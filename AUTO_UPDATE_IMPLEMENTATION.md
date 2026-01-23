# 自动更新实现方案

## 1. 安装依赖

```bash
npm install electron-updater --save
```

## 2. 修改 electron/main.js

在文件顶部添加：
```javascript
const { autoUpdater } = require('electron-updater');
```

在 `app.whenReady()` 之后添加自动更新配置：
```javascript
// 配置自动更新
autoUpdater.setFeedURL({
  provider: 'generic',
  url: 'https://sigma-focus.oss-cn-hangzhou.aliyuncs.com/updates'
});

// 禁用自动下载，改为手动控制
autoUpdater.autoDownload = false;

// 监听更新事件
autoUpdater.on('checking-for-update', () => {
  console.log('[AutoUpdater] 正在检查更新...');
});

autoUpdater.on('update-available', (info) => {
  console.log('[AutoUpdater] 发现新版本:', info.version);
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[AutoUpdater] 当前已是最新版本');
});

autoUpdater.on('error', (err) => {
  console.error('[AutoUpdater] 更新错误:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`[AutoUpdater] 下载进度: ${progressObj.percent}%`);
  // 发送进度到渲染进程
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[AutoUpdater] 更新下载完成');
  // 发送下载完成事件到渲染进程
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});
```

## 3. 添加 IPC 处理器

替换现有的 `check-update` 和 `open-download-url` 处理器：

```javascript
// 检查更新
ipcMain.handle('check-update', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    if (result && result.updateInfo) {
      return {
        status: 'update_required',
        remoteVersion: {
          versionCode: result.updateInfo.version,
          versionName: result.updateInfo.version,
          updateContent: result.updateInfo.releaseNotes || '新版本可用',
          windowsUrl: '' // electron-updater 会自动处理
        },
        downloadUrl: ''
      };
    }
    return {
      status: 'up_to_date'
    };
  } catch (error) {
    console.error('[IPC] check-update 错误:', error);
    return {
      status: 'fetch_error',
      errorMessage: `版本检查失败: ${error.message}`
    };
  }
});

// 开始下载更新
ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    console.error('[IPC] download-update 错误:', error);
    return { success: false, error: error.message };
  }
});

// 安装更新并重启
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});
```

## 4. 修改前端 UpdateModal.tsx

```typescript
import { useState, useEffect } from 'react';
import { Download, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import Modal from './common/Modal';
import type { RemoteVersionInfo } from '../types/electron';

interface UpdateModalProps {
  isOpen: boolean;
  remoteVersion: RemoteVersionInfo | null;
  downloadUrl: string;
  onDownload: () => void;
}

export default function UpdateModal({
  isOpen,
  remoteVersion,
  downloadUrl,
  onDownload,
}: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloaded, setIsDownloaded] = useState(false);

  useEffect(() => {
    // 监听下载进度
    const handleProgress = (event: any, progress: any) => {
      setDownloadProgress(Math.round(progress.percent));
    };

    // 监听下载完成
    const handleDownloaded = () => {
      setIsDownloading(false);
      setIsDownloaded(true);
    };

    if (window.electronAPI) {
      window.electron.ipcRenderer.on('download-progress', handleProgress);
      window.electron.ipcRenderer.on('update-downloaded', handleDownloaded);
    }

    return () => {
      if (window.electronAPI) {
        window.electron.ipcRenderer.removeListener('download-progress', handleProgress);
        window.electron.ipcRenderer.removeListener('update-downloaded', handleDownloaded);
      }
    };
  }, []);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    
    try {
      const result = await window.electronAPI.downloadUpdate();
      if (!result.success) {
        alert('下载失败: ' + result.error);
        setIsDownloading(false);
      }
    } catch (error) {
      console.error('下载更新失败:', error);
      alert('下载失败，请稍后重试');
      setIsDownloading(false);
    }
  };

  const handleInstall = async () => {
    await window.electronAPI.installUpdate();
  };

  const formatUpdateContent = (content: string) => {
    return content.split('\n').map((line, index) => (
      <p key={index} className="text-sm text-gray-600">
        {line}
      </p>
    ));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title={isDownloaded ? "更新已就绪" : "发现新版本"}
      icon={isDownloaded ? <CheckCircle className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
      iconBgColor={isDownloaded ? "bg-green-100" : "bg-blue-100"}
      iconColor={isDownloaded ? "text-green-600" : "text-blue-600"}
      headerBgClass={isDownloaded ? "bg-gradient-to-r from-green-50 to-emerald-50" : "bg-gradient-to-r from-blue-50 to-indigo-50"}
      closable={false}
      closeOnBackdropClick={false}
      maxWidth="md"
      footer={
        isDownloaded ? (
          <button
            onClick={handleInstall}
            className="w-full px-4 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            立即安装并重启
          </button>
        ) : (
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-full px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                下载中 {downloadProgress}%
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                下载更新
              </>
            )}
          </button>
        )
      }
    >
      <div className="space-y-4">
        {/* Version info */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <span className="text-sm text-gray-500">新版本</span>
          <span className="text-sm font-semibold text-gray-800">
            {remoteVersion?.versionName || '未知'}
          </span>
        </div>

        {/* Download progress */}
        {isDownloading && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-blue-800">下载进度</span>
              <span className="text-sm font-semibold text-blue-800">{downloadProgress}%</span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Update content */}
        {remoteVersion?.updateContent && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <h4 className="text-sm font-semibold text-blue-800 mb-3">
              更新内容
            </h4>
            <div className="space-y-1">
              {formatUpdateContent(remoteVersion.updateContent)}
            </div>
          </div>
        )}

        {/* Notice */}
        <div className="text-xs text-gray-500 text-center">
          {isDownloaded ? '点击按钮将自动安装更新并重启软件' : '更新将在后台下载，完成后可立即安装'}
        </div>
      </div>
    </Modal>
  );
}
```

## 5. 更新 electron.d.ts 类型定义

在 `frontend/src/types/electron.d.ts` 中添加：

```typescript
downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
installUpdate: () => Promise<void>;
```

## 6. 配置 OSS 文件结构

在 OSS 上创建以下文件结构：

```
https://sigma-focus.oss-cn-hangzhou.aliyuncs.com/
├── updates/
│   ├── latest.yml          # 自动生成，包含最新版本信息
│   └── Focus-1.0.6.exe     # 安装包
└── version.json            # 保留用于兼容旧版本
```

## 7. 打包配置

在 `package.json` 的 `build` 配置中添加：

```json
"publish": {
  "provider": "generic",
  "url": "https://sigma-focus.oss-cn-hangzhou.aliyuncs.com/updates"
}
```

## 8. 打包和发布流程

1. 运行 `npm run build` 打包应用
2. 在 `release-dev-test` 目录会生成：
   - `Focus-1.0.6.exe` - 安装包
   - `latest.yml` - 更新配置文件
3. 将这两个文件上传到 OSS 的 `updates/` 目录
4. 用户打开应用时会自动检查更新，点击下载后会自动下载并安装

## 优势

- ✅ 自动下载更新文件
- ✅ 显示下载进度
- ✅ 下载完成后一键安装
- ✅ 安装时自动关闭旧进程
- ✅ 安装完成后自动启动新版本
- ✅ 支持断点续传
- ✅ 无需用户手动操作

## 注意事项

1. 确保 OSS 的 CORS 配置允许跨域访问
2. `latest.yml` 文件必须和 exe 文件在同一目录
3. 每次发布新版本都要更新 `package.json` 中的 `version` 和 `versionCode`
