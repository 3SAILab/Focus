// src/views/Create.tsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import Lightbox from '../components/Lightbox';
import ImageCard from '../components/ImageCard';
import ImageGrid from '../components/ImageGrid';
import ErrorCard from '../components/ErrorCard';
import PromptBar from '../components/PromptBar';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
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

// 删除目标类型
interface DeleteTarget {
  type: 'single' | 'batch' | 'failed' | 'session-batch';
  item?: GenerationHistory;
  batchId?: string;
  items?: GenerationHistory[];
  failedId?: string;
  message: string;
}

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
  refImages?: string[]; // 参考图 URL 列表
}

export default function Create() {
  const toast = useToast();
  const { getCompletedTask, clearCompletedTask, getFailedTask, clearFailedTask } = useGlobalTask();
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null); // 当前异步任务 ID
  
  // 多任务占位卡片状态 - 支持同时显示多个正在生成的任务
  interface PendingTask {
    id: string;
    prompt: string;
    imageCount: number;
    timestamp: number;
    taskId?: string; // 关联的后端任务 ID（用于精确清除，非 SSE 模式）
    batchId?: string; // 关联的批次 ID（用于精确清除，SSE 模式）
  }
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  
  // 当前正在处理的 pendingTask ID 队列（用于关联 taskId，非 SSE 模式）
  // 使用队列而不是单个值，以支持快速连续发送多个任务
  const pendingTaskIdQueueRef = useRef<string[]>([]);
  
  // SSE 模式：等待 SSE start 事件的 pendingTask ID 队列
  // 与非 SSE 模式分开，避免混淆
  const pendingSSETaskIdQueueRef = useRef<string[]>([]);
  
  // PromptBar state lifting for repopulation
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedImageCount, setSelectedImageCount] = useState<1 | 2 | 3 | 4>(1); // 选中的图片数量（用于重新生成）
  const [promptUpdateKey, setPromptUpdateKey] = useState(0); // 用于强制更新 PromptBar 的 key
  const [triggerGenerate, setTriggerGenerate] = useState(false);
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [failedGenerations, setFailedGenerations] = useState<FailedGeneration[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState(''); // 记录当前正在生成的提示词
  
  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 多图生成状态 (Requirements: 5.1, 5.2, 5.3)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [currentImageCount, setCurrentImageCount] = useState<number>(1); // 当前生成的图片数量
  
  // SSE 流式生成状态
  const [streamingBatch, setStreamingBatch] = useState<BatchResult | null>(null);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_SIZE = 20;
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null); // 顶部哨兵元素，用于检测滚动到顶部
  
  // 计算任务运行状态（用于禁用重新生成按钮）
  // 注意：processingTasks 在 useTaskRecovery 之后才可用，这里先定义为 false，后面会更新
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true); // 标记是否为首次加载

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 加载历史记录（首次加载或刷新）
  const loadHistory = useCallback(async () => {
    try {
      const response = await api.getHistory(1, PAGE_SIZE);
      if (response.ok) {
        const data: GenerationHistory[] = await response.json();
        // 过滤掉白底图和换装的历史记录，只显示创作空间的
        const filteredData = data.filter(
          (item) => !item.type || item.type === GenerationType.CREATE
        );
        setHistory(filteredData);
        setCurrentPage(1);
        setHasMore(data.length >= PAGE_SIZE); // 如果返回数量等于 PAGE_SIZE，可能还有更多
        
        // 清空 batchResults，因为历史记录已经包含了所有数据
        // 避免重复显示
        setBatchResults([]);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  }, []);

  // 加载更多历史记录（向上滚动时触发）
  const loadMoreHistory = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    
    // 记录当前滚动位置，用于加载后恢复
    const container = scrollContainerRef.current;
    const prevScrollTop = container?.scrollTop || 0;
    const prevScrollHeight = container?.scrollHeight || 0;
    
    // 禁用平滑滚动，确保位置恢复是瞬间的
    if (container) {
      container.style.scrollBehavior = 'auto';
    }
    
    try {
      const nextPage = currentPage + 1;
      const response = await api.getHistory(nextPage, PAGE_SIZE);
      if (response.ok) {
        const data: GenerationHistory[] = await response.json();
        // 过滤掉白底图和换装的历史记录
        const filteredData = data.filter(
          (item) => !item.type || item.type === GenerationType.CREATE
        );
        
        if (filteredData.length > 0) {
          // 后端返回的是 desc 排序（最新在前），我们需要把更旧的数据追加到 history 末尾
          // history 存储顺序：[最新, ..., 较旧] (desc)
          // 新加载的数据也是 desc 排序，直接追加到末尾即可
          setHistory(prev => [...prev, ...filteredData]);
          setCurrentPage(nextPage);
        }
        
        // 如果返回数量小于 PAGE_SIZE，说明没有更多数据了
        setHasMore(data.length >= PAGE_SIZE);
      }
    } catch (error) {
      console.error('加载更多历史记录失败:', error);
    } finally {
      setIsLoadingMore(false);
      
      // 恢复滚动位置：新内容加在数组末尾，显示时 reverse 后出现在顶部
      // 需要调整滚动位置，让用户看到的内容保持不变
      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          const heightDiff = newScrollHeight - prevScrollHeight;
          // 新内容在顶部，所以需要把滚动位置下移（瞬间完成）
          container.scrollTop = prevScrollTop + heightDiff;
          
          // 恢复平滑滚动（延迟一点，确保位置已设置）
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
    // 清除对应的 pendingTask（通过 taskId 精确匹配）
    setPendingTasks(prev => {
      const idx = prev.findIndex(p => p.taskId === task.task_id);
      if (idx !== -1) {
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }
      // 如果没找到匹配的 taskId，不清除任何 pendingTask
      // 这种情况可能是刷新后恢复的任务，pendingTasks 已经是空的
      return prev;
    });
    // 清空当前会话的批次结果，避免与历史记录重复显示
    setBatchResults([]);
    // Reload history to show the completed task
    loadHistory();
    // Refresh generation counter
    setCounterRefresh(prev => prev + 1);
    // 注意：GlobalTaskContext 已经显示了 toast，这里不再重复显示
  }, [loadHistory]);

  const handleTaskFailed = useCallback((task: GenerationTask) => {
    console.log('[Create] Task failed:', task.task_id, task.error_msg);
    // 清除对应的 pendingTask（通过 taskId 精确匹配）
    setPendingTasks(prev => {
      const idx = prev.findIndex(p => p.taskId === task.task_id);
      if (idx !== -1) {
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      }
      // 如果没找到匹配的 taskId，不清除任何 pendingTask
      return prev;
    });
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

  // 处理重新生成（不再检查任务状态，允许并发生成）
  const handleRegenerateWithCheck = useCallback((callback: () => void) => {
    // 直接执行回调，允许用户在生成过程中继续发送新任务
    callback();
  }, []);

  // 监听所有 pendingTasks 中的任务完成（通过 GlobalTaskContext 轮询）
  // 支持多任务并发：遍历所有有 taskId 的 pendingTask，检查它们的完成状态
  useEffect(() => {
    // 获取所有有 taskId 的 pendingTasks
    const tasksToMonitor = pendingTasks.filter(p => p.taskId);
    
    if (tasksToMonitor.length === 0) {
      return;
    }
    
    console.log('[Create] Monitoring tasks:', tasksToMonitor.map(t => t.taskId));
    
    const checkInterval = setInterval(() => {
      for (const pendingTask of tasksToMonitor) {
        const taskId = pendingTask.taskId!;
        const completedTask = getCompletedTask(taskId);
        const failedTask = getFailedTask(taskId);
        
        if (completedTask) {
          console.log('[Create] Task completed via GlobalTaskContext:', completedTask.task_id);
          clearCompletedTask(taskId);
          
          // 清除对应的 pendingTask
          setPendingTasks(prev => prev.filter(p => p.taskId !== taskId));
          
          // 如果这是当前任务，重置状态
          if (currentTaskId === taskId) {
            setIsGenerating(false);
            setCurrentTaskId(null);
          }
          
          // 清空当前会话的批次结果，避免与历史记录重复显示
          setBatchResults([]);
          // 重新加载历史记录
          loadHistory();
          // 刷新计数器
          setCounterRefresh(prev => prev + 1);
        }
        
        if (failedTask) {
          console.log('[Create] Task failed via GlobalTaskContext:', failedTask.task_id);
          clearFailedTask(taskId);
          
          // 清除对应的 pendingTask
          setPendingTasks(prev => prev.filter(p => p.taskId !== taskId));
          
          // 如果这是当前任务，重置状态
          if (currentTaskId === taskId) {
            setIsGenerating(false);
            setCurrentTaskId(null);
          }
          
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
        }
      }
    }, 500);
    
    return () => {
      clearInterval(checkInterval);
    };
  }, [pendingTasks, currentTaskId, getCompletedTask, clearCompletedTask, getFailedTask, clearFailedTask, loadHistory, currentPrompt]);

  useEffect(() => {
    loadHistory();
  }, []);

  // 核心滚动逻辑：仅首次加载时跳到底部
  // 注意：加载更多历史记录时不应该触发滚动，用户应该能继续往上滑
  const initialHistoryLoadedRef = useRef(false); // 标记首次历史记录是否已加载
  
  useEffect(() => {
    // 只在首次加载历史记录时跳到底部
    // 后续加载更多历史记录时不触发任何滚动
    if (history.length > 0 && !initialHistoryLoadedRef.current) {
      initialHistoryLoadedRef.current = true;
      
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
    // 清除对应的 pendingTask（从队列中取出第一个）
    const pendingId = pendingTaskIdQueueRef.current.shift();
    setPendingTasks(prev => {
      if (pendingId) {
        const idx = prev.findIndex(p => p.id === pendingId);
        if (idx !== -1) {
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        }
      }
      // 如果没有 pendingId，不清除任何 pendingTask
      return prev;
    });
    setIsGenerating(false);
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
    // 清除对应的 pendingTask（从队列中取出第一个）
    const pendingId = pendingTaskIdQueueRef.current.shift();
    setPendingTasks(prev => {
      if (pendingId) {
        const idx = prev.findIndex(p => p.id === pendingId);
        if (idx !== -1) {
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        }
      }
      // 如果没有 pendingId，不清除任何 pendingTask
      return prev;
    });
    setIsGenerating(false);
    setCurrentTaskId(null); // 重置任务 ID
    
    // 将多图响应转换为 BatchResult
    const batchResult: BatchResult = {
      batchId: response.batch_id,
      images: response.images.map((img, index) => ({
        url: img.image_url,
        // 如果有错误，使用 getErrorMessage 过滤敏感信息
        error: img.error ? getErrorMessage(img.error).message : undefined,
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
    // 创建新的待处理任务
    // 使用时间戳 + 随机字符串确保唯一性
    const newTaskId = 'pending-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
    const newTask: PendingTask = {
      id: newTaskId,
      prompt: prompt || '正在思考...',
      imageCount: imageCount || 1,
      timestamp: Date.now(),
    };
    
    setPendingTasks(prev => [...prev, newTask]);
    
    // 根据图片数量决定使用哪种关联方式
    // SSE 模式（多图）：使用 SSE 队列，在 handleSSEStart 时通过 batch_id 关联
    // 非 SSE 模式（单图）：使用普通队列，在响应时通过队列顺序关联
    if (imageCount && imageCount > 1) {
      // SSE 模式：将 pendingTask ID 加入 SSE 队列
      pendingSSETaskIdQueueRef.current.push(newTaskId);
    } else {
      // 非 SSE 模式：将 pendingTask ID 加入普通队列
      pendingTaskIdQueueRef.current.push(newTaskId);
    }
    
    // 保持向后兼容
    setIsGenerating(true);
    if (prompt) setCurrentPrompt(prompt);
    if (imageCount) setCurrentImageCount(imageCount);
    setTimeout(scrollToBottom, 100);
  };

  const handleGenerateError = (error: string, prompt?: string, imageCount?: number) => {
    const count = imageCount || currentImageCount;
    
    // 根据图片数量决定从哪个队列中取出 pendingTask ID
    // SSE 模式（多图）：从 SSE 队列取出
    // 非 SSE 模式（单图）：从普通队列取出
    let pendingId: string | undefined;
    if (count > 1) {
      pendingId = pendingSSETaskIdQueueRef.current.shift();
    } else {
      pendingId = pendingTaskIdQueueRef.current.shift();
    }
    
    setPendingTasks(prev => {
      if (pendingId) {
        const idx = prev.findIndex(p => p.id === pendingId);
        if (idx !== -1) {
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        }
      }
      // 如果没有 pendingId，不清除任何 pendingTask
      return prev;
    });
    setIsGenerating(false);
    setCurrentTaskId(null); // 重置任务 ID
    
    const { message, isQuotaError } = getErrorMessage(error);
    
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

  // 监听滚动，显示/隐藏回到底部按钮 + 滚动到顶部时加载更多
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // 距离底部超过 200px 时显示按钮
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollButton(distanceFromBottom > 200);
      
      // 滚动到顶部附近时加载更多（距离顶部 100px 以内）
      // 使用防抖避免重复触发
      if (scrollTop < 100 && hasMore && !isLoadingMore && !isInitialLoadRef.current) {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          loadMoreHistory();
        }, 100);
      }
    };

    // 初始检查一次（延迟执行，避免首次加载时触发）
    const initTimeout = setTimeout(handleScroll, 500);

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
      clearTimeout(initTimeout);
    };
  }, [hasMore, isLoadingMore, loadMoreHistory]); // 移除 history.length 依赖，避免重复绑定

  // 重新生成：使用历史记录的提示词和参考图
  const handleRegenerate = async (item: GenerationHistory) => {
    // 不再检查任务状态，允许用户在生成过程中继续发送新任务
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

      // 设置提示词、参考图和图片数量
      setPromptUpdateKey(prev => prev + 1);
      setSelectedPrompt(item.prompt || '');
      setSelectedFiles(refFiles);
      // 保留原来的图片数量（batch_total），如果没有则默认为 1
      const imageCount = (item.batch_total || 1) as 1 | 2 | 3 | 4;
      setSelectedImageCount(imageCount);

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

      // 设置提示词、参考图和图片数量（不触发生成）
      // 更新 key 强制 PromptBar 重新接收 initialPrompt
      setPromptUpdateKey(prev => prev + 1);
      setSelectedPrompt(item.prompt || '');
      setSelectedFiles(refFiles);
      // 保留原来的图片数量
      const imageCount = (item.batch_total || 1) as 1 | 2 | 3 | 4;
      setSelectedImageCount(imageCount);

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

  // 重新生成批次（带参考图）：使用相同的提示词和参考图重新生成
  const handleRegenerateBatchWithRef = async (batch: BatchResult) => {
    // 不再检查任务状态，允许用户在生成过程中继续发送新任务
    try {
      // 加载参考图为 File 对象
      const refFiles: File[] = [];
      if (batch.refImages && batch.refImages.length > 0) {
        for (const url of batch.refImages) {
          const file = await loadImageAsFile(url);
          if (file) {
            refFiles.push(file);
          }
        }
      }
      
      setPromptUpdateKey(prev => prev + 1);
      setSelectedPrompt(batch.prompt);
      setSelectedFiles(refFiles);
      const imageCount = (batch.imageCount || 1) as 1 | 2 | 3 | 4;
      setSelectedImageCount(imageCount);
      setTimeout(() => setTriggerGenerate(true), 200);
    } catch (error) {
      console.error('加载参考图失败:', error);
      // 即使参考图加载失败，也继续生成
      setPromptUpdateKey(prev => prev + 1);
      setSelectedPrompt(batch.prompt);
      const imageCount = (batch.imageCount || 1) as 1 | 2 | 3 | 4;
      setSelectedImageCount(imageCount);
      setTimeout(() => setTriggerGenerate(true), 200);
    }
  };

  // 编辑批次提示词（带参考图）：填充提示词和参考图到输入框，但不自动发送
  const handleEditBatchPromptWithRef = async (batch: BatchResult) => {
    try {
      // 加载参考图为 File 对象
      const refFiles: File[] = [];
      if (batch.refImages && batch.refImages.length > 0) {
        for (const url of batch.refImages) {
          const file = await loadImageAsFile(url);
          if (file) {
            refFiles.push(file);
          }
        }
      }
      
      setPromptUpdateKey(prev => prev + 1);
      setSelectedPrompt(batch.prompt);
      setSelectedFiles(refFiles);
      const imageCount = (batch.imageCount || 1) as 1 | 2 | 3 | 4;
      setSelectedImageCount(imageCount);
      setTimeout(scrollToBottom, 100);
      toast.success(refFiles.length > 0 ? '已填充提示词和参考图，可编辑后发送' : '已填充提示词，可编辑后发送');
    } catch (error) {
      console.error('加载参考图失败:', error);
      setPromptUpdateKey(prev => prev + 1);
      setSelectedPrompt(batch.prompt);
      const imageCount = (batch.imageCount || 1) as 1 | 2 | 3 | 4;
      setSelectedImageCount(imageCount);
      setTimeout(scrollToBottom, 100);
      toast.success('已填充提示词，可编辑后发送');
    }
  };

  // 点击删除单条历史记录 - 显示确认对话框
  const handleDeleteSingleClick = (item: GenerationHistory) => {
    if (!item.id) {
      toast.error('无法删除：记录 ID 不存在');
      return;
    }
    setDeleteTarget({
      type: 'single',
      item,
      message: '确定要删除这条记录吗？删除后无法恢复，但不会影响生成次数统计。',
    });
  };

  // 点击删除批次记录 - 显示确认对话框
  const handleDeleteBatchClick = (batchId: string, items: GenerationHistory[]) => {
    const count = items.length;
    setDeleteTarget({
      type: 'batch',
      batchId,
      items,
      message: `确定要删除这批 ${count} 张图片吗？删除后无法恢复，但不会影响生成次数统计。`,
    });
  };

  // 点击删除当前会话的失败记录 - 直接删除（无需确认）
  const handleDeleteFailedRecord = (failedId: string) => {
    setFailedGenerations(prev => prev.filter(f => f.id !== failedId));
  };

  // 点击删除当前会话的批次结果 - 直接删除（无需确认）
  const handleDeleteSessionBatch = (batchId: string) => {
    setBatchResults(prev => prev.filter(b => b.batchId !== batchId));
  };

  // 确认删除
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    
    setIsDeleting(true);
    try {
      if (deleteTarget.type === 'single' && deleteTarget.item?.id) {
        const response = await api.deleteHistory(deleteTarget.item.id);
        if (response.ok) {
          toast.success('删除成功');
          await loadHistory();
        } else {
          toast.error('删除失败');
        }
      } else if (deleteTarget.type === 'batch' && deleteTarget.batchId) {
        const response = await api.deleteHistoryByBatch(deleteTarget.batchId);
        if (response.ok) {
          toast.success('删除成功');
          await loadHistory();
        } else {
          toast.error('删除失败');
        }
      }
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // SSE 流式生成事件处理
  const handleSSEStart = useCallback((event: SSEStartEvent) => {
    // 从 SSE 队列中取出第一个 pendingTask ID，并关联 batch_id
    const pendingId = pendingSSETaskIdQueueRef.current.shift();
    
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
      refImages: event.ref_images || [], // 保存参考图
    };
    
    // 同时更新 pendingTasks 和 streamingBatch
    // 使用函数式更新确保状态一致性
    if (pendingId) {
      setPendingTasks(prev => prev.map(p => 
        p.id === pendingId 
          ? { ...p, batchId: event.batch_id }
          : p
      ));
    }
    
    setStreamingBatch(newBatch);
    setTimeout(scrollToBottom, 100);
  }, []);

  const handleSSEImage = useCallback((event: SSEImageEvent) => {
    console.log('[Create] SSE Image:', event);
    // 更新流式批次中对应索引的图片
    setStreamingBatch(prev => {
      if (!prev) return prev;
      const newImages = [...prev.images];
      // 如果有错误，使用 getErrorMessage 过滤敏感信息
      const errorMessage = event.error ? getErrorMessage(event.error).message : undefined;
      newImages[event.index] = {
        url: event.image_url,
        error: errorMessage,
        isLoading: false,
        index: event.index,
      };
      return { ...prev, images: newImages };
    });
  }, []);

  const handleSSEComplete = useCallback(async (event: SSECompleteEvent) => {
    console.log('[Create] SSE Complete:', event);
    // 使用 batch_id 精确清除对应的 pendingTask（而不是队列）
    setPendingTasks(prev => prev.filter(p => p.batchId !== event.batch_id));
    setIsGenerating(false);
    
    // 将流式批次移动到完成的批次列表
    if (streamingBatch) {
      // 使用最终的图片数据更新
      const finalBatch: BatchResult = {
        ...streamingBatch,
        images: event.images.map((img, index) => ({
          url: img.image_url,
          // 如果有错误，使用 getErrorMessage 过滤敏感信息
          error: img.error ? getErrorMessage(img.error).message : undefined,
          isLoading: false,
          index,
        })),
        refImages: event.ref_images || streamingBatch.refImages || [], // 保存参考图
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
    type: 'single' | 'batch' | 'failed' | 'session-batch' | 'pending' | 'recovering' | 'streaming';
    item?: GenerationHistory;  // 单图时使用
    batchId?: string;          // 批次时使用
    items?: GenerationHistory[]; // 批次时使用
    prompt: string;
    timestamp: string | number; // 支持字符串（历史）和数字（当前会话）
    refImages?: string | string[];  // 参考图（字符串或数组）
    // 失败记录专用
    failedRecord?: FailedGeneration;
    // 当前会话批次专用（也用于 streaming 类型）
    sessionBatch?: BatchResult;
    // 正在处理的任务专用
    pendingTask?: PendingTask;
    // 恢复的任务专用
    recoveringTask?: GenerationTask;
  }
  
  const groupedHistory = React.useMemo((): HistoryDisplayItem[] => {
    const result: HistoryDisplayItem[] = [];
    const batchMap = new Map<string, GenerationHistory[]>();
    const processedBatchIds = new Set<string>();
    
    // history 是 desc 排序（最新在前：69, 68, 67...）
    // 我们需要显示为 asc（旧在前：1, 2, 3...），所以 reverse
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
    
    // 第二遍：构建显示列表（按时间正序，旧在前）
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
            // 参考图从第一个 item 获取（同一批次的参考图相同）
            result.push({
              type: 'batch',
              batchId: item.batch_id,
              items: batchItems,
              prompt: batchItems[0].prompt,
              timestamp: batchItems[0].created_at,
              refImages: batchItems[0].ref_images,
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
    
    // 添加当前会话的失败记录
    for (const failed of failedGenerations) {
      result.push({
        type: 'failed',
        prompt: failed.prompt,
        timestamp: failed.timestamp,
        failedRecord: failed,
      });
    }
    
    // 添加当前会话的批次结果
    for (const batch of batchResults) {
      result.push({
        type: 'session-batch',
        batchId: batch.batchId,
        prompt: batch.prompt,
        timestamp: batch.timestamp,
        refImages: batch.refImages,
        sessionBatch: batch,
      });
    }
    
    // 收集 processingTasks 的 task_id，用于去重
    const processingTaskIds = new Set(processingTasks.map(t => t.task_id));
    
    // 添加恢复的处理中任务（刷新后恢复的）
    for (const task of processingTasks) {
      result.push({
        type: 'recovering',
        prompt: task.prompt || '正在思考...',
        timestamp: new Date(task.created_at).getTime(),
        recoveringTask: task,
      });
    }
    
    // 添加当前会话的待处理任务
    // 修复：不再根据 streamingBatch 是否存在来决定是否显示 pendingTasks
    // 而是根据每个 pendingTask 是否已经有对应的 batchId（SSE 模式）来决定
    // 如果 pendingTask 有 batchId 且等于 streamingBatch.batchId，说明它已经在 streamingBatch 中显示了，跳过
    for (const task of pendingTasks) {
      // 如果这个 pendingTask 已经有 taskId，且该 taskId 在 processingTasks 中，则跳过
      if (task.taskId && processingTaskIds.has(task.taskId)) {
        continue;
      }
      // 如果这个 pendingTask 已经有 batchId，且该 batchId 等于当前 streamingBatch 的 batchId，则跳过
      // 因为它已经在 streamingBatch 中显示了
      if (task.batchId && streamingBatch && task.batchId === streamingBatch.batchId) {
        continue;
      }
      result.push({
        type: 'pending',
        prompt: task.prompt,
        timestamp: task.timestamp,
        pendingTask: task,
      });
    }
    
    // 添加当前正在流式生成的批次（SSE 模式）
    // 将 streamingBatch 加入到排序列表中，而不是单独渲染在最后
    if (streamingBatch) {
      result.push({
        type: 'streaming',
        batchId: streamingBatch.batchId,
        prompt: streamingBatch.prompt,
        timestamp: streamingBatch.timestamp,
        refImages: streamingBatch.refImages,
        sessionBatch: streamingBatch, // 复用 sessionBatch 字段存储 streamingBatch
      });
    }
    
    // 按时间戳排序（统一转换为数字比较）
    result.sort((a, b) => {
      const timeA = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : a.timestamp;
      const timeB = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : b.timestamp;
      return timeA - timeB;
    });
    
    return result;
  }, [history, failedGenerations, batchResults, processingTasks, pendingTasks, streamingBatch]);
  
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
          {history.length === 0 && batchResults.length === 0 && failedGenerations.length === 0 && pendingTasks.length === 0 && !isRecovering && processingTasks.length === 0 && (
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

          {/* 历史消息流 - 历史记录不使用动画，静默显示 */}
          <div className="space-y-8" ref={topSentinelRef}>
          {chatHistory.map((displayItem, index) => {
            // 单图记录
            if (displayItem.type === 'single' && displayItem.item) {
              const item = displayItem.item;
              const isFailedRecord = !!item.error_msg && !item.image_url;
              
              return (
                <div
                    key={item.id || `history-${index}`}
                    className="flex flex-col w-full"
                >
                    {/* 用户指令气泡 */}
                    <div className="flex justify-end items-center gap-2 mb-3 px-2">
                        {/* 删除按钮 */}
                        <button
                          onClick={() => handleDeleteSingleClick(item)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                            errorMessage={getErrorMessage(item.error_msg || '未知错误').message}
                            prompt={item.prompt}
                            onRetry={() => handleRegenerateWithCheck(() => {
                              setPromptUpdateKey(prev => prev + 1);
                              setSelectedPrompt(item.prompt);
                              setTimeout(() => setTriggerGenerate(true), 100);
                            })}
                          />
                        ) : (
                          <ImageCard
                            item={item}
                            onImageClick={setLightboxImage}
                            onRefImageClick={setLightboxImage}
                            onRegenerate={handleRegenerate}
                            onEditPrompt={handleEditPrompt}
                            onUseAsReference={handleUseAsReference}
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
                    className="flex flex-col w-full"
                >
                    {/* 用户指令气泡 */}
                    <div className="flex justify-end items-center gap-2 mb-3 px-2">
                        {/* 操作按钮 */}
                        <div className="flex gap-1">
                          <button
                            onClick={async () => {
                              // 多图批次编辑：加载提示词和参考图
                              try {
                                let refImageUrls: string[] = [];
                                try {
                                  if (displayItem.refImages) {
                                    if (Array.isArray(displayItem.refImages)) {
                                      refImageUrls = displayItem.refImages;
                                    } else {
                                      const parsed = JSON.parse(displayItem.refImages);
                                      refImageUrls = Array.isArray(parsed) ? parsed : [];
                                    }
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
                                
                                setPromptUpdateKey(prev => prev + 1);
                                setSelectedPrompt(displayItem.prompt);
                                setSelectedFiles(refFiles);
                                setTimeout(scrollToBottom, 100);
                                toast.success('已填充提示词和参考图，可编辑后发送');
                              } catch (error) {
                                console.error('加载参考图失败:', error);
                                setPromptUpdateKey(prev => prev + 1);
                                setSelectedPrompt(displayItem.prompt);
                                setTimeout(scrollToBottom, 100);
                                toast.success('已填充提示词，可编辑后发送');
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="编辑提示词"
                          >
                            <span className="text-xs">重新编辑</span>
                          </button>
                          <button
                            onClick={async () => {
                              // 不再检查任务状态，允许用户在生成过程中继续发送新任务
                              // 多图批次重新生成：加载提示词和参考图
                              try {
                                let refImageUrls: string[] = [];
                                try {
                                  if (displayItem.refImages) {
                                    if (Array.isArray(displayItem.refImages)) {
                                      refImageUrls = displayItem.refImages;
                                    } else {
                                      const parsed = JSON.parse(displayItem.refImages);
                                      refImageUrls = Array.isArray(parsed) ? parsed : [];
                                    }
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
                                
                                setPromptUpdateKey(prev => prev + 1);
                                setSelectedPrompt(displayItem.prompt);
                                setSelectedFiles(refFiles);
                                // 使用 selectedImageCount 而不是 currentImageCount，确保 PromptBar 接收到正确的图片数量
                                const imageCount = (batchTotal || 1) as 1 | 2 | 3 | 4;
                                setSelectedImageCount(imageCount);
                                setTimeout(() => setTriggerGenerate(true), 200);
                              } catch (error) {
                                console.error('加载参考图失败:', error);
                                setPromptUpdateKey(prev => prev + 1);
                                setSelectedPrompt(displayItem.prompt);
                                // 使用 selectedImageCount 而不是 currentImageCount
                                const imageCount = (batchTotal || 1) as 1 | 2 | 3 | 4;
                                setSelectedImageCount(imageCount);
                                setTimeout(() => setTriggerGenerate(true), 200);
                              }
                            }}
                            className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50"
                            title="重新生成"
                          >
                            <span className="text-xs">重新生成</span>
                          </button>
                          <button
                            onClick={() => displayItem.batchId && handleDeleteBatchClick(displayItem.batchId, batchItems)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除批次"
                          >
                            <Trash2 className="w-4 h-4" />
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
                          refImages={(() => {
                            // 解析参考图
                            try {
                              if (displayItem.refImages) {
                                if (Array.isArray(displayItem.refImages)) {
                                  return displayItem.refImages;
                                }
                                const parsed = JSON.parse(displayItem.refImages);
                                return Array.isArray(parsed) ? parsed : [];
                              }
                            } catch (e) {
                              console.warn('解析参考图失败:', e);
                            }
                            return [];
                          })()}
                          onRefImageClick={setLightboxImage}
                        />
                      </div>
                    </div>
                  </div>
              );
            }
            
            // 当前会话的失败记录
            if (displayItem.type === 'failed' && displayItem.failedRecord) {
              const failed = displayItem.failedRecord;
              return (
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
                        <span className="text-xs">编辑</span>
                      </button>
                      <button
                        onClick={() => handleRegenerateWithCheck(() => {
                          setPromptUpdateKey(prev => prev + 1);
                          setSelectedPrompt(failed.prompt);
                          setTimeout(() => setTriggerGenerate(true), 100);
                        })}
                        className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50"
                        title="重新生成"
                      >
                        <span className="text-xs">重新生成</span>
                      </button>
                      <button
                        onClick={() => handleDeleteFailedRecord(failed.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
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
                          setPromptUpdateKey(prev => prev + 1);
                          setSelectedPrompt(failed.prompt);
                          setTimeout(() => setTriggerGenerate(true), 100);
                        })}
                      />
                    </div>
                  </div>
                </div>
              );
            }
            
            // 当前会话的批次结果
            if (displayItem.type === 'session-batch' && displayItem.sessionBatch) {
              const batch = displayItem.sessionBatch;
              return (
                <div key={batch.batchId} className="flex flex-col w-full fade-in-up mt-8">
                  <div className="flex justify-end items-center gap-2 mb-3 px-2">
                    {/* 操作按钮 */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditBatchPromptWithRef(batch)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="编辑提示词"
                      >
                        <span className="text-xs">编辑</span>
                      </button>
                      <button
                        onClick={() => handleRegenerateBatchWithRef(batch)}
                        className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50"
                        title="重新生成"
                      >
                        <span className="text-xs">重新生成</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSessionBatch(batch.batchId)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
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
                        refImages={batch.refImages}
                        onRefImageClick={setLightboxImage}
                      />
                    </div>
                  </div>
                </div>
              );
            }
            
            // 恢复的处理中任务（刷新后恢复的）
            if (displayItem.type === 'recovering' && displayItem.recoveringTask) {
              const task = displayItem.recoveringTask;
              const taskImageCount = task.image_count || 1;
              return (
                <div key={`recovering-${task.task_id}`} className="flex flex-col w-full fade-in-up mt-8">
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
                      <ImageGrid
                        images={Array.from({ length: taskImageCount }, (_, index) => ({
                          isLoading: true,
                          index,
                        }))}
                        onImageClick={() => {}}
                        showFooter={true}
                      />
                    </div>
                  </div>
                </div>
              );
            }
            
            // 当前会话的待处理任务
            if (displayItem.type === 'pending' && displayItem.pendingTask) {
              const task = displayItem.pendingTask;
              return (
                <div key={task.id} className="flex flex-col w-full fade-in-up mt-8">
                  <div className="flex justify-end mb-3 px-2">
                    <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm opacity-50">
                      {task.prompt || '正在思考...'}
                      {task.imageCount > 1 && ` (${task.imageCount}张)`}
                    </div>
                  </div>
                  <div className="flex flex-col items-start w-full pl-2">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold animate-pulse">
                        AI
                      </div>
                      <span className="text-xs text-red-500 font-medium">
                        正在生成{task.imageCount > 1 ? ` ${task.imageCount} 张图片` : ''}...
                      </span>
                    </div>
                    <div className="w-full max-w-xl">
                      <ImageGrid
                        images={Array.from({ length: task.imageCount }, (_, index) => ({
                          isLoading: true,
                          index,
                        }))}
                        onImageClick={() => {}}
                        showFooter={true}
                      />
                    </div>
                  </div>
                </div>
              );
            }
            
            // SSE 流式生成中 - 实时显示每张图片（现在按时间戳排序显示）
            if (displayItem.type === 'streaming' && displayItem.sessionBatch) {
              const batch = displayItem.sessionBatch;
              return (
                <div key={`streaming-${batch.batchId}`} className="flex flex-col w-full fade-in-up mt-8">
                  <div className="flex justify-end mb-3 px-2">
                    <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm opacity-50">
                      {batch.prompt} ({batch.imageCount}张)
                    </div>
                  </div>
                  <div className="flex flex-col items-start w-full pl-2">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold animate-pulse">
                        AI
                      </div>
                      <span className="text-xs text-red-500 font-medium">
                        正在生成 {batch.images.filter(img => !img.isLoading).length}/{batch.imageCount} 张图片...
                      </span>
                    </div>
                    <div className="w-full max-w-xl">
                      <ImageGrid
                        images={batch.images}
                        onImageClick={setLightboxImage}
                        onUseAsReference={handleUseAsReference}
                        prompt={batch.prompt}
                        showFooter={true}
                        refImages={batch.refImages}
                        onRefImageClick={setLightboxImage}
                      />
                    </div>
                  </div>
                </div>
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
          setSelectedImageCount(1); // 重置图片数量
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
          // 从队列中取出第一个 pendingTask ID，关联 taskId
          const pendingId = pendingTaskIdQueueRef.current.shift();
          if (pendingId) {
            setPendingTasks(prev => prev.map(p => 
              p.id === pendingId 
                ? { ...p, taskId } 
                : p
            ));
          }
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
      
      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="确认删除"
        message={deleteTarget?.message || '确定要删除这条记录吗？'}
        isDeleting={isDeleting}
      />
    </>
  );
}