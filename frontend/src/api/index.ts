// src/api/index.ts

// API 服务

// 默认后端 URL（本地 HTTP）
const DEFAULT_BACKEND_URL = 'http://localhost:51888';

// ============ 测试模式开关 ============
// 设置为 true 可以模拟 API 错误，用于测试 ErrorCard
// 测试完成后请设置为 false
const SIMULATE_ERROR = false;
const SIMULATE_ERROR_CODE = 500; // 可选: 429, 500, 502, 503

// ============ 多图 Mock 模式 ============
// 设置为 true 可以模拟多图生成响应，用于测试前端 UI
// 测试完成后请设置为 false
const MOCK_MULTI_IMAGE = false;
// 模拟部分失败：设置为 true 时，多图生成中一定会有 1 张失败
// 失败的图片位置随机
const MOCK_PARTIAL_FAILURE = false;
// 模拟延迟（毫秒）：每张图的模拟生成延迟
const MOCK_DELAY_PER_IMAGE = 500;
// =====================================

// API 日志功能（始终启用，用于调试）
const logAPI = (type: 'REQUEST' | 'RESPONSE', method: string, url: string, data?: unknown, duration?: number, status?: number) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    type,
    method,
    url,
    ...(duration !== undefined && { duration: `${duration}ms` }),
    ...(status !== undefined && { status }),
    ...(data !== undefined && { data: typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : data }),
  };
  console.log(`[API ${type}]`, JSON.stringify(logEntry));
};

// 动态获取 API 地址
const getApiBaseUrl = async (): Promise<string> => {
  console.log('[API] 开始获取后端 URL...');
  console.log('[API] window.electronAPI 存在:', typeof window !== 'undefined' && !!window.electronAPI);
  
  // 在 Electron 环境中，从 window.electronAPI 获取
  if (typeof window !== 'undefined' && window.electronAPI) {
    try {
      console.log('[API] 尝试从 Electron API 获取后端 URL...');
      const url = await window.electronAPI.getBackendUrl();
      console.log('[API] Electron API 返回的 URL:', url);
      if (url) {
        return url;
      }
      console.warn('[API] Electron API 返回空 URL，使用默认值');
      return DEFAULT_BACKEND_URL;
    } catch (error) {
      console.warn('[API] 获取 Electron API URL 失败，使用默认值:', error);
      return DEFAULT_BACKEND_URL;
    }
  }
  
  // 开发环境或浏览器环境
  const envUrl = import.meta.env.VITE_BACKEND_URL;
  console.log('[API] 环境变量 VITE_BACKEND_URL:', envUrl);
  return envUrl || DEFAULT_BACKEND_URL;
};

// 缓存 API URL（避免每次都调用异步函数）
let cachedApiUrl: string | null = null;

const getCachedApiUrl = async (): Promise<string> => {
  if (cachedApiUrl) {
    return cachedApiUrl;
  }
  cachedApiUrl = await getApiBaseUrl();
  return cachedApiUrl;
};

// 创建带超时的 fetch 请求
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs: number = 900000 // 默认 15 分钟超时
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('服务器负载异常，不会消耗次数，请重试');
    }
    throw error;
  }
};

// ============ 多图 Mock 响应类型 ============
interface MockImageResult {
  image_url?: string;
  error?: string;
}

interface MockMultiImageResponse {
  images: MockImageResult[];
  prompt: string;
  batch_id: string;
}

// 生成唯一的 batch_id
const generateBatchId = (): string => {
  return `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

// 生成 Mock 多图响应
const generateMockMultiImageResponse = async (
  count: number,
  prompt: string
): Promise<MockMultiImageResponse> => {
  const batchId = generateBatchId();
  const images: MockImageResult[] = [];
  
  // 随机图片尺寸选项（模拟不同比例）
  const sizes = ['400/400', '400/300', '300/400', '500/400'];
  
  // 多图时随机选择一个位置作为失败的图片
  const failIndex = MOCK_PARTIAL_FAILURE && count > 1 
    ? Math.floor(Math.random() * count) 
    : -1;
  
  console.log(`[Mock] 多图生成: count=${count}, failIndex=${failIndex}`);
  
  for (let i = 0; i < count; i++) {
    // 模拟每张图的延迟
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY_PER_IMAGE));
    
    // 模拟部分失败：当启用且是随机选中的失败位置时
    if (MOCK_PARTIAL_FAILURE && i === failIndex) {
      images.push({
        error: '图片生成失败：API 调用超时',
      });
      console.log(`[Mock] 图片 ${i + 1}/${count} 模拟失败`);
    } else {
      // 使用 picsum.photos 生成随机占位图
      // 添加随机参数确保每张图不同
      const size = sizes[i % sizes.length];
      const randomSeed = Math.floor(Math.random() * 1000);
      const imageUrl = `https://picsum.photos/seed/${randomSeed}/${size}`;
      
      images.push({
        image_url: imageUrl,
      });
      console.log(`[Mock] 图片 ${i + 1}/${count} 生成成功: ${imageUrl}`);
    }
  }
  
  return {
    images,
    prompt,
    batch_id: batchId,
  };
};

