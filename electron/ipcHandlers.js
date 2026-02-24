const path = require('path');
const fs = require('fs');
const { ipcMain, app, shell } = require('electron');
const versionChecker = require('./versionChecker');

// 常量
const BACKEND_PROTOCOL = 'http';

/**
 * 注册所有 IPC 处理器。
 *
 * @param {Object} deps
 * @param {import('electron').BrowserWindow} deps.mainWindow - 主窗口，用于保存对话框
 * @param {string} deps.userDataPath - 用户数据目录
 * @param {Function} deps.readPortFromFile - 从端口文件读取端口（来自 processManager）
 * @param {Function} deps.getActualPort - 获取当前后端端口（来自 processManager）
 */
function registerHandlers(deps) {
  const { mainWindow, userDataPath, readPortFromFile, getActualPort } = deps;

  // IPC 处理
  ipcMain.handle('get-backend-url', () => {
    // 尝试从端口文件读取最新端口
    const portFromFile = readPortFromFile();
    const port = portFromFile || getActualPort();
    const url = `${BACKEND_PROTOCOL}://localhost:${port}`;
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

  /**
   * 获取本地版本信息
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
   * 执行版本检查
   * IPC Channel: check-update
   * Returns: VersionCheckResult
   */
  ipcMain.handle('check-update', async () => {
    console.log('[IPC] check-update 请求开始');

    try {
      // 获取本地版本信息
      const packageJsonPath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      const localVersion = {
        versionCode: packageJson.versionCode || '',
        versionName: packageJson.version || ''
      };

      console.log('[IPC] 本地版本:', localVersion);

      // 执行版本检查
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
   * 在默认浏览器中打开下载链接
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
}

module.exports = { registerHandlers };
