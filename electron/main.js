const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const versionChecker = require('./versionChecker');

// ============ 开发环境日志开关 ============
// 设置为 true 启用开发环境日志（控制台 + 文件）
// 设置为 false 禁用所有日志
const ENABLE_DEV_LOG = false;
// =========================================

// ============ 生产环境日志开关 ============
// 设置为 true 启用生产环境日志（用于调试用户问题）
// 设置为 false 禁用生产环境日志（正常发布时应设为 false）
const ENABLE_PROD_LOG = false;
// =========================================

// ============ 前端 Console 日志开关 ============
// 设置为 true 保留前端 console.log（用于调试）
// 设置为 false 在生产环境移除 console.log（减小包体积）
// 
// 配置方法：
// 1. 修改 package.json 中的 build:frontend 脚本
//    - 调试版本：set ENABLE_FRONTEND_CONSOLE=true
//    - 正式版本：set ENABLE_FRONTEND_CONSOLE=false
// 2. 或使用专用脚本：
//    - npm run build:frontend (保留 console)
//    - npm run build:frontend:release (移除 console)
// 
// 当前配置：保留 console（用于调试）
const ENABLE_FRONTEND_CONSOLE = true;
// =========================================

// 创建中文菜单（传入 isDev 参数控制开发者工具显示）
function createChineseMenu(showDevTools = false) {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // macOS 应用菜单
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { label: '关于 Focus', role: 'about' },
        { type: 'separator' },
        { label: '服务', role: 'services' },
        { type: 'separator' },
        { label: '隐藏 Focus', role: 'hide' },
        { label: '隐藏其他', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        { label: '退出 Focus', role: 'quit' }
      ]
    }] : []),
    // 文件菜单
    {
      label: '文件',
      submenu: [
        isMac ? { label: '关闭窗口', role: 'close' } : { label: '退出', role: 'quit' }
      ]
    },
    // 编辑菜单
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: '重做', role: 'redo', accelerator: 'Shift+CmdOrCtrl+Z' },
        { type: 'separator' },
        { label: '剪切', role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: '复制', role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: '粘贴', role: 'paste', accelerator: 'CmdOrCtrl+V' },
        ...(isMac ? [
          { label: '粘贴并匹配样式', role: 'pasteAndMatchStyle' },
          { label: '删除', role: 'delete' },
          { label: '全选', role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
          { type: 'separator' },
          {
            label: '语音',
            submenu: [
              { label: '开始朗读', role: 'startSpeaking' },
              { label: '停止朗读', role: 'stopSpeaking' }
            ]
          }
        ] : [
          { label: '删除', role: 'delete' },
          { type: 'separator' },
          { label: '全选', role: 'selectAll', accelerator: 'CmdOrCtrl+A' }
        ])
      ]
    },
    // 视图菜单
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { label: '强制重新加载', role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { type: 'separator' },
        // 仅开发环境显示开发者工具
        ...(showDevTools ? [
          { label: '开发者工具', role: 'toggleDevTools', accelerator: 'F12' },
          { type: 'separator' },
        ] : []),
        { label: '实际大小', role: 'resetZoom', accelerator: 'CmdOrCtrl+0' },
        { label: '放大', role: 'zoomIn', accelerator: 'CmdOrCtrl+Plus' },
        { label: '缩小', role: 'zoomOut', accelerator: 'CmdOrCtrl+-' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen', accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11' }
      ]
    },
    // 窗口菜单
    {
      label: '窗口',
      submenu: [
        { label: '最小化', role: 'minimize', accelerator: 'CmdOrCtrl+M' },
        { label: '缩放', role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { label: '前置所有窗口', role: 'front' },
          { type: 'separator' },
          { label: '窗口', role: 'window' }
        ] : [
          { label: '关闭', role: 'close' }
        ])
      ]
    },
    // 帮助菜单
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 Focus',
          click: async () => {
            const { dialog } = require('electron');
            dialog.showMessageBox({
              type: 'info',
              title: '关于 Focus',
              message: 'Focus AI 图像生成工具',
              detail: `版本: ${app.getVersion()}\n\n© 2025 希革马（宁波市）人工智能有限责任公司\n保留所有权利\n\n本软件最终解释权归希革马（宁波市）人工智能有限责任公司所有\n\nbeta版`,
              buttons: ['确定']
            });
          }
        }
      ]
    }
  ];

  return Menu.buildFromTemplate(template);
}

let mainWindow = null;
let backendProcess = null;
const DEFAULT_BACKEND_PORT = 51888;  // 使用不常用的端口，避免与其他服务冲突
const BACKEND_PROTOCOL = 'http';
const MAX_PORT_ATTEMPTS = 10;
const PORT_FILE_NAME = 'sigma-backend.port';

// 实际使用的后端端口（启动后从端口文件读取）
let actualBackendPort = DEFAULT_BACKEND_PORT;