// 生成 Mock 单图响应（向后兼容）
const generateMockSingleImageResponse = async (prompt: string): Promise<{
  status: string;
  image_url: string;
  text: string;
}> => {
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY_PER_IMAGE));
  
  const randomSeed = Math.floor(Math.random() * 1000);
  const imageUrl = `https://picsum.photos/seed/${randomSeed}/400/400`;
  
  console.log(`[Mock] 单图生成成功: ${imageUrl}`);
  
  return {
    status: 'success',
    image_url: imageUrl,
    text: prompt,
  };
};

// SSE 事件类型定义
export interface SSEStartEvent {
  type: 'start';
  task_id: string;
  batch_id: string;
  count: number;
  prompt: string;
  ref_images: string[];
}

export interface SSEImageEvent {
  type: 'image';
  index: number;
  image_url?: string;
  error?: string;
  completed: number;
  total: number;
}

export interface SSECompleteEvent {
  type: 'complete';
  status: 'success' | 'partial' | 'failed';
  task_id: string;
  batch_id: string;
  images: Array<{ image_url?: string; error?: string; index: number }>;
  ref_images: string[];
  success_count: number;
  total_count: number;
}

export type SSEEvent = SSEStartEvent | SSEImageEvent | SSECompleteEvent;

// SSE 回调类型
export interface SSECallbacks {
  onStart?: (event: SSEStartEvent) => void;
  onImage?: (event: SSEImageEvent) => void;
  onComplete?: (event: SSECompleteEvent) => void;
  onError?: (error: Error) => void;
}

