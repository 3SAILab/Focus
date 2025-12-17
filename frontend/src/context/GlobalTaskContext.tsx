// src/context/GlobalTaskContext.tsx
// Global task manager for handling async generation tasks across page navigation

import { createContext, useContext, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { api } from '../api';
import type { GenerationTask, GenerationTypeValue } from '../type';
import { useToast } from './ToastContext';

// Polling interval in milliseconds
const POLLING_INTERVAL = 2000;

// Task type to Chinese name mapping
const TYPE_NAMES: Record<string, string> = {
  'white_background': '白底图',
  'clothing_change': '换装',
  'product_scene': '商品图',
  'light_shadow': '光影融合',
  'create': '图片',
};

interface GlobalTaskContextType {
  /**
   * Register a task for global polling
   * The task will continue to be polled even if the originating page is unmounted
   */
  registerTask: (taskId: string, type: GenerationTypeValue) => void;
  
  /**
   * Unregister a task (stop polling)
   */
  unregisterTask: (taskId: string) => void;
  
  /**
   * Check if a task is being polled
   */
  isTaskPolling: (taskId: string) => boolean;
  
  /**
   * Get completed task result (if any)
   */
  getCompletedTask: (taskId: string) => GenerationTask | undefined;
  
  /**
   * Clear completed task from cache
   */
  clearCompletedTask: (taskId: string) => void;
}

const GlobalTaskContext = createContext<GlobalTaskContextType | undefined>(undefined);

interface TaskInfo {
  taskId: string;
  type: GenerationTypeValue;
  intervalId: ReturnType<typeof setInterval> | null;
}

export function GlobalTaskProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const tasksRef = useRef<Map<string, TaskInfo>>(new Map());
  const completedTasksRef = useRef<Map<string, GenerationTask>>(new Map());
  const toastRef = useRef(toast);
  
  // Keep toast ref updated
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  
  /**
   * Poll a task's status
   */
  const pollTask = useCallback(async (taskId: string) => {
    const taskInfo = tasksRef.current.get(taskId);
    if (!taskInfo) {
      console.log(`[GlobalTask] Task ${taskId} not found in tasksRef, skipping poll`);
      return;
    }
    
    try {
      console.log(`[GlobalTask] Polling task ${taskId}...`);
      const response = await api.getTaskStatus(taskId);
      if (!response.ok) {
        console.error(`[GlobalTask] Failed to get task status for ${taskId}, status: ${response.status}`);
        return;
      }
      
      const task: GenerationTask = await response.json();
      console.log(`[GlobalTask] Task ${taskId} status: ${task.status}, type: ${task.type}`);
      
      if (task.status === 'completed') {
        // Stop polling
        if (taskInfo.intervalId) {
          clearInterval(taskInfo.intervalId);
        }
        tasksRef.current.delete(taskId);
        
        // Store completed task for later retrieval
        completedTasksRef.current.set(taskId, task);
        
        // Show global toast notification
        const typeName = TYPE_NAMES[task.type] || '图片';
        console.log(`[GlobalTask] Task completed! Showing success toast for ${typeName}, toastRef exists: ${!!toastRef.current}`);
        
        // Use setTimeout to ensure toast is shown after any pending state updates
        setTimeout(() => {
          console.log(`[GlobalTask] Calling toast.success for ${typeName}`);
          toastRef.current.success(`${typeName}生成完成！`);
        }, 0);
      } else if (task.status === 'failed') {
        // Stop polling
        if (taskInfo.intervalId) {
          clearInterval(taskInfo.intervalId);
        }
        tasksRef.current.delete(taskId);
        
        // Show error toast
        const typeName = TYPE_NAMES[task.type] || '图片';
        console.log(`[GlobalTask] Task failed! Showing error toast for ${typeName}`);
        
        // Use setTimeout to ensure toast is shown after any pending state updates
        setTimeout(() => {
          console.log(`[GlobalTask] Calling toast.error for ${typeName}`);
          toastRef.current.error(`${typeName}生成失败: ${task.error_msg || '未知错误'}`);
        }, 0);
      }
      // If still processing, continue polling
    } catch (error) {
      console.error(`[GlobalTask] Error polling task ${taskId}:`, error);
    }
  }, []);
  
  /**
   * Register a task for global polling
   */
  const registerTask = useCallback((taskId: string, type: GenerationTypeValue) => {
    // Don't register if already polling
    if (tasksRef.current.has(taskId)) {
      console.log(`[GlobalTask] Task ${taskId} already registered`);
      return;
    }
    
    console.log(`[GlobalTask] Registering task ${taskId} of type ${type}, total tasks: ${tasksRef.current.size + 1}`);
    
    const taskInfo: TaskInfo = {
      taskId,
      type,
      intervalId: null,
    };
    
    tasksRef.current.set(taskId, taskInfo);
    
    // Poll immediately
    console.log(`[GlobalTask] Starting immediate poll for task ${taskId}`);
    pollTask(taskId);
    
    // Set up interval
    const intervalId = setInterval(() => {
      console.log(`[GlobalTask] Interval poll for task ${taskId}`);
      pollTask(taskId);
    }, POLLING_INTERVAL);
    
    // Update the map with the interval ID
    taskInfo.intervalId = intervalId;
    tasksRef.current.set(taskId, taskInfo);
    
    console.log(`[GlobalTask] Task ${taskId} registered with interval ${intervalId}`);
  }, [pollTask]);
  
  /**
   * Unregister a task
   */
  const unregisterTask = useCallback((taskId: string) => {
    const taskInfo = tasksRef.current.get(taskId);
    if (taskInfo) {
      if (taskInfo.intervalId) {
        clearInterval(taskInfo.intervalId);
      }
      tasksRef.current.delete(taskId);
      console.log(`[GlobalTask] Unregistered task ${taskId}`);
    }
  }, []);
  
  /**
   * Check if a task is being polled
   */
  const isTaskPolling = useCallback((taskId: string) => {
    return tasksRef.current.has(taskId);
  }, []);
  
  /**
   * Get completed task result
   */
  const getCompletedTask = useCallback((taskId: string) => {
    return completedTasksRef.current.get(taskId);
  }, []);
  
  /**
   * Clear completed task from cache
   */
  const clearCompletedTask = useCallback((taskId: string) => {
    completedTasksRef.current.delete(taskId);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all intervals
      tasksRef.current.forEach((taskInfo) => {
        if (taskInfo.intervalId) {
          clearInterval(taskInfo.intervalId);
        }
      });
      tasksRef.current.clear();
    };
  }, []);
  
  return (
    <GlobalTaskContext.Provider value={{ 
      registerTask, 
      unregisterTask, 
      isTaskPolling,
      getCompletedTask,
      clearCompletedTask,
    }}>
      {children}
    </GlobalTaskContext.Provider>
  );
}

export function useGlobalTask() {
  const context = useContext(GlobalTaskContext);
  if (context === undefined) {
    throw new Error('useGlobalTask must be used within a GlobalTaskProvider');
  }
  return context;
}