// Note: isDev and userDataPath will be initialized after app.whenReady()
// because app.isPackaged and app.getPath() are only available after app is ready
let isDev = false;
let userDataPath = '';

// Log stream will be initialized after app.whenReady()
let logPath = '';
let logStream = null;

// 重写 console.log 和 console.error 以同时写入文件
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// 计算是否启用日志：
// 1. 开发环境 + ENABLE_DEV_LOG = true
// 2. 生产环境 + ENABLE_PROD_LOG = true
function shouldEnableLog() {
  if (isDev) {
    return ENABLE_DEV_LOG;
  }
  return ENABLE_PROD_LOG;
}

// Initialize logging function (will be called after app.whenReady())
function initializeLogging() {
  // 仅开发环境且日志开关开启时启用日志
  // 生产环境或日志开关关闭时完全禁用日志
  
  console.log = function(...args) {
    if (shouldEnableLog()) {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
      const timestamp = new Date().toISOString();
      if (logStream) {
        logStream.write(`[${timestamp}] [LOG] ${message}\n`);
      }
      originalLog.apply(console, args);
    }
  };

  console.error = function(...args) {
    if (shouldEnableLog()) {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
      const timestamp = new Date().toISOString();
      if (logStream) {
        logStream.write(`[${timestamp}] [ERROR] ${message}\n`);
      }
      originalError.apply(console, args);
    }
  };

  console.warn = function(...args) {
    if (shouldEnableLog()) {
      const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
      const timestamp = new Date().toISOString();
      if (logStream) {
        logStream.write(`[${timestamp}] [WARN] ${message}\n`);
      }
      originalWarn.apply(console, args);
    }
  };
}

// Get backend executable path based on environment and architecture
function getBackendPath() {
  const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
  
  if (isDev) {
    // Development: use dist/backend directory
    return path.join(__dirname, '..', 'dist', 'backend', exeName);
  } else {
    // Production: use resources/backend directory
    return path.join(process.resourcesPath, 'backend', exeName);
  }
}

// Validate backend executable exists
function validateBackendPath(backendExe) {
  if (!fs.existsSync(backendExe)) {
    const errorInfo = {
      message: 'Backend executable not found',
      expectedPath: backendExe,
      isPackaged: app.isPackaged,
      isDev: isDev,
      platform: process.platform,
      __dirname: __dirname,
      resourcesPath: process.resourcesPath,
      cwd: process.cwd()
    };
    
    console.error('[Backend] ✗ Backend executable not found');
    console.error('[Backend] Error details:', JSON.stringify(errorInfo, null, 2));
    
    // Try to list what's actually in the expected directory
    try {
      const parentDir = path.dirname(backendExe);
      if (fs.existsSync(parentDir)) {
        console.error('[Backend] Directory contents:', parentDir);
        const files = fs.readdirSync(parentDir);
        files.forEach(file => console.error('  -', file));
      } else {
        console.error('[Backend] Parent directory does not exist:', parentDir);
      }
    } catch (e) {
      console.error('[Backend] Cannot list directory:', e.message);
    }
    
    throw new Error(`Backend executable not found: ${backendExe}`);
  }
  
  console.log('[Backend] ✓ Backend executable found:', backendExe);
  return true;
}

// Ensure necessary directories exist
function ensureDirectories(baseUserDataPath) {
  console.log('[Paths] Creating necessary directory structure...');
  
  const directories = {
    output: path.join(baseUserDataPath, 'output'),
    uploads: path.join(baseUserDataPath, 'uploads'),
    db: path.join(baseUserDataPath, 'db'),
    temp: path.join(baseUserDataPath, 'temp'),
    logs: path.join(baseUserDataPath, 'logs')
  };
  
  for (const [name, dir] of Object.entries(directories)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`[Paths] ✓ ${name} directory created:`, dir);
    } else {
      console.log(`[Paths] ✓ ${name} directory exists:`, dir);
    }
  }
  
  console.log('[Paths] Directory structure validation complete');
  return directories;
}

