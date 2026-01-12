/**
 * 图片生成生命周期统一类型定义
 * 
 * 生命周期：
 * 1. pending (本地) - 用户点击生成，请求发送中
 * 2. processing (后端) - 后端正在处理
 * 3. completed/failed (后端) - 处理完成或失败
 * 4. history (数据库) - 持久化到历史记录
 */

import type { GenerationTypeValue, ImageGridItem } from './index';

/**
 * 生成任务的基础状态
 */
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * 统一的生成任务类型
 * 用于表示任何阶段的生成任务
 */
export interface GenerationItem {
  // 标识符
  id: string;                    // 本地唯一 ID
  taskId?: string;               // 后端任务 ID（processing 阶段后有值）
  batchId?: string;              // 批次 ID（多图生成时有值）
  
  // 状态
  status: GenerationStatus;
  
  // 内容
  prompt: string;
  imageCount: number;            // 请求生成的图片数量
  images?: ImageGridItem[];      // 图片结果（completed 时有值）
  errorMessage?: string;         // 错误信息（failed 时有值）
  
  // 元数据
  type?: GenerationTypeValue;    // 生成类型
  refImages?: string[];          // 参考图 URL 列表
  timestamp: number;             // 创建时间戳
  
  // 后端数据（processing/completed/failed 阶段）
  startedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 从 PendingTaskInfo 创建 GenerationItem
 */
export function createPendingItem(params: {
  id: string;
  prompt: string;
  imageCount: number;
  timestamp: number;
  type?: GenerationTypeValue;
  refImages?: string[];
}): GenerationItem {
  return {
    id: params.id,
    status: 'pending',
    prompt: params.prompt,
    imageCount: params.imageCount,
    type: params.type,
    refImages: params.refImages,
    timestamp: params.timestamp,
  };
}

/**
 * 从后端 GenerationTask 创建 GenerationItem
 */
export function fromBackendTask(task: {
  id: number;
  task_id: string;
  status: 'processing' | 'completed' | 'failed';
  type: GenerationTypeValue;
  prompt: string;
  ref_images: string;
  image_url: string;
  error_msg: string;
  started_at: string;
  created_at: string;
  updated_at: string;
  image_count: number;
}): GenerationItem {
  let refImages: string[] | undefined;
  try {
    if (task.ref_images) {
      refImages = JSON.parse(task.ref_images);
    }
  } catch {
    // ignore parse error
  }

  return {
    id: `task-${task.id}`,
    taskId: task.task_id,
    status: task.status,
    prompt: task.prompt,
    imageCount: task.image_count,
    type: task.type,
    refImages,
    timestamp: new Date(task.created_at).getTime(),
    errorMessage: task.error_msg || undefined,
    images: task.image_url ? [{ url: task.image_url, index: 0 }] : undefined,
    startedAt: task.started_at,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

/**
 * 批次结果类型（用于多图生成）
 */
export interface BatchResult {
  batchId: string;
  images: ImageGridItem[];
  prompt: string;
  timestamp: number;
  imageCount: number;
  refImages?: string[];
  status: 'streaming' | 'completed' | 'failed';
}

/**
 * 创建批次结果
 */
export function createBatchResult(params: {
  batchId: string;
  prompt: string;
  imageCount: number;
  images?: Array<{ url?: string; error?: string; isLoading?: boolean }>;
  refImages?: string[];
  status: 'streaming' | 'completed' | 'failed';
}): BatchResult {
  const { batchId, prompt, imageCount, images, refImages, status } = params;
  const count = Math.max(1, imageCount);
  
  let resultImages: ImageGridItem[];
  
  switch (status) {
    case 'completed':
      resultImages = images 
        ? images.map((img, index) => ({
            url: img.url,
            error: img.error,
            isLoading: false,
            index,
          }))
        : Array.from({ length: count }, (_, index) => ({
            isLoading: false,
            index,
          }));
      break;
      
    case 'failed': {
      // 如果有传入的 images 且数量与 count 匹配，使用它们
      // 否则创建 count 个错误卡片
      if (images && images.length === count) {
        resultImages = images.map((img, index) => ({
          url: img.url,
          error: img.error || '生成失败',
          isLoading: false,
          index,
        }));
      } else {
        // 获取错误信息：优先使用传入的第一个错误，否则使用默认错误
        const errorMessage = (images && images.length > 0 && images[0].error) 
          ? images[0].error 
          : '生成失败';
        resultImages = Array.from({ length: count }, (_, index) => ({
          error: errorMessage,
          isLoading: false,
          index,
        }));
      }
      break;
    }
      
    case 'streaming':
      resultImages = Array.from({ length: count }, (_, index) => ({
        isLoading: true,
        index,
      }));
      break;
  }
  
  return {
    batchId,
    images: resultImages,
    prompt,
    timestamp: Date.now(),
    imageCount: count,
    refImages,
    status,
  };
}
