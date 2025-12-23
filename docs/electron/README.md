# Electron 开发指南

Focus 使用 Electron 33.x 作为桌面应用框架，管理窗口、后端进程和 IPC 通信。

## 目录结构

```
electron/
├── main.js              # 主进程入口
├── preload.js           # 预加载脚本
├── versionChecker.js    # 版本检测模块
├── main.test.js         # 主进程测试
├── e2e.test.js          # 端到端测试
└── build-validation.test.js  # 构建验证测试
```

## 主进程 (main.js)

### 职责

1. **窗口管理**：创建和管理 BrowserWindow
2. **后端进程管理**：启动、监控和终止 Go 后端
3. **版本检测**：检查更新并提示用户下载
4. **IPC 通信**：处理渲染进程的请求
5. **环境配置**：设置后端运行环境
6. **自动端口发现**：支持端口自动切换

### 生命周期

```mermaid
sequenceDiagram
    participant App as Electron App
    participant Main as 主进程
    participant Backend as Go 后端
    participant Window as BrowserWindow
    participant Version as 版本检测
    
    App->>Main: app.whenReady()
    Main->>Backend: 启动后端进程
    Backend-->>Main: 端口就绪
    Main->>Window: 创建窗口
    Window->>Window: 加载前端
    Main->>Version: 检查版本更新
    Version-->>Window: 显示更新提示（如有）
    
    Note over Main,Window: 应用运行中
    
    App->>Main: app.on('quit')
    Main->>Backend: 终止后端
    Main->>Window: 关闭窗口
```

### 关键代码

```javascript
// 创建窗口
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发模式加载 Vite 服务器
  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // 生产模式加载打包的前端
    win.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }
}
```

## 预加载脚本 (preload.js)

### 职责

在渲染进程和主进程之间建立安全的通信桥梁。

### 暴露的 API

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getBackendUrl: () => ipcRenderer.invoke('get-backend-url'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkVersion: () => ipcRenderer.invoke('check-version'),
  openDownloadUrl: (url) => ipcRenderer.invoke('open-download-url', url),
  saveImage: (options) => ipcRenderer.invoke('save-image', options),
  copyImageToClipboard: (base64Data) => ipcRenderer.invoke('copy-image-to-clipboard', base64Data),
});
```

### 安全性

- 启用 `contextIsolation`：隔离预加载脚本和渲染进程
- 禁用 `nodeIntegration`：渲染进程无法直接访问 Node.js
- 使用 `contextBridge`：安全地暴露有限的 API

## 版本检测 (versionChecker.js)

### 职责

检查远程版本信息，自动识别平台并提供正确的下载链接。

### 功能

```javascript
const { performVersionCheck, getDownloadUrl } = require('./versionChecker');

// 执行版本检查
const result = await performVersionCheck({ versionCode, versionName });
// result.status: 'up_to_date' | 'update_required' | 'network_error' | 'fetch_error'

// 获取下载链接（自动识别平台）
const url = getDownloadUrl(versionInfo);
// Windows: windowsUrl
// Mac Intel: macX64Url
// Mac M1/M2: macArm64Url
```

### 平台自动识别

- **Windows** (`process.platform === 'win32'`) → `windowsUrl`
- **Mac Intel** (`process.platform === 'darwin' && process.arch === 'x64'`) → `macX64Url`
- **Mac M1/M2** (`process.platform === 'darwin' && process.arch === 'arm64'`) → `macArm64Url`

### 版本信息格式 (version.json)

```json
{
  "versionCode": "202512221621",
  "versionName": "1.0.2",
  "updateContent": "1. 添加删除功能\n2. 优化了用户体验",
  "windowsUrl": "https://example.com/Focus-1.0.2.zip",
  "macX64Url": "https://example.com/Focus-1.0.2-x64.dmg",
  "macArm64Url": "https://example.com/Focus-1.0.2-arm64.dmg"
}
```

## IPC 通信

### 主进程处理器

```javascript
const { ipcMain } = require('electron');

// 获取后端 URL
ipcMain.handle('get-backend-url', () => {
  return `http://localhost:${backendPort}`;
});

// 获取应用版本
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// 检查版本更新
ipcMain.handle('check-version', async () => {
  const localVersion = { versionCode, versionName };
  return await performVersionCheck(localVersion);
});

// 打开下载链接
ipcMain.handle('open-download-url', async (event, url) => {
  await shell.openExternal(url);
  return { success: true };
});
```

### 渲染进程调用

```typescript
// 通过预加载脚本暴露的 API 调用
const url = await window.electronAPI.getBackendUrl();
```

## 后端进程管理

### 启动后端

```javascript
const { spawn } = require('child_process');

function startBackend() {
  const backendPath = getBackendPath();
  const env = {
    ...process.env,
    PORT: '8080',
    AUTO_PORT_DISCOVERY: 'true',
    OUTPUT_DIR: path.join(userDataPath, 'output'),
    UPLOAD_DIR: path.join(userDataPath, 'uploads'),
    DB_PATH: path.join(userDataPath, 'db', 'history.db'),
    PRODUCTION: 'true',
  };

  backendProcess = spawn(backendPath, [], { env });
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend] ${data}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Error] ${data}`);
  });
}
```

### 终止后端

```javascript
function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.on('quit', stopBackend);
```

### 后端路径

```javascript
function getBackendPath() {
  if (isDev) {
    // 开发模式：从 dist/backend 运行
    return path.join(__dirname, '../dist/backend/sigma-backend.exe');
  } else {
    // 生产模式：从 resources/backend 运行
    return path.join(process.resourcesPath, 'backend/sigma-backend.exe');
  }
}
```

## 开发模式

### 检测开发模式

```javascript
const isDev = !app.isPackaged;
```

### 开发模式特性

- 加载 Vite 开发服务器
- 自动打开 DevTools
- 后端从 `dist/backend` 运行
- 详细日志输出

### 启动开发模式

```bash
npm run dev
```

## 测试

### 单元测试

```bash
npm run test:electron
```

### 端到端测试

```bash
npm run test:e2e
```

### 构建验证测试

```bash
npm run test:build
```

## 调试

### 主进程调试

1. 在 VS Code 中配置 launch.json
2. 设置断点
3. 按 F5 启动调试

### 渲染进程调试

1. 开发模式下自动打开 DevTools
2. 或按 `Ctrl+Shift+I` 手动打开

### 后端日志

- 开发模式：输出到控制台
- 生产模式：输出到 `data/logs/app.log`

## 常见问题

### 后端启动失败

1. 检查后端可执行文件是否存在
2. 检查端口是否被占用（支持自动端口切换）
3. 查看后端日志

### 版本检测失败

1. 检查网络连接
2. 检查 version.json 是否可访问
3. 查看控制台错误信息

### 窗口空白

1. 检查前端是否构建成功
2. 检查 Vite 开发服务器是否运行
3. 查看 DevTools 控制台错误
