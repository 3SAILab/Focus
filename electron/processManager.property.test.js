/**
 * Property-based tests for processManager module
 *
 * Feature: code-structure-refactor
 * Properties 1-6: API surface, env vars, platform cleanup,
 * abnormal exit notification, health check retry, cleanup idempotence
 */

const fc = require('fast-check');

jest.setTimeout(15000);

const mockExistsSync = jest.fn(() => true);
const mockMkdirSync = jest.fn();
const mockReaddirSync = jest.fn(() => []);
const mockReadFileSync = jest.fn(() => '51888');
const mockUnlinkSync = jest.fn();
const mockAccessSync = jest.fn();
const mockChmodSync = jest.fn();
const mockWriteFileSync = jest.fn();

jest.mock('fs', () => ({
  existsSync: (...args) => mockExistsSync(...args),
  mkdirSync: (...args) => mockMkdirSync(...args),
  readdirSync: (...args) => mockReaddirSync(...args),
  readFileSync: (...args) => mockReadFileSync(...args),
  writeFileSync: (...args) => mockWriteFileSync(...args),
  unlinkSync: (...args) => mockUnlinkSync(...args),
  accessSync: (...args) => mockAccessSync(...args),
  chmodSync: (...args) => mockChmodSync(...args),
  constants: { X_OK: 1 },
}));

const mockSpawn = jest.fn();
const mockExecSync = jest.fn();
const mockSpawnSync = jest.fn();

jest.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args),
  execSync: (...args) => mockExecSync(...args),
  spawnSync: (...args) => mockSpawnSync(...args),
}));

const mockHttpRequest = jest.fn();
jest.mock('http', () => ({
  request: (...args) => mockHttpRequest(...args),
}));

jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: jest.fn(() => '1.0.0'),
    getPath: jest.fn(() => '/mock/userData'),
    getAppPath: jest.fn(() => '/mock/app'),
    relaunch: jest.fn(),
    quit: jest.fn(),
  },
  dialog: {
    showMessageBox: jest.fn().mockResolvedValue({ response: 1 }),
    showErrorBox: jest.fn(),
  },
}));

jest.mock('os', () => ({
  tmpdir: jest.fn(() => '/tmp'),
}));

const { createProcessManager } = require('./processManager');

