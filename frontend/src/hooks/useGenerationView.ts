/**
 * useGenerationView Hook
 * 封装电商视图（白底图、换装、商品图、光影）的通用状态和逻辑
 */

import { useState, useCallback } from 'react';
import type { GenerationHistory, GenerationTask, GenerationTypeValue } from '../type';
import type { PendingTaskInfo } from './useAsyncGeneration';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorHandler';
import { useTaskRecovery } from './useTaskRecovery';
import { useAsyncGeneration } from './useAsyncGeneration';

export interface UseGenerationViewOptions {
  type: GenerationTypeValue;
  loadHistoryFn: () => Promise<GenerationHistory[]>;
}

export interface UseGenerationViewResult {
  // State
  generatedImage: string | null;
  setGeneratedImage: (url: string | null) => void;
  history: GenerationHistory[];
  lightboxImage: string | null;
  setLightboxImage: (url: string | null) => void;
  counterRefresh: number;
  showQuotaError: boolean;
  showContact: boolean;
  contextMenu: { x: number; y: number; url: string } | null;
  
  // Generation state
  isGenerating: boolean;
  isRecovering: boolean;
  processingTasks: GenerationTask[];
  pendingTasks: PendingTaskInfo[];
  
  // Actions
  loadHistory: () => Promise<void>;
  startGeneration: (formData: FormData) => Promise<void>;
  handleError: (errorMsg: string, isQuotaError: boolean) => void;
  handleHistoryClick: (item: GenerationHistory) => void;
  handleContextMenu: (e: React.MouseEvent, url: string) => void;
  closeContextMenu: () => void;
  
  // Quota error handlers
  closeQuotaError: () => void;
  closeContact: () => void;
  openContactFromQuota: () => void;
}

export function useGenerationView({
  type,
  loadHistoryFn,
}: UseGenerationViewOptions): UseGenerationViewResult {
  const toast = useToast();
  
  // State
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string } | null>(null);

  // Load history
  const loadHistory = useCallback(async () => {
    try {
      const data = await loadHistoryFn();
      setHistory(data);
    } catch (error) {
      console.error(`[${type}] 加载历史失败:`, error);
    }
  }, [loadHistoryFn, type]);

  // Error handler
  const handleError = useCallback((errorMsg: string, isQuotaError: boolean) => {
    console.log(`[${type}] Error:`, errorMsg, 'isQuotaError:', isQuotaError);
    if (isQuotaError) {
      setShowQuotaError(true);
    } else {
      const { message } = getErrorMessage(errorMsg);
      toast.error(message);
    }
  }, [toast, type]);

  // Task completion callback
  const handleTaskComplete = useCallback((task: GenerationTask) => {
    console.log(`[${type}] Task completed:`, task.task_id);
    if (task.image_url) {
      setGeneratedImage(task.image_url);
    }
    loadHistory();
    setCounterRefresh(prev => prev + 1);
  }, [loadHistory, type]);

  // Task failed callback
  const handleTaskFailed = useCallback((task: GenerationTask) => {
    console.log(`[${type}] Task failed:`, task.task_id, task.error_msg);
    const { message, isQuotaError } = getErrorMessage(task.error_msg);
    handleError(message, isQuotaError);
  }, [handleError, type]);

  // Async generation hook
  const { isGenerating, startGeneration, pendingTasks } = useAsyncGeneration({
    onComplete: handleTaskComplete,
    onError: handleError,
  });

  // Task recovery hook
  const { processingTasks, isRecovering } = useTaskRecovery({
    type,
    onTaskComplete: handleTaskComplete,
    onTaskFailed: handleTaskFailed,
  });

  // History click handler
  const handleHistoryClick = useCallback((item: GenerationHistory) => {
    setGeneratedImage(item.image_url);
  }, []);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setContextMenu({
      x: rect.right + 8,
      y: Math.min(e.clientY, window.innerHeight - 120),
      url,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Quota error handlers
  const closeQuotaError = useCallback(() => {
    setShowQuotaError(false);
  }, []);

  const closeContact = useCallback(() => {
    setShowContact(false);
  }, []);

  const openContactFromQuota = useCallback(() => {
    setShowQuotaError(false);
    setShowContact(true);
  }, []);

  return {
    // State
    generatedImage,
    setGeneratedImage,
    history,
    lightboxImage,
    setLightboxImage,
    counterRefresh,
    showQuotaError,
    showContact,
    contextMenu,
    
    // Generation state
    isGenerating,
    isRecovering,
    processingTasks,
    pendingTasks,
    
    // Actions
    loadHistory,
    startGeneration,
    handleError,
    handleHistoryClick,
    handleContextMenu,
    closeContextMenu,
    
    // Quota error handlers
    closeQuotaError,
    closeContact,
    openContactFromQuota,
  };
}