async function startBackend() {
  console.log('[Backend] startBackend() function starting');
  try {
    // Ensure necessary directories exist
    console.log('[Backend] Ensuring necessary directories exist...');
    const directories = ensureDirectories(userDataPath);
    console.log('[Backend] Directory check complete');
    
    // Get and validate backend path
    const backendExe = getBackendPath();
    const backendWorkingDir = path.dirname(backendExe);
    
    // Log path information (only in dev mode or if validation fails)
    if (isDev) {
      console.log('[Backend] Path debug information:');
      console.log('  - __dirname:', __dirname);
      console.log('  - process.resourcesPath:', process.resourcesPath);
      console.log('  - app.isPackaged:', app.isPackaged);
      console.log('  - isDev:', isDev);
      console.log('  - backendExe:', backendExe);
      console.log('  - backendWorkingDir:', backendWorkingDir);
    }
    
    // Validate backend executable exists
    validateBackendPath(backendExe);
    
    // Verify file is executable (Unix systems)
    if (process.platform !== 'win32') {
      try {
        fs.accessSync(backendExe, fs.constants.X_OK);
        console.log('[Backend] Backend file has execute permission');
      } catch (err) {
        console.warn('[Backend] Backend file may not have execute permission:', err.message);
        // Try to set execute permission
        try {
          fs.chmodSync(backendExe, 0o755);
          console.log('[Backend] Execute permission set successfully');
        } catch (chmodErr) {
          console.error('[Backend] Failed to set execute permission:', chmodErr.message);
        }
      }
    }
    
    // Set environment variables (不再需要 TLS 相关配置)
    const env = {
      ...process.env,
      // 明确不传递配置相关的环境变量，让后端从 config.json 加载
      API_KEY: '',
      DISCLAIMER_AGREED: '',
      OUTPUT_DIR: directories.output,
      UPLOAD_DIR: directories.uploads,
      DB_PATH: path.join(directories.db, 'history.db'),
      PORT: DEFAULT_BACKEND_PORT.toString(),
      LOG_DIR: directories.logs,
      // 根据日志开关启用 API 日志记录
      ENABLE_API_LOG: shouldEnableLog() ? 'true' : 'false',
      // 启用自动端口发现
      AUTO_PORT_DISCOVERY: 'true',
      // 生产环境标识（打包后的应用使用生产模型）
      PRODUCTION: isDev ? 'false' : 'true'
    };

    console.log('[Backend] Starting backend service...');
    console.log('[Backend] Configuration:');
    console.log('  - Default Port:', DEFAULT_BACKEND_PORT);
    console.log('  - Auto Port Discovery: enabled (max attempts:', MAX_PORT_ATTEMPTS, ')');
    console.log('  - Protocol:', BACKEND_PROTOCOL);
    console.log('  - User data directory:', userDataPath);
    console.log('  - Output directory:', directories.output);
    console.log('  - Upload directory:', directories.uploads);
    console.log('  - Database directory:', directories.db);
    console.log('  - Log directory:', directories.logs);
    console.log('  - API Log: enabled');
    console.log('  - Backend executable:', backendExe);
    console.log('  - Working directory:', backendWorkingDir);
    console.log('  - Port file:', getPortFilePath());

    // Spawn backend process
    const spawnOptions = {
      env: env,
      cwd: backendWorkingDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    };
    
    console.log('[Backend] Spawning process:', backendExe);
    backendProcess = spawn(backendExe, [], spawnOptions);
    
    // 捕获后端输出
    if (backendProcess.stdout) {
      backendProcess.stdout.on('data', (data) => {
        console.log('[Backend stdout]', data.toString().trim());
      });
    }
    
    if (backendProcess.stderr) {
      backendProcess.stderr.setEncoding('utf8');
      backendProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        console.error('[Backend stderr]', output);
        // 尝试用不同编码解析
        try {
          const buffer = Buffer.from(data, 'binary');
          const gbkOutput = buffer.toString('gbk');
          if (gbkOutput !== output) {
            console.error('[Backend stderr GBK]', gbkOutput);
          }
        } catch (e) {
          // Ignore encoding errors
        }
      });
    }

    backendProcess.on('error', (error) => {
      console.error('[Backend] 后端进程启动失败:', error);
      console.error('[Backend] 错误详情:', {
        code: error.code,
        message: error.message,
        path: error.path,
      });
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', `后端启动失败: ${error.message}`);
      }
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`[Backend] 后端进程退出 - 代码: ${code}, 信号: ${signal}`);
      
      // Mark process as null to prevent cleanup from trying to kill it again
      const wasAbnormal = code !== 0 && code !== null && !cleanupComplete;
      backendProcess = null;
      
      if (wasAbnormal) {
        console.error('[Backend] 后端进程异常退出，退出代码:', code);
        
        // Show error to user
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('backend-error', `后端进程异常退出，代码: ${code}`);
          
          // Show dialog for critical failures
          const { dialog } = require('electron');
          dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: '后端服务错误',
            message: '后端服务意外停止',
            detail: `退出代码: ${code}\n信号: ${signal || '无'}\n\n应用可能无法正常工作。建议重启应用。`,
            buttons: ['重启应用', '继续使用'],
          }).then((result) => {
            if (result.response === 0) {
              // User chose to restart
              console.log('[Backend] 用户选择重启应用');
              app.relaunch();
              app.quit();
            }
          });
        }
      } else if (code === 0 || code === null) {
        console.log('[Backend] 后端进程正常退出');
      }
    });

    // 等待后端启动并进行健康检查
    console.log('[Backend] 等待后端服务启动...');
    setTimeout(() => {
      checkBackendHealth();
    }, 2000);
  } catch (error) {
    console.error('[Backend] 启动后端失败:', error);
    console.error('[Backend] 错误堆栈:', error.stack);
    if (mainWindow) {
      mainWindow.webContents.send('backend-error', `启动后端失败: ${error.message}`);
    }
    // Re-throw to allow caller to handle
    throw error;
  }
}

