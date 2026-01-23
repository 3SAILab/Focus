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
  /** 余额不足错误回调 */
  onQuotaError?: () => void;
}

/**
 * useSSEGeneration 返回值接口
 * Requirements: 6.2, 6.3
 */
export interface UseSSEGenerationResult {
  /** 当前流式生成的批次 Map（支持多个并发批次） */
  streamingBatches: Map<string, BatchResult>;
  /** SSE 开始事件处理 */
  handleSSEStart: (event: SSEStartEvent, tempId?: string) => void;
  /** SSE 图片事件处理 */
  handleSSEImage: (event: SSEImageEvent) => void;
  /** SSE 完成事件处理 */
  handleSSEComplete: (event: SSECompleteEvent, tempId?: string) => Promise<void>;
  /** 清除流式批次状态（可选指定 batchId） */
  clearStreamingBatch: (batchId?: string) => void;
  /** SSE 错误处理（保留已成功的图片，标记未完成的为失败） */
  handleSSEError: (errorMessage: string, batchId?: string) => void;
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
    removePendingTask,
    onGenerationComplete,
    onQuotaError,
  } = params;

  // SSE 流式生成状态 - 支持多个并发批次
  const [streamingBatches, setStreamingBatches] = useState<Map<string, BatchResult>>(new Map());

  /**
   * SSE 开始事件处理
   * 创建流式批次，初始化所有图片为 loading 状态
   * Requirements: 6.1
   */
  const handleSSEStart = useCallback((event: SSEStartEvent, tempId?: string) => {
    console.log('[useSSEGeneration] SSE Start:', event, 'tempId:', tempId);
    
    // 创建流式批次，初始化所有图片为 loading 状态
    const newBatch = createBatchResult({
      batchId: event.batch_id,
      prompt: event.prompt,
      imageCount: event.count,
      refImages: event.ref_images || [],
      aspectRatio: event.aspect_ratio,
      imageSize: event.image_size,
      status: 'streaming',
    });

    // 清除 pendingTask（SSE 模式下不需要 taskId，直接清除）
    if (tempId && removePendingTask) {
      console.log('[useSSEGeneration] 清除 pendingTask by tempId:', tempId);
      removePendingTask({ tempId });
    }

    // 添加到 streamingBatches Map
    setStreamingBatches(prev => {
      const newMap = new Map(prev);
      newMap.set(event.batch_id, newBatch);
      return newMap;
    });
  }, [removePendingTask]);

  /**
   * SSE 图片事件处理
   * 更新流式批次中对应索引的图片
   * Requirements: 6.2
   */
  const handleSSEImage = useCallback((event: SSEImageEvent) => {
    console.log('[useSSEGeneration] SSE Image:', event);
    
    // 使用 event.batch_id 直接定位批次
    setStreamingBatches(prev => {
      const batch = prev.get(event.batch_id);
      if (!batch) {
        console.warn('[useSSEGeneration] 未找到批次:', event.batch_id);
        return prev;
      }
      
      // 检查索引是否有效
      if (event.index < 0 || event.index >= batch.images.length) {
        console.warn('[useSSEGeneration] 无效的图片索引:', event.index, '批次图片数量:', batch.images.length);
        return prev;
      }
      
      const newImages = [...batch.images];
      const errorMessage = event.error ? getErrorMessage(event.error).message : undefined;
      
      newImages[event.index] = {
        url: event.image_url,
        error: errorMessage,
        isLoading: false,
        index: event.index,
      };
      
      const newMap = new Map(prev);
      newMap.set(event.batch_id, { ...batch, images: newImages });
      
      return newMap;
    });
  }, []);

  /**
   * SSE 完成事件处理
   * 将流式批次移动到完成的批次列表
   * Requirements: 6.3, 6.4
   */
  const handleSSEComplete = useCallback(async (event: SSECompleteEvent, tempId?: string) => {
    console.log('[useSSEGeneration] ========== SSE Complete 开始处理 ==========');
    console.log('[useSSEGeneration] Event:', event);
    console.log('[useSSEGeneration] tempId:', tempId);

    // 使用统一的 removePendingTask 函数清除对应的 pendingTask
    if (removePendingTask) {
      if (tempId) {
        console.log('[useSSEGeneration] 清除 pendingTask by tempId:', tempId);
        removePendingTask({ tempId });
      } else {
        // 兼容：如果没有 tempId，使用 batch_id 清除
        console.log('[useSSEGeneration] 清除 pendingTask by batchId:', event.batch_id);
        removePendingTask({ batchId: event.batch_id });
      }
    }

    // 预先检查是否有余额不足错误（在 setState 之前）
    let hasQuotaError = false;
    const processedImages = event.images.map((img) => {
      if (img.error) {
        const { message, isQuotaError } = getErrorMessage(img.error);
        if (isQuotaError) {
          hasQuotaError = true;
        }
        return { url: img.image_url, error: message };
      }
      return { url: img.image_url };
    });

    console.log('[useSSEGeneration] 处理后的图片:', processedImages);

    // 获取当前的 streamingBatch 用于创建最终批次
    // 使用函数式更新来获取最新状态并清除
    setStreamingBatches(currentBatches => {
      const currentBatch = currentBatches.get(event.batch_id);
      console.log('[useSSEGeneration] setState 回调执行 - 当前 batch:', currentBatch);
      
      // 将流式批次移动到完成的批次列表
      if (currentBatch) {
        // 根据后端返回的 status 确定批次状态
        // status: 'success' | 'partial' | 'failed'
        const batchStatus = event.status === 'failed' ? 'failed' : 'completed';
        
        const finalBatch = createBatchResult({
          batchId: currentBatch.batchId,
          prompt: currentBatch.prompt,
          imageCount: event.images.length,
          images: processedImages,
          refImages: event.ref_images || currentBatch.refImages || [],
          aspectRatio: currentBatch.aspectRatio,
          imageSize: currentBatch.imageSize,
          status: batchStatus,
        });
        
        console.log('[useSSEGeneration] 创建最终批次:', finalBatch);
        console.log('[useSSEGeneration] 调用 onBatchComplete');
        onBatchComplete(finalBatch);
        console.log('[useSSEGeneration] onBatchComplete 调用完成');
      } else {
        console.warn('[useSSEGeneration] ⚠️ 警告: 未找到批次', event.batch_id);
      }
      
      // 清除该批次的流式状态
      const newMap = new Map(currentBatches);
      newMap.delete(event.batch_id);
      console.log('[useSSEGeneration] ✅ 清除批次', event.batch_id, '剩余批次数:', newMap.size);
      return newMap;
    });

    // 等待一个微任务，确保 setState 已经执行
    await Promise.resolve();
    console.log('[useSSEGeneration] setState 应该已经执行完成');

    // 调用生成完成回调
    console.log('[useSSEGeneration] 调用 onGenerationComplete');
    onGenerationComplete?.();
    console.log('[useSSEGeneration] onGenerationComplete 调用完成');

    // 如果有余额不足错误，触发回调
    if (hasQuotaError && onQuotaError) {
      console.log('[useSSEGeneration] 触发 onQuotaError');
      onQuotaError();
    }

    // 重新加载历史记录
    console.log('[useSSEGeneration] 开始重新加载历史记录');
    await loadHistory();
    console.log('[useSSEGeneration] 历史记录加载完成');
    
    console.log('[useSSEGeneration] ========== SSE Complete 处理完成 ==========');
  }, [onBatchComplete, loadHistory, removePendingTask, onGenerationComplete, onQuotaError]);

  /**
   * 清除流式批次状态
   * 用于错误处理或取消操作
   * @param batchId - 可选，指定要清除的批次 ID。如果不指定，清除所有批次
   */
  const clearStreamingBatch = useCallback((batchId?: string) => {
    if (batchId) {
      setStreamingBatches(prev => {
        const newMap = new Map(prev);
        newMap.delete(batchId);
        return newMap;
      });
    } else {
      setStreamingBatches(new Map());
    }
  }, []);

  /**
   * SSE 错误处理
   * 保留已成功的图片，把还在 loading 的图片标记为失败
   * @param errorMessage - 错误消息
   * @param batchId - 可选，指定要处理的批次 ID。如果不指定，处理所有批次
   */
  const handleSSEError = useCallback((errorMessage: string, batchId?: string) => {
    console.log('[useSSEGeneration] SSE Error:', errorMessage, 'batchId:', batchId);
    
    setStreamingBatches(currentBatches => {
      const newMap = new Map(currentBatches);
      
      // 如果指定了 batchId，只处理该批次
      if (batchId) {
        const batch = currentBatches.get(batchId);
        if (batch) {
          // 处理图片：保留已成功的，把 loading 的标记为失败
          const processedImages = batch.images.map((img) => {
            if (img.isLoading) {
              return { ...img, isLoading: false, error: errorMessage };
            }
            return img;
          });
          
          // 检查是否有成功的图片
          const hasSuccess = processedImages.some(img => img.url && !img.error);
          const allFailed = processedImages.every(img => img.error);
          
          const finalBatch: BatchResult = {
            ...batch,
            images: processedImages,
            status: allFailed ? 'failed' : 'completed',
          };
          
          onBatchComplete(finalBatch);
          
          // 如果有成功的图片，重新加载历史记录
          if (hasSuccess) {
            loadHistory();
          }
          
          // 清除该批次
          newMap.delete(batchId);
        }
      } else {
        // 没有指定 batchId，处理所有批次
        currentBatches.forEach((batch) => {
          const processedImages = batch.images.map((img) => {
            if (img.isLoading) {
              return { ...img, isLoading: false, error: errorMessage };
            }
            return img;
          });
          
          const hasSuccess = processedImages.some(img => img.url && !img.error);
          const allFailed = processedImages.every(img => img.error);
          
          const finalBatch: BatchResult = {
            ...batch,
            images: processedImages,
            status: allFailed ? 'failed' : 'completed',
          };
          
          onBatchComplete(finalBatch);
          
          if (hasSuccess) {
            loadHistory();
          }
        });
        
        // 清除所有批次
        newMap.clear();
      }
      
      return newMap;
    });
    
    // 调用生成完成回调
    onGenerationComplete?.();
  }, [onBatchComplete, loadHistory, onGenerationComplete]);

  return {
    streamingBatches,
    handleSSEStart,
    handleSSEImage,
    handleSSEComplete,
    clearStreamingBatch,
    handleSSEError,
  };
}
