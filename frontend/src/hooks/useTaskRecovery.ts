// src/hooks/useTaskRecovery.ts
// Task recovery hook for restoring in-progress generation tasks after page refresh

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import type { GenerationTask, GenerationTypeValue } from '../type';

// Polling interval in milliseconds
const POLLING_INTERVAL = 2000;

export interface UseTaskRecoveryOptions {
  type: GenerationTypeValue;
  onTaskComplete: (task: GenerationTask) => void;
  onTaskFailed: (task: GenerationTask) => void;
}

export interface UseTaskRecoveryResult {
  processingTasks: GenerationTask[];
  isRecovering: boolean;
}

/**
 * Hook for recovering and monitoring in-progress generation tasks
 * 
 * Requirements covered:
 * - 1.4: Query for tasks with status "processing" on page load
 * - 1.5: Display generated image when task completes
 * - 2.1: Display loading indicator for processing tasks
 * - 2.2: Poll task status every 2 seconds
 * - 2.3: Stop polling when task completes
 * - 2.4: Stop polling when task fails
 */
export function useTaskRecovery(options: UseTaskRecoveryOptions): UseTaskRecoveryResult {
  const { type, onTaskComplete, onTaskFailed } = options;
  
  const [processingTasks, setProcessingTasks] = useState<GenerationTask[]>([]);
  const [isRecovering, setIsRecovering] = useState(true);
  
  // Use refs to track polling intervals for each task
  const pollingIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Store callbacks in refs to avoid stale closures
  const onTaskCompleteRef = useRef(onTaskComplete);
  const onTaskFailedRef = useRef(onTaskFailed);
  
  // Update callback refs when they change
  useEffect(() => {
    onTaskCompleteRef.current = onTaskComplete;
    onTaskFailedRef.current = onTaskFailed;
  }, [onTaskComplete, onTaskFailed]);

  /**
   * Stop polling for a specific task
   */
  const stopPolling = useCallback((taskId: string) => {
    const interval = pollingIntervalsRef.current.get(taskId);
    if (interval) {
      clearInterval(interval);
      pollingIntervalsRef.current.delete(taskId);
    }
  }, []);

  /**
   * Poll a single task's status
   * Property 5: Polling Termination on Completion
   * - When task status changes to "completed" or "failed", polling stops
   */
  const pollTaskStatus = useCallback(async (taskId: string) => {
    if (!isMountedRef.current) return;
    
    try {
      const response = await api.getTaskStatus(taskId);
      if (!response.ok) {
        console.error(`[TaskRecovery] Failed to get task status for ${taskId}`);
        return;
      }
      
      const task: GenerationTask = await response.json();
      
      if (!isMountedRef.current) return;
      
      // Check if task has completed or failed - stop polling (Requirement 2.3, 2.4)
      if (task.status === 'completed') {
        stopPolling(taskId);
        // Remove from processing tasks
        setProcessingTasks(prev => prev.filter(t => t.task_id !== taskId));
        // Notify completion
        onTaskCompleteRef.current(task);
      } else if (task.status === 'failed') {
        stopPolling(taskId);
        // Remove from processing tasks
        setProcessingTasks(prev => prev.filter(t => t.task_id !== taskId));
        // Notify failure
        onTaskFailedRef.current(task);
      }
      // If still processing, continue polling (interval continues)
    } catch (error) {
      console.error(`[TaskRecovery] Error polling task ${taskId}:`, error);
    }
  }, [stopPolling]);

  /**
   * Start polling for a task
   * Requirement 2.2: Poll task status every 2 seconds
   */
  const startPolling = useCallback((taskId: string) => {
    // Don't start if already polling
    if (pollingIntervalsRef.current.has(taskId)) return;
    
    // Poll immediately first
    pollTaskStatus(taskId);
    
    // Then set up interval for subsequent polls
    const interval = setInterval(() => {
      pollTaskStatus(taskId);
    }, POLLING_INTERVAL);
    
    pollingIntervalsRef.current.set(taskId, interval);
  }, [pollTaskStatus]);

  /**
   * Initial task recovery on mount
   * Requirement 1.4: Query for tasks with status "processing" on page load
   */
  useEffect(() => {
    const recoverTasks = async () => {
      if (!isMountedRef.current) return;
      
      try {
        console.log(`[TaskRecovery] Recovering tasks for type: ${type}`);
        const response = await api.getProcessingTasks(type);
        
        if (!response.ok) {
          console.error('[TaskRecovery] Failed to get processing tasks');
          setIsRecovering(false);
          return;
        }
        
        const tasks: GenerationTask[] = await response.json();
        
        if (!isMountedRef.current) return;
        
        console.log(`[TaskRecovery] Found ${tasks.length} processing tasks`);
        
        if (tasks.length > 0) {
          setProcessingTasks(tasks);
          // Start polling for each task
          tasks.forEach(task => {
            startPolling(task.task_id);
          });
        }
        
        setIsRecovering(false);
      } catch (error) {
        console.error('[TaskRecovery] Error recovering tasks:', error);
        if (isMountedRef.current) {
          setIsRecovering(false);
        }
      }
    };
    
    recoverTasks();
  }, [type, startPolling]);

  /**
   * Cleanup on unmount
   * Stop all polling intervals
   */
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // Clear all polling intervals
      pollingIntervalsRef.current.forEach((interval) => {
        clearInterval(interval);
      });
      pollingIntervalsRef.current.clear();
    };
  }, []);

  return {
    processingTasks,
    isRecovering,
  };
}
