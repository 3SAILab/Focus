const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取后端 URL
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  
  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // 获取用户数据路径
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  
  // 获取所有路径配置
  getPaths: () => ipcRenderer.invoke('get-paths'),
  
  // 保存图片到用户选择的位置
  saveImage: (imageData, defaultFileName) => ipcRenderer.invoke('save-image', { imageData, defaultFileName }),
  
  // 监听后端就绪事件
  onBackendReady: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('backend-ready', listener);
    // 返回清理函数
    return () => {
      ipcRenderer.removeListener('backend-ready', listener);
    };
  },
  
  // 监听后端错误事件
  onBackendError: (callback) => {
    const listener = (_event, error) => callback(error);
    ipcRenderer.on('backend-error', listener);
    // 返回清理函数
    return () => {
      ipcRenderer.removeListener('backend-error', listener);
    };
  },
  
  // ===== Version Check APIs =====
  // Requirements: 3.3
  
  /**
   * Get local version info (versionCode, versionName)
   * @returns {Promise<{versionCode: string, versionName: string}>}
   */
  getVersionInfo: () => ipcRenderer.invoke('get-version-info'),
  
  /**
   * Check for updates against remote server
   * @returns {Promise<VersionCheckResult>}
   * VersionCheckResult: {
   *   status: 'network_error' | 'fetch_error' | 'update_required' | 'up_to_date',
   *   remoteVersion?: RemoteVersionInfo,
   *   downloadUrl?: string,
   *   errorMessage?: string
   * }
   */
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  
  /**
   * Open download URL in default browser
   * @param {string} url - Download URL to open
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  openDownloadUrl: (url) => ipcRenderer.invoke('open-download-url', url),
});