// 获取端口文件路径
function getPortFilePath() {
  const os = require('os');
  const tempDir = os.tmpdir();
  return path.join(tempDir, PORT_FILE_NAME);
}

// 从端口文件读取实际端口
function readPortFromFile() {
  try {
    const portFilePath = getPortFilePath();
    if (fs.existsSync(portFilePath)) {
      const content = fs.readFileSync(portFilePath, 'utf8').trim();
      const port = parseInt(content, 10);
      if (port >= 1 && port <= 65535) {
        console.log(`[Port] 从端口文件读取到端口: ${port}`);
        return port;
      }
    }
  } catch (error) {
    console.warn('[Port] 读取端口文件失败:', error.message);
  }
  return null;
}

// 用于跟踪健康检查是否已完成
let healthCheckComplete = false;

function checkBackendHealth(retryCount = 0) {
  // 如果已经完成健康检查，不再继续
  if (healthCheckComplete) {
    return;
  }
  
  // 尝试从端口文件读取实际端口
  const portFromFile = readPortFromFile();
  if (portFromFile) {
    actualBackendPort = portFromFile;
  }
  
  const http = require('http');
  const maxRetries = 10;
  const retryDelay = 2000;
  
  const options = {
    hostname: 'localhost',
    port: actualBackendPort,
    path: '/history',
    method: 'GET',
    timeout: 3000,
  };

  console.log(`[Health] 健康检查尝试 ${retryCount + 1}/${maxRetries} - ${BACKEND_PROTOCOL}://localhost:${actualBackendPort}/history`);

  const req = http.request(options, (res) => {
    // 必须消费响应数据，否则请求不会正确结束
    res.resume();
    
    console.log(`[Health] 收到响应，状态码: ${res.statusCode}`);
    
    if (res.statusCode === 200) {
      // 标记健康检查已完成，防止后续重试
      healthCheckComplete = true;
      console.log('[Health] ✓ 后端服务已启动并响应正常');
      if (mainWindow) {
        mainWindow.webContents.send('backend-ready');
      }
    } else {
      console.warn(`[Health] ✗ 后端服务响应异常，状态码: ${res.statusCode}`);
      if (retryCount < maxRetries - 1) {
        console.log(`[Health] 将在 ${retryDelay}ms 后重试...`);
        setTimeout(() => checkBackendHealth(retryCount + 1), retryDelay);
      } else {
        const errorMsg = `后端健康检查失败: 达到最大重试次数 (${maxRetries})，最后状态码: ${res.statusCode}`;
        console.error('[Health]', errorMsg);
        if (mainWindow) {
          mainWindow.webContents.send('backend-error', '后端服务启动超时或响应异常');
        }
      }
    }
  });

  req.on('error', (err) => {
    // 如果已经完成健康检查，忽略错误
    if (healthCheckComplete) {
      return;
    }
    
    console.error(`[Health] ✗ 健康检查请求失败: ${err.message}`);
    
    if (retryCount < maxRetries - 1) {
      console.log(`[Health] 将在 ${retryDelay}ms 后重试...`);
      setTimeout(() => checkBackendHealth(retryCount + 1), retryDelay);
    } else {
      const errorMsg = `后端健康检查失败: 达到最大重试次数 (${maxRetries})`;
      console.error('[Health]', errorMsg);
      console.error('[Health] 可能的原因:');
      console.error('  1. 后端进程未成功启动');
      console.error('  2. 端口被占用或防火墙阻止');
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', `后端服务无法连接: ${err.message}`);
      }
    }
  });

  req.on('timeout', () => {
    // 如果已经完成健康检查，忽略超时
    if (healthCheckComplete) {
      req.destroy();
      return;
    }
    
    req.destroy();
    console.warn(`[Health] ✗ 健康检查超时 (${options.timeout}ms)`);
    
    if (retryCount < maxRetries - 1) {
      console.log(`[Health] 将在 ${retryDelay}ms 后重试...`);
      setTimeout(() => checkBackendHealth(retryCount + 1), retryDelay);
    } else {
      const errorMsg = `后端健康检查失败: 达到最大重试次数 (${maxRetries})，请求超时`;
      console.error('[Health]', errorMsg);
      if (mainWindow) {
        mainWindow.webContents.send('backend-error', '后端服务启动超时');
      }
    }
  });

  req.end();
}

