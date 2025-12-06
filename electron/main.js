const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow = null;
let backendProcess = null;
const BACKEND_PORT = 8080;

// 获取应用数据目录
const userDataPath = app.getPath('userData');
const backendPath = path.join(__dirname, '..', 'backend');
const backendExe = process.platform === 'win32' 
  ? path.join(backendPath, 'sigma-backend.exe')
  : process.platform === 'darwin'
  ? path.join(backendPath, 'sigma-backend')
  : path.join(backendPath, 'sigma-backend');

// 确保必要的目录存在
const outputDir = path.join(userDataPath, 'output');
const uploadsDir = path.join(userDataPath, 'uploads');
const dbPath = path.join(userDataPath, 'history.db');

function ensureDirectories() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

function startBackend() {
  ensureDirectories();
  
  // 设置环境变量
  const env = {
    ...process.env,
    API_KEY: process.env.API_KEY || '', // 从环境变量或配置文件读取
    OUTPUT_DIR: outputDir,
    UPLOAD_DIR: uploadsDir,
    DB_PATH: dbPath,
    PORT: BACKEND_PORT.toString(),
  };

  console.log('启动后端服务...');
  console.log('后端路径:', backendExe);
  console.log('输出目录:', outputDir);
  console.log('上传目录:', uploadsDir);
  console.log('数据库路径:', dbPath);

  // 启动后端进程
  backendProcess = spawn(backendExe, [], {
    env: env,
    cwd: backendPath,
    stdio: 'inherit',
  });

  backendProcess.on('error', (error) => {
    console.error('后端启动失败:', error);
    if (mainWindow) {
      mainWindow.webContents.send('backend-error', error.message);
    }
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`后端进程退出，代码: ${code}, 信号: ${signal}`);
    if (code !== 0 && code !== null) {
      console.error('后端进程异常退出');
    }
  });

  // 等待后端启动
  setTimeout(() => {
    checkBackendHealth();
  }, 2000);
}

function checkBackendHealth() {
  const http = require('http');
  const req = http.get(`http://localhost:${BACKEND_PORT}/history`, (res) => {
    if (res.statusCode === 200) {
      console.log('后端服务已启动');
      if (mainWindow) {
        mainWindow.webContents.send('backend-ready');
      }
    } else {
      console.warn('后端服务响应异常:', res.statusCode);
    }
  });

  req.on('error', (err) => {
    console.error('后端健康检查失败:', err.message);
    // 重试
    setTimeout(checkBackendHealth, 2000);
  });

  req.setTimeout(3000, () => {
    req.destroy();
    console.warn('后端健康检查超时');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'), // 可选
  });

  // 开发环境加载 Vite 开发服务器
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  startBackend();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 关闭后端进程
  if (backendProcess) {
    console.log('正在关闭后端进程...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
    } else {
      backendProcess.kill('SIGTERM');
    }
  }
});

// IPC 处理
ipcMain.handle('get-backend-url', () => {
  return `http://localhost:${BACKEND_PORT}`;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

