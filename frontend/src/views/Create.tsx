// src/views/Create.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, RotateCw, Pencil } from 'lucide-react';
import Lightbox from '../components/Lightbox';
import ImageCard from '../components/ImageCard';
import ImageGrid from '../components/ImageGrid';
import PlaceholderCard from '../components/PlaceholderCard';
import ErrorCard from '../components/ErrorCard';
import PromptBar from '../components/PromptBar';
import { PageHeader, QuotaErrorHandler } from '../components/common';
import type { GenerationHistory, GenerationTask, ImageGridItem, GenerateMultiResponse, GenerateResponse } from '../type';
import { GenerationType } from '../type';
import type { SSEStartEvent, SSEImageEvent, SSECompleteEvent } from '../api';
import { api } from '../api';
import { loadImageAsFile } from '../utils';
import { useToast } from '../context/ToastContext';
import { useGlobalTask } from '../context/GlobalTaskContext';
import { getErrorMessage } from '../utils/errorHandler';
import { useTaskRecovery } from '../hooks/useTaskRecovery';

// 失败记录类型
interface FailedGeneration {
  id: string;
  prompt: string;
  errorMessage: string;
  timestamp: number;
}

// 批次结果类型 (Requirements: 5.1, 5.2, 5.3)
interface BatchResult {
  batchId: string;
  images: ImageGridItem[];
  prompt: string;
  timestamp: number;
  imageCount: number; // 记录请求的图片数量
}