function createWindow() {
  console.log('[Window] 创建主窗口...');
  
  // 设置中文菜单（传入 isDev 或 ENABLE_PROD_LOG 控制开发者工具显示）
  const menu = createChineseMenu(isDev || ENABLE_PROD_LOG);
  Menu.setApplicationMenu(menu);
  console.log('[Window] ✓ 中文菜单已设置');
  
  // 使用 focus.ico 作为应用图标
  const iconPath = path.join(__dirname, '..', 'assets', 'focus.ico');
  const windowOptions = {
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,  // 禁用 web 安全策略，解决跨域和本地文件加载问题
      devTools: isDev || ENABLE_PROD_LOG,     // 开发环境或启用生产日志时启用开发者工具
    },
  };
  
  // Add icon if it exists
  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
    console.log('[Window] 应用图标已设置:', iconPath);
  } else {
    console.warn('[Window] 应用图标不存在:', iconPath);
  }
  
  mainWindow = new BrowserWindow(windowOptions);

  // 开发环境加载 Vite 开发服务器
  if (isDev) {
    const devUrl = 'http://localhost:5174';
    console.log('[Window] 开发模式: 加载 Vite 开发服务器:', devUrl);
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
    console.log('[Window] 开发者工具已打开');
  } else {
    // 生产环境加载打包后的文件
    // In production, files are in app.asar, use app.getAppPath()
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'frontend', 'dist', 'index.html');
    console.log('[Window] 生产模式: 加载打包文件');
    console.log('[Window] App path:', appPath);
    console.log('[Window] Index path:', indexPath);
    
    if (fs.existsSync(indexPath)) {
      console.log('[Window] ✓ 前端文件存在，开始加载');
      mainWindow.loadFile(indexPath);
    } else {
      console.error('[Window] ✗ 前端文件不存在:', indexPath);
      
      // Try to list what's in the app directory
      try {
        console.log('[Window] App directory contents:');
        const appContents = fs.readdirSync(appPath);
        appContents.forEach(item => console.log('  -', item));
        
        const frontendPath = path.join(appPath, 'frontend');
        if (fs.existsSync(frontendPath)) {
          console.log('[Window] Frontend directory contents:');
          const frontendContents = fs.readdirSync(frontendPath);
          frontendContents.forEach(item => console.log('  -', item));
        }
      } catch (e) {
        console.error('[Window] Cannot list directory:', e.message);
      }
      
      const { dialog } = require('electron');
      dialog.showErrorBox(
        '前端文件缺失',
        `无法找到前端文件:\n${indexPath}\n\n请确保应用已正确构建。`
      );
    }
  }

  mainWindow.on('closed', () => {
    console.log('[Window] 主窗口已关闭');
    mainWindow = null;
  });
  
  console.log('[Window] ✓ 主窗口创建完成');
}

// 获取应用数据目录
// 生产环境使用 AppData 目录（有写入权限），开发环境使用项目目录
function getAppDataPath() {
  if (isDev) {
    // 开发模式：使用项目根目录下的 data 文件夹
    return path.join(__dirname, '..', 'data');
  } else {
    // 生产模式：使用 AppData 目录（C:\Users\<用户名>\AppData\Roaming\Focus\）
    // 这是 Windows 推荐的用户数据存储位置，有完整的写入权限
    // 注意：Program Files 目录是受保护的，普通用户无法写入
    return app.getPath('userData');
  }
}

// 数据迁移：从旧安装目录迁移到 AppData
// 旧版本数据可能存储在安装目录下的 data 文件夹
function migrateOldData(newDataPath) {
  // 仅在生产环境执行迁移
  if (isDev) {
    console.log('[Migration] 开发模式，跳过数据迁移');
    return;
  }
  
  try {
    // 获取可能的旧数据目录（安装目录下的 data 文件夹）
    // process.resourcesPath 指向 resources 目录（如 C:\Program Files\Focus\resources）
    // 其父目录就是安装目录（如 C:\Program Files\Focus）
    const installDir = path.dirname(process.resourcesPath);
    const oldDataPath = path.join(installDir, 'data');
    
    console.log('[Migration] process.resourcesPath:', process.resourcesPath);
    console.log('[Migration] 安装目录:', installDir);
    console.log('[Migration] 检查旧数据目录:', oldDataPath);
    console.log('[Migration] 新数据目录:', newDataPath);
    
    // 检查旧数据目录是否存在
    if (!fs.existsSync(oldDataPath)) {
      console.log('[Migration] 旧数据目录不存在，无需迁移');
      return;
    }
    
    // 检查旧数据目录是否有内容
    const oldFiles = fs.readdirSync(oldDataPath);
    if (oldFiles.length === 0) {
      console.log('[Migration] 旧数据目录为空，无需迁移');
      // 删除空的旧目录
      try {
        fs.rmdirSync(oldDataPath);
        console.log('[Migration] 已删除空的旧数据目录');
      } catch (e) {
        console.warn('[Migration] 删除空目录失败:', e.message);
      }
      return;
    }
    
    // 检查新数据目录是否已有数据库（避免覆盖）
    const newDbPath = path.join(newDataPath, 'db', 'history.db');
    if (fs.existsSync(newDbPath)) {
      console.log('[Migration] 新数据目录已有数据库，跳过迁移');
      return;
    }
    
    console.log('[Migration] 开始迁移数据...');
    console.log('[Migration] 旧目录内容:', oldFiles);
    
    // 递归复制目录
    const copyRecursive = (src, dest) => {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
          copyRecursive(srcPath, destPath);
        } else {
          try {
            fs.copyFileSync(srcPath, destPath);
            console.log('[Migration] 复制文件成功:', entry.name);
          } catch (copyErr) {
            console.error('[Migration] 复制文件失败:', entry.name, copyErr.message);
          }
        }
      }
    };
    
    // 执行复制
    copyRecursive(oldDataPath, newDataPath);
    console.log('[Migration] ✓ 数据迁移完成');
    
    // 删除旧数据目录
    const deleteRecursive = (dirPath) => {
      if (fs.existsSync(dirPath)) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            deleteRecursive(fullPath);
          } else {
            try {
              fs.unlinkSync(fullPath);
            } catch (unlinkErr) {
              console.warn('[Migration] 删除文件失败:', fullPath, unlinkErr.message);
            }
          }
        }
        try {
          fs.rmdirSync(dirPath);
        } catch (rmdirErr) {
          console.warn('[Migration] 删除目录失败:', dirPath, rmdirErr.message);
        }
      }
    };
    
    try {
      deleteRecursive(oldDataPath);
      console.log('[Migration] ✓ 旧数据目录已删除');
    } catch (deleteError) {
      console.warn('[Migration] 删除旧数据目录失败:', deleteError.message);
      console.warn('[Migration] 用户可以手动删除:', oldDataPath);
    }
    
  } catch (error) {
    console.error('[Migration] 数据迁移失败:', error.message);
    console.error('[Migration] 错误堆栈:', error.stack);
    // 迁移失败不应阻止应用启动
  }
}

