/**
 * Unit tests for processManager module
 *
 * Tests the createProcessManager factory function, API surface,
 * environment variable configuration, platform-specific cleanup,
 * and cleanup idempotence.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.7
 */

// ---- Mocks ----

const mockExistsSync = jest.fn(() => true);
const mockMkdirSync = jest.fn();
const mockReaddirSync = jest.fn(() => []);
const mockReadFileSync = jest.fn(() => '51888');
const mockWriteFileSync = jest.fn();
const mockUnlinkSync = jest.fn();
const mockAccessSync = jest.fn();
const mockChmodSync = jest.fn();

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

jest.mock('child_process', () => ({
  spawn: (...args) => mockSpawn(...args),
  execSync: (...args) => mockExecSync(...args),
  spawnSync: jest.fn(),
}));

jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: jest.fn(() => '1.0.0'),
    getPath: jest.fn(() => '/mock/userData'),
    getAppPath: jest.fn(() => '/mock/app'),
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

describe('processManager', () => {
  let pm;
  const mockMainWindow = {
    isDestroyed: jest.fn(() => false),
    destroy: jest.fn(),
    webContents: { send: jest.fn() },
  };

  const defaultConfig = {
    userDataPath: '/mock/userData',
    isDev: true,
    mainWindow: mockMainWindow,
    enableLog: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('51888');
    mockReaddirSync.mockReturnValue([]);
    pm = createProcessManager(defaultConfig);
  });

  describe('API Surface', () => {
    test('createProcessManager returns an object with all expected API functions', () => {
      const expectedFunctions = [
        'startBackend',
        'cleanup',
        'getBackendPath',
        'validateBackendPath',
        'ensureDirectories',
        'checkBackendHealth',
        'readPortFromFile',
        'getPortFilePath',
        'getActualPort',
      ];

      for (const fn of expectedFunctions) {
        expect(pm).toHaveProperty(fn);
        expect(typeof pm[fn]).toBe('function');
      }
    });

    test('createProcessManager returns exactly 9 API functions', () => {
      const keys = Object.keys(pm);
      expect(keys).toHaveLength(9);
    });
  });

  describe('getBackendPath', () => {
    test('returns dev path containing dist/backend in development mode', () => {
      const devPm = createProcessManager({ ...defaultConfig, isDev: true });
      const backendPath = devPm.getBackendPath();

      expect(backendPath).toContain('dist');
      expect(backendPath).toContain('backend');
    });

    test('returns correct executable name for win32', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const winPm = createProcessManager(defaultConfig);
      const backendPath = winPm.getBackendPath();
      expect(backendPath).toContain('sigma-backend.exe');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    test('returns correct executable name for unix', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const linuxPm = createProcessManager(defaultConfig);
      const backendPath = linuxPm.getBackendPath();
      expect(backendPath).toMatch(/sigma-backend$/);

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('ensureDirectories', () => {
    test('creates output, uploads, db, temp, and logs directories', () => {
      mockExistsSync.mockReturnValue(false);
      const dirs = pm.ensureDirectories('/mock/userData');

      expect(dirs).toHaveProperty('output');
      expect(dirs).toHaveProperty('uploads');
      expect(dirs).toHaveProperty('db');
      expect(dirs).toHaveProperty('temp');
      expect(dirs).toHaveProperty('logs');
    });

    test('calls mkdirSync for each missing directory', () => {
      mockExistsSync.mockReturnValue(false);
      pm.ensureDirectories('/mock/userData');

      // 5 directories should be created
      expect(mockMkdirSync).toHaveBeenCalledTimes(5);
    });

    test('does not create directories that already exist', () => {
      mockExistsSync.mockReturnValue(true);
      pm.ensureDirectories('/mock/userData');

      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('readPortFromFile', () => {
    test('returns port number when port file exists with valid content', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('8080');

      const port = pm.readPortFromFile();
      expect(port).toBe(8080);
    });

    test('returns null when port file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const port = pm.readPortFromFile();
      expect(port).toBeNull();
    });

    test('returns null when port file contains invalid content', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not-a-number');

      const port = pm.readPortFromFile();
      expect(port).toBeNull();
    });

    test('returns null when port is out of range (0)', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('0');

      const port = pm.readPortFromFile();
      expect(port).toBeNull();
    });

    test('returns null when port is out of range (70000)', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('70000');

      const port = pm.readPortFromFile();
      expect(port).toBeNull();
    });
  });

  describe('getPortFilePath', () => {
    test('returns path in temp directory with sigma-backend.port filename', () => {
      const portPath = pm.getPortFilePath();
      expect(portPath).toContain('sigma-backend.port');
      expect(portPath).toContain('/tmp');
    });
  });

  describe('getActualPort', () => {
    test('returns default port (51888) initially', () => {
      expect(pm.getActualPort()).toBe(51888);
    });
  });

  describe('Environment Variables in startBackend', () => {
    let spawnedEnv;

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockSpawn.mockReturnValue({
        pid: 12345,
        killed: false,
        stdout: { on: jest.fn() },
        stderr: { setEncoding: jest.fn(), on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
      });

      mockSpawn.mockImplementation((cmd, args, options) => {
        spawnedEnv = options.env;
        return {
          pid: 12345,
          killed: false,
          stdout: { on: jest.fn() },
          stderr: { setEncoding: jest.fn(), on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn(),
        };
      });
    });

    test('startBackend sets OUTPUT_DIR, UPLOAD_DIR, DB_PATH, PORT, LOG_DIR, AUTO_PORT_DISCOVERY, PRODUCTION env vars', async () => {
      await pm.startBackend();

      expect(spawnedEnv).toBeDefined();
      expect(spawnedEnv.OUTPUT_DIR).toContain('output');
      expect(spawnedEnv.UPLOAD_DIR).toContain('uploads');
      expect(spawnedEnv.DB_PATH).toContain('history.db');
      expect(spawnedEnv.PORT).toBe('51888');
      expect(spawnedEnv.LOG_DIR).toContain('logs');
      expect(spawnedEnv.AUTO_PORT_DISCOVERY).toBe('true');
      expect(spawnedEnv.PRODUCTION).toBe('false'); // isDev = true
    });

    test('PRODUCTION is "true" when isDev is false', async () => {
      const prodPm = createProcessManager({ ...defaultConfig, isDev: false });
      mockSpawn.mockImplementation((cmd, args, options) => {
        spawnedEnv = options.env;
        return {
          pid: 12345,
          killed: false,
          stdout: { on: jest.fn() },
          stderr: { setEncoding: jest.fn(), on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn(),
        };
      });

      await prodPm.startBackend();
      expect(spawnedEnv.PRODUCTION).toBe('true');
    });

    test('ENABLE_API_LOG is "true" when enableLog is true', async () => {
      const logPm = createProcessManager({ ...defaultConfig, enableLog: true });
      mockSpawn.mockImplementation((cmd, args, options) => {
        spawnedEnv = options.env;
        return {
          pid: 12345,
          killed: false,
          stdout: { on: jest.fn() },
          stderr: { setEncoding: jest.fn(), on: jest.fn() },
          on: jest.fn(),
          kill: jest.fn(),
        };
      });

      await logPm.startBackend();
      expect(spawnedEnv.ENABLE_API_LOG).toBe('true');
    });
  });

  describe('Platform-Specific Cleanup', () => {
    let mockBackendProcess;

    beforeEach(() => {
      mockBackendProcess = {
        pid: 12345,
        killed: false,
        stdout: { on: jest.fn() },
        stderr: { setEncoding: jest.fn(), on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
      };
      mockExistsSync.mockReturnValue(true);
      mockSpawn.mockReturnValue(mockBackendProcess);
    });

    test('cleanup on win32 uses taskkill with /f /t flags', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const winPm = createProcessManager(defaultConfig);
      await winPm.startBackend();
      winPm.cleanup();

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('taskkill'),
        expect.objectContaining({ timeout: 5000 })
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    test('cleanup on unix uses SIGTERM', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const unixPm = createProcessManager(defaultConfig);
      await unixPm.startBackend();
      unixPm.cleanup();

      expect(mockBackendProcess.kill).toHaveBeenCalledWith('SIGTERM');

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });
  });

  describe('Cleanup Idempotence', () => {
    let mockBackendProcess;

    beforeEach(() => {
      mockBackendProcess = {
        pid: 12345,
        killed: false,
        stdout: { on: jest.fn() },
        stderr: { setEncoding: jest.fn(), on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
      };
      mockExistsSync.mockReturnValue(true);
      mockSpawn.mockReturnValue(mockBackendProcess);
    });

    test('calling cleanup multiple times only executes process termination once', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      const idempotentPm = createProcessManager(defaultConfig);
      await idempotentPm.startBackend();

      // First cleanup should execute
      idempotentPm.cleanup();
      const firstCallCount = mockBackendProcess.kill.mock.calls.length;

      // Second and third cleanup should be no-ops
      idempotentPm.cleanup();
      idempotentPm.cleanup();

      // kill should only have been called during the first cleanup
      expect(mockBackendProcess.kill.mock.calls.length).toBe(firstCallCount);

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    test('cleanup without a running backend process does not throw', () => {
      // pm was created but startBackend was never called
      expect(() => pm.cleanup()).not.toThrow();
    });
  });
});