export default function Create() {
  const toast = useToast();
  const { isTaskPolling, getCompletedTask, clearCompletedTask, getFailedTask, clearFailedTask } = useGlobalTask();
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null); // 当前异步任务 ID
  
  // PromptBar state lifting for repopulation
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [promptUpdateKey, setPromptUpdateKey] = useState(0); // 用于强制更新 PromptBar 的 key
  const [triggerGenerate, setTriggerGenerate] = useState(false);
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [failedGenerations, setFailedGenerations] = useState<FailedGeneration[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState(''); // 记录当前正在生成的提示词
  
  // 多图生成状态 (Requirements: 5.1, 5.2, 5.3)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [currentImageCount, setCurrentImageCount] = useState<number>(1); // 当前生成的图片数量
  
  // SSE 流式生成状态
  const [streamingBatch, setStreamingBatch] = useState<BatchResult | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 计算任务运行状态（用于禁用重新生成按钮）
  // 注意：processingTasks 在 useTaskRecovery 之后才可用，这里先定义为 false，后面会更新
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true); // 标记是否为首次加载

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.getHistory();
      if (response.ok) {
        const data: GenerationHistory[] = await response.json();
        // 过滤掉白底图和换装的历史记录，只显示创作空间的
        const filteredData = data.filter(
          (item) => !item.type || item.type === GenerationType.CREATE
        );
        setHistory(filteredData);
        
        // 清空 batchResults，因为历史记录已经包含了所有数据
        // 避免重复显示
        setBatchResults([]);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  }, []);

  // Task recovery callbacks
  const handleTaskComplete = useCallback((task: GenerationTask) => {
    console.log('[Create] Task completed:', task.task_id);
    // Reload history to show the completed task
    loadHistory();
    // Refresh generation counter
    setCounterRefresh(prev => prev + 1);
    toast.success('图片生成完成');
  }, [loadHistory, toast]);

  const handleTaskFailed = useCallback((task: GenerationTask) => {
    console.log('[Create] Task failed:', task.task_id, task.error_msg);
    const { message, isQuotaError } = getErrorMessage(task.error_msg);
    const taskImageCount = task.image_count || 1;
    
    // 添加失败记录到列表，显示 ErrorCard 让用户重试
    if (taskImageCount > 1) {
      // 多图生成失败
      const failedBatch: BatchResult = {
        batchId: 'failed-task-' + task.task_id,
        images: Array.from({ length: taskImageCount }, (_, index) => ({
          error: message,
          isLoading: false,
          index,
        })),
        prompt: task.prompt || '未知提示词',
        timestamp: Date.now(),
        imageCount: taskImageCount,
      };
      setBatchResults(prev => [...prev, failedBatch]);
    } else {
      // 单图失败：添加失败记录到列表
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
    // 不再显示 toast，改为显示 ErrorCard
  }, []);

  // Use task recovery hook to restore in-progress tasks after page refresh
  // Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4
  const { processingTasks, isRecovering } = useTaskRecovery({
    type: GenerationType.CREATE,
    onTaskComplete: handleTaskComplete,
    onTaskFailed: handleTaskFailed,
  });

  // 计算任务运行状态（用于禁用重新生成按钮和发送按钮）
  const isTaskRunning = isGenerating || !!currentTaskId || processingTasks.length > 0 || !!streamingBatch;

  // 处理重新生成时检查任务状态
  const handleRegenerateWithCheck = useCallback((callback: () => void) => {
    if (isTaskRunning) {
      toast.warning('请等待当前任务完成后再操作');
      return;
    }
    callback();
  }, [isTaskRunning, toast]);

  // 监听当前任务完成（通过 GlobalTaskContext 轮询）
  useEffect(() => {
    if (!currentTaskId) {
      console.log('[Create] No currentTaskId, skipping task monitoring');
      return;
    }
    
    console.log('[Create] Starting task monitoring for:', currentTaskId);
    
    const checkInterval = setInterval(() => {
      const polling = isTaskPolling(currentTaskId);
      const completedTask = getCompletedTask(currentTaskId);
      const failedTask = getFailedTask(currentTaskId);
      
      console.log('[Create] Task check:', {
        taskId: currentTaskId,
        isPolling: polling,
        hasCompleted: !!completedTask,
        hasFailed: !!failedTask,
      });
      
      // 优先检查是否有完成或失败的任务结果
      if (completedTask) {
        console.log('[Create] Task completed via GlobalTaskContext:', completedTask.task_id);
        // 先清理任务，再更新状态
        clearCompletedTask(currentTaskId);
        setIsGenerating(false);
        setGeneratingId(null);
        setCurrentTaskId(null);
        // 重新加载历史记录
        loadHistory();
        // 刷新计数器
        setCounterRefresh(prev => prev + 1);
        return;
      }
      
      if (failedTask) {
        console.log('[Create] Task failed via GlobalTaskContext:', failedTask.task_id);
        // 先清理任务
        clearFailedTask(currentTaskId);
        setIsGenerating(false);
        setGeneratingId(null);
        setCurrentTaskId(null);
        
        // 添加失败记录到列表，显示 ErrorCard
        const { message, isQuotaError } = getErrorMessage(failedTask.error_msg);
        const taskImageCount = failedTask.image_count || 1;
        
        if (taskImageCount > 1) {
          const failedBatch: BatchResult = {
            batchId: 'failed-task-' + failedTask.task_id,
            images: Array.from({ length: taskImageCount }, (_, index) => ({
              error: message,
              isLoading: false,
              index,
            })),
            prompt: failedTask.prompt || currentPrompt || '未知提示词',
            timestamp: Date.now(),
            imageCount: taskImageCount,
          };
          setBatchResults(prev => [...prev, failedBatch]);
        } else {
          const failedRecord: FailedGeneration = {
            id: 'failed-task-' + failedTask.task_id,
            prompt: failedTask.prompt || currentPrompt || '未知提示词',
            errorMessage: message,
            timestamp: Date.now(),
          };
          setFailedGenerations(prev => [...prev, failedRecord]);
        }
        
        if (isQuotaError) {
          setShowQuotaError(true);
        }
        return;
      }
      
      // 如果任务不在轮询中，也没有完成/失败结果，可能是未知状态
      if (!polling) {
        console.log('[Create] Task not polling and no result, waiting...', currentTaskId);
        // 给一点时间让 GlobalTaskContext 处理完成
        // 不立即重置，等待下一次检查
      }
    }, 500);
    
    return () => {
      console.log('[Create] Stopping task monitoring for:', currentTaskId);
      clearInterval(checkInterval);
    };
  }, [currentTaskId, isTaskPolling, getCompletedTask, clearCompletedTask, getFailedTask, clearFailedTask, loadHistory, currentPrompt]);

  useEffect(() => {
    loadHistory();
  }, []);

  // 核心滚动逻辑：首次加载直接跳到底部，后续更新平滑滚动
  useEffect(() => {
    if (history.length > 0) {
      // 首次加载时直接跳到底部（instant），避免长时间滚动
      if (isInitialLoadRef.current) {
        
        // 定义强制跳转底部的函数
        const jumpToBottom = () => {
            if (scrollContainerRef.current) {
                // 1. 临时覆盖 CSS 的 scroll-smooth，强制变为 auto 以实现瞬间跳转
                scrollContainerRef.current.style.scrollBehavior = 'auto';
                // 2. 设置滚动位置
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            }
        };

        // 策略：分阶段多次执行，确保在 DOM 渲染和图片初步布局后都能滚动到底部
        
        // 第一次：React 渲染循环结束后立即执行
        requestAnimationFrame(() => {
            jumpToBottom();
            
            // 第二次：给一点时间让 DOM 布局稳定 (100ms)
            setTimeout(() => {
                jumpToBottom();
            }, 100);

            // 第三次：给更多时间等待部分图片占位 (300ms)
            // 并在结束后恢复平滑滚动，关闭初始加载标记
            setTimeout(() => {
                jumpToBottom();
                
                // 恢复 CSS 定义的平滑滚动
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.style.scrollBehavior = '';
                }
                isInitialLoadRef.current = false;
            }, 300);
        });

      } else {
        // 后续更新使用平滑滚动
        scrollToBottom();
      }
    }
  }, [history.length]);

  // 生成状态改变时也滚动到底部
  useEffect(() => {
    if (!isInitialLoadRef.current) {
      scrollToBottom();
    }
  }, [isGenerating]);

  // 处理单图生成完成 (向后兼容)
  // 注意：在 Mock 模式下，需要传入 response 来显示结果
  const handleGenerate = async (response: GenerateResponse) => {
    setIsGenerating(false);
    setGeneratingId(null);
    setCurrentTaskId(null); // 重置任务 ID
    
    // Mock 模式下，将单图结果也添加到 batchResults 中显示
    if (response.image_url) {
      const singleResult: BatchResult = {
        batchId: 'single-' + Date.now(),
        images: [{
          url: response.image_url,
          isLoading: false,
          index: 0,
        }],
        prompt: response.text || currentPrompt || '未知提示词',
        timestamp: Date.now(),
        imageCount: 1,
      };
      setBatchResults(prev => [...prev, singleResult]);
    }
    
    await loadHistory();
    
    // 刷新生成计数器
    setCounterRefresh(prev => prev + 1);
    
    // 修复点：生成成功后，清空父组件选中的文件，防止下次引用时带入旧图
    setSelectedFiles([]); 

    // 强制滚动到底部
    setTimeout(scrollToBottom, 100);
  };

  // 处理多图生成响应 (Requirements: 5.2)
  const handleGenerateMulti = async (response: GenerateMultiResponse) => {
    setIsGenerating(false);
    setGeneratingId(null);
    setCurrentTaskId(null); // 重置任务 ID
    
    // 将多图响应转换为 BatchResult
    const batchResult: BatchResult = {
      batchId: response.batch_id,
      images: response.images.map((img, index) => ({
        url: img.image_url,
        error: img.error,
        isLoading: false,
        index,
      })),
      prompt: response.prompt,
      timestamp: Date.now(),
      imageCount: response.images.length,
    };
    
    // 添加到批次结果列表
    setBatchResults(prev => [...prev, batchResult]);
    
    // 刷新生成计数器
    setCounterRefresh(prev => prev + 1);
    
    // 清空选中的文件
    setSelectedFiles([]);
    
    // 重新加载历史记录（后端会保存多图记录）
    await loadHistory();
    
    // 强制滚动到底部
    setTimeout(scrollToBottom, 100);
  };

  const handleGenerateStart = (prompt?: string, imageCount?: number) => {
    setIsGenerating(true);
    setGeneratingId('gen-' + Date.now());
    if (prompt) setCurrentPrompt(prompt);
    if (imageCount) setCurrentImageCount(imageCount);
    setTimeout(scrollToBottom, 100);
  };

  const handleGenerateError = (error: string, prompt?: string, imageCount?: number) => {
    setIsGenerating(false);
    setGeneratingId(null);
    setCurrentTaskId(null); // 重置任务 ID
    
    const { message, isQuotaError } = getErrorMessage(error);
    const count = imageCount || currentImageCount;
    
    // 多图生成失败时，创建一个全部失败的 BatchResult (Requirements: 5.3, 6.3)
    if (count > 1) {
      const failedBatch: BatchResult = {
        batchId: 'failed-batch-' + Date.now(),
        images: Array.from({ length: count }, (_, index) => ({
          error: message,
          isLoading: false,
          index,
        })),
        prompt: prompt || currentPrompt || '未知提示词',
        timestamp: Date.now(),
        imageCount: count,
      };
      setBatchResults(prev => [...prev, failedBatch]);
    } else {
      // 单图失败：添加失败记录到列表
      const failedRecord: FailedGeneration = {
        id: 'failed-' + Date.now(),
        prompt: prompt || currentPrompt || '未知提示词',
        errorMessage: message,
        timestamp: Date.now(),
      };
      setFailedGenerations(prev => [...prev, failedRecord]);
    }
    
    if (isQuotaError) {
      setShowQuotaError(true);
    }
    // 不再显示 toast，改为显示 ErrorCard
  };

  // 监听滚动，显示/隐藏回到底部按钮
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // 距离底部超过 200px 时显示按钮
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollButton(distanceFromBottom > 200);
    };

    // 初始检查一次
    handleScroll();

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [history.length]); // 当历史记录变化时重新绑定

  // 重新生成：使用历史记录的提示词和参考图
  const handleRegenerate = async (item: GenerationHistory) => {
    if (isTaskRunning) {
      toast.warning('请等待当前任务完成后再操作');
      return;
    }
    try {
      // 解析参考图
      let refImageUrls: string[] = [];
      try {
        if (item.ref_images) {
          const parsed = JSON.parse(item.ref_images);
          refImageUrls = Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.warn('解析参考图失败:', e);
      }

      // 加载参考图为 File 对象
      const refFiles: File[] = [];
      for (const url of refImageUrls) {
        const file = await loadImageAsFile(url);
        if (file) {
          refFiles.push(file);
        }
      }

      // 设置提示词和参考图
      setPromptUpdateKey(prev => prev + 1);
      setSelectedPrompt(item.prompt || '');
      setSelectedFiles(refFiles);

      // 等待状态更新后触发生成
      setTimeout(() => {
        setTriggerGenerate(true);
      }, 200);
    } catch (error) {
      console.error('重新生成失败:', error);
      toast.error('重新生成失败，请稍后重试');
    }
  };

  // 编辑提示词：填充提示词和参考图，但不自动发送
  const handleEditPrompt = async (item: GenerationHistory) => {
    try {
      // 解析参考图
      let refImageUrls: string[] = [];
      try {
        if (item.ref_images) {
          const parsed = JSON.parse(item.ref_images);
          refImageUrls = Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.warn('解析参考图失败:', e);
      }

      // 加载参考图为 File 对象
      const refFiles: File[] = [];
      for (const url of refImageUrls) {
        const file = await loadImageAsFile(url);
        if (file) {
          refFiles.push(file);
        }
      }

      // 设置提示词和参考图（不触发生成）
      // 更新 key 强制 PromptBar 重新接收 initialPrompt
      setPromptUpdateKey(prev => prev + 1);
      setSelectedPrompt(item.prompt || '');
      setSelectedFiles(refFiles);

      // 滚动到底部，让用户看到输入框
      setTimeout(scrollToBottom, 100);
      
      toast.success('已填充提示词，可编辑后发送');
    } catch (error) {
      console.error('编辑提示词失败:', error);
      toast.error('加载失败，请稍后重试');
    }
  };

  // 引用图片：将图片添加到参考图列表
  const handleUseAsReference = async (imageUrl: string) => {
    try {
      const file = await loadImageAsFile(imageUrl);
      if (file) {
        // [!code note] 由于上面 handleGenerate 清空了 selectedFiles，这里 [...prev, file] 就只会包含新添加的图片了
        setSelectedFiles((prev) => [...prev, file]);
        // 滚动到底部，让用户看到新添加的参考图
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      } else {
        toast.error('加载图片失败，请稍后重试');
      }
    } catch (error) {
      console.error('引用图片失败:', error);
      toast.error('引用图片失败，请稍后重试');
    }
  };

  // 重新生成批次：使用相同的提示词重新生成
  const handleRegenerateBatch = (batch: BatchResult) => {
    if (isTaskRunning) {
      toast.warning('请等待当前任务完成后再操作');
      return;
    }
    setPromptUpdateKey(prev => prev + 1);
    setSelectedPrompt(batch.prompt);
    setCurrentImageCount(batch.imageCount);
    setTimeout(() => setTriggerGenerate(true), 100);
  };

  // 编辑批次提示词：填充提示词到输入框，但不自动发送
  const handleEditBatchPrompt = (batch: BatchResult) => {
    setPromptUpdateKey(prev => prev + 1);
    setSelectedPrompt(batch.prompt);
    setTimeout(scrollToBottom, 100);
    toast.success('已填充提示词，可编辑后发送');
  };

  // SSE 流式生成事件处理
  const handleSSEStart = useCallback((event: SSEStartEvent) => {
    console.log('[Create] SSE Start:', event);
    // 创建流式批次，初始化所有图片为 loading 状态
    const newBatch: BatchResult = {
      batchId: event.batch_id,
      images: Array.from({ length: event.count }, (_, index) => ({
        isLoading: true,
        index,
      })),
      prompt: event.prompt,
      timestamp: Date.now(),
      imageCount: event.count,
    };
    setStreamingBatch(newBatch);
    setTimeout(scrollToBottom, 100);
  }, []);

  const handleSSEImage = useCallback((event: SSEImageEvent) => {
    console.log('[Create] SSE Image:', event);
    // 更新流式批次中对应索引的图片
    setStreamingBatch(prev => {
      if (!prev) return prev;
      const newImages = [...prev.images];
      newImages[event.index] = {
        url: event.image_url,
        error: event.error,
        isLoading: false,
        index: event.index,
      };
      return { ...prev, images: newImages };
    });
  }, []);

  const handleSSEComplete = useCallback(async (event: SSECompleteEvent) => {
    console.log('[Create] SSE Complete:', event);
    setIsGenerating(false);
    setGeneratingId(null);
    
    // 将流式批次移动到完成的批次列表
    if (streamingBatch) {
      // 使用最终的图片数据更新
      const finalBatch: BatchResult = {
        ...streamingBatch,
        images: event.images.map((img, index) => ({
          url: img.image_url,
          error: img.error,
          isLoading: false,
          index,
        })),
      };
      setBatchResults(prev => [...prev, finalBatch]);
    }
    setStreamingBatch(null);
    
    // 刷新生成计数器
    setCounterRefresh(prev => prev + 1);
    
    // 清空选中的文件
    setSelectedFiles([]);
    
    // 重新加载历史记录
    await loadHistory();
    
    // 滚动到底部
    setTimeout(scrollToBottom, 100);
  }, [streamingBatch, loadHistory]);

  // 将历史记录按 batch_id 分组
  // 返回一个数组，每个元素是一个"显示项"，可能是单图或多图批次
  interface HistoryDisplayItem {
    type: 'single' | 'batch';
    item?: GenerationHistory;  // 单图时使用
    batchId?: string;          // 批次时使用
    items?: GenerationHistory[]; // 批次时使用
    prompt: string;
    timestamp: string;
  }
  
  const groupedHistory = React.useMemo((): HistoryDisplayItem[] => {
    const result: HistoryDisplayItem[] = [];
    const batchMap = new Map<string, GenerationHistory[]>();
    const processedBatchIds = new Set<string>();
    
    // 先按时间正序排列（旧在前）
    const sortedHistory = [...history].reverse();
    
    // 第一遍：收集所有批次的图片
    for (const item of sortedHistory) {
      if (item.batch_id && item.batch_total && item.batch_total > 1) {
        // 有 batch_id 且批次总数 > 1，属于多图批次
        if (!batchMap.has(item.batch_id)) {
          batchMap.set(item.batch_id, []);
        }
        batchMap.get(item.batch_id)!.push(item);
      }
    }
    
    // 第二遍：构建显示列表
    for (const item of sortedHistory) {
      if (item.batch_id && item.batch_total && item.batch_total > 1) {
        // 多图批次：只在第一次遇到该批次时处理
        if (!processedBatchIds.has(item.batch_id)) {
          processedBatchIds.add(item.batch_id);
          const batchItems = batchMap.get(item.batch_id)!;
          // 按 batch_index 排序
          batchItems.sort((a, b) => (a.batch_index || 0) - (b.batch_index || 0));
          
          // 即使批次不完整也显示（部分成功的情况）
          if (batchItems.length > 1) {
            // 多张图片，显示为批次
            result.push({
              type: 'batch',
              batchId: item.batch_id,
              items: batchItems,
              prompt: batchItems[0].prompt,
              timestamp: batchItems[0].created_at,
            });
          } else if (batchItems.length === 1) {
            // 只有一张图片成功，显示为单图
            result.push({
              type: 'single',
              item: batchItems[0],
              prompt: batchItems[0].prompt,
              timestamp: batchItems[0].created_at,
            });
          }
        }
      } else {
        // 单图记录
        result.push({
          type: 'single',
          item,
          prompt: item.prompt,
          timestamp: item.created_at,
        });
      }
    }
    
    return result;
  }, [history]);
  
  // 使用分组后的历史记录
  const chatHistory = groupedHistory;

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
          
          {/* 空状态提示 - 考虑恢复中状态、处理中任务、批次结果和失败记录 */}
          {history.length === 0 && batchResults.length === 0 && failedGenerations.length === 0 && !isGenerating && !isRecovering && processingTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center text-gray-400 py-20 fade-in-up">
              <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
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

          {/* 历史消息流 */}
          <div className="space-y-8">
          {chatHistory.map((displayItem, index) => {
            // 单图记录
            if (displayItem.type === 'single' && displayItem.item) {
              const item = displayItem.item;
              const isFailedRecord = !!item.error_msg && !item.image_url;
              
              return (
                <div
                    key={item.id || `history-${index}`}
                    className="flex flex-col w-full fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                >
                    {/* 用户指令气泡 */}
                    <div className="flex justify-end mb-3 px-2">
                        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[80%]">
                            {item.type === GenerationType.WHITE_BACKGROUND
                              ? '白底图创作'
                              : item.type === GenerationType.CLOTHING_CHANGE
                              ? '一键换装'
                              : item.original_prompt || item.prompt || '无提示词'}
                        </div>
                    </div>

                    {/* 生成结果卡片 */}
                    <div className="flex flex-col items-start w-full pl-2">
                      <div className="flex items-center gap-3 mb-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                            isFailedRecord ? 'bg-gray-400' : 'bg-red-600 shadow-md shadow-red-200'
                          }`}>
                              AI
                          </div>
                          <span className="text-xs text-gray-400 font-medium">
                            {isFailedRecord ? '生成失败' : 'Focus'}
                          </span>
                      </div>
                      <div className="w-full max-w-xl">
                        {isFailedRecord ? (
                          <ErrorCard
                            errorMessage={item.error_msg || '未知错误'}
                            prompt={item.prompt}
                            onRetry={() => handleRegenerateWithCheck(() => {
                              setPromptUpdateKey(prev => prev + 1);
                              setSelectedPrompt(item.prompt);
                              setTimeout(() => setTriggerGenerate(true), 100);
                            })}
                            disabled={isTaskRunning}
                          />
                        ) : (
                          <ImageCard
                            item={item}
                            onImageClick={setLightboxImage}
                            onRefImageClick={setLightboxImage}
                            onRegenerate={handleRegenerate}
                            onEditPrompt={handleEditPrompt}
                            onUseAsReference={handleUseAsReference}
                            disabled={isTaskRunning}
                          />
                        )}
                      </div>
                    </div>
                  </div>
              );
            }
            
            // 多图批次记录
            if (displayItem.type === 'batch' && displayItem.items) {
              const batchItems = displayItem.items;
              const batchTotal = batchItems[0]?.batch_total || batchItems.length;
              return (
                <div
                    key={displayItem.batchId || `batch-${index}`}
                    className="flex flex-col w-full fade-in-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                >
                    {/* 用户指令气泡 */}
                    <div className="flex justify-end items-center gap-2 mb-3 px-2">
                        {/* 操作按钮 */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setPromptUpdateKey(prev => prev + 1);
                              setSelectedPrompt(displayItem.prompt);
                              setTimeout(scrollToBottom, 100);
                              toast.success('已填充提示词，可编辑后发送');
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="编辑提示词"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRegenerateWithCheck(() => {
                              setPromptUpdateKey(prev => prev + 1);
                              setSelectedPrompt(displayItem.prompt);
                              setCurrentImageCount(batchTotal);
                              setTimeout(() => setTriggerGenerate(true), 100);
                            })}
                            disabled={isTaskRunning}
                            className={`p-1.5 rounded-lg transition-colors ${isTaskRunning ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                            title={isTaskRunning ? '请等待当前任务完成' : '重新生成'}
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[70%]">
                            {displayItem.prompt} ({batchTotal}张)
                        </div>
                    </div>

                    {/* 生成结果网格 */}
                    <div className="flex flex-col items-start w-full pl-2">
                      <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-red-200">
                              AI
                          </div>
                          <span className="text-xs text-gray-400 font-medium">Focus</span>
                      </div>
                      <div className="w-full max-w-xl">
                        <ImageGrid
                          images={batchItems.map((item, idx) => ({
                            url: item.image_url,
                            isLoading: false,
                            index: item.batch_index ?? idx,
                          }))}
                          onImageClick={setLightboxImage}
                          onUseAsReference={handleUseAsReference}
                          prompt={displayItem.prompt}
                        />
                      </div>
                    </div>
                  </div>
              );
            }
            
            return null;
          })}

            {/* 恢复的处理中任务 - Requirements: 1.4, 2.1 */}
            {processingTasks.map((task) => {
              const taskImageCount = task.image_count || 1;
              return (
                <div key={task.task_id} className="flex flex-col w-full fade-in-up mt-8">
                  <div className="flex justify-end mb-3 px-2">
                    <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm opacity-50">
                      {task.prompt || '正在思考...'}
                      {taskImageCount > 1 && ` (${taskImageCount}张)`}
                    </div>
                  </div>
                  <div className="flex flex-col items-start w-full pl-2">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold animate-pulse">
                        AI
                      </div>
                      <span className="text-xs text-red-500 font-medium">
                        正在生成{taskImageCount > 1 ? ` ${taskImageCount} 张图片` : ''}...
                      </span>
                    </div>
                    <div className="w-full max-w-xl">
                      {/* 多图生成时显示 ImageGrid 占位 */}
                      {taskImageCount > 1 ? (
                        <ImageGrid
                          images={Array.from({ length: taskImageCount }, (_, index) => ({
                            isLoading: true,
                            index,
                          }))}
                          onImageClick={() => {}}
                        />
                      ) : (
                        <PlaceholderCard key={task.task_id} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* SSE 流式生成中 - 实时显示每张图片 */}
            {streamingBatch && (
              <div className="flex flex-col w-full fade-in-up mt-8">
                <div className="flex justify-end mb-3 px-2">
                  <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm opacity-50">
                    {streamingBatch.prompt} ({streamingBatch.imageCount}张)
                  </div>
                </div>
                <div className="flex flex-col items-start w-full pl-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold animate-pulse">
                      AI
                    </div>
                    <span className="text-xs text-red-500 font-medium">
                      正在生成 {streamingBatch.images.filter(img => !img.isLoading).length}/{streamingBatch.imageCount} 张图片...
                    </span>
                  </div>
                  <div className="w-full max-w-xl">
                    <ImageGrid
                      images={streamingBatch.images}
                      onImageClick={setLightboxImage}
                      onUseAsReference={handleUseAsReference}
                      prompt={streamingBatch.prompt}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 生成中状态 - 支持多图占位 (Requirements: 5.1) - 仅在非 SSE 模式下显示 */}
            {isGenerating && generatingId && !streamingBatch && (
              <div className="flex flex-col w-full fade-in-up mt-8">
                 <div className="flex justify-end mb-3 px-2">
                    <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm opacity-50">
                        {currentPrompt || '正在思考...'}
                        {currentImageCount > 1 && ` (${currentImageCount}张)`}
                    </div>
                </div>
                <div className="flex flex-col items-start w-full pl-2">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold animate-pulse">
                          AI
                      </div>
                      <span className="text-xs text-red-500 font-medium">
                        正在生成{currentImageCount > 1 ? ` ${currentImageCount} 张图片` : ''}...
                      </span>
                  </div>
                  <div className="w-full max-w-xl">
                    {/* 多图生成时显示 ImageGrid 占位 */}
                    {currentImageCount > 1 ? (
                      <ImageGrid
                        images={Array.from({ length: currentImageCount }, (_, index) => ({
                          isLoading: true,
                          index,
                        }))}
                        onImageClick={() => {}}
                      />
                    ) : (
                      <PlaceholderCard key={generatingId} />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 失败的生成记录 (单图) */}
            {failedGenerations.map((failed) => (
              <div key={failed.id} className="flex flex-col w-full fade-in-up mt-8">
                <div className="flex justify-end items-center gap-2 mb-3 px-2">
                  {/* 操作按钮 */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setPromptUpdateKey(prev => prev + 1);
                        setSelectedPrompt(failed.prompt);
                        setTimeout(scrollToBottom, 100);
                        toast.success('已填充提示词，可编辑后发送');
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="编辑提示词"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRegenerateWithCheck(() => {
                        setPromptUpdateKey(prev => prev + 1);
                        // 不删除失败记录，保留占位
                        setSelectedPrompt(failed.prompt);
                        setTimeout(() => setTriggerGenerate(true), 100);
                      })}
                      disabled={isTaskRunning}
                      className={`p-1.5 rounded-lg transition-colors ${isTaskRunning ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                      title={isTaskRunning ? '请等待当前任务完成' : '重新生成'}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* 提示词气泡 */}
                  <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[70%]">
                    {failed.prompt}
                  </div>
                </div>
                <div className="flex flex-col items-start w-full pl-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
                      AI
                    </div>
                    <span className="text-xs text-gray-400 font-medium">生成失败</span>
                  </div>
                  <div className="w-full max-w-xl">
                    <ErrorCard
                      errorMessage={failed.errorMessage}
                      prompt={failed.prompt}
                      onRetry={() => handleRegenerateWithCheck(() => {
                        // 不删除失败记录，保留占位
                        setPromptUpdateKey(prev => prev + 1);
                        setSelectedPrompt(failed.prompt);
                        setTimeout(() => setTriggerGenerate(true), 100);
                      })}
                      disabled={isTaskRunning}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* 多图批次结果 (Requirements: 5.3, 2.1, 2.2, 2.3) */}
            {batchResults.map((batch) => (
              <div key={batch.batchId} className="flex flex-col w-full fade-in-up mt-8">
                <div className="flex justify-end items-center gap-2 mb-3 px-2">
                  {/* 操作按钮 */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditBatchPrompt(batch)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="编辑提示词"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRegenerateBatch(batch)}
                      disabled={isTaskRunning}
                      className={`p-1.5 rounded-lg transition-colors ${isTaskRunning ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                      title={isTaskRunning ? '请等待当前任务完成' : '重新生成'}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* 提示词气泡 */}
                  <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[70%]">
                    {batch.prompt} ({batch.imageCount}张)
                  </div>
                </div>
                <div className="flex flex-col items-start w-full pl-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ${
                      batch.images.every(img => img.error) ? 'bg-gray-400' : 'bg-red-600 shadow-red-200'
                    }`}>
                      AI
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                      {batch.images.every(img => img.error) 
                        ? '生成失败' 
                        : batch.images.some(img => img.error)
                        ? '部分生成成功'
                        : 'Focus'}
                    </span>
                  </div>
                  <div className="w-full max-w-xl">
                    <ImageGrid
                      images={batch.images}
                      onImageClick={setLightboxImage}
                      onUseAsReference={handleUseAsReference}
                      prompt={batch.prompt}
                    />
                  </div>
                </div>
              </div>
            ))}
            
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
        onFilesChange={setSelectedFiles} 
        onPreviewImage={setLightboxImage}
        triggerGenerate={triggerGenerate}
        onTriggered={() => {
          setTriggerGenerate(false);
          setSelectedPrompt('');
          setSelectedFiles([]);
        }}
        // SSE 流式回调
        onSSEStart={handleSSEStart}
        onSSEImage={handleSSEImage}
        onSSEComplete={handleSSEComplete}
        // 异步任务运行状态（禁用发送按钮直到任务完成）
        isTaskRunning={isTaskRunning}
        // 异步任务创建回调
        onTaskCreated={(taskId) => {
          console.log('[Create] Task created:', taskId);
          setCurrentTaskId(taskId);
        }}
        // 提示词更新版本号，用于强制更新
        promptVersion={promptUpdateKey}
      />

      {/* 回到底部按钮 - 放在右上角，header 下方 */}
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
    </>
  );
}