const path = require('path');
const fs = require('fs');

/**
 * Creates and configures the main BrowserWindow.
 *
 * Sets up the Chinese menu, creates a BrowserWindow with standard options
 * (1400x900, context isolation, preload script, icon), and loads the
 * appropriate URL based on environment (Vite dev server or packaged index.html).
 *
 * @param {Object} config
 * @param {boolean} config.isDev - Development mode flag
 * @param {boolean} config.ENABLE_PROD_LOG - Production logging flag
 * @param {Function} config.createChineseMenu - Menu builder function that accepts showDevTools boolean
 * @returns {import('electron').BrowserWindow} The created main window
 */
function createWindow(config) {
  const { isDev, ENABLE_PROD_LOG, createChineseMenu } = config;
  const { BrowserWindow, Menu, app } = require('electron');

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

  const mainWindow = new BrowserWindow(windowOptions);

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
  });

  console.log('[Window] ✓ 主窗口创建完成');
  return mainWindow;
}

module.exports = { createWindow };