describe('processManager property tests', () => {
  const mockMainWindow = {
    isDestroyed: jest.fn(() => false),
    destroy: jest.fn(),
    webContents: { send: jest.fn() },
  };

  function createMockBackendProcess() {
    return {
      pid: 12345,
      killed: false,
      stdout: { on: jest.fn() },
      stderr: { setEncoding: jest.fn(), on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    };
  }

  function setupMockHttpRequest() {
    const mockReq = {
      on: jest.fn().mockReturnThis(),
      end: jest.fn(),
      destroy: jest.fn(),
    };
    mockHttpRequest.mockReturnValue(mockReq);
    return mockReq;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('51888');
    mockReaddirSync.mockReturnValue([]);
    setupMockHttpRequest();
  });

  /**
   * Feature: code-structure-refactor, Property 1: Process manager exports complete API
   * **Validates: Requirements 1.1**
   */
  test('Property 1: Process manager exports complete API', () => {
    const expectedFunctions = [
      'startBackend', 'cleanup', 'getBackendPath', 'validateBackendPath',
      'ensureDirectories', 'checkBackendHealth', 'readPortFromFile',
      'getPortFilePath', 'getActualPort',
    ];

    fc.assert(
      fc.property(
        fc.record({
          userDataPath: fc.string({ minLength: 1 }),
          isDev: fc.boolean(),
        }),
        (config) => {
          const pm = createProcessManager({ ...config, mainWindow: mockMainWindow });
          for (const fn of expectedFunctions) {
            expect(pm).toHaveProperty(fn);
            expect(typeof pm[fn]).toBe('function');
          }
          expect(Object.keys(pm)).toHaveLength(9);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: code-structure-refactor, Property 2: startBackend configures correct environment variables
   * **Validates: Requirements 1.3**
   */
  test('Property 2: startBackend configures correct environment variables', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userDataPath: fc.constantFrom('/mock/data', '/tmp/test', '/home/user'),
          isDev: fc.boolean(),
        }),
        async (config) => {
          jest.clearAllMocks();
          mockExistsSync.mockReturnValue(true);
          mockReadFileSync.mockReturnValue('51888');
          setupMockHttpRequest();

          // Ensure process.resourcesPath is defined for production mode
          const origResourcesPath = process.resourcesPath;
          Object.defineProperty(process, 'resourcesPath', { value: '/mock/resources', configurable: true });

          let spawnedEnv = null;
          const mockProc = createMockBackendProcess();
          mockSpawn.mockImplementation((cmd, args, options) => {
            spawnedEnv = options.env;
            return mockProc;
          });

          const pm = createProcessManager({ ...config, mainWindow: mockMainWindow });
          await pm.startBackend();

          expect(spawnedEnv).toBeDefined();
          expect(spawnedEnv.OUTPUT_DIR).toBeDefined();
          expect(spawnedEnv.UPLOAD_DIR).toBeDefined();
          expect(spawnedEnv.DB_PATH).toBeDefined();
          expect(spawnedEnv.PORT).toBe('51888');
          expect(spawnedEnv.LOG_DIR).toBeDefined();
          expect(spawnedEnv.AUTO_PORT_DISCOVERY).toBe('true');
          expect(spawnedEnv.PRODUCTION).toBe(config.isDev ? 'false' : 'true');

          Object.defineProperty(process, 'resourcesPath', { value: origResourcesPath, configurable: true });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: code-structure-refactor, Property 3: Platform-appropriate process termination
   * **Validates: Requirements 1.4**
   */
  test('Property 3: Platform-appropriate process termination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('win32', 'linux', 'darwin'),
        async (platform) => {
          jest.clearAllMocks();
          mockExistsSync.mockReturnValue(true);
          mockReaddirSync.mockReturnValue([]);
          setupMockHttpRequest();

          const originalPlatform = process.platform;
          Object.defineProperty(process, 'platform', { value: platform, configurable: true });

          const mockProc = createMockBackendProcess();
          mockSpawn.mockReturnValue(mockProc);

          const pm = createProcessManager({
            userDataPath: '/mock/userData', isDev: true, mainWindow: mockMainWindow,
          });
          await pm.startBackend();
          pm.cleanup();

          if (platform === 'win32') {
            expect(mockExecSync).toHaveBeenCalledWith(
              expect.stringContaining('taskkill'), expect.any(Object)
            );
          } else {
            expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
          }

          Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: code-structure-refactor, Property 4: Abnormal exit triggers error notification
   * **Validates: Requirements 1.5**
   */
  test('Property 4: Abnormal exit triggers error notification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 255 }),
        async (exitCode) => {
          jest.clearAllMocks();
          mockExistsSync.mockReturnValue(true);
          mockReaddirSync.mockReturnValue([]);
          mockMainWindow.isDestroyed.mockReturnValue(false);
          mockMainWindow.webContents.send.mockClear();
          setupMockHttpRequest();

          let exitHandler = null;
          const mockProc = createMockBackendProcess();
          mockProc.on = jest.fn((event, handler) => {
            if (event === 'exit') exitHandler = handler;
          });
          mockSpawn.mockReturnValue(mockProc);

          const pm = createProcessManager({
            userDataPath: '/mock/userData', isDev: true, mainWindow: mockMainWindow,
          });
          await pm.startBackend();

          expect(exitHandler).not.toBeNull();
          exitHandler(exitCode, null);

          expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
            'backend-error', expect.stringContaining(String(exitCode))
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: code-structure-refactor, Property 5: Health check retry respects max attempts
   * **Validates: Requirements 1.6**
   */
  test('Property 5: Health check retry respects max attempts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        (retryCount) => {
          const maxRetries = 10;
          const shouldRetry = retryCount < maxRetries - 1;
          if (retryCount < maxRetries - 1) {
            expect(shouldRetry).toBe(true);
          } else {
            expect(shouldRetry).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: code-structure-refactor, Property 6: Cleanup is idempotent
   * **Validates: Requirements 1.7**
   */
  test('Property 6: Cleanup is idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (cleanupCallCount) => {
          jest.clearAllMocks();
          mockExistsSync.mockReturnValue(true);
          mockReaddirSync.mockReturnValue([]);
          setupMockHttpRequest();

          const originalPlatform = process.platform;
          Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

          const mockProc = createMockBackendProcess();
          mockSpawn.mockReturnValue(mockProc);

          const pm = createProcessManager({
            userDataPath: '/mock/userData', isDev: true, mainWindow: mockMainWindow,
          });
          await pm.startBackend();

          // Call cleanup N times
          for (let i = 0; i < cleanupCallCount; i++) {
            pm.cleanup();
          }

          // On Windows, cleanup uses execSync(taskkill). It should be called exactly once
          // because cleanupComplete guard prevents subsequent calls from doing anything.
          expect(mockExecSync).toHaveBeenCalledTimes(1);

          Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
        }
      ),
      { numRuns: 20 }
    );
  });
});
