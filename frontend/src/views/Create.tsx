// src/views/Create.tsx
// Refactored version - Requirements: 1.1, 1.2, 1.3, 2.1-2.7, 3.1, 4.1, 6.1, 7.1, 8.1-8.4, 9.3

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import Lightbox from '../components/Lightbox';
import PromptBar from '../components/PromptBar';
import { PageHeader } from '../components/common';
import { QuotaErrorHandler } from '../components/feedback';
import { AlertDialog } from '../components/ui/alert-dialog';
import type { GenerationHistory, GenerationTask, GenerateMultiResponse, GenerateResponse } from '../type';
import { GenerationType } from '../type';
import { api } from '../api';
import { loadImageAsFile } from '../utils';
import { useToast } from '../context/ToastContext';
import { useGlobalTask } from '../context/GlobalTaskContext';
import { getErrorMessage } from '../utils/errorHandler';
import { useTaskRecovery } from '../hooks/useTaskRecovery';

// Import unified types - Requirements: 1.1, 1.2
import { createBatchResult, type BatchResult } from '../type/generation';

// Import extracted hooks - Requirements: 3.1, 4.1, 6.1, 7.1
import { useGroupedHistory, type FailedGeneration, type PendingTask } from '../hooks/useGroupedHistory';
import { usePromptPopulation } from '../hooks/usePromptPopulation';
import { useSSEGeneration } from '../hooks/useSSEGeneration';
import { useDeleteConfirmation } from '../hooks/useDeleteConfirmation';

// Import history components - Requirements: 2.1-2.7
import {
  HistorySingleItem,
  HistoryBatchItem,
  HistoryFailedItem,
  HistorySessionBatch,
  HistoryPendingItem,
  HistoryStreamingItem,
  HistoryRecoveringItem,
} from '../components/history';

