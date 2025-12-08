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
  created_at: string;
  updated_at?: string;
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

export type AspectRatio = 
  | '智能' 
  | '21:9' 
  | '16:9' 
  | '3:2' 
  | '4:3' 
  | '1:1' 
  | '3:4' 
  | '2:3' 
  | '9:16';

export type ImageSize = '2K';


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
}