app.whenReady().then(async () => {
  // Initialize environment detection and paths
  isDev = !app.isPackaged;
  
  // 使用安装路径下的 data 目录，而不是 AppData
  userDataPath = getAppDataPath();
  
  // Ensure user data directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  // 数据迁移：从旧安装目录迁移到 AppData
  migrateOldData(userDataPath);
  
  // Initialize logging (根据日志开关启用)
  if (shouldEnableLog()) {
    const logsDir = path.join(userDataPath, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    logPath = path.join(logsDir, 'app.log');
    logStream = fs.createWriteStream(logPath, { flags: 'a' });
  }
  initializeLogging();
  
  console.log('[App] Electron application ready');
  console.log('[App] Platform:', process.platform);
  console.log('[App] Architecture:', process.arch);
  console.log('[App] Is packaged:', app.isPackaged);
  console.log('[App] Development mode:', isDev);
  console.log('[App] Log enabled:', shouldEnableLog(), isDev ? `(ENABLE_DEV_LOG=${ENABLE_DEV_LOG})` : `(ENABLE_PROD_LOG=${ENABLE_PROD_LOG})`);
  console.log('[App] User data directory:', userDataPath);
  console.log('[App] Install directory:', isDev ? 'N/A (dev mode)' : path.dirname(process.resourcesPath));
  console.log('[App] Log file path:', logPath || 'disabled');
  
  try {
    createWindow();
    await startBackend();
  } catch (error) {
    console.error('[App] ✗ Application initialization failed:', error.message);
    console.error('[App] Error stack:', error.stack);
    
    // Show error dialog to user
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Application Startup Failed',
      `Failed to start SIGMA:\n\n${error.message}\n\nLog file: ${logPath}\n\nPlease check the log file for details.`
    );
  }

  app.on('activate', () => {
    console.log('[App] Application activated');
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('[App] No open windows, creating new window...');
      createWindow();
    }
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Track cleanup state to prevent multiple cleanup calls
let isCleaningUp = false;
let cleanupComplete = false;

function cleanup() {
  // Prevent multiple simultaneous cleanup calls
  if (isCleaningUp) {
    console.log('[Cleanup] 清理已在进行中，跳过重复调用');
    return;
  }
  
  if (cleanupComplete) {
    console.log('[Cleanup] 清理已完成，跳过重复调用');
    return;
  }
  
  isCleaningUp = true;
  console.log('[Cleanup] 开始清理资源...');
  
  // 关闭后端进程
  if (backendProcess && !backendProcess.killed) {
    console.log('[Cleanup] 正在关闭后端进程 (PID:', backendProcess.pid, ')...');
    try {
      if (process.platform === 'win32') {
        // Windows: 使用 taskkill 强制终止进程树
        console.log('[Cleanup] 使用 taskkill 终止 Windows 进程树...');
        try {
          const { execSync } = require('child_process');
          // Use synchronous execution to ensure process is killed before app exits
          execSync(`taskkill /pid ${backendProcess.pid} /f /t`, { 
            stdio: 'ignore',
            timeout: 5000 
          });
          console.log('[Cleanup] ✓ taskkill 成功终止进程');
          backendProcess = null;
        } catch (killError) {
          console.error('[Cleanup] ✗ taskkill 失败:', killError.message);
          // 备用方案：直接 kill
          try {
            console.log('[Cleanup] 尝试备用方案: 直接 kill...');
            backendProcess.kill('SIGKILL');
            console.log('[Cleanup] ✓ 备用 kill 成功');
            backendProcess = null;
          } catch (e) {
            console.error('[Cleanup] ✗ 备用 kill 失败:', e.message);
          }
        }
      } else {
        // Unix-like: 使用 SIGTERM，如果失败则使用 SIGKILL
        console.log('[Cleanup] 发送 SIGTERM 信号到后端进程...');
        try {
          backendProcess.kill('SIGTERM');
          
          // Wait briefly for graceful shutdown
          const startTime = Date.now();
          const timeout = 3000;
          
          while (backendProcess && !backendProcess.killed && (Date.now() - startTime) < timeout) {
            // Busy wait for a short period
            require('child_process').spawnSync('sleep', ['0.1']);
          }
          
          if (backendProcess && !backendProcess.killed) {
            console.warn('[Cleanup] 后端进程未响应 SIGTERM，使用 SIGKILL 强制终止');
            backendProcess.kill('SIGKILL');
            console.log('[Cleanup] ✓ SIGKILL 发送成功');
          } else {
            console.log('[Cleanup] ✓ 后端进程已正常退出');
          }
          backendProcess = null;
        } catch (e) {
          console.error('[Cleanup] ✗ 终止进程失败:', e.message);
        }
      }
    } catch (error) {
      console.error('[Cleanup] ✗ 终止后端进程失败:', error.message);
      console.error('[Cleanup] 错误堆栈:', error.stack);
    }
  } else {
    console.log('[Cleanup] 后端进程不存在或已终止');
  }
  
  // Clean up temporary files
  try {
    if (userDataPath) {
      console.log('[Cleanup] Cleaning temporary files...');
      const tempDir = path.join(userDataPath, 'temp');
      if (fs.existsSync(tempDir)) {
        const tempFiles = fs.readdirSync(tempDir);
        let cleanedCount = 0;
        tempFiles.forEach(file => {
          try {
            const filePath = path.join(tempDir, file);
            fs.unlinkSync(filePath);
            cleanedCount++;
          } catch (err) {
            console.warn('[Cleanup] Cannot delete temporary file:', file, err.message);
          }
        });
        console.log(`[Cleanup] ✓ Cleaned ${cleanedCount} temporary files`);
      } else {
        console.log('[Cleanup] Temporary directory does not exist, skipping cleanup');
      }
    }
  } catch (error) {
    console.error('[Cleanup] ✗ Failed to clean temporary files:', error.message);
  }
  
  // Close main window if still open
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[Cleanup] 关闭主窗口...');
    try {
      mainWindow.destroy();
      mainWindow = null;
      console.log('[Cleanup] ✓ 主窗口已关闭');
    } catch (error) {
      console.error('[Cleanup] ✗ 关闭主窗口失败:', error.message);
    }
  }
  
  cleanupComplete = true;
  isCleaningUp = false;
  console.log('[Cleanup] ✓ 清理完成');
}

app.on('before-quit', (event) => {
  console.log('[App] 应用即将退出 (before-quit)');
  if (!cleanupComplete) {
    event.preventDefault();
    cleanup();
    // Allow app to quit after cleanup
    setImmediate(() => {
      app.quit();
    });
  }
});

app.on('will-quit', (event) => {
  console.log('[App] 应用即将退出 (will-quit)');
  if (!cleanupComplete) {
    event.preventDefault();
    cleanup();
    // Allow app to quit after cleanup
    setImmediate(() => {
      app.quit();
    });
  }
});

// 处理异常退出
process.on('SIGINT', () => {
  console.log('[Process] 收到 SIGINT 信号，准备退出...');
  cleanup();
  // Give cleanup time to complete before forcing exit
  setTimeout(() => {
    console.log('[Process] 强制退出');
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  console.log('[Process] 收到 SIGTERM 信号，准备退出...');
  cleanup();
  // Give cleanup time to complete before forcing exit
  setTimeout(() => {
    console.log('[Process] 强制退出');
    process.exit(0);
  }, 1000);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] ✗ 未捕获的异常:', error.message);
  console.error('[Process] 错误堆栈:', error.stack);
  
  // Show error dialog to user
  try {
    const { dialog } = require('electron');
    if (app.isReady()) {
      dialog.showErrorBox(
        '应用错误',
        `应用遇到未预期的错误:\n\n${error.message}\n\n应用将关闭。`
      );
    }
  } catch (dialogError) {
    console.error('[Process] 无法显示错误对话框:', dialogError.message);
  }
  
  cleanup();
  // Give cleanup time to complete before forcing exit
  setTimeout(() => {
    console.log('[Process] 强制退出');
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] ✗ 未处理的 Promise 拒绝:', reason);
  console.error('[Process] Promise:', promise);
  
  // Log but don't exit - unhandled rejections shouldn't crash the app
  // unless they're critical
  if (reason && reason.message && reason.message.includes('critical')) {
    console.error('[Process] 检测到关键错误，准备退出...');
    cleanup();
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
});

// IPC 处理
ipcMain.handle('get-backend-url', () => {
  // 尝试从端口文件读取最新端口
  const portFromFile = readPortFromFile();
  if (portFromFile) {
    actualBackendPort = portFromFile;
  }
  const url = `${BACKEND_PROTOCOL}://localhost:${actualBackendPort}`;
  console.log('[IPC] get-backend-url 请求，返回:', url);
  return url;
});

ipcMain.handle('get-app-version', () => {
  const version = app.getVersion();
  console.log('[IPC] get-app-version 请求，返回:', version);
  return version;
});

ipcMain.handle('get-user-data-path', () => {
  console.log('[IPC] get-user-data-path 请求，返回:', userDataPath);
  return userDataPath;
});

ipcMain.handle('get-paths', () => {
  const paths = {
    userData: userDataPath,
    output: path.join(userDataPath, 'output'),
    uploads: path.join(userDataPath, 'uploads'),
    database: path.join(userDataPath, 'db', 'history.db'),
  };
  console.log('[IPC] get-paths request, returning:', paths);
  return paths;
});

// 保存图片到用户选择的位置
ipcMain.handle('save-image', async (event, { imageData, defaultFileName }) => {
  const { dialog } = require('electron');
  
  try {
    // 显示保存对话框让用户选择保存位置
    // 默认使用 jpg 格式
    let fileName = defaultFileName || `image_${Date.now()}.jpg`;
    // 如果文件名是 png 格式，改为 jpg
    if (fileName.endsWith('.png')) {
      fileName = fileName.replace('.png', '.jpg');
    }
    
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存图片',
      defaultPath: fileName,
      filters: [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (result.canceled || !result.filePath) {
      console.log('[IPC] save-image: 用户取消保存');
      return { success: false, canceled: true };
    }
    
    // 将 base64 或 data URL 转换为 Buffer 并保存
    let buffer;
    if (imageData.startsWith('data:')) {
      // 处理 data URL
      const base64Data = imageData.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else if (imageData.startsWith('http')) {
      // 处理远程 URL - 需要先下载
      const https = require('https');
      const http = require('http');
      const protocol = imageData.startsWith('https') ? https : http;
      
      buffer = await new Promise((resolve, reject) => {
        const agent = new https.Agent({ rejectUnauthorized: false });
        const options = { agent: imageData.startsWith('https') ? agent : undefined };
        
        protocol.get(imageData, options, (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks)));
          response.on('error', reject);
        }).on('error', reject);
      });
    } else {
      // 假设是 base64 字符串
      buffer = Buffer.from(imageData, 'base64');
    }
    
    // 写入文件
    fs.writeFileSync(result.filePath, buffer);
    console.log('[IPC] save-image: 图片已保存到', result.filePath);
    
    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('[IPC] save-image: 保存失败', error);
    return { success: false, error: error.message };
  }
});

// Version check IPC handlers
// Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.3

/**
 * Get local version info from package.json
 * IPC Channel: get-version-info
 */
ipcMain.handle('get-version-info', () => {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const versionInfo = {
      versionCode: packageJson.versionCode || '',
      versionName: packageJson.version || ''
    };
    
    console.log('[IPC] get-version-info 请求，返回:', versionInfo);
    return versionInfo;
  } catch (error) {
    console.error('[IPC] get-version-info 错误:', error.message);
    return {
      versionCode: '',
      versionName: ''
    };
  }
});

/**
 * Perform version check against remote server
 * IPC Channel: check-update
 * Returns: VersionCheckResult
 */
ipcMain.handle('check-update', async () => {
  console.log('[IPC] check-update 请求开始');
  
  try {
    // Get local version info
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const localVersion = {
      versionCode: packageJson.versionCode || '',
      versionName: packageJson.version || ''
    };
    
    console.log('[IPC] 本地版本:', localVersion);
    
    // Perform version check
    const result = await versionChecker.performVersionCheck(localVersion);
    
    console.log('[IPC] check-update 结果:', result.status);
    return result;
  } catch (error) {
    console.error('[IPC] check-update 错误:', error.message);
    return {
      status: 'fetch_error',
      errorMessage: `版本检查失败: ${error.message}`
    };
  }
});

/**
 * Open download URL in default browser
 * IPC Channel: open-download-url
 */
ipcMain.handle('open-download-url', async (event, url) => {
  console.log('[IPC] open-download-url 请求，URL:', url);
  
  if (!url) {
    console.error('[IPC] open-download-url: URL 为空');
    return { success: false, error: '下载链接为空' };
  }
  
  try {
    await shell.openExternal(url);
    console.log('[IPC] open-download-url: 已打开浏览器');
    return { success: true };
  } catch (error) {
    console.error('[IPC] open-download-url 错误:', error.message);
    return { success: false, error: error.message };
  }
});

console.log('[IPC] IPC 处理器已注册');

