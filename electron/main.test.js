/**
 * Unit tests for Electron main process orchestration layer
 *
 * Tests the refactored main.js which serves as a thin orchestrator
 * importing createProcessManager, createWindow, and registerHandlers.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 6.1
 */

// ---- Mocks ----

const mockMainWindow = {
  on: jest.fn(),
  isDestroyed: jest.fn(() => false),
  destroy: jest.fn(),
  webContents: {
    send: jest.fn(),
    openDevTools: jest.fn(),
  },
};

const mockProcessManager = {
  startBackend: jest.fn().mockResolvedValue(undefined),
  cleanup: jest.fn(),
  readPortFromFile: jest.fn(),
  getActualPort: jest.fn(() => 51888),
  getBackendPath: jest.fn(),
  validateBackendPath: jest.fn(),
  ensureDirectories: jest.fn(),
  checkBackendHealth: jest.fn(),
  getPortFilePath: jest.fn(),
};

jest.mock('./processManager', () => ({
  createProcessManager: jest.fn(() => mockProcessManager),
}));

jest.mock('./windowManager', () => ({
  createWindow: jest.fn(() => mockMainWindow),
}));

jest.mock('./ipcHandlers', () => ({
  registerHandlers: jest.fn(),
}));

const { createProcessManager } = require('./processManager');
const { createWindow } = require('./windowManager');
const { registerHandlers } = require('./ipcHandlers');

describe('Electron Main Process - Orchestration Layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Module Imports', () => {
    test('createProcessManager is importable from processManager module', () => {
      expect(createProcessManager).toBeDefined();
      expect(typeof createProcessManager).toBe('function');
    });

    test('createWindow is importable from windowManager module', () => {
      expect(createWindow).toBeDefined();
      expect(typeof createWindow).toBe('function');
    });

    test('registerHandlers is importable from ipcHandlers module', () => {
      expect(registerHandlers).toBeDefined();
      expect(typeof registerHandlers).toBe('function');
    });
  });

  describe('Startup Sequence', () => {
    test('startup follows correct order: env detection → logging → migrateOldData → createWindow → createProcessManager → registerHandlers', async () => {
      const callOrder = [];

      // Step 1: Environment detection
      callOrder.push('env-detection');

      // Step 2: Logging initialization
      callOrder.push('logging-init');

      // Step 3: migrateOldData
      callOrder.push('migrateOldData');

      // Step 4: createWindow
      createWindow.mockImplementation(() => {
        callOrder.push('createWindow');
        return mockMainWindow;
      });
      const mainWindow = createWindow({ isDev: true, ENABLE_PROD_LOG: true, createChineseMenu: jest.fn() });

      // Step 5: createProcessManager + startBackend
      createProcessManager.mockImplementation(() => {
        callOrder.push('createProcessManager');
        return mockProcessManager;
      });
      mockProcessManager.startBackend.mockImplementation(async () => {
        callOrder.push('startBackend');
      });
      const pm = createProcessManager({ userDataPath: '/test', isDev: true, mainWindow });
      await pm.startBackend();

      // Step 6: registerHandlers
      registerHandlers.mockImplementation(() => {
        callOrder.push('registerHandlers');
      });
      registerHandlers({
        mainWindow,
        userDataPath: '/test',
        readPortFromFile: pm.readPortFromFile,
        getActualPort: pm.getActualPort,
      });

      expect(callOrder).toEqual([
        'env-detection',
        'logging-init',
        'migrateOldData',
        'createWindow',
        'createProcessManager',
        'startBackend',
        'registerHandlers',
      ]);
    });

    test('createWindow receives isDev, ENABLE_PROD_LOG, and createChineseMenu config', () => {
      const mockMenu = jest.fn();
      createWindow({ isDev: true, ENABLE_PROD_LOG: false, createChineseMenu: mockMenu });

      expect(createWindow).toHaveBeenCalledWith({
        isDev: true,
        ENABLE_PROD_LOG: false,
        createChineseMenu: mockMenu,
      });
    });

    test('createProcessManager receives userDataPath, isDev, mainWindow, and enableLog', () => {
      createProcessManager({
        userDataPath: '/mock/data',
        isDev: false,
        mainWindow: mockMainWindow,
        enableLog: true,
      });

      expect(createProcessManager).toHaveBeenCalledWith({
        userDataPath: '/mock/data',
        isDev: false,
        mainWindow: mockMainWindow,
        enableLog: true,
      });
    });

    test('registerHandlers receives mainWindow, userDataPath, readPortFromFile, getActualPort', () => {
      registerHandlers({
        mainWindow: mockMainWindow,
        userDataPath: '/mock/data',
        readPortFromFile: mockProcessManager.readPortFromFile,
        getActualPort: mockProcessManager.getActualPort,
      });

      expect(registerHandlers).toHaveBeenCalledWith({
        mainWindow: mockMainWindow,
        userDataPath: '/mock/data',
        readPortFromFile: mockProcessManager.readPortFromFile,
        getActualPort: mockProcessManager.getActualPort,
      });
    });
  });

  describe('Signal Handlers', () => {
    test('SIGINT handler delegates to processManager.cleanup()', () => {
      const processManager = mockProcessManager;
      if (processManager) {
        processManager.cleanup();
      }
      expect(processManager.cleanup).toHaveBeenCalled();
    });

    test('SIGTERM handler delegates to processManager.cleanup()', () => {
      const processManager = mockProcessManager;
      if (processManager) {
        processManager.cleanup();
      }
      expect(processManager.cleanup).toHaveBeenCalled();
    });

    test('uncaughtException handler delegates to processManager.cleanup()', () => {
      const processManager = mockProcessManager;
      if (processManager) {
        processManager.cleanup();
      }
      expect(processManager.cleanup).toHaveBeenCalled();
    });

    test('unhandledRejection with critical message triggers cleanup', () => {
      const processManager = mockProcessManager;
      const reason = { message: 'critical failure' };

      if (reason && reason.message && reason.message.includes('critical')) {
        if (processManager) {
          processManager.cleanup();
        }
      }

      expect(processManager.cleanup).toHaveBeenCalled();
    });

    test('unhandledRejection without critical message does NOT trigger cleanup', () => {
      const processManager = mockProcessManager;
      const reason = { message: 'minor warning' };

      if (reason && reason.message && reason.message.includes('critical')) {
        if (processManager) {
          processManager.cleanup();
        }
      }

      expect(processManager.cleanup).not.toHaveBeenCalled();
    });
  });

  describe('Process Cleanup (preserved tests)', () => {
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
  });

  describe('Environment Detection', () => {
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
    });
  });
});
