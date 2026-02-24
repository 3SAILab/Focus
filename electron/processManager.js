const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Module-level constants
const DEFAULT_BACKEND_PORT = 51888;
const BACKEND_PROTOCOL = 'http';
const MAX_PORT_ATTEMPTS = 10;
const PORT_FILE_NAME = 'sigma-backend.port';

/**
 * Creates a process manager instance for managing the Go backend lifecycle.
 *
 * @param {Object} config
 * @param {string} config.userDataPath - User data directory
 * @param {boolean} config.isDev - Development mode flag
 * @param {import('electron').BrowserWindow} config.mainWindow - Main window reference for IPC events
 * @param {boolean} [config.enableLog] - Whether logging is enabled (for ENABLE_API_LOG env var)
 * @returns {Object} Process manager API
 */
function createProcessManager(config) {
  const { userDataPath, isDev, mainWindow } = config;
  const enableLog = config.enableLog !== undefined ? config.enableLog : false;

  // Internal state (replaces module-level globals from main.js)
  let backendProcess = null;
  let actualBackendPort = DEFAULT_BACKEND_PORT;
  let healthCheckComplete = false;
  let isCleaningUp = false;
  let cleanupComplete = false;

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
    const { app } = require('electron');

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
        const { app } = require('electron');
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
        ENABLE_API_LOG: enableLog ? 'true' : 'false',
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
            const { dialog, app } = require('electron');
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
        console.log('[Cleanup] ✓ 主窗口已关闭');
      } catch (error) {
        console.error('[Cleanup] ✗ 关闭主窗口失败:', error.message);
      }
    }

    cleanupComplete = true;
    isCleaningUp = false;
    console.log('[Cleanup] ✓ 清理完成');
  }

  // Get the current actual backend port
  function getActualPort() {
    return actualBackendPort;
  }

  // Public API
  return {
    startBackend,
    cleanup,
    getBackendPath,
    validateBackendPath,
    ensureDirectories,
    checkBackendHealth,
    readPortFromFile,
    getPortFilePath,
    getActualPort,
  };
}

module.exports = { createProcessManager };
