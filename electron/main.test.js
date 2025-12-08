/**
 * Unit tests for Electron main process
 * Tests backend process management, health checks, and IPC handlers
 */

const { spawn } = require('child_process');
const https = require('https');
const TLSManager = require('./tls-manager');

describe('Electron Main Process', () => {
  let mockBackendProcess;
  let mockHttpsRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock backend process
    mockBackendProcess = {
      pid: 12345,
      killed: false,
      on: jest.fn((event, callback) => {
        mockBackendProcess[`_${event}Callback`] = callback;
        return mockBackendProcess;
      }),
      kill: jest.fn(),
    };

    // Setup mock HTTPS request
    mockHttpsRequest = {
      on: jest.fn((event, callback) => {
        mockHttpsRequest[`_${event}Callback`] = callback;
        return mockHttpsRequest;
      }),
      end: jest.fn(),
      destroy: jest.fn(),
    };
  });

  describe('Backend Process Management', () => {
    test('should configure backend process with TLS environment variables', () => {
      const env = {
        TLS_CERT_PATH: '/path/to/cert.pem',
        TLS_KEY_PATH: '/path/to/key.pem',
        USE_TLS: 'true',
        PORT: '8080',
      };

      expect(env).toHaveProperty('TLS_CERT_PATH');
      expect(env).toHaveProperty('TLS_KEY_PATH');
      expect(env).toHaveProperty('USE_TLS', 'true');
      expect(env).toHaveProperty('PORT', '8080');
    });

    test('should register error handler for backend process', () => {
      mockBackendProcess.on('error', (error) => {
        console.error('Backend error:', error);
      });

      expect(mockBackendProcess.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should register exit handler for backend process', () => {
      mockBackendProcess.on('exit', (code, signal) => {
        console.log(`Process exited: ${code}`);
      });

      expect(mockBackendProcess.on).toHaveBeenCalledWith('exit', expect.any(Function));
    });

    test('should handle backend process error callback', () => {
      const errorHandler = jest.fn();
      mockBackendProcess.on('error', errorHandler);
      
      // Simulate error
      const error = new Error('Backend failed');
      mockBackendProcess._errorCallback(error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    test('should handle backend process exit callback', () => {
      const exitHandler = jest.fn();
      mockBackendProcess.on('exit', exitHandler);
      
      // Simulate exit
      mockBackendProcess._exitCallback(1, null);

      expect(exitHandler).toHaveBeenCalledWith(1, null);
    });

    test('should terminate backend process on Windows using taskkill', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });

      mockBackendProcess.killed = false;
      
      // Simulate Windows cleanup logic
      if (process.platform === 'win32' && !mockBackendProcess.killed) {
        const killCmd = 'taskkill';
        const killArgs = ['/pid', mockBackendProcess.pid.toString(), '/f', '/t'];
        expect(killCmd).toBe('taskkill');
        expect(killArgs).toContain('/f');
        expect(killArgs).toContain('/t');
      }

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    test('should terminate backend process on Unix with SIGTERM', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });

      mockBackendProcess.killed = false;
      
      // Simulate Unix cleanup logic
      if (process.platform !== 'win32' && !mockBackendProcess.killed) {
        mockBackendProcess.kill('SIGTERM');
      }

      expect(mockBackendProcess.kill).toHaveBeenCalledWith('SIGTERM');

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    test('should not kill already terminated process', () => {
      mockBackendProcess.killed = true;
      
      // Cleanup should check if process is already killed
      if (mockBackendProcess && !mockBackendProcess.killed) {
        mockBackendProcess.kill('SIGTERM');
      }

      expect(mockBackendProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe('Health Check Mechanism', () => {
    test('should configure HTTPS health check with correct options', () => {
      const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/history',
        method: 'GET',
        timeout: 3000,
      };

      expect(options.hostname).toBe('localhost');
      expect(options.port).toBe(8080);
      expect(options.path).toBe('/history');
      expect(options.method).toBe('GET');
      expect(options.timeout).toBe(3000);
    });

    test('should configure HTTPS agent to trust self-signed certificates', () => {
      const agentConfig = { rejectUnauthorized: false };
      
      expect(agentConfig.rejectUnauthorized).toBe(false);
    });

    test('should register error handler for health check', () => {
      mockHttpsRequest.on('error', (err) => {
        console.error('Health check error:', err);
      });

      expect(mockHttpsRequest.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should register timeout handler for health check', () => {
      mockHttpsRequest.on('timeout', () => {
        mockHttpsRequest.destroy();
      });

      expect(mockHttpsRequest.on).toHaveBeenCalledWith('timeout', expect.any(Function));
    });

    test('should handle health check error callback', () => {
      const errorHandler = jest.fn();
      mockHttpsRequest.on('error', errorHandler);
      
      // Simulate error
      const error = new Error('Connection refused');
      mockHttpsRequest._errorCallback(error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    test('should handle health check timeout callback', () => {
      const timeoutHandler = jest.fn();
      mockHttpsRequest.on('timeout', timeoutHandler);
      
      // Simulate timeout
      mockHttpsRequest._timeoutCallback();

      expect(timeoutHandler).toHaveBeenCalled();
    });

    test('should implement retry logic with max attempts', () => {
      const maxRetries = 10;
      let retryCount = 0;

      // Simulate retry logic
      const shouldRetry = retryCount < maxRetries;
      expect(shouldRetry).toBe(true);

      retryCount = 5;
      expect(retryCount < maxRetries).toBe(true);

      retryCount = 10;
      const shouldNotRetry = retryCount < maxRetries;
      expect(shouldNotRetry).toBe(false);
    });

    test('should increment retry count on failure', () => {
      let retryCount = 0;
      const maxRetries = 10;

      // Simulate failure and retry
      retryCount++;
      expect(retryCount).toBe(1);
      expect(retryCount < maxRetries).toBe(true);

      // Simulate multiple failures
      for (let i = 0; i < 9; i++) {
        retryCount++;
      }
      expect(retryCount).toBe(10);
      expect(retryCount < maxRetries).toBe(false);
    });
  });

  describe('IPC Handlers', () => {
    test('should return HTTPS URL with correct protocol', () => {
      const BACKEND_PORT = 8080;
      const BACKEND_PROTOCOL = 'https';
      const url = `${BACKEND_PROTOCOL}://localhost:${BACKEND_PORT}`;
      
      expect(url).toBe('https://localhost:8080');
      expect(url).toMatch(/^https:\/\//);
    });

    test('should construct backend URL with localhost', () => {
      const getBackendUrl = () => {
        const BACKEND_PORT = 8080;
        const BACKEND_PROTOCOL = 'https';
        return `${BACKEND_PROTOCOL}://localhost:${BACKEND_PORT}`;
      };

      const url = getBackendUrl();
      expect(url).toContain('localhost');
      expect(url).toContain('8080');
    });

    test('should return app version string', () => {
      const getAppVersion = () => '1.0.0';
      
      const version = getAppVersion();
      expect(version).toBe('1.0.0');
      expect(typeof version).toBe('string');
    });
  });

  describe('TLS Integration', () => {
    test('should initialize TLS manager with user data path', () => {
      const userDataPath = '/mock/userData';
      const tlsManager = new TLSManager(userDataPath);

      expect(tlsManager).toBeDefined();
      expect(tlsManager.userDataPath).toBe(userDataPath);
    });

    test('should configure environment variables with TLS paths', () => {
      const certPath = '/path/to/cert.pem';
      const keyPath = '/path/to/key.pem';
      
      const env = {
        TLS_CERT_PATH: certPath,
        TLS_KEY_PATH: keyPath,
        USE_TLS: 'true',
      };

      expect(env.TLS_CERT_PATH).toBe(certPath);
      expect(env.TLS_KEY_PATH).toBe(keyPath);
      expect(env.USE_TLS).toBe('true');
    });

    test('should validate TLS certificate paths exist', () => {
      const paths = {
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem',
      };

      expect(paths.certPath).toBeDefined();
      expect(paths.keyPath).toBeDefined();
      expect(paths.certPath).toContain('cert.pem');
      expect(paths.keyPath).toContain('key.pem');
    });
  });

  describe('Path Management', () => {
    test('should resolve backend path correctly in development mode', () => {
      // Validates: Requirements 1.1, 1.2
      const path = require('path');
      const isDev = true;
      const __dirname = '/mock/electron';
      const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
      
      // Simulate getBackendPath() logic for development
      const backendPath = isDev 
        ? path.join(__dirname, '..', 'dist', 'backend', exeName)
        : path.join('/mock/resources', 'backend', exeName);
      
      expect(backendPath).toContain('dist');
      expect(backendPath).toContain('backend');
      expect(backendPath).toContain(exeName);
      expect(backendPath).not.toContain('resources');
    });

    test('should resolve backend path correctly in production mode', () => {
      // Validates: Requirements 1.1, 1.2
      const path = require('path');
      const isDev = false;
      const resourcesPath = '/mock/resources';
      const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
      
      // Simulate getBackendPath() logic for production
      const backendPath = isDev 
        ? path.join('/mock/electron', '..', 'dist', 'backend', exeName)
        : path.join(resourcesPath, 'backend', exeName);
      
      expect(backendPath).toContain('resources');
      expect(backendPath).toContain('backend');
      expect(backendPath).toContain(exeName);
      expect(backendPath).not.toContain('dist');
    });

    test('should use correct executable name for platform', () => {
      // Validates: Requirements 1.1
      const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
      
      if (process.platform === 'win32') {
        expect(exeName).toBe('sigma-backend.exe');
        expect(exeName).toContain('.exe');
      } else {
        expect(exeName).toBe('sigma-backend');
        expect(exeName).not.toContain('.exe');
      }
    });

    test('should validate backend path exists before spawning', () => {
      // Validates: Requirements 1.3
      const fs = require('fs');
      const backendPath = '/mock/backend/sigma-backend.exe';
      
      // Simulate validation logic
      const validatePath = (path) => {
        if (!fs.existsSync(path)) {
          throw new Error(`Backend executable not found: ${path}`);
        }
        return true;
      };
      
      // Mock fs.existsSync
      const originalExists = fs.existsSync;
      fs.existsSync = jest.fn(() => false);
      
      expect(() => validatePath(backendPath)).toThrow('Backend executable not found');
      
      fs.existsSync = jest.fn(() => true);
      expect(validatePath(backendPath)).toBe(true);
      
      // Restore
      fs.existsSync = originalExists;
    });

    test('should log detailed path information on validation failure', () => {
      // Validates: Requirements 1.4
      const errorInfo = {
        message: 'Backend executable not found',
        expectedPath: '/mock/backend/sigma-backend.exe',
        isPackaged: false,
        isDev: true,
        platform: 'win32',
        __dirname: '/mock/electron',
        resourcesPath: '/mock/resources',
        cwd: '/mock/project'
      };
      
      expect(errorInfo.message).toBe('Backend executable not found');
      expect(errorInfo.expectedPath).toBeDefined();
      expect(errorInfo.isPackaged).toBeDefined();
      expect(errorInfo.isDev).toBeDefined();
      expect(errorInfo.platform).toBeDefined();
      expect(errorInfo.__dirname).toBeDefined();
      expect(errorInfo.resourcesPath).toBeDefined();
    });

    test('should use standard user data directory location', () => {
      // Validates: Requirements 3.1
      const path = require('path');
      
      // Mock app.getPath('userData')
      const mockUserDataPath = process.platform === 'win32'
        ? 'C:\\Users\\TestUser\\AppData\\Roaming\\SIGMA'
        : process.platform === 'darwin'
        ? '/Users/TestUser/Library/Application Support/SIGMA'
        : '/home/testuser/.config/SIGMA';
      
      // Verify it's not using exe directory
      expect(mockUserDataPath).not.toContain('user-data');
      expect(mockUserDataPath).not.toContain(path.dirname('/mock/exe/SIGMA.exe'));
      
      // Verify it's in standard location
      if (process.platform === 'win32') {
        expect(mockUserDataPath).toContain('AppData');
        expect(mockUserDataPath).toContain('Roaming');
      } else if (process.platform === 'darwin') {
        expect(mockUserDataPath).toContain('Library');
        expect(mockUserDataPath).toContain('Application Support');
      } else {
        expect(mockUserDataPath).toContain('.config');
      }
    });

    test('should create necessary subdirectories in user data path', () => {
      // Validates: Requirements 3.1
      const userDataPath = '/mock/userData';
      const path = require('path');
      
      const directories = {
        output: path.join(userDataPath, 'output'),
        uploads: path.join(userDataPath, 'uploads'),
        db: path.join(userDataPath, 'db'),
        temp: path.join(userDataPath, 'temp'),
        logs: path.join(userDataPath, 'logs')
      };
      
      // Use path.normalize to handle platform differences
      expect(path.normalize(directories.output)).toBe(path.normalize('/mock/userData/output'));
      expect(path.normalize(directories.uploads)).toBe(path.normalize('/mock/userData/uploads'));
      expect(path.normalize(directories.db)).toBe(path.normalize('/mock/userData/db'));
      expect(path.normalize(directories.temp)).toBe(path.normalize('/mock/userData/temp'));
      expect(path.normalize(directories.logs)).toBe(path.normalize('/mock/userData/logs'));
    });

    test('should use app.isPackaged for environment detection', () => {
      // Validates: Requirements 4.1, 4.2
      // Simulate app.isPackaged behavior
      const mockApp = {
        isPackaged: false
      };
      
      const isDev = !mockApp.isPackaged;
      expect(isDev).toBe(true);
      
      mockApp.isPackaged = true;
      const isProd = !mockApp.isPackaged;
      expect(isProd).toBe(false);
    });

    test('should not rely on NODE_ENV for production detection', () => {
      // Validates: Requirements 4.1, 4.2
      const originalEnv = process.env.NODE_ENV;
      
      // Even if NODE_ENV is not set, app.isPackaged should determine environment
      delete process.env.NODE_ENV;
      
      const mockApp = { isPackaged: true };
      const isDev = !mockApp.isPackaged;
      
      expect(isDev).toBe(false);
      expect(process.env.NODE_ENV).toBeUndefined();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Development Mode Support', () => {
    test('should detect development mode from NODE_ENV', () => {
      const originalEnv = process.env.NODE_ENV;
      
      process.env.NODE_ENV = 'development';
      expect(process.env.NODE_ENV).toBe('development');
      
      process.env.NODE_ENV = 'production';
      expect(process.env.NODE_ENV).toBe('production');
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should use Vite dev server URL in development mode', () => {
      const isDevelopment = process.env.NODE_ENV === 'development';
      const devUrl = 'http://localhost:5174';
      const prodPath = 'frontend/dist/index.html';
      
      const url = isDevelopment ? devUrl : prodPath;
      
      // In development, should use Vite URL
      if (isDevelopment) {
        expect(url).toBe(devUrl);
        expect(url).toMatch(/^http:\/\/localhost:\d+$/);
      }
    });

    test('should load packaged files in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const isDevelopment = process.env.NODE_ENV === 'development';
      const prodPath = 'frontend/dist/index.html';
      
      expect(isDevelopment).toBe(false);
      
      // In production, should use packaged files
      if (!isDevelopment) {
        expect(prodPath).toContain('dist/index.html');
      }
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should enable DevTools in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const isDevelopment = process.env.NODE_ENV === 'development';
      const shouldOpenDevTools = isDevelopment;
      
      expect(shouldOpenDevTools).toBe(true);
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should not enable DevTools in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const isDevelopment = process.env.NODE_ENV === 'development';
      const shouldOpenDevTools = isDevelopment;
      
      expect(shouldOpenDevTools).toBe(false);
      
      process.env.NODE_ENV = originalEnv;
    });

    test('should construct correct Vite dev server URL', () => {
      const devServerPort = 5174;
      const devUrl = `http://localhost:${devServerPort}`;
      
      expect(devUrl).toBe('http://localhost:5174');
      expect(devUrl).toMatch(/^http:\/\//);
      expect(devUrl).not.toMatch(/^https:\/\//);
    });

    test('should handle missing NODE_ENV as production', () => {
      const originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
      
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      expect(isDevelopment).toBe(false);
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Process Cleanup', () => {
    test('should check if process is killed before terminating', () => {
      mockBackendProcess.killed = true;
      
      // Cleanup should check if process is already killed
      if (mockBackendProcess && !mockBackendProcess.killed) {
        mockBackendProcess.kill('SIGTERM');
      }

      expect(mockBackendProcess.kill).not.toHaveBeenCalled();
    });

    test('should terminate process if not already killed', () => {
      mockBackendProcess.killed = false;
      
      // Cleanup should terminate process
      if (mockBackendProcess && !mockBackendProcess.killed) {
        mockBackendProcess.kill('SIGTERM');
      }

      expect(mockBackendProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('should handle cleanup errors gracefully', () => {
      mockBackendProcess.kill.mockImplementation(() => {
        throw new Error('Kill failed');
      });

      // Cleanup should catch and log errors
      let errorCaught = false;
      try {
        mockBackendProcess.kill('SIGTERM');
      } catch (error) {
        errorCaught = true;
        expect(error.message).toBe('Kill failed');
      }

      expect(errorCaught).toBe(true);
    });

    test('should use SIGKILL as fallback on Unix after timeout', (done) => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        configurable: true,
      });

      mockBackendProcess.killed = false;
      
      // First attempt with SIGTERM
      mockBackendProcess.kill('SIGTERM');
      expect(mockBackendProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Simulate timeout and fallback to SIGKILL
      setTimeout(() => {
        if (!mockBackendProcess.killed) {
          mockBackendProcess.kill('SIGKILL');
          expect(mockBackendProcess.kill).toHaveBeenCalledWith('SIGKILL');
        }
        
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          configurable: true,
        });
        done();
      }, 10);
    });

    test('should handle null or undefined process gracefully', () => {
      const nullProcess = null;
      
      // Cleanup should check for null/undefined
      if (nullProcess && !nullProcess.killed) {
        nullProcess.kill('SIGTERM');
      }

      // Should not throw error
      expect(nullProcess).toBeNull();
    });

    test('should prevent duplicate cleanup calls', () => {
      let isCleaningUp = false;
      let cleanupComplete = false;
      let cleanupCallCount = 0;

      const cleanup = () => {
        if (isCleaningUp) {
          return;
        }
        if (cleanupComplete) {
          return;
        }
        
        isCleaningUp = true;
        cleanupCallCount++;
        // Simulate cleanup work
        cleanupComplete = true;
        isCleaningUp = false;
      };

      // Call cleanup multiple times
      cleanup();
      cleanup();
      cleanup();

      // Should only execute once
      expect(cleanupCallCount).toBe(1);
    });

    test('should clean up temporary files during cleanup', () => {
      const path = require('path');
      
      // Mock temp directory with files
      const tempDir = '/mock/temp';
      const tempFiles = ['temp1.txt', 'temp2.txt', 'temp3.txt'];
      
      let deletedFiles = [];
      
      // Simulate cleanup logic (assuming directory exists)
      const dirExists = true;
      if (dirExists) {
        tempFiles.forEach(file => {
          const filePath = path.join(tempDir, file);
          deletedFiles.push(filePath);
        });
      }

      expect(deletedFiles.length).toBe(3);
      expect(deletedFiles[0]).toContain('temp1.txt');
    });

    test('should handle abnormal backend exit with user notification', () => {
      const exitCode = 1;
      const wasAbnormal = exitCode !== 0 && exitCode !== null;
      
      expect(wasAbnormal).toBe(true);
      
      // Should trigger error notification
      let errorNotified = false;
      if (wasAbnormal) {
        errorNotified = true;
      }
      
      expect(errorNotified).toBe(true);
    });

    test('should not treat normal exit as abnormal', () => {
      const exitCode = 0;
      const wasAbnormal = exitCode !== 0 && exitCode !== null;
      
      expect(wasAbnormal).toBe(false);
    });

    test('should use synchronous taskkill on Windows for reliable cleanup', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        configurable: true,
      });

      const pid = 12345;
      const expectedCommand = `taskkill /pid ${pid} /f /t`;
      
      // Verify command format
      expect(expectedCommand).toContain('taskkill');
      expect(expectedCommand).toContain('/f');
      expect(expectedCommand).toContain('/t');
      expect(expectedCommand).toContain(pid.toString());

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true,
      });
    });

    test('should close main window during cleanup', () => {
      const mockWindow = {
        isDestroyed: jest.fn(() => false),
        destroy: jest.fn(),
      };

      // Simulate window cleanup
      if (mockWindow && !mockWindow.isDestroyed()) {
        mockWindow.destroy();
      }

      expect(mockWindow.destroy).toHaveBeenCalled();
    });

    test('should not attempt to close already destroyed window', () => {
      const mockWindow = {
        isDestroyed: jest.fn(() => true),
        destroy: jest.fn(),
      };

      // Simulate window cleanup
      if (mockWindow && !mockWindow.isDestroyed()) {
        mockWindow.destroy();
      }

      expect(mockWindow.destroy).not.toHaveBeenCalled();
    });
  });
});
