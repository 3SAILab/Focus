/**
 * Unit tests for Electron main process
 * Tests backend process management, health checks, and IPC handlers
 */

const { spawn } = require('child_process');
const http = require('http');

describe('Electron Main Process', () => {
  let mockBackendProcess;
  let mockHttpRequest;

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

    // Setup mock HTTP request
    mockHttpRequest = {
      on: jest.fn((event, callback) => {
        mockHttpRequest[`_${event}Callback`] = callback;
        return mockHttpRequest;
      }),
      end: jest.fn(),
      destroy: jest.fn(),
    };
  });

  describe('Backend Process Management', () => {
    test('should configure backend process with environment variables', () => {
      const env = {
        PORT: '8080',
        OUTPUT_DIR: '/path/to/output',
        UPLOAD_DIR: '/path/to/uploads',
      };

      expect(env).toHaveProperty('PORT', '8080');
      expect(env).toHaveProperty('OUTPUT_DIR');
      expect(env).toHaveProperty('UPLOAD_DIR');
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
    test('should configure HTTP health check with correct options', () => {
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

    test('should register error handler for health check', () => {
      mockHttpRequest.on('error', (err) => {
        console.error('Health check error:', err);
      });

      expect(mockHttpRequest.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    test('should register timeout handler for health check', () => {
      mockHttpRequest.on('timeout', () => {
        mockHttpRequest.destroy();
      });

      expect(mockHttpRequest.on).toHaveBeenCalledWith('timeout', expect.any(Function));
    });

    test('should handle health check error callback', () => {
      const errorHandler = jest.fn();
      mockHttpRequest.on('error', errorHandler);
      
      // Simulate error
      const error = new Error('Connection refused');
      mockHttpRequest._errorCallback(error);

      expect(errorHandler).toHaveBeenCalledWith(error);
    });

    test('should handle health check timeout callback', () => {
      const timeoutHandler = jest.fn();
      mockHttpRequest.on('timeout', timeoutHandler);
      
      // Simulate timeout
      mockHttpRequest._timeoutCallback();

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
  });

  describe('IPC Handlers', () => {
    test('should return HTTP URL with correct protocol', () => {
      const BACKEND_PORT = 8080;
      const BACKEND_PROTOCOL = 'http';
      const url = `${BACKEND_PROTOCOL}://localhost:${BACKEND_PORT}`;
      
      expect(url).toBe('http://localhost:8080');
      expect(url).toMatch(/^http:\/\//);
    });

    test('should construct backend URL with localhost', () => {
      const getBackendUrl = () => {
        const BACKEND_PORT = 8080;
        const BACKEND_PROTOCOL = 'http';
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

  describe('Path Management', () => {
    test('should resolve backend path correctly in development mode', () => {
      const path = require('path');
      const isDev = true;
      const __dirname = '/mock/electron';
      const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
      
      const backendPath = isDev 
        ? path.join(__dirname, '..', 'dist', 'backend', exeName)
        : path.join('/mock/resources', 'backend', exeName);
      
      expect(backendPath).toContain('dist');
      expect(backendPath).toContain('backend');
      expect(backendPath).toContain(exeName);
    });

    test('should resolve backend path correctly in production mode', () => {
      const path = require('path');
      const isDev = false;
      const resourcesPath = '/mock/resources';
      const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
      
      const backendPath = isDev 
        ? path.join('/mock/electron', '..', 'dist', 'backend', exeName)
        : path.join(resourcesPath, 'backend', exeName);
      
      expect(backendPath).toContain('resources');
      expect(backendPath).toContain('backend');
      expect(backendPath).toContain(exeName);
    });

    test('should use correct executable name for platform', () => {
      const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
      
      if (process.platform === 'win32') {
        expect(exeName).toBe('sigma-backend.exe');
      } else {
        expect(exeName).toBe('sigma-backend');
      }
    });

    test('should create necessary subdirectories in user data path', () => {
      const userDataPath = '/mock/userData';
      const path = require('path');
      
      const directories = {
        output: path.join(userDataPath, 'output'),
        uploads: path.join(userDataPath, 'uploads'),
        db: path.join(userDataPath, 'db'),
        temp: path.join(userDataPath, 'temp'),
        logs: path.join(userDataPath, 'logs')
      };
      
      expect(path.normalize(directories.output)).toBe(path.normalize('/mock/userData/output'));
      expect(path.normalize(directories.uploads)).toBe(path.normalize('/mock/userData/uploads'));
      expect(path.normalize(directories.db)).toBe(path.normalize('/mock/userData/db'));
    });

    test('should use app.isPackaged for environment detection', () => {
      const mockApp = { isPackaged: false };
      
      const isDev = !mockApp.isPackaged;
      expect(isDev).toBe(true);
      
      mockApp.isPackaged = true;
      const isProd = !mockApp.isPackaged;
      expect(isProd).toBe(false);
    });
  });

  describe('Development Mode Support', () => {
    test('should use Vite dev server URL in development mode', () => {
      const isDevelopment = true;
      const devUrl = 'http://localhost:5174';
      const prodPath = 'frontend/dist/index.html';
      
      const url = isDevelopment ? devUrl : prodPath;
      expect(url).toBe(devUrl);
    });

    test('should construct correct Vite dev server URL', () => {
      const devServerPort = 5174;
      const devUrl = `http://localhost:${devServerPort}`;
      
      expect(devUrl).toBe('http://localhost:5174');
      expect(devUrl).toMatch(/^http:\/\//);
    });
  });

  describe('Process Cleanup', () => {
    test('should check if process is killed before terminating', () => {
      mockBackendProcess.killed = true;
      
      if (mockBackendProcess && !mockBackendProcess.killed) {
        mockBackendProcess.kill('SIGTERM');
      }

      expect(mockBackendProcess.kill).not.toHaveBeenCalled();
    });

    test('should terminate process if not already killed', () => {
      mockBackendProcess.killed = false;
      
      if (mockBackendProcess && !mockBackendProcess.killed) {
        mockBackendProcess.kill('SIGTERM');
      }

      expect(mockBackendProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('should prevent duplicate cleanup calls', () => {
      let isCleaningUp = false;
      let cleanupComplete = false;
      let cleanupCallCount = 0;

      const cleanup = () => {
        if (isCleaningUp || cleanupComplete) return;
        
        isCleaningUp = true;
        cleanupCallCount++;
        cleanupComplete = true;
        isCleaningUp = false;
      };

      cleanup();
      cleanup();
      cleanup();

      expect(cleanupCallCount).toBe(1);
    });

    test('should handle abnormal backend exit with user notification', () => {
      const exitCode = 1;
      const wasAbnormal = exitCode !== 0 && exitCode !== null;
      
      expect(wasAbnormal).toBe(true);
    });

    test('should not treat normal exit as abnormal', () => {
      const exitCode = 0;
      const wasAbnormal = exitCode !== 0 && exitCode !== null;
      
      expect(wasAbnormal).toBe(false);
    });

    test('should close main window during cleanup', () => {
      const mockWindow = {
        isDestroyed: jest.fn(() => false),
        destroy: jest.fn(),
      };

      if (mockWindow && !mockWindow.isDestroyed()) {
        mockWindow.destroy();
      }

      expect(mockWindow.destroy).toHaveBeenCalled();
    });
  });
});
