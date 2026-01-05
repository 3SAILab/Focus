/**
 * useDeleteConfirmation Hook
 * 从 Create.tsx 提取的删除确认逻辑
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { useState, useCallback } from 'react';
import type { GenerationHistory } from '../type';
import type { FailedGeneration } from './useGroupedHistory';
import type { BatchResult } from '../type/generation';
import { api } from '../api';

/**
 * 删除目标类型
 * Requirements: 7.1
 */
export interface DeleteTarget {
  type: 'single' | 'batch' | 'failed' | 'session-batch';
  item?: GenerationHistory;
  batchId?: string;
  items?: GenerationHistory[];
  failedId?: string;
  message: string;
}

/**
 * Toast 上下文接口（简化版，仅包含需要的方法）
 */
interface ToastContext {
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
}

/**
 * useDeleteConfirmation Hook 参数接口
 * Requirements: 7.1
 */
export interface UseDeleteConfirmationParams {
  /** 重新加载历史记录的回调 */
  loadHistory: () => Promise<void>;
  /** 更新失败记录列表的 setter */
  setFailedGenerations: React.Dispatch<React.SetStateAction<FailedGeneration[]>>;
  /** 更新批次结果列表的 setter */
  setBatchResults: React.Dispatch<React.SetStateAction<BatchResult[]>>;
  /** Toast 上下文 */
  toast: ToastContext;
}

/**
 * useDeleteConfirmation Hook 返回值接口
 * Requirements: 7.2, 7.3, 7.4
 */
export interface UseDeleteConfirmationResult {
  /** 当前删除目标 */
  deleteTarget: DeleteTarget | null;
  /** 是否正在删除 */
  isDeleting: boolean;
  /** 点击删除单条记录 - 显示确认对话框 */
  handleDeleteSingleClick: (item: GenerationHistory) => void;
  /** 点击删除批次记录 - 显示确认对话框 */
  handleDeleteBatchClick: (batchId: string, items: GenerationHistory[]) => void;
  /** 删除当前会话的失败记录 - 直接删除（无需确认） */
  handleDeleteFailedRecord: (failedId: string) => void;
  /** 删除当前会话的批次结果 - 直接删除（无需确认） */
  handleDeleteSessionBatch: (batchId: string) => void;
  /** 确认删除 */
  handleDeleteConfirm: () => Promise<void>;
  /** 关闭删除对话框 */
  closeDeleteDialog: () => void;
}

/**
 * 删除确认 Hook
 * 管理删除目标状态和删除相关的处理函数
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 * 
 * @param params - Hook 参数
 * @returns 删除确认状态和回调函数
 */
export function useDeleteConfirmation(params: UseDeleteConfirmationParams): UseDeleteConfirmationResult {
  const {
    loadHistory,
    setFailedGenerations,
    setBatchResults,
    toast,
  } = params;

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * 点击删除单条历史记录 - 显示确认对话框
   * Requirements: 7.1
   */
  const handleDeleteSingleClick = useCallback((item: GenerationHistory) => {
    if (!item.id) {
      toast.error('无法删除：记录 ID 不存在');
      return;
    }
    setDeleteTarget({
      type: 'single',
      item,
      message: '确定要删除这条记录吗？删除后无法恢复，但不会影响生成次数统计。',
    });
  }, [toast]);

  /**
   * 点击删除批次记录 - 显示确认对话框
   * Requirements: 7.1
   */
  const handleDeleteBatchClick = useCallback((batchId: string, items: GenerationHistory[]) => {
    const count = items.length;
    setDeleteTarget({
      type: 'batch',
      batchId,
      items,
      message: `确定要删除这批 ${count} 张图片吗？删除后无法恢复，但不会影响生成次数统计。`,
    });
  }, []);

  /**
   * 删除当前会话的失败记录 - 直接删除（无需确认）
   * Requirements: 7.2
   */
  const handleDeleteFailedRecord = useCallback((failedId: string) => {
    setFailedGenerations(prev => prev.filter(f => f.id !== failedId));
  }, [setFailedGenerations]);

  /**
   * 删除当前会话的批次结果 - 直接删除（无需确认）
   * Requirements: 7.2
   */
  const handleDeleteSessionBatch = useCallback((batchId: string) => {
    setBatchResults(prev => prev.filter(b => b.batchId !== batchId));
  }, [setBatchResults]);

  /**
   * 确认删除
   * Requirements: 7.3
   */
  const handleDeleteConfirm = useCallback(async () => {
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
  }, [deleteTarget, loadHistory, toast]);

  /**
   * 关闭删除对话框
   * Requirements: 7.4
   */
  const closeDeleteDialog = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  return {
    deleteTarget,
    isDeleting,
    handleDeleteSingleClick,
    handleDeleteBatchClick,
    handleDeleteFailedRecord,
    handleDeleteSessionBatch,
    handleDeleteConfirm,
    closeDeleteDialog,
  };
}