export default function Create() {
  const toast = useToast();
  const { getFailedTask, clearFailedTask, getCompletedTask, clearCompletedTask } = useGlobalTask();
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  
  // 多任务占位卡片状态
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [failedGenerations, setFailedGenerations] = useState<FailedGeneration[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState('');

  // 多图生成状态
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_SIZE = 20; // 创作空间只显示最近 20 条记录
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  /**
   * 统一的 PendingTask 清理函数
   * Requirements: 3.1
   */
  const removePendingTask = useCallback((identifier: { tempId?: string; taskId?: string; batchId?: string }): void => {
    const { tempId, taskId, batchId } = identifier;
    
    setPendingTasks(prev => {
      if (tempId) {
        return prev.filter(p => p.id !== tempId);
      }
      if (taskId) {
        return prev.filter(p => p.taskId !== taskId);
      }
      if (batchId) {
        return prev.filter(p => p.batchId !== batchId);
      }
      return prev;
    });
  }, []);

  /**
   * 更新 PendingTask 的 batchId
   */
  const updatePendingTaskBatchId = useCallback((tempId: string, batchId: string) => {
    setPendingTasks(prev => prev.map(p => 
      p.id === tempId ? { ...p, batchId } : p
    ));
  }, []);

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    try {
      const response = await api.getHistory(1, PAGE_SIZE);
      if (response.ok) {
        const data: GenerationHistory[] = await response.json();
        const filteredData = data.filter(
          (item) => !item.type || item.type === GenerationType.CREATE
        );
        setHistory(filteredData);
        setCurrentPage(1);
        setHasMore(data.length >= PAGE_SIZE);
        // 只清空成功的批次，保留失败的批次（失败的不会保存到历史记录）
        setBatchResults(prev => prev.filter(batch => batch.status === 'failed'));
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  }, []);

  // 检测不完整批次并自动刷新
  // 当历史记录中有批次图片数量少于 batch_total 时，说明批次还在生成中
  // 只对最近 15 分钟内的批次进行轮询，超时的批次不再轮询
  useEffect(() => {
    const BATCH_TIMEOUT_MS = 15 * 60 * 1000; // 15 分钟
    const now = Date.now();
    
    // 检查是否有不完整且未超时的批次
    const hasIncompleteBatch = history.some(item => {
      if (!item.batch_id || !item.batch_total || item.batch_total <= 1) return false;
      
      // 检查批次是否已超时
      const batchCreatedAt = new Date(item.created_at).getTime();
      if (now - batchCreatedAt > BATCH_TIMEOUT_MS) return false; // 超时的批次不轮询
      
      // 统计该批次已有的图片数量
      const batchCount = history.filter(h => h.batch_id === item.batch_id).length;
      return batchCount < item.batch_total;
    });

    if (!hasIncompleteBatch) return;

    // 有不完整且未超时的批次，启动轮询
    const pollInterval = setInterval(() => {
      loadHistory();
    }, 3000); // 每 3 秒检查一次

    return () => clearInterval(pollInterval);
  }, [history, loadHistory]);

  // 加载更多历史记录
  const loadMoreHistory = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    const container = scrollContainerRef.current;
    const prevScrollTop = container?.scrollTop || 0;
    const prevScrollHeight = container?.scrollHeight || 0;
    
    if (container) {
      container.style.scrollBehavior = 'auto';
    }
    
    try {
      const nextPage = currentPage + 1;
      const response = await api.getHistory(nextPage, PAGE_SIZE);
      if (response.ok) {
        const data: GenerationHistory[] = await response.json();
        const filteredData = data.filter(
          (item) => !item.type || item.type === GenerationType.CREATE
        );
        
        if (filteredData.length > 0) {
          setHistory(prev => [...prev, ...filteredData]);
          setCurrentPage(nextPage);
        }
        setHasMore(data.length >= PAGE_SIZE);
      }
    } catch (error) {
      console.error('加载更多历史记录失败:', error);
    } finally {
      setIsLoadingMore(false);
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          const heightDiff = newScrollHeight - prevScrollHeight;
          container.scrollTop = prevScrollTop + heightDiff;
          setTimeout(() => {
            if (container) {
              container.style.scrollBehavior = '';
            }
          }, 100);
        }
      });
    }
  }, [currentPage, hasMore, isLoadingMore]);

  // Task recovery callbacks
  const handleTaskComplete = useCallback((task: GenerationTask) => {
    console.log('[Create] Task completed:', task.task_id);
    removePendingTask({ taskId: task.task_id });
    setIsGenerating(false);
    setCurrentTaskId(null);
    // 只清空成功的批次，保留失败的批次
    setBatchResults(prev => prev.filter(batch => batch.status === 'failed'));
    loadHistory();
    setCounterRefresh(prev => prev + 1);
  }, [loadHistory, removePendingTask]);

  const handleTaskFailed = useCallback((task: GenerationTask) => {
    console.log('[Create] Task failed:', task.task_id, task.error_msg);
    removePendingTask({ taskId: task.task_id });
    setIsGenerating(false);
    setCurrentTaskId(null);
    
    const { message, isQuotaError } = getErrorMessage(task.error_msg);
    const taskImageCount = task.image_count || 1;
    
    if (taskImageCount > 1) {
      const failedBatch = createBatchResult({
        batchId: 'failed-task-' + task.task_id,
        prompt: task.prompt || '未知提示词',
        imageCount: taskImageCount,
        images: [{ error: message }],
        status: 'failed',
      });
      setBatchResults(prev => [...prev, failedBatch]);
    } else {
      const failedRecord: FailedGeneration = {
        id: 'failed-task-' + task.task_id,
        prompt: task.prompt || '未知提示词',
        errorMessage: message,
        timestamp: Date.now(),
      };
      setFailedGenerations(prev => [...prev, failedRecord]);
    }
    
    if (isQuotaError) {
      setShowQuotaError(true);
    }
  }, [removePendingTask]);

  // Use task recovery hook
  const { processingTasks, isRecovering } = useTaskRecovery({
    type: GenerationType.CREATE,
    onTaskComplete: handleTaskComplete,
    onTaskFailed: handleTaskFailed,
  });

  // 监听 GlobalTaskContext 中的完成和失败任务
  // 修复：双向检查 - 既检查 pendingTask 是否完成，也检查完成的任务是否有对应的 pendingTask
  useEffect(() => {
    const checkInterval = setInterval(() => {
      if (pendingTasks.length === 0) return;
      
      console.log('[Create] Checking', pendingTasks.length, 'pending tasks for completion');
      
      // 方向1：检查所有 pendingTasks 是否完成或失败
      pendingTasks.forEach(pending => {
        if (!pending.taskId) {
          console.log('[Create] Pending task', pending.id, 'has no taskId yet');
          return; // 跳过还没有 taskId 的任务
        }
        
        // 检查完成的任务
        const completedTask = getCompletedTask(pending.taskId);
        if (completedTask) {
          console.log('[Create] Detected completed task from GlobalTaskContext:', pending.taskId);
          handleTaskComplete(completedTask);
          clearCompletedTask(pending.taskId);
          return;
        }
        
        // 检查失败的任务
        const failedTask = getFailedTask(pending.taskId);
        if (failedTask) {
          console.log('[Create] Detected failed task from GlobalTaskContext:', pending.taskId);
          handleTaskFailed(failedTask);
          clearFailedTask(pending.taskId);
        }
      });
    }, 500);
    
    return () => clearInterval(checkInterval);
  }, [pendingTasks, getCompletedTask, clearCompletedTask, getFailedTask, clearFailedTask, handleTaskComplete, handleTaskFailed]);

  // Use usePromptPopulation hook - Requirements: 4.1
  const {
    selectedPrompt,
    selectedFiles,
    selectedImageCount,
    promptUpdateKey,
    triggerGenerate,
    setSelectedPrompt,
    setSelectedFiles,
    setSelectedImageCount,
    setTriggerGenerate,
    populatePromptBar,
    handleRegenerate,
    handleEditPrompt,
    handleRegenerateBatchWithRef,
    handleEditBatchPromptWithRef,
  } = usePromptPopulation(toast, scrollToBottom);

  // Use useSSEGeneration hook - Requirements: 6.1
  const {
    streamingBatch,
    handleSSEStart,
    handleSSEImage,
    handleSSEComplete,
    handleSSEError,
  } = useSSEGeneration({
    onBatchComplete: (batch) => {
      console.log('[Create] onBatchComplete 被调用，添加批次到 batchResults:', batch);
      setBatchResults(prev => [...prev, batch]);
    },
    loadHistory,
    updatePendingTaskBatchId,
    removePendingTask,
    onGenerationComplete: () => {
      console.log('[Create] onGenerationComplete 被调用');
      setIsGenerating(false);
      setCounterRefresh(prev => prev + 1);
      setSelectedFiles([]);
    },
    onQuotaError: () => setShowQuotaError(true),
  });

  // 监控 streamingBatch 状态变化
  useEffect(() => {
    console.log('[Create] streamingBatch 状态变化:', streamingBatch ? `存在 (batchId: ${streamingBatch.batchId})` : 'null');
  }, [streamingBatch]);

  // Use useDeleteConfirmation hook - Requirements: 7.1
  const {
    deleteTarget,
    isDeleting,
    handleDeleteSingleClick,
    handleDeleteBatchClick,
    handleDeleteFailedRecord,
    handleDeleteSessionBatch,
    handleDeleteConfirm,
    closeDeleteDialog,
  } = useDeleteConfirmation({
    loadHistory,
    setFailedGenerations,
    setBatchResults,
    toast,
  });

  // Use useGroupedHistory hook - Requirements: 3.1
  const chatHistory = useGroupedHistory({
    history,
    failedGenerations,
    batchResults,
    processingTasks,
    pendingTasks,
    streamingBatch,
  });

  // 计算任务运行状态
  const isTaskRunning = isGenerating || !!currentTaskId || processingTasks.length > 0 || !!streamingBatch;

  useEffect(() => {
    loadHistory();
  }, []);

  // 首次加载时跳到底部
  const initialHistoryLoadedRef = useRef(false);
  
  useEffect(() => {
    if (history.length > 0 && !initialHistoryLoadedRef.current) {
      initialHistoryLoadedRef.current = true;
      
      const jumpToBottom = () => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.style.scrollBehavior = 'auto';
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      };

      requestAnimationFrame(() => {
        jumpToBottom();
        setTimeout(() => jumpToBottom(), 100);
        setTimeout(() => {
          jumpToBottom();
          if (scrollContainerRef.current) {
            scrollContainerRef.current.style.scrollBehavior = '';
          }
          isInitialLoadRef.current = false;
        }, 300);
      });
    }
  }, [history.length]);

  // 统一滚动控制逻辑
  const prevBatchResultsLengthRef = useRef(batchResults.length);
  const prevFailedGenerationsLengthRef = useRef(failedGenerations.length);
  const prevPendingTasksLengthRef = useRef(pendingTasks.length);
  const prevStreamingBatchRef = useRef<BatchResult | null>(streamingBatch);
  
  useEffect(() => {
    if (isInitialLoadRef.current) {
      prevBatchResultsLengthRef.current = batchResults.length;
      prevFailedGenerationsLengthRef.current = failedGenerations.length;
      prevPendingTasksLengthRef.current = pendingTasks.length;
      prevStreamingBatchRef.current = streamingBatch;
      return;
    }
    
    const hasBatchResultsAdded = batchResults.length > prevBatchResultsLengthRef.current;
    const hasFailedGenerationsAdded = failedGenerations.length > prevFailedGenerationsLengthRef.current;
    const hasPendingTasksAdded = pendingTasks.length > prevPendingTasksLengthRef.current;
    const hasStreamingBatchStarted = !prevStreamingBatchRef.current && streamingBatch !== null;
    
    prevBatchResultsLengthRef.current = batchResults.length;
    prevFailedGenerationsLengthRef.current = failedGenerations.length;
    prevPendingTasksLengthRef.current = pendingTasks.length;
    prevStreamingBatchRef.current = streamingBatch;
    
    if (hasBatchResultsAdded || hasFailedGenerationsAdded || hasPendingTasksAdded || hasStreamingBatchStarted) {
      setTimeout(scrollToBottom, 100);
    }
  }, [batchResults.length, failedGenerations.length, pendingTasks.length, streamingBatch, scrollToBottom]);

  // 处理单图生成完成
  const handleGenerate = async (response: GenerateResponse, tempId?: string) => {
    if (tempId) {
      removePendingTask({ tempId });
    }
    
    setIsGenerating(false);
    setCurrentTaskId(null);
    
    if (response.image_url) {
      const singleResult = createBatchResult({
        batchId: 'single-' + Date.now(),
        prompt: response.text || currentPrompt || '未知提示词',
        imageCount: 1,
        images: [{ url: response.image_url }],
        status: 'completed',
      });
      setBatchResults(prev => [...prev, singleResult]);
    }
    
    await loadHistory();
    setCounterRefresh(prev => prev + 1);
    setSelectedFiles([]);
  };

  // 处理多图生成响应
  const handleGenerateMulti = async (response: GenerateMultiResponse, tempId?: string) => {
    if (tempId) {
      removePendingTask({ tempId });
    }
    
    setIsGenerating(false);
    setCurrentTaskId(null);
    
    const batchResult = createBatchResult({
      batchId: response.batch_id,
      prompt: response.prompt,
      imageCount: response.images.length,
      images: response.images.map((img) => ({
        url: img.image_url,
        error: img.error ? getErrorMessage(img.error).message : undefined,
      })),
      status: 'completed',
    });
    
    setBatchResults(prev => [...prev, batchResult]);
    setCounterRefresh(prev => prev + 1);
    setSelectedFiles([]);
    await loadHistory();
  };

  // 处理生成开始
  const handleGenerateStart = (prompt?: string, imageCount?: number): string => {
    const timestamp = Date.now();
    const tempId = 'pending-' + timestamp + '-' + Math.random().toString(36).substring(2, 9);
    const newTask: PendingTask = {
      id: tempId,
      prompt: prompt || '正在思考...',
      imageCount: imageCount || 1,
      timestamp: timestamp,
    };
    
    setPendingTasks(prev => [...prev, newTask]);
    setIsGenerating(true);
    if (prompt) setCurrentPrompt(prompt);
    
    return tempId;
  };

  // 处理生成错误
  const handleGenerateError = (error: string, prompt?: string, imageCount?: number, tempId?: string) => {
    console.log('[Create] handleGenerateError called:', { error, prompt, imageCount, tempId });
    const count = imageCount || selectedImageCount;
    console.log('[Create] Resolved count:', count, 'selectedImageCount:', selectedImageCount);
    
    const { message, isQuotaError } = getErrorMessage(error);
    console.log('[Create] Parsed error:', { message, isQuotaError });
    
    // 如果是多图生成且有 streamingBatch，使用 handleSSEError 保留已成功的图片
    if (count > 1 && streamingBatch) {
      console.log('[Create] Using handleSSEError for multi-image with streamingBatch');
      // 先移除 pendingTask
      if (tempId) {
        removePendingTask({ tempId });
      }
      handleSSEError(message);
    } else {
      // 单图或没有 streamingBatch 的情况
      console.log('[Create] Creating failed batch/record, streamingBatch:', !!streamingBatch);
      setIsGenerating(false);
      setCurrentTaskId(null);
      
      if (count > 1) {
        // 多图生成失败：创建失败批次
        const failedBatch = createBatchResult({
          batchId: 'failed-batch-' + Date.now(),
          prompt: prompt || currentPrompt || '未知提示词',
          imageCount: count,
          images: [{ error: message }],
          status: 'failed',
        });
        console.log('[Create] Created failedBatch:', failedBatch);
        // 先添加失败批次，再移除 pendingTask，确保 UI 不会闪烁
        setBatchResults(prev => {
          console.log('[Create] Adding failedBatch to batchResults, prev length:', prev.length);
          return [...prev, failedBatch];
        });
        // 移除 pendingTask 放在添加 failedBatch 之后
        if (tempId) {
          removePendingTask({ tempId });
        }
      } else {
        // 单图生成失败：创建失败记录
        const failedRecord: FailedGeneration = {
          id: 'failed-' + Date.now(),
          prompt: prompt || currentPrompt || '未知提示词',
          errorMessage: message,
          timestamp: Date.now(),
        };
        console.log('[Create] Created failedRecord:', failedRecord);
        // 先添加失败记录，再移除 pendingTask
        setFailedGenerations(prev => {
          console.log('[Create] Adding failedRecord to failedGenerations, prev length:', prev.length);
          return [...prev, failedRecord];
        });
        // 移除 pendingTask 放在添加 failedRecord 之后
        if (tempId) {
          removePendingTask({ tempId });
        }
      }
    }
    
    // 如果是额度不足错误，显示弹窗
    if (isQuotaError) {
      setShowQuotaError(true);
    }
  };

  // 监听滚动
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollButton(distanceFromBottom > 200);
      
      if (scrollTop < 100 && hasMore && !isLoadingMore && !isInitialLoadRef.current) {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          loadMoreHistory();
        }, 100);
      }
    };

    const initTimeout = setTimeout(handleScroll, 500);

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      clearTimeout(initTimeout);
    };
  }, [hasMore, isLoadingMore, loadMoreHistory]);

  // 引用图片
  const handleUseAsReference = async (imageUrl: string) => {
    try {
      const file = await loadImageAsFile(imageUrl);
      if (file) {
        // Note: setSelectedFiles from usePromptPopulation accepts File[] directly
        // We need to append to existing files
        const newFiles = [...selectedFiles, file];
        setSelectedFiles(newFiles);
        setTimeout(() => scrollToBottom(), 100);
      } else {
        toast.error('加载图片失败，请稍后重试');
      }
    } catch (error) {
      console.error('引用图片失败:', error);
      toast.error('引用图片失败，请稍后重试');
    }
  };

  // 重试失败的生成（用于 HistorySingleItem）
  const handleRetry = useCallback(async (prompt: string) => {
    console.log('[Create] handleRetry 被调用，prompt:', prompt);
    await populatePromptBar({
      prompt,
      imageCount: 1,
      autoTrigger: true,
    });
  }, [populatePromptBar]);

  // 编辑失败记录的提示词
  const handleEditFailedPrompt = useCallback(async (prompt: string) => {
    console.log('[Create] handleEditFailedPrompt 被调用，prompt:', prompt);
    await populatePromptBar({
      prompt,
      imageCount: 1,
      autoTrigger: false,
    });
  }, [populatePromptBar]);

  // 重新生成失败记录
  const handleRegenerateFailedPrompt = useCallback(async (prompt: string) => {
    console.log('[Create] handleRegenerateFailedPrompt 被调用，prompt:', prompt);
    await populatePromptBar({
      prompt,
      imageCount: 1,
      autoTrigger: true,
    });
  }, [populatePromptBar]);

  // 批次重新生成（用于 HistoryBatchItem）
  const handleBatchRegenerate = useCallback(async (prompt: string, refImages?: string | string[], imageCount?: number) => {
    await populatePromptBar({
      prompt,
      refImages,
      imageCount: imageCount || 1,
      autoTrigger: true,
    });
  }, [populatePromptBar]);

  // 批次编辑提示词（用于 HistoryBatchItem）
  const handleBatchEditPrompt = useCallback(async (prompt: string, refImages?: string | string[], imageCount?: number) => {
    await populatePromptBar({
      prompt,
      refImages,
      imageCount: imageCount || 1,
      autoTrigger: false,
    });
  }, [populatePromptBar]);

  return (
    <>
      <PageHeader
        title="AI 创意工坊"
        statusColor="green"
        showCounter
        counterRefresh={counterRefresh}
      />

      <div
        className="flex-1 overflow-y-auto bg-[#fafafa] scroll-smooth"
        ref={scrollContainerRef}
      >
        <div className="max-w-3xl mx-auto px-4 py-8 pb-32 min-h-full flex flex-col justify-end">
          
          {/* 空状态提示 */}
          {history.length === 0 && batchResults.length === 0 && failedGenerations.length === 0 && pendingTasks.length === 0 && !isRecovering && processingTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center text-gray-400 py-20 fade-in-up">
              <div className="w-20 h-20 bg-linear-to-br from-red-50 to-orange-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <div className="w-8 h-8 bg-red-400/20 rounded-full blur-xl absolute"></div>
                <span className="text-3xl">🎨</span>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">开始你的创作</h3>
              <p className="text-sm text-gray-400 text-center">
                在下方输入框描述画面，支持中英文提示词
              </p>
            </div>
          )}
          
          {/* 恢复中状态提示 */}
          {isRecovering && (
            <div className="flex flex-col items-center justify-center text-gray-400 py-20 fade-in-up">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-gray-500">正在恢复任务状态...</p>
            </div>
          )}

          {/* 加载更多指示器 */}
          {isLoadingMore && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin"></div>
                <span className="text-sm">加载更多...</span>
              </div>
            </div>
          )}
          
          {/* 没有更多数据提示 */}
          {!hasMore && history.length > 0 && (
            <div className="flex justify-center py-4">
              <span className="text-xs text-gray-300">已加载全部历史记录</span>
            </div>
          )}

          {/* 历史消息流 - 使用提取的组件 Requirements: 2.1-2.7 */}
          <div className="space-y-8" ref={topSentinelRef}>
          {chatHistory.map((displayItem, index) => {
            // 单图记录 - Requirements: 2.1
            if (displayItem.type === 'single' && displayItem.item) {
              return (
                <HistorySingleItem
                  key={displayItem.item.id || `history-${index}`}
                  item={displayItem.item}
                  index={index}
                  onImageClick={setLightboxImage}
                  onRegenerate={handleRegenerate}
                  onEditPrompt={handleEditPrompt}
                  onUseAsReference={handleUseAsReference}
                  onDelete={handleDeleteSingleClick}
                  onRetry={handleRetry}
                />
              );
            }
            
            // 多图批次记录 - Requirements: 2.2
            if (displayItem.type === 'batch' && displayItem.items) {
              return (
                <HistoryBatchItem
                  key={displayItem.batchId || `batch-${index}`}
                  displayItem={displayItem}
                  index={index}
                  onImageClick={setLightboxImage}
                  onRegenerate={handleBatchRegenerate}
                  onEditPrompt={handleBatchEditPrompt}
                  onUseAsReference={handleUseAsReference}
                  onDelete={handleDeleteBatchClick}
                />
              );
            }
            
            // 当前会话的失败记录 - Requirements: 2.3
            if (displayItem.type === 'failed' && displayItem.failedRecord) {
              return (
                <HistoryFailedItem
                  key={displayItem.failedRecord.id}
                  failedRecord={displayItem.failedRecord}
                  onEditPrompt={handleEditFailedPrompt}
                  onRegenerate={handleRegenerateFailedPrompt}
                  onDelete={handleDeleteFailedRecord}
                />
              );
            }
            
            // 当前会话的批次结果 - Requirements: 2.4
            if (displayItem.type === 'session-batch' && displayItem.sessionBatch) {
              return (
                <HistorySessionBatch
                  key={displayItem.sessionBatch.batchId}
                  batch={displayItem.sessionBatch}
                  onImageClick={setLightboxImage}
                  onUseAsReference={handleUseAsReference}
                  onEditPrompt={handleEditBatchPromptWithRef}
                  onRegenerate={handleRegenerateBatchWithRef}
                  onDelete={handleDeleteSessionBatch}
                />
              );
            }
            
            // 恢复的处理中任务 - Requirements: 2.7
            if (displayItem.type === 'recovering' && displayItem.recoveringTask) {
              return (
                <HistoryRecoveringItem
                  key={`recovering-${displayItem.recoveringTask.task_id}`}
                  task={displayItem.recoveringTask}
                />
              );
            }
            
            // 当前会话的待处理任务 - Requirements: 2.5
            if (displayItem.type === 'pending' && displayItem.pendingTask) {
              return (
                <HistoryPendingItem
                  key={displayItem.pendingTask.id}
                  task={displayItem.pendingTask}
                />
              );
            }
            
            // SSE 流式生成中 - Requirements: 2.6
            if (displayItem.type === 'streaming' && displayItem.sessionBatch) {
              return (
                <HistoryStreamingItem
                  key={`streaming-${displayItem.sessionBatch.batchId}`}
                  batch={displayItem.sessionBatch}
                  onImageClick={setLightboxImage}
                  onUseAsReference={handleUseAsReference}
                />
              );
            }
            
            return null;
          })}
            
            {/* 滚动锚点 */}
            <div ref={bottomRef} className="h-4" />
          </div>
        </div>
      </div>

      <PromptBar
        onGenerate={handleGenerate}
        onGenerateMulti={handleGenerateMulti}
        onGenerateStart={handleGenerateStart}
        onError={handleGenerateError}
        initialPrompt={selectedPrompt}
        initialFiles={selectedFiles}
        initialImageCount={selectedImageCount}
        onFilesChange={setSelectedFiles} 
        onPreviewImage={setLightboxImage}
        triggerGenerate={triggerGenerate}
        onTriggered={() => {
          setTriggerGenerate(false);
          setSelectedPrompt('');
          setSelectedFiles([]);
          setSelectedImageCount(1);
        }}
        onSSEStart={handleSSEStart}
        onSSEImage={handleSSEImage}
        onSSEComplete={handleSSEComplete}
        isTaskRunning={isTaskRunning}
        onTaskCreated={(taskId, tempId) => {
          console.log('[Create] Task created:', taskId, 'tempId:', tempId);
          setCurrentTaskId(taskId);
          if (tempId) {
            setPendingTasks(prev => prev.map(p => 
              p.id === tempId ? { ...p, taskId } : p
            ));
          }
          
          // 立即检查任务是否已经完成（处理快速完成的情况）
          setTimeout(() => {
            const completedTask = getCompletedTask(taskId);
            if (completedTask) {
              console.log('[Create] Task already completed when created:', taskId);
              handleTaskComplete(completedTask);
              clearCompletedTask(taskId);
              return;
            }
            
            const failedTask = getFailedTask(taskId);
            if (failedTask) {
              console.log('[Create] Task already failed when created:', taskId);
              handleTaskFailed(failedTask);
              clearFailedTask(taskId);
            }
          }, 100); // 短暂延迟确保 pendingTask 已更新
        }}
        promptVersion={promptUpdateKey}
      />

      {/* 回到底部按钮 */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="fixed top-20 right-6 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-500 hover:text-red-600 hover:shadow-xl transition-all z-50 border border-gray-200 hover:scale-105"
          title="回到底部"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />
      
      {/* 配额错误处理 */}
      <QuotaErrorHandler
        showQuotaError={showQuotaError}
        showContact={showContact}
        onQuotaErrorClose={() => setShowQuotaError(false)}
        onContactClose={() => setShowContact(false)}
        onContactSales={() => {
          setShowQuotaError(false);
          setShowContact(true);
        }}
      />
      
      {/* 删除确认对话框 - Requirements: 9.3 使用 AlertDialog 替换 DeleteConfirmDialog */}
      <AlertDialog
        isOpen={!!deleteTarget}
        onClose={closeDeleteDialog}
        onConfirm={handleDeleteConfirm}
        title="确认删除"
        description={deleteTarget?.message || '确定要删除这条记录吗？'}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        isLoading={isDeleting}
      />
    </>
  );
}
