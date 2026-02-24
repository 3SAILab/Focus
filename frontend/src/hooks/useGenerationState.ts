/**
 * useGenerationState Hook
 * 从 Create.tsx 提取的生成状态管理逻辑
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { useState, useCallback } from 'react';
import type { PendingTask, FailedGeneration } from './useGroupedHistory';
import type { BatchResult } from '../type/generation';

/**
 * useGenerationState 参数接口
 * 无需参数 — 此 hook 管理自身状态
 * Requirements: 5.1
 */
export interface UseGenerationStateParams {
  // No params needed — this hook is self-contained state
}

/**
 * useGenerationState 返回值接口
 * Requirements: 5.2, 5.3, 5.4, 5.5
 */
export interface UseGenerationStateResult {
  /** 待处理的生成任务列表 */
  pendingTasks: PendingTask[];
  /** 设置待处理任务列表 */
  setPendingTasks: React.Dispatch<React.SetStateAction<PendingTask[]>>;
  /** 已完成的批次结果列表 */
  batchResults: BatchResult[];
  /** 设置批次结果列表 */
  setBatchResults: React.Dispatch<React.SetStateAction<BatchResult[]>>;
  /** 失败的生成记录列表 */
  failedGenerations: FailedGeneration[];
  /** 设置失败的生成记录列表 */
  setFailedGenerations: React.Dispatch<React.SetStateAction<FailedGeneration[]>>;
  /** 通过 tempId、taskId 或 batchId 移除待处理任务 */
  removePendingTask: (identifier: { tempId?: string; taskId?: string; batchId?: string }) => void;
  /** 通过 tempId 更新待处理任务的 batchId */
  updatePendingTaskBatchId: (tempId: string, batchId: string) => void;
  /** 检查批次是否包含失败的图片 */
  batchHasFailedImages: (batch: BatchResult) => boolean;
}

/**
 * 生成状态管理 Hook
 * 管理 pendingTasks、batchResults、failedGenerations 状态及其关联的操作回调
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 *
 * @returns 生成状态和回调函数
 */
export function useGenerationState(): UseGenerationStateResult {
  // 多任务占位卡片状态
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  // 多图生成状态
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  // 失败记录状态
  const [failedGenerations, setFailedGenerations] = useState<FailedGeneration[]>([]);

  /**
   * 统一的 PendingTask 清理函数
   * 通过 tempId、taskId 或 batchId 移除待处理任务
   * Requirements: 5.3
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
   * Requirements: 5.4
   */
  const updatePendingTaskBatchId = useCallback((tempId: string, batchId: string) => {
    setPendingTasks(prev => prev.map(p =>
      p.id === tempId ? { ...p, batchId } : p
    ));
  }, []);

  /**
   * 判断批次是否包含失败的图片
   * 失败的图片不会保存到后端历史记录，所以需要在前端保留显示
   * Requirements: 5.5
   */
  const batchHasFailedImages = useCallback((batch: BatchResult): boolean => {
    return batch.images.some(img => img.error);
  }, []);

  return {
    pendingTasks,
    setPendingTasks,
    batchResults,
    setBatchResults,
    failedGenerations,
    setFailedGenerations,
    removePendingTask,
    updatePendingTaskBatchId,
    batchHasFailedImages,
  };
}
