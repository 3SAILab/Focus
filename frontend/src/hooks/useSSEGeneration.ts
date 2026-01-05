/**
 * SSE 流式生成 Hook
 * 从 Create.tsx 提取，用于管理 SSE 流式生成状态和回调
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

import { useState, useCallback } from 'react';
import type { SSEStartEvent, SSEImageEvent, SSECompleteEvent } from '../api';
import { createBatchResult, type BatchResult } from '../type/generation';
import { getErrorMessage } from '../utils/errorHandler';

/**
 * useSSEGeneration 参数接口
 * Requirements: 6.1
 */
export interface UseSSEGenerationParams {
  /** 批次完成时的回调 */
  onBatchComplete: (batch: BatchResult) => void;
  /** 重新加载历史记录的回调 */
  loadHistory: () => Promise<void>;
  /** 更新 pendingTasks 的回调（用于关联 batchId） */
  updatePendingTaskBatchId?: (tempId: string, batchId: string) => void;
  /** 移除 pendingTask 的回调 */
  removePendingTask?: (identifier: { tempId?: string; batchId?: string }) => void;
  /** 生成完成后的清理回调 */
  onGenerationComplete?: () => void;
}

/**
 * useSSEGeneration 返回值接口
 * Requirements: 6.2, 6.3
 */
export interface UseSSEGenerationResult {
  /** 当前流式生成的批次 */
  streamingBatch: BatchResult | null;
  /** SSE 开始事件处理 */
  handleSSEStart: (event: SSEStartEvent, tempId?: string) => void;
  /** SSE 图片事件处理 */
  handleSSEImage: (event: SSEImageEvent) => void;
  /** SSE 完成事件处理 */
  handleSSEComplete: (event: SSECompleteEvent, tempId?: string) => Promise<void>;
  /** 清除流式批次状态 */
  clearStreamingBatch: () => void;
}

/**
 * SSE 流式生成 Hook
 * 管理 streamingBatch 状态和 SSE 事件处理回调
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 * 
 * @param params - Hook 参数
 * @returns SSE 生成状态和回调函数
 */
export function useSSEGeneration(params: UseSSEGenerationParams): UseSSEGenerationResult {
  const {
    onBatchComplete,
    loadHistory,
    updatePendingTaskBatchId,
    removePendingTask,
    onGenerationComplete,
  } = params;

  // SSE 流式生成状态
  const [streamingBatch, setStreamingBatch] = useState<BatchResult | null>(null);

  /**
   * SSE 开始事件处理
   * 创建流式批次，初始化所有图片为 loading 状态
   * Requirements: 6.1
   */
  const handleSSEStart = useCallback((event: SSEStartEvent, tempId?: string) => {
    // 创建流式批次，初始化所有图片为 loading 状态
    const newBatch = createBatchResult({
      batchId: event.batch_id,
      prompt: event.prompt,
      imageCount: event.count,
      refImages: event.ref_images || [],
      status: 'streaming',
    });

    // 使用 tempId 精确更新对应的 pendingTask
    if (tempId && updatePendingTaskBatchId) {
      updatePendingTaskBatchId(tempId, event.batch_id);
    }

    setStreamingBatch(newBatch);
  }, [updatePendingTaskBatchId]);

  /**
   * SSE 图片事件处理
   * 更新流式批次中对应索引的图片
   * Requirements: 6.2
   */
  const handleSSEImage = useCallback((event: SSEImageEvent) => {
    console.log('[useSSEGeneration] SSE Image:', event);
    
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

  /**
   * SSE 完成事件处理
   * 将流式批次移动到完成的批次列表
   * Requirements: 6.3, 6.4
   */
  const handleSSEComplete = useCallback(async (event: SSECompleteEvent, tempId?: string) => {
    console.log('[useSSEGeneration] SSE Complete:', event);

    // 使用统一的 removePendingTask 函数清除对应的 pendingTask
    if (removePendingTask) {
      if (tempId) {
        removePendingTask({ tempId });
      } else {
        // 兼容：如果没有 tempId，使用 batch_id 清除
        removePendingTask({ batchId: event.batch_id });
      }
    }

    // 获取当前的 streamingBatch 用于创建最终批次
    // 使用函数式更新来获取最新状态并清除
    setStreamingBatch(currentStreamingBatch => {
      // 将流式批次移动到完成的批次列表
      if (currentStreamingBatch) {
        // 使用最终的图片数据更新
        const finalBatch = createBatchResult({
          batchId: currentStreamingBatch.batchId,
          prompt: currentStreamingBatch.prompt,
          imageCount: event.images.length,
          images: event.images.map((img) => ({
            url: img.image_url,
            // 如果有错误，使用 getErrorMessage 过滤敏感信息
            error: img.error ? getErrorMessage(img.error).message : undefined,
          })),
          refImages: event.ref_images || currentStreamingBatch.refImages || [],
          status: 'completed',
        });
        
        onBatchComplete(finalBatch);
      }
      
      // 清除流式批次状态
      return null;
    });

    // 调用生成完成回调
    onGenerationComplete?.();

    // 重新加载历史记录
    await loadHistory();
  }, [onBatchComplete, loadHistory, removePendingTask, onGenerationComplete]);

  /**
   * 清除流式批次状态
   * 用于错误处理或取消操作
   */
  const clearStreamingBatch = useCallback(() => {
    setStreamingBatch(null);
  }, []);

  return {
    streamingBatch,
    handleSSEStart,
    handleSSEImage,
    handleSSEComplete,
    clearStreamingBatch,
  };
}
