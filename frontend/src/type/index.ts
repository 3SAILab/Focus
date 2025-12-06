// 类型定义

export interface GenerationHistory {
  id?: number;
  prompt: string;
  original_prompt?: string; // [!code ++] 新增这一行
  image_url: string;
  file_name: string;
  ref_images?: string; // JSON 字符串数组
  created_at: string;
  updated_at?: string;
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