export const api = {
  // 生成图片（超时时间 5 分钟）
  async generate(formData: FormData): Promise<Response> {
    // 测试模式：模拟错误响应
    if (SIMULATE_ERROR) {
      console.log('[API] 测试模式：模拟错误响应', SIMULATE_ERROR_CODE);
      await new Promise(resolve => setTimeout(resolve, 1500)); // 模拟延迟
      return new Response(JSON.stringify({ 
        error: '服务器负载异常，不会消耗次数，请重试',
        status_code: SIMULATE_ERROR_CODE 
      }), {
        status: SIMULATE_ERROR_CODE,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 多图 Mock 模式
    if (MOCK_MULTI_IMAGE) {
      const count = parseInt(formData.get('count') as string) || 1;
      const prompt = (formData.get('prompt') as string) || '测试提示词';
      
      console.log(`[API] 多图 Mock 模式：生成 ${count} 张图片`);
      console.log(`[API] Mock 配置: 部分失败=${MOCK_PARTIAL_FAILURE}, 延迟=${MOCK_DELAY_PER_IMAGE}ms/张`);
      
      if (count === 1) {
        // 单图模式：返回向后兼容的响应格式
        const mockResponse = await generateMockSingleImageResponse(prompt);
        console.log('[API] Mock 单图响应:', mockResponse);
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // 多图模式：返回新的响应格式
        const mockResponse = await generateMockMultiImageResponse(count, prompt);
        console.log('[API] Mock 多图响应:', mockResponse);
        return new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const baseUrl = await getCachedApiUrl();
    const url = `${baseUrl}/generate`;
    const startTime = Date.now();
    
    // 记录请求（FormData 内容简化显示）
    const formDataInfo: Record<string, string> = {};
    formData.forEach((value, key) => {
      if (value instanceof File) {
        formDataInfo[key] = `[File: ${value.name}, ${value.size} bytes]`;
      } else {
        formDataInfo[key] = String(value);
      }
    });
    logAPI('REQUEST', 'POST', url, formDataInfo);
    
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          body: formData,
        },
        300000 // 5 分钟超时
      );
      
      const duration = Date.now() - startTime;
      logAPI('RESPONSE', 'POST', url, undefined, duration, response.status);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logAPI('RESPONSE', 'POST', url, { error: String(error) }, duration, 0);
      throw error;
    }
  },

  // 获取历史记录（支持分页）
  async getHistory(page: number = 1, pageSize: number = 20): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/history?page=${page}&page_size=${pageSize}`, {
      method: 'GET',
    });
  },

  // 检查配置（是否已设置 API Key）
  async checkConfig(): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/config/check`, {
      method: 'GET',
    });
  },

  // 设置 API Key
  async setApiKey(key: string, skipValidate: boolean = false): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/config/apikey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ api_key: key, skip_validate: skipValidate }),
    });
  },

  // 验证 API Key 是否有效
  async validateApiKey(key: string): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/config/apikey/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ api_key: key }),
    });
  },

  // 获取生成计数
  async getGenerationCount(): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/stats/generation-count`, {
      method: 'GET',
    });
  },

  // 增加生成计数
  async incrementGenerationCount(): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/stats/increment-count`, {
      method: 'POST',
    });
  },

  // 获取白底图历史记录
  async getWhiteBackgroundHistory(): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/history/white-background`, {
      method: 'GET',
    });
  },

  // 获取换装历史记录
  async getClothingChangeHistory(): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/history/clothing-change`, {
      method: 'GET',
    });
  },

  // 获取一键商品图历史记录
  async getProductSceneHistory(): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/history/product-scene`, {
      method: 'GET',
    });
  },

  // 获取光影融合历史记录
  async getLightShadowHistory(): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/history/light-shadow`, {
      method: 'GET',
    });
  },

  // 删除单条历史记录（软删除）
  async deleteHistory(id: number): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/history/${id}`, {
      method: 'DELETE',
    });
  },

  // 批量删除历史记录（软删除）
  async batchDeleteHistory(ids: number[]): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/history/batch-delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });
  },

  // 按日期删除历史记录
  async deleteHistoryByDate(date: string): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/history/date/${date}`, {
      method: 'DELETE',
    });
  },

  // 按批次 ID 删除历史记录
  async deleteHistoryByBatch(batchId: string): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/history/batch/${encodeURIComponent(batchId)}`, {
      method: 'DELETE',
    });
  },

  // 设置免责声明同意状态
  async setDisclaimerAgreed(agreed: boolean): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/config/disclaimer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ agreed }),
    });
  },

  // 获取正在处理的任务
  async getProcessingTasks(type: string): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/tasks/processing?type=${encodeURIComponent(type)}`, {
      method: 'GET',
    });
  },

  // 获取单个任务状态
  async getTaskStatus(taskId: string): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/tasks/${encodeURIComponent(taskId)}`, {
      method: 'GET',
    });
  },

  // 多图生成 - SSE 流式接口
  async generateWithSSE(formData: FormData, callbacks: SSECallbacks): Promise<void> {
    const baseUrl = await getCachedApiUrl();
    const url = `${baseUrl}/generate`;
    const startTime = Date.now();
    
    // 记录请求
    const formDataInfo: Record<string, string> = {};
    formData.forEach((value, key) => {
      if (value instanceof File) {
        formDataInfo[key] = `[File: ${value.name}, ${value.size} bytes]`;
      } else {
        formDataInfo[key] = String(value);
      }
    });
    logAPI('REQUEST', 'POST (SSE)', url, formDataInfo);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP ${response.status}`);
      }
      
      // 检查是否是 SSE 响应
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/event-stream')) {
        // 不是 SSE，按普通 JSON 处理（单图或旧版响应）
        const data = await response.json();
        const duration = Date.now() - startTime;
        logAPI('RESPONSE', 'POST (JSON fallback)', url, undefined, duration, response.status);
        
        // 转换为 complete 事件格式
        if (data.images) {
          callbacks.onComplete?.({
            type: 'complete',
            status: 'success',
            task_id: data.task_id || '',
            batch_id: data.batch_id || '',
            images: data.images,
            ref_images: data.ref_images || [],
            success_count: data.images.filter((img: { image_url?: string }) => img.image_url).length,
            total_count: data.images.length,
          });
        } else if (data.image_url) {
          // 单图响应
          callbacks.onComplete?.({
            type: 'complete',
            status: 'success',
            task_id: data.task_id || '',
            batch_id: '',
            images: [{ image_url: data.image_url, index: 0 }],
            ref_images: data.ref_images || [],
            success_count: 1,
            total_count: 1,
          });
        }
        return;
      }
      
      // 处理 SSE 流
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // 解析 SSE 事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留未完成的行
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const jsonStr = line.slice(5).trim();
            if (jsonStr) {
              try {
                const event = JSON.parse(jsonStr) as SSEEvent;
                
                switch (event.type) {
                  case 'start':
                    console.log('[SSE] Start event:', event);
                    callbacks.onStart?.(event);
                    break;
                  case 'image':
                    console.log('[SSE] Image event:', event);
                    callbacks.onImage?.(event);
                    break;
                  case 'complete':
                    console.log('[SSE] Complete event 收到:', event);
                    console.log('[SSE] 调用 callbacks.onComplete');
                    callbacks.onComplete?.(event);
                    console.log('[SSE] callbacks.onComplete 调用完成');
                    break;
                }
              } catch (e) {
                console.warn('[SSE] 解析事件失败:', jsonStr, e);
              }
            }
          }
        }
      }
      
      const duration = Date.now() - startTime;
      logAPI('RESPONSE', 'POST (SSE)', url, undefined, duration, response.status);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logAPI('RESPONSE', 'POST (SSE)', url, { error: String(error) }, duration, 0);
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  },
};