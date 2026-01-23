// 类型定义

// 生成类型常量
export const GenerationType = {
  CREATE: 'create',
  WHITE_BACKGROUND: 'white_background',
  CLOTHING_CHANGE: 'clothing_change',
  PRODUCT_SCENE: 'product_scene',
  LIGHT_SHADOW: 'light_shadow',
} as const;

export type GenerationTypeValue = typeof GenerationType[keyof typeof GenerationType];

export interface GenerationHistory {
  id?: number;
  prompt: string;
  original_prompt?: string;
  image_url: string;
  file_name: string;
  ref_images?: string; // JSON 字符串数组
  type?: GenerationTypeValue; // 生成类型
  error_msg?: string;  // 错误信息（失败时）
  image_deleted?: boolean; // 图片是否已被删除
  aspect_ratio?: string; // 图片比例
  image_size?: string;   // 图片尺寸
  created_at: string;
  updated_at?: string;
  // 多图生成批次信息
  batch_id?: string;      // 批次 ID
  batch_index?: number;   // 批次内序号 (0-3)
  batch_total?: number;   // 批次总数
}

// 生成统计
export interface GenerationStats {
  total_count: number;
}

export interface GenerateRequest {
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  images: File[];
}

export interface GenerateResponse {
  status: string;
  image_url: string;
  text?: string;
  ref_images?: string[];
}

// 多图生成响应中的单个图片结果
export interface MultiImageResult {
  image_url?: string;
  error?: string;
}

// 多图生成响应
export interface GenerateMultiResponse {
  images: MultiImageResult[];
  prompt: string;
  batch_id: string;
}

// ImageGrid 组件中单个图片项的状态
export interface ImageGridItem {
  url?: string;           // 图片 URL (成功时)
  error?: string;         // 错误信息 (失败时)
  isLoading?: boolean;    // 是否加载中
  index: number;          // 在批次中的索引
}

export type AspectRatio = 
  | '21:9' 
  | '16:9' 
  | '3:2' 
  | '4:3' 
  | '1:1' 
  | '3:4' 
  | '2:3' 
  | '9:16';

export type ImageSize = '2K' | '4K';

// 生成数量类型 (1-4)
export type ImageCount = 1 | 2 | 3 | 4;


// Task status type
export type TaskStatus = 'processing' | 'completed' | 'failed';

// Generation task interface (matches backend TaskResponse)
export interface GenerationTask {
  id: number;
  task_id: string;
  status: TaskStatus;
  type: GenerationTypeValue;
  prompt: string;
  ref_images: string; // JSON array of ref image URLs
  image_url: string;
  error_msg: string;
  started_at: string;
  created_at: string;
  updated_at: string;
  image_count: number; // 请求生成的图片数量 (1-4)
}


// 导出统一的生成类型
export { 
  type GenerationStatus, 
  type GenerationItem,
  type BatchResult,
  createPendingItem, 
  fromBackendTask,
  createBatchResult,
} from './generation';
