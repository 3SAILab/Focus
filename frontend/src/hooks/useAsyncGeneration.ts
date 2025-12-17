// src/hooks/useAsyncGeneration.ts
// Hook for async image generation with task polling
// Uses GlobalTaskContext for cross-page task management

import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../api';
import type { GenerationTask, GenerationTypeValue } from '../type';
import { useGlobalTask } from '../context/GlobalTaskContext';

export interface UseAsyncGenerationOptions {
  onComplete: (task: GenerationTask) => void;
  onError: (error: string, isQuotaError: boolean) => void;
}

export interface UseAsyncGenerationResult {
  isGenerating: boolean;
  currentTaskId: string | null;
  startGeneration: (formData: FormData) => Promise<void>;
  cancelGeneration: () => void;
}

/**
 * Hook for async image generation
 * - Sends request and gets task_id immediately
 * - Registers task with GlobalTaskContext for cross-page polling
 * - GlobalTaskContext handles toast notifications even if user navigates away
 */
export function useAsyncGeneration(options: UseAsyncGenerationOptions): UseAsyncGenerationResult {
  const { onComplete, onError } = options;
  const { registerTask, unregisterTask, isTaskPolling, getCompletedTask, clearCompletedTask } = useGlobalTask();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  
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
      // Note: We don't unregister the task - GlobalTaskContext continues polling
    };
  }, []);
  
  /**
   * Start async generation
   */
  const startGeneration = useCallback(async (formData: FormData) => {
    setIsGenerating(true);
    
    try {
      const response = await api.generate(formData);
      
      // Handle error responses
      if (!response.ok) {
        const errData = await response.json();
        const isQuotaError = response.status === 429 || 
                           errData.error?.includes('429') ||
                           errData.error?.includes('quota');
        if (isMountedRef.current) {
          setIsGenerating(false);
          onErrorRef.current(errData.error || '请求失败', isQuotaError);
        }
        return;
      }
      
      const data = await response.json();
      
      // Check if we got a task_id
      if (data.task_id) {
        if (isMountedRef.current) {
          setCurrentTaskId(data.task_id);
        }
        
        // Register task with GlobalTaskContext for polling
        // GlobalTaskContext will show toast when task completes
        const taskType = (formData.get('type') as string || 'create') as GenerationTypeValue;
        registerTask(data.task_id, taskType);
      } else {
        // No task_id, unexpected response
        if (isMountedRef.current) {
          setIsGenerating(false);
          onErrorRef.current('服务器响应异常', false);
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        setIsGenerating(false);
        const errorMessage = error instanceof Error ? error.message : '网络错误';
        onErrorRef.current(errorMessage, false);
      }
    }
  }, [registerTask]);
  
  /**
   * Cancel current generation (stop polling)
   */
  const cancelGeneration = useCallback(() => {
    if (currentTaskId) {
      unregisterTask(currentTaskId);
    }
    setIsGenerating(false);
    setCurrentTaskId(null);
  }, [currentTaskId, unregisterTask]);
  
  // Check if current task has completed (polled by GlobalTaskContext)
  useEffect(() => {
    if (!currentTaskId) return;
    
    const checkInterval = setInterval(() => {
      // Check if task is still being polled
      if (!isTaskPolling(currentTaskId)) {
        // Task finished, check if we have the result
        const completedTask = getCompletedTask(currentTaskId);
        if (completedTask && isMountedRef.current) {
          setIsGenerating(false);
          setCurrentTaskId(null);
          // Call onComplete to update local state (image display, history)
          // Note: Toast is already shown by GlobalTaskContext
          onCompleteRef.current(completedTask);
          clearCompletedTask(currentTaskId);
        } else if (!isTaskPolling(currentTaskId) && isMountedRef.current) {
          // Task finished but no result (maybe failed), just reset state
          setIsGenerating(false);
          setCurrentTaskId(null);
        }
      }
    }, 500);
    
    return () => clearInterval(checkInterval);
  }, [currentTaskId, isTaskPolling, getCompletedTask, clearCompletedTask]);
  
  return {
    isGenerating,
    currentTaskId,
    startGeneration,
    cancelGeneration,
  };
}
