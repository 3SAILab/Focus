const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Import extracted modules
const { createProcessManager } = require('./processManager');
const { createWindow } = require('./windowManager');
const { registerHandlers } = require('./ipcHandlers');

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

  const { Menu } = require('electron');
  return Menu.buildFromTemplate(template);
}

let mainWindow = null;
let processManager = null;
let isQuitting = false;

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
    // Create window via windowManager
    mainWindow = createWindow({ isDev, ENABLE_PROD_LOG, createChineseMenu });
    
    // Handle mainWindow nullification on close
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
    
    // Create process manager and start backend
    processManager = createProcessManager({
      userDataPath,
      isDev,
      mainWindow,
      enableLog: shouldEnableLog(),
    });
    await processManager.startBackend();
    
    // Register IPC handlers
    registerHandlers({
      mainWindow,
      userDataPath,
      readPortFromFile: processManager.readPortFromFile,
      getActualPort: processManager.getActualPort,
    });
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
      mainWindow = createWindow({ isDev, ENABLE_PROD_LOG, createChineseMenu });
      mainWindow.on('closed', () => {
        mainWindow = null;
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Signal and cleanup handlers - delegate to processManager
app.on('before-quit', (event) => {
  console.log('[App] 应用即将退出 (before-quit)');
  if (processManager && !isQuitting) {
    isQuitting = true;
    processManager.cleanup();
  }
  // Don't preventDefault - let the app quit naturally after cleanup
});

app.on('will-quit', (event) => {
  console.log('[App] 应用即将退出 (will-quit)');
  if (processManager && !isQuitting) {
    isQuitting = true;
    processManager.cleanup();
  }
  // Close log stream
  if (logStream) {
    logStream.end();
    logStream = null;
  }
});

// 处理异常退出
process.on('SIGINT', () => {
  console.log('[Process] 收到 SIGINT 信号，准备退出...');
  if (processManager) {
    processManager.cleanup();
  }
  // Give cleanup time to complete before forcing exit
  setTimeout(() => {
    console.log('[Process] 强制退出');
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  console.log('[Process] 收到 SIGTERM 信号，准备退出...');
  if (processManager) {
    processManager.cleanup();
  }
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
  
  if (processManager) {
    processManager.cleanup();
  }
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
    if (processManager) {
      processManager.cleanup();
    }
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
});
