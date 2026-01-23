/**
 * useGroupedHistory Hook
 * 从 Create.tsx 提取的历史记录分组逻辑
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { useMemo } from 'react';
import type { GenerationHistory, GenerationTask, GenerationItem } from '../type';
import type { BatchResult } from '../type/generation';

/**
 * @deprecated 使用 GenerationItem 代替
 * 失败记录类型 - 保留以保持向后兼容
 * Requirements: 3.1
 */
export interface FailedGeneration {
  id: string;
  prompt: string;
  errorMessage: string;  // 失败记录必须有错误信息
  timestamp: number;
}

/**
 * @deprecated 使用 GenerationItem 代替
 * 待处理任务类型 - 保留以保持向后兼容
 * Requirements: 3.1
 */
export type PendingTask = Pick<GenerationItem, 'id' | 'prompt' | 'imageCount' | 'timestamp' | 'taskId' | 'batchId'>;

/**
 * 历史记录显示项类型
 * 支持单图、批次、失败记录、当前会话批次、待处理任务、恢复中任务、流式生成等多种类型
 * Requirements: 3.1, 3.2
 */
export interface HistoryDisplayItem {
  type: 'single' | 'batch' | 'failed' | 'session-batch' | 'pending' | 'recovering' | 'streaming';
  item?: GenerationHistory;  // 单图时使用
  batchId?: string;          // 批次时使用
  items?: GenerationHistory[]; // 批次时使用（已加载的图片）
  fullBatchItems?: (GenerationHistory | null)[]; // 批次时使用（完整数组，含占位）
  batchTotal?: number;       // 批次总数
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


/**
 * useGroupedHistory Hook 参数接口
 * Requirements: 3.2
 */
export interface UseGroupedHistoryParams {
  history: GenerationHistory[];
  failedGenerations: FailedGeneration[];
  batchResults: BatchResult[];
  processingTasks: GenerationTask[];
  pendingTasks: PendingTask[];
  streamingBatches: Map<string, BatchResult>;  // 改为 Map 支持多批次
}

/**
 * 将历史记录按 batch_id 分组，并合并当前会话的各种状态
 * 返回一个按时间戳排序的显示项数组
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 * 
 * @param params - 分组参数
 * @returns HistoryDisplayItem[] - 按时间戳升序排列的显示项数组
 */
export function useGroupedHistory(params: UseGroupedHistoryParams): HistoryDisplayItem[] {
  const {
    history,
    failedGenerations,
    batchResults,
    processingTasks,
    pendingTasks,
    streamingBatches,
  } = params;

  return useMemo((): HistoryDisplayItem[] => {
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
          
          // 修复布局偏移：只要 batch_total > 1，就始终使用批次模式渲染
          // 即使当前只加载到 1 张图片，也要显示为网格（其他位置显示占位符）
          // 这样可以避免 "大图 -> 网格" 的视觉跳变
          const batchTotal = item.batch_total;
          
          // 构建完整的批次图片数组，未加载的位置用 null 占位
          const fullBatchItems: (GenerationHistory | null)[] = Array(batchTotal).fill(null);
          for (const batchItem of batchItems) {
            const idx = batchItem.batch_index ?? 0;
            if (idx >= 0 && idx < batchTotal) {
              fullBatchItems[idx] = batchItem;
            }
          }
          
          // 参考图从第一个 item 获取（同一批次的参考图相同）
          result.push({
            type: 'batch',
            batchId: item.batch_id,
            items: batchItems, // 保留原始 items 用于其他逻辑
            fullBatchItems: fullBatchItems, // 完整的批次数组（含占位）
            batchTotal: batchTotal, // 批次总数
            prompt: batchItems[0].prompt,
            timestamp: batchItems[0].created_at,
            refImages: batchItems[0].ref_images,
          });
        }
      } else {
        // 单图记录（没有 batch_id 或 batch_total <= 1）
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
    // 修复：不再根据 streamingBatches 是否存在来决定是否显示 pendingTasks
    // 而是根据每个 pendingTask 是否已经有对应的 batchId（SSE 模式）来决定
    // 如果 pendingTask 有 batchId 且在 streamingBatches 中，说明它已经在 streamingBatch 中显示了，跳过
    for (const task of pendingTasks) {
      // 如果这个 pendingTask 已经有 taskId，且该 taskId 在 processingTasks 中，则跳过
      if (task.taskId && processingTaskIds.has(task.taskId)) {
        continue;
      }
      // 如果这个 pendingTask 已经有 batchId，且该 batchId 在 streamingBatches 中，则跳过
      // 因为它已经在 streamingBatch 中显示了
      if (task.batchId && streamingBatches.has(task.batchId)) {
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
    // 将所有 streamingBatches 加入到排序列表中
    streamingBatches.forEach((batch) => {
      result.push({
        type: 'streaming',
        batchId: batch.batchId,
        prompt: batch.prompt,
        timestamp: batch.timestamp,
        refImages: batch.refImages,
        sessionBatch: batch, // 复用 sessionBatch 字段存储 streamingBatch
      });
    });
    
    // 按时间戳排序（统一转换为数字比较）
    // Requirements: 3.3 - 按时间戳升序排列
    result.sort((a, b) => {
      const timeA = typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() : a.timestamp;
      const timeB = typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() : b.timestamp;
      return timeA - timeB;
    });
    
    return result;
  }, [history, failedGenerations, batchResults, processingTasks, pendingTasks, streamingBatches]);
}
