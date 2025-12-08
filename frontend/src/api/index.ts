// src/api/index.ts

// API 服务

// 动态获取 API 地址
const getApiBaseUrl = async (): Promise<string> => {
  // 在 Electron 环境中，从 window.electronAPI 获取
  if (typeof window !== 'undefined' && window.electronAPI) {
    try {
      const url = await window.electronAPI.getBackendUrl();
      return url || 'https://localhost:8080';
    } catch (error) {
      console.warn('获取 Electron API URL 失败，使用默认值:', error);
      return 'https://localhost:8080';
    }
  
  }
  // 开发环境或浏览器环境
  return import.meta.env.VITE_BACKEND_URL || 'https://localhost:8080';
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

export const api = {
  // 生成图片
  async generate(formData: FormData): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/generate`, {
      method: 'POST',
      body: formData,
    });
  },

  // 获取历史记录
  async getHistory(): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/history`, {
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
  async setApiKey(key: string): Promise<Response> {
    const baseUrl = await getCachedApiUrl();
    return fetch(`${baseUrl}/config/apikey`, {
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
};