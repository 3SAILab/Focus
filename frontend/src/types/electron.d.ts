// Electron API 类型定义

export interface PathsConfig {
  userData: string;
  output: string;
  uploads: string;
  database: string;
}

export interface SaveImageResult {
  success: boolean;
  canceled?: boolean;
  filePath?: string;
  error?: string;
}

export interface ElectronAPI {
  /**
   * 获取后端服务 URL
   * @returns Promise<string> 后端服务的完整 URL (例如: http://localhost:8080)
   */
  getBackendUrl: () => Promise<string>;
  
  /**
   * 获取应用版本号
   * @returns Promise<string> 应用版本号
   */
  getAppVersion: () => Promise<string>;
  
  /**
   * 获取用户数据目录路径
   * @returns Promise<string> 用户数据目录的完整路径
   */
  getUserDataPath: () => Promise<string>;
  
  /**
   * 获取所有路径配置
   * @returns Promise<PathsConfig> 包含所有路径配置的对象
   */
  getPaths: () => Promise<PathsConfig>;
  
  /**
   * 保存图片到用户选择的位置
   * @param imageData 图片数据 (data URL, base64, 或远程 URL)
   * @param defaultFileName 默认文件名
   * @returns Promise<SaveImageResult> 保存结果
   */
  saveImage: (imageData: string, defaultFileName?: string) => Promise<SaveImageResult>;
  
  /**
   * 监听后端就绪事件
   * @param callback 当后端服务启动并就绪时调用的回调函数
   * @returns 清理函数，用于移除事件监听器
   */
  onBackendReady: (callback: () => void) => () => void;
  
  /**
   * 监听后端错误事件
   * @param callback 当后端服务发生错误时调用的回调函数，接收错误消息作为参数
   * @returns 清理函数，用于移除事件监听器
   */
  onBackendError: (callback: (error: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

