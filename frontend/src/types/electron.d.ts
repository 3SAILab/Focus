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

// Version Check Types
export interface LocalVersionInfo {
  versionCode: string;
  versionName: string;
}

export interface RemoteVersionInfo {
  versionCode: string;
  versionName: string;
  updateContent: string;
  windowsUrl: string;
  macX64Url: string;
  macArm64Url: string;
}

export interface VersionCheckResult {
  status: 'network_error' | 'fetch_error' | 'update_required' | 'up_to_date';
  remoteVersion?: RemoteVersionInfo;
  downloadUrl?: string;
  errorMessage?: string;
}

export interface OpenUrlResult {
  success: boolean;
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
  
  // ===== Version Check APIs =====
  
  /**
   * 获取本地版本信息
   * @returns Promise<LocalVersionInfo> 本地版本信息 (versionCode, versionName)
   */
  getVersionInfo: () => Promise<LocalVersionInfo>;
  
  /**
   * 检查更新
   * @returns Promise<VersionCheckResult> 版本检查结果
   */
  checkUpdate: () => Promise<VersionCheckResult>;
  
  /**
   * 在默认浏览器中打开下载链接
   * @param url 下载链接
   * @returns Promise<OpenUrlResult> 操作结果
   */
  openDownloadUrl: (url: string) => Promise<OpenUrlResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

