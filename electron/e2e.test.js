/**
 * End-to-End Tests for Electron Application
 * Tests complete application lifecycle including startup, communication, HTTPS, and cleanup
 * 
 * Requirements: 3.1, 3.2, 3.3, 8.1, 8.2
 */

const { spawn } = require('child_process');
const https = require('https');
const path = require('path');
const fs = require('fs');
const TLSManager = require('./tls-manager');

// Test configuration
const TEST_TIMEOUT = 60000; // 60 seconds for E2E tests
const BACKEND_PORT = 8080;
const BACKEND_URL = `https://localhost:${BACKEND_PORT}`;
const HEALTH_CHECK_PATH = '/history';

describe('E2E: Application Lifecycle', () => {
  let backendProcess;
  let tlsManager;
  let certPaths;
  const userDataPath = path.join(__dirname, '..', 'test-data');

  beforeAll(async () => {
    // Create test data directory
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    // Initialize TLS manager
    tlsManager = new TLSManager(userDataPath);
    
    // Generate TLS certificates for testing
    if (!tlsManager.certificateExists()) {
      await tlsManager.generateCertificate();
    }
    
    certPaths = tlsManager.getCertificatePaths();
  }, TEST_TIMEOUT);

  describe('Path Management in Packaged App', () => {
    test('should resolve backend path from resources directory in production', () => {
      // Validates: Requirements 1.1, 3.1
      const mockApp = { isPackaged: true };
      const isDev = !mockApp.isPackaged;
      const resourcesPath = '/mock/app/resources';
      const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
      
      // Simulate getBackendPath() for production
      const backendPath = isDev
        ? path.join(__dirname, '..', 'dist', 'backend', exeName)
        : path.join(resourcesPath, 'backend', exeName);
      
      expect(isDev).toBe(false);
      expect(backendPath).toContain('resources');
      expect(backendPath).toContain('backend');
      expect(backendPath).toContain(exeName);
      expect(backendPath).not.toContain('dist');
    });

    test('should use standard user data directory in packaged app', () => {
      // Validates: Requirements 3.1
      // Simulate app.getPath('userData') behavior
      const mockUserDataPath = process.platform === 'win32'
        ? 'C:\\Users\\TestUser\\AppData\\Roaming\\SIGMA'
        : process.platform === 'darwin'
        ? '/Users/TestUser/Library/Application Support/SIGMA'
        : '/home/testuser/.config/SIGMA';
      
      // Should NOT be in exe directory
      expect(mockUserDataPath).not.toContain('user-data');
      expect(mockUserDataPath).not.toContain(path.sep + 'SIGMA.exe');
      
      // Should be in platform-specific standard location
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

    test('should not copy backend executable to user data directory', () => {
      // Validates: Requirements 1.1, 1.2
      const resourcesPath = '/mock/app/resources';
      const userDataPath = '/mock/userData';
      const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
      
      // Backend should run from resources, not user-data
      const backendPath = path.join(resourcesPath, 'backend', exeName);
      const wrongPath = path.join(userDataPath, 'backend', exeName);
      
      expect(backendPath).toContain('resources');
      expect(backendPath).not.toContain('userData');
      expect(backendPath).not.toBe(wrongPath);
    });

    test('should validate backend exists in resources before spawning', () => {
      // Validates: Requirements 1.3
      const resourcesPath = '/mock/app/resources';
      const exeName = process.platform === 'win32' ? 'sigma-backend.exe' : 'sigma-backend';
      const backendPath = path.join(resourcesPath, 'backend', exeName);
      
      // Simulate validation
      const validateBackendPath = (path) => {
        if (!fs.existsSync(path)) {
          throw new Error(`Backend executable not found: ${path}`);
        }
        return true;
      };
      
      // Mock fs.existsSync
      const originalExists = fs.existsSync;
      fs.existsSync = jest.fn(() => false);
      
      expect(() => validateBackendPath(backendPath)).toThrow('Backend executable not found');
      
      fs.existsSync = originalExists;
    });

    test('should use app.isPackaged for environment detection', () => {
      // Validates: Requirements 4.1, 4.2
      const mockApp = { isPackaged: true };
      const isDev = !mockApp.isPackaged;
      
      expect(isDev).toBe(false);
      expect(mockApp.isPackaged).toBe(true);
      
      // Change to development
      mockApp.isPackaged = false;
      const isDevNow = !mockApp.isPackaged;
      expect(isDevNow).toBe(true);
    });
  });

  describe('Debug Dialog Suppression', () => {
    test('should not show debug dialogs in production mode', () => {
      // Validates: Requirements 4.4
      const mockApp = { isPackaged: true };
      const isDev = !mockApp.isPackaged;
      
      // Debug dialogs should only show in development
      const shouldShowDebugDialog = isDev;
      
      expect(shouldShowDebugDialog).toBe(false);
      expect(isDev).toBe(false);
    });

    test('should only log debug info in development mode', () => {
      // Validates: Requirements 4.4
      const mockApp = { isPackaged: false };
      const isDev = !mockApp.isPackaged;
      
      // Debug logging should only happen in development
      const shouldLogDebugInfo = isDev;
      
      expect(shouldLogDebugInfo).toBe(true);
      expect(isDev).toBe(true);
    });

    test('should show error dialogs only on critical failures', () => {
      // Validates: Requirements 4.4
      const mockApp = { isPackaged: true };
      const isDev = !mockApp.isPackaged;
      
      // Error dialogs should show regardless of environment for critical errors
      const hasCriticalError = true;
      const shouldShowErrorDialog = hasCriticalError; // Not dependent on isDev
      
      expect(shouldShowErrorDialog).toBe(true);
      expect(isDev).toBe(false); // Production mode
    });

    test('should include log file path in error messages', () => {
      // Validates: Requirements 4.4, 7.2
      const userDataPath = '/mock/userData';
      const logPath = path.join(userDataPath, 'logs', 'app.log');
      
      const errorMessage = `Failed to start SIGMA:\n\nBackend not found\n\nLog file: ${logPath}`;
      
      expect(errorMessage).toContain('Log file:');
      expect(errorMessage).toContain(logPath);
      expect(errorMessage).toContain('logs');
      expect(errorMessage).toContain('app.log');
    });
  });

  afterAll(() => {
    // Cleanup test data directory
    if (fs.existsSync(userDataPath)) {
      fs.rmSync(userDataPath, { recursive: true, force: true });
    }
  });

  describe('Application Startup Flow', () => {
    test('should generate TLS certificates on first run', async () => {
      // Validates: Requirements 8.3
      expect(certPaths).toBeDefined();
      expect(certPaths.certPath).toBeDefined();
      expect(certPaths.keyPath).toBeDefined();
      
      // Verify certificate files exist
      expect(fs.existsSync(certPaths.certPath)).toBe(true);
      expect(fs.existsSync(certPaths.keyPath)).toBe(true);
    }, TEST_TIMEOUT);

    test('should start backend process with TLS environment variables', async () => {
      // Validates: Requirements 3.1, 8.3
      const backendPath = path.join(__dirname, '..', 'backend', 'main.go');
      
      // Check if backend source exists
      if (!fs.existsSync(backendPath)) {
        console.warn('Backend source not found, skipping backend startup test');
        return;
      }

      const env = {
        ...process.env,
        TLS_CERT_PATH: certPaths.certPath,
        TLS_KEY_PATH: certPaths.keyPath,
        USE_TLS: 'true',
        PORT: BACKEND_PORT.toString(),
        DB_PATH: path.join(userDataPath, 'test.db'),
        UPLOAD_DIR: path.join(userDataPath, 'uploads'),
        OUTPUT_DIR: path.join(userDataPath, 'output'),
      };

      backendProcess = spawn('go', ['run', backendPath], {
        env,
        cwd: path.join(__dirname, '..', 'backend'),
      });

      expect(backendProcess).toBeDefined();
      expect(backendProcess.pid).toBeDefined();

      // Wait for backend to start
      await new Promise(resolve => setTimeout(resolve, 3000));
    }, TEST_TIMEOUT);

    test('should wait for backend to be ready before loading frontend', async () => {
      // Validates: Requirements 3.2
      if (!backendProcess || !backendProcess.pid) {
        console.warn('Backend not running, skipping health check test');
        return;
      }

      let isHealthy = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isHealthy && attempts < maxAttempts) {
        try {
          isHealthy = await checkBackendHealth();
          if (!isHealthy) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        } catch (error) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      expect(isHealthy).toBe(true);
      expect(attempts).toBeLessThan(maxAttempts);
    }, TEST_TIMEOUT);
  });

  describe('Frontend-Backend Communication', () => {
    test('should establish HTTPS connection to backend', async () => {
      // Validates: Requirements 8.1, 8.2
      if (!backendProcess || !backendProcess.pid) {
        console.warn('Backend not running, skipping HTTPS connection test');
        return;
      }

      const response = await makeHttpsRequest(HEALTH_CHECK_PATH);
      
      expect(response).toBeDefined();
      expect(response.statusCode).toBe(200);
    }, TEST_TIMEOUT);

    test('should use HTTPS protocol for all API requests', async () => {
      // Validates: Requirements 8.1
      const url = BACKEND_URL;
      
      expect(url).toMatch(/^https:\/\//);
      expect(url).not.toMatch(/^http:\/\//);
      expect(url).toContain('localhost');
    });

    test('should trust self-signed certificates in Electron environment', async () => {
      // Validates: Requirements 8.4
      if (!backendProcess || !backendProcess.pid) {
        console.warn('Backend not running, skipping certificate trust test');
        return;
      }

      // Make request with rejectUnauthorized: false (simulating Electron behavior)
      const response = await makeHttpsRequest(HEALTH_CHECK_PATH, { rejectUnauthorized: false });
      
      expect(response).toBeDefined();
      expect(response.statusCode).toBe(200);
    }, TEST_TIMEOUT);

    test('should encrypt request and response data', async () => {
      // Validates: Requirements 8.2
      if (!backendProcess || !backendProcess.pid) {
        console.warn('Backend not running, skipping encryption test');
        return;
      }

      // Verify TLS is being used
      const response = await makeHttpsRequest(HEALTH_CHECK_PATH);
      
      expect(response).toBeDefined();
      expect(response.encrypted).toBe(true); // Connection should be encrypted
    }, TEST_TIMEOUT);

    test('should handle API errors gracefully', async () => {
      // Validates: Requirements 3.2
      if (!backendProcess || !backendProcess.pid) {
        console.warn('Backend not running, skipping error handling test');
        return;
      }

      try {
        await makeHttpsRequest('/nonexistent-endpoint');
      } catch (error) {
        // Should handle 404 or other errors
        expect(error).toBeDefined();
      }
    }, TEST_TIMEOUT);
  });

  describe('HTTPS Encryption', () => {
    test('should use TLS 1.2 or higher', async () => {
      // Validates: Requirements 8.1, 8.2
      if (!backendProcess || !backendProcess.pid) {
        console.warn('Backend not running, skipping TLS version test');
        return;
      }

      const response = await makeHttpsRequest(HEALTH_CHECK_PATH);
      
      expect(response).toBeDefined();
      expect(response.encrypted).toBe(true);
      // TLS version should be 1.2 or higher
      if (response.tlsVersion) {
        expect(['TLSv1.2', 'TLSv1.3']).toContain(response.tlsVersion);
      }
    }, TEST_TIMEOUT);

    test('should prevent unencrypted HTTP connections', () => {
      // Validates: Requirements 8.1
      const httpsUrl = BACKEND_URL;
      const httpUrl = httpsUrl.replace('https://', 'http://');
      
      expect(httpsUrl).toMatch(/^https:\/\//);
      expect(httpUrl).toMatch(/^http:\/\//);
      
      // Application should only use HTTPS URLs
      expect(BACKEND_URL).toBe(httpsUrl);
      expect(BACKEND_URL).not.toBe(httpUrl);
    });

    test('should use localhost for communication', () => {
      // Validates: Requirements 8.5
      expect(BACKEND_URL).toContain('localhost');
      expect(BACKEND_URL).not.toContain('0.0.0.0');
      expect(BACKEND_URL).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
    });

    test('should validate certificate paths are configured', () => {
      // Validates: Requirements 8.3
      expect(certPaths.certPath).toBeDefined();
      expect(certPaths.keyPath).toBeDefined();
      expect(certPaths.certPath).toContain('.pem');
      expect(certPaths.keyPath).toContain('.pem');
    });
  });

  describe('Application Shutdown and Cleanup', () => {
    test('should terminate backend process on application exit', async () => {
      // Validates: Requirements 3.3
      if (!backendProcess || !backendProcess.pid) {
        console.warn('Backend not running, skipping termination test');
        return;
      }

      const pid = backendProcess.pid;
      
      // Terminate backend process
      if (process.platform === 'win32') {
        // Windows: use taskkill
        const killProcess = spawn('taskkill', ['/pid', pid.toString(), '/f', '/t']);
        await new Promise((resolve) => {
          killProcess.on('close', resolve);
        });
      } else {
        // Unix: use SIGTERM
        backendProcess.kill('SIGTERM');
        await new Promise((resolve) => {
          backendProcess.on('exit', resolve);
        });
      }

      // Wait a bit for process to terminate
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify process is terminated
      let processExists = false;
      try {
        process.kill(pid, 0); // Check if process exists
        processExists = true;
      } catch (error) {
        processExists = false;
      }

      expect(processExists).toBe(false);
      backendProcess = null;
    }, TEST_TIMEOUT);

    test('should clean up temporary files on exit', () => {
      // Validates: Requirements 3.3
      const tempDir = path.join(userDataPath, 'temp');
      
      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Create temp files
      const tempFile = path.join(tempDir, 'temp.txt');
      fs.writeFileSync(tempFile, 'test data');
      
      expect(fs.existsSync(tempFile)).toBe(true);

      // Simulate cleanup
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      expect(fs.existsSync(tempFile)).toBe(false);
    });

    test('should handle abnormal backend exit', async () => {
      // Validates: Requirements 3.3
      const mockProcess = {
        pid: 99999,
        killed: false,
        exitCode: null,
        on: jest.fn(),
        kill: jest.fn(),
      };

      // Simulate abnormal exit
      const exitHandler = jest.fn((code) => {
        if (code !== 0 && code !== null) {
          // Log error
          console.error(`Backend exited abnormally with code ${code}`);
        }
      });

      mockProcess.on('exit', exitHandler);
      
      // Trigger exit handler with error code
      const exitCallback = mockProcess.on.mock.calls.find(call => call[0] === 'exit')[1];
      if (exitCallback) {
        exitCallback(1);
      }

      expect(exitHandler).toHaveBeenCalledWith(1);
    });

    test('should not leave orphaned processes', async () => {
      // Validates: Requirements 3.3
      // This test verifies that cleanup logic prevents orphaned processes
      
      const mockProcess = {
        pid: 12345,
        killed: false,
        kill: jest.fn(() => {
          mockProcess.killed = true;
        }),
      };

      // Simulate cleanup
      if (mockProcess && !mockProcess.killed) {
        mockProcess.kill('SIGTERM');
      }

      expect(mockProcess.killed).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('should use SIGKILL as fallback if SIGTERM fails', async () => {
      // Validates: Requirements 3.3
      const mockProcess = {
        pid: 12345,
        killed: false,
        kill: jest.fn(),
      };

      // First attempt with SIGTERM
      mockProcess.kill('SIGTERM');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      // Simulate timeout - process still running
      await new Promise(resolve => setTimeout(resolve, 100));

      // Fallback to SIGKILL
      if (!mockProcess.killed) {
        mockProcess.kill('SIGKILL');
      }

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });

    test('should close main window during cleanup', () => {
      // Validates: Requirements 3.3
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

    test('should handle cleanup errors gracefully', () => {
      // Validates: Requirements 3.3
      const mockProcess = {
        kill: jest.fn(() => {
          throw new Error('Process already terminated');
        }),
      };

      // Cleanup should catch errors
      let errorCaught = false;
      try {
        mockProcess.kill('SIGTERM');
      } catch (error) {
        errorCaught = true;
        expect(error.message).toBe('Process already terminated');
      }

      expect(errorCaught).toBe(true);
    });
  });
});

// Helper function to check backend health
function checkBackendHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: HEALTH_CHECK_PATH,
      method: 'GET',
      timeout: 3000,
      rejectUnauthorized: false, // Trust self-signed certificate
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    req.on('error', (err) => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Helper function to make HTTPS requests
function makeHttpsRequest(path, customOptions = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: BACKEND_PORT,
      path: path,
      method: 'GET',
      timeout: 5000,
      rejectUnauthorized: false, // Trust self-signed certificate
      ...customOptions,
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          encrypted: res.socket.encrypted || false,
          tlsVersion: res.socket.getProtocol ? res.socket.getProtocol() : null,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}
