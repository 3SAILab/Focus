// Electron API 类型定义

export interface ElectronAPI {
  getBackendUrl: () => Promise<string>;
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

