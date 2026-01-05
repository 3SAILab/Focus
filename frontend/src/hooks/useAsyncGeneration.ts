// src/hooks/useAsyncGeneration.ts
// Hook for async image generation with task polling
// Uses GlobalTaskContext for cross-page task management
// Supports multiple concurrent tasks

import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../api';
import type { GenerationTask, GenerationTypeValue, GenerationItem } from '../type';
import { createPendingItem } from '../type';
import { useGlobalTask } from '../context/GlobalTaskContext';
import { getErrorMessage } from '../utils/errorHandler';

/**
 * @deprecated 使用 GenerationItem 代替
 * 保留此类型别名以保持向后兼容
 */
export type PendingTaskInfo = Pick<GenerationItem, 'id' | 'taskId' | 'timestamp'>;

export interface UseAsyncGenerationOptions {
  onComplete: (task: GenerationTask) => void;
  onError: (error: string, isQuotaError: boolean) => void;
}

export interface UseAsyncGenerationResult {
  isGenerating: boolean;
  currentTaskId: string | null;
  // 新增：所有正在处理的任务列表（用于显示多个占位卡片）
  pendingTasks: PendingTaskInfo[];
  startGeneration: (formData: FormData) => Promise<void>;
  cancelGeneration: () => void;
}

/**
 * Hook for async image generation
 * - Sends request and gets task_id immediately
 * - Registers task with GlobalTaskContext for cross-page polling
 * - GlobalTaskContext handles toast notifications even if user navigates away
 * - Supports multiple concurrent tasks
 * 
 * 修复：使用 localId 直接关联 taskId，而不是依赖队列顺序
 * 这样即使后端响应顺序与请求顺序不一致，也能正确关联
 */
export function useAsyncGeneration(options: UseAsyncGenerationOptions): UseAsyncGenerationResult {
  const { onComplete, onError } = options;
  const { registerTask, unregisterTask, isTaskPolling, getCompletedTask, clearCompletedTask, getFailedTask, clearFailedTask } = useGlobalTask();
  
  // 多任务支持：使用数组存储所有正在处理的任务
  // 内部使用 GenerationItem，但只暴露 PendingTaskInfo 兼容的字段
  const [pendingTasks, setPendingTasks] = useState<GenerationItem[]>([]);
  
  // 向后兼容：isGenerating 表示是否有任何任务在处理
  const isGenerating = pendingTasks.length > 0;
  // 向后兼容：currentTaskId 返回最新的任务 ID
  const currentTaskId = pendingTasks.length > 0 ? (pendingTasks[pendingTasks.length - 1].taskId || null) : null;
  
  // Refs for cleanup
  const isMountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  
  // Update callback refs
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
  }, [onComplete, onError]);
  
  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  /**
   * Start async generation - supports multiple concurrent calls
   * 修复：每个请求使用闭包捕获自己的 localId，确保响应时能正确关联
   */
  const startGeneration = useCallback(async (formData: FormData) => {
    // 创建新的本地任务，使用时间戳确保唯一性和排序
    const timestamp = Date.now();
    const localId = 'pending-' + timestamp + '-' + Math.random().toString(36).substring(2, 11);
    
    // 使用统一的 createPendingItem 工厂函数
    const newTask = createPendingItem({
      id: localId,
      prompt: formData.get('prompt') as string || '',
      imageCount: parseInt(formData.get('imageCount') as string || '1', 10),
      timestamp: timestamp,
      type: formData.get('type') as GenerationTypeValue,
    });
    
    // 添加到待处理列表
    setPendingTasks(prev => [...prev, newTask]);
    
    console.log('[useAsyncGeneration] Starting generation, localId:', localId);
    
    try {
      const response = await api.generate(formData);
      
      // Handle error responses
      if (!response.ok) {
        const errData = await response.json();
        const { message, isQuotaError } = getErrorMessage(errData, response.status);
        if (isMountedRef.current) {
          // 使用闭包中的 localId 精确移除失败的任务
          setPendingTasks(prev => prev.filter(t => t.id !== localId));
          onErrorRef.current(message, isQuotaError);
        }
        return;
      }
      
      const data = await response.json();
      
      // Check if we got a task_id
      if (data.task_id) {
        console.log('[useAsyncGeneration] Got task_id:', data.task_id, 'for localId:', localId);
        
        // 使用闭包中的 localId 精确关联 taskId
        if (isMountedRef.current) {
          setPendingTasks(prev => prev.map(t => 
            t.id === localId 
              ? { ...t, taskId: data.task_id }
              : t
          ));
        }
        
        // Register task with GlobalTaskContext for polling
        const taskType = (formData.get('type') as string || 'create') as GenerationTypeValue;
        registerTask(data.task_id, taskType);
      } else {
        // No task_id, unexpected response
        if (isMountedRef.current) {
          setPendingTasks(prev => prev.filter(t => t.id !== localId));
          const { message, isQuotaError } = getErrorMessage('服务器响应异常');
          onErrorRef.current(message, isQuotaError);
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        // 使用闭包中的 localId 精确移除失败的任务
        setPendingTasks(prev => prev.filter(t => t.id !== localId));
        const { message, isQuotaError } = getErrorMessage(error);
        onErrorRef.current(message, isQuotaError);
      }
    }
  }, [registerTask]);
  
  /**
   * Cancel all generations (stop polling)
   */
  const cancelGeneration = useCallback(() => {
    pendingTasks.forEach(task => {
      if (task.taskId) {
        unregisterTask(task.taskId);
      }
    });
    setPendingTasks([]);
  }, [pendingTasks, unregisterTask]);
  
  // Check if any tasks have completed (polled by GlobalTaskContext)
  useEffect(() => {
    const tasksWithId = pendingTasks.filter(t => t.taskId);
    if (tasksWithId.length === 0) return;
    
    console.log('[useAsyncGeneration] Monitoring tasks:', tasksWithId.map(t => t.taskId));
    
    const checkInterval = setInterval(() => {
      for (const task of tasksWithId) {
        const taskId = task.taskId!;
        
        // Check for completed task
        const completedTask = getCompletedTask(taskId);
        if (completedTask && isMountedRef.current) {
          console.log('[useAsyncGeneration] Task completed:', taskId);
          // 移除完成的任务
          setPendingTasks(prev => prev.filter(t => t.taskId !== taskId));
          onCompleteRef.current(completedTask);
          clearCompletedTask(taskId);
          continue;
        }
        
        // Check for failed task
        const failedTask = getFailedTask(taskId);
        if (failedTask && isMountedRef.current) {
          console.log('[useAsyncGeneration] Task failed:', taskId, failedTask.error_msg);
          // 移除失败的任务
          setPendingTasks(prev => prev.filter(t => t.taskId !== taskId));
          const { message, isQuotaError } = getErrorMessage(failedTask.error_msg);
          onErrorRef.current(message, isQuotaError);
          clearFailedTask(taskId);
          continue;
        }
        
        // Check if task is no longer being polled (edge case)
        if (!isTaskPolling(taskId) && isMountedRef.current) {
          console.log('[useAsyncGeneration] Task no longer polling:', taskId);
          // 任务不再轮询但没有结果，可能是异常情况，移除它
          setPendingTasks(prev => prev.filter(t => t.taskId !== taskId));
        }
      }
    }, 500);
    
    return () => clearInterval(checkInterval);
  }, [pendingTasks, isTaskPolling, getCompletedTask, clearCompletedTask, getFailedTask, clearFailedTask]);
  
  return {
    isGenerating,
    currentTaskId,
    pendingTasks,
    startGeneration,
    cancelGeneration,
  };
}
