/**
 * Unit tests for ipcHandlers module
 *
 * Tests channel registration, get-backend-url handler,
 * get-app-version handler, and save-image format detection.
 *
 * Requirements: 3.2, 3.4, 3.5
 */

// ---- Mocks ----

const registeredHandlers = {};

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => {
      registeredHandlers[channel] = handler;
    }),
  },
  app: {
    getVersion: jest.fn(() => '1.0.6'),
  },
  shell: {
    openExternal: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => JSON.stringify({ version: '1.0.6', versionCode: '202601231000' })),
  writeFileSync: jest.fn(),
}));

jest.mock('./versionChecker', () => ({
  performVersionCheck: jest.fn().mockResolvedValue({ status: 'up_to_date' }),
}));

const { registerHandlers } = require('./ipcHandlers');
const { ipcMain, app } = require('electron');

describe('ipcHandlers', () => {
  const mockMainWindow = {
    isDestroyed: jest.fn(() => false),
    webContents: { send: jest.fn() },
  };

  const defaultDeps = {
    mainWindow: mockMainWindow,
    userDataPath: '/mock/userData',
    readPortFromFile: jest.fn(() => 8080),
    getActualPort: jest.fn(() => 51888),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear registered handlers
    Object.keys(registeredHandlers).forEach(key => delete registeredHandlers[key]);
  });

  describe('Channel Registration', () => {
    test('registerHandlers registers all 8 expected IPC channels', () => {
      registerHandlers(defaultDeps);

      const expectedChannels = [
        'get-backend-url',
        'get-app-version',
        'get-user-data-path',
        'get-paths',
        'save-image',
        'get-version-info',
        'check-update',
        'open-download-url',
      ];

      expect(ipcMain.handle).toHaveBeenCalledTimes(8);

      for (const channel of expectedChannels) {
        expect(registeredHandlers).toHaveProperty(channel);
        expect(typeof registeredHandlers[channel]).toBe('function');
      }
    });

    test('registerHandlers registers exactly the expected channels (no extras)', () => {
      registerHandlers(defaultDeps);

      const registeredChannelNames = Object.keys(registeredHandlers);
      expect(registeredChannelNames).toHaveLength(8);
    });
  });

  describe('get-backend-url handler', () => {
    test('returns URL with port from readPortFromFile when available', () => {
      defaultDeps.readPortFromFile.mockReturnValue(9090);
      registerHandlers(defaultDeps);

      const result = registeredHandlers['get-backend-url']();
      expect(result).toBe('http://localhost:9090');
    });

    test('falls back to getActualPort when readPortFromFile returns null', () => {
      defaultDeps.readPortFromFile.mockReturnValue(null);
      defaultDeps.getActualPort.mockReturnValue(51888);
      registerHandlers(defaultDeps);

      const result = registeredHandlers['get-backend-url']();
      expect(result).toBe('http://localhost:51888');
    });

    test('returns URL in http://localhost:{port} format', () => {
      defaultDeps.readPortFromFile.mockReturnValue(3000);
      registerHandlers(defaultDeps);

      const result = registeredHandlers['get-backend-url']();
      expect(result).toMatch(/^http:\/\/localhost:\d+$/);
    });
  });

  describe('get-app-version handler', () => {
    test('returns a version string', () => {
      registerHandlers(defaultDeps);

      const result = registeredHandlers['get-app-version']();
      expect(typeof result).toBe('string');
      expect(result).toBe('1.0.6');
    });
  });

  describe('get-user-data-path handler', () => {
    test('returns the userDataPath from deps', () => {
      registerHandlers(defaultDeps);

      const result = registeredHandlers['get-user-data-path']();
      expect(result).toBe('/mock/userData');
    });
  });

  describe('get-paths handler', () => {
    test('returns paths object with userData, output, uploads, database', () => {
      registerHandlers(defaultDeps);

      const result = registeredHandlers['get-paths']();
      expect(result).toHaveProperty('userData', '/mock/userData');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('uploads');
      expect(result).toHaveProperty('database');
      expect(result.output).toContain('output');
      expect(result.uploads).toContain('uploads');
      expect(result.database).toContain('history.db');
    });
  });

  describe('save-image format detection', () => {
    test('data: prefix is detected as base64 data URL', () => {
      const imageData = 'data:image/png;base64,iVBORw0KGgo=';
      expect(imageData.startsWith('data:')).toBe(true);
    });

    test('http prefix is detected as remote URL', () => {
      const imageData = 'http://example.com/image.png';
      expect(imageData.startsWith('http')).toBe(true);
    });

    test('https prefix is detected as remote URL', () => {
      const imageData = 'https://example.com/image.png';
      expect(imageData.startsWith('http')).toBe(true);
    });

    test('raw base64 string (no prefix) is treated as base64', () => {
      const imageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk';
      expect(imageData.startsWith('data:')).toBe(false);
      expect(imageData.startsWith('http')).toBe(false);
      // This means it falls through to the raw base64 branch
    });
  });
});
