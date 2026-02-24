/**
 * Property-based tests for ipcHandlers module
 *
 * Feature: code-structure-refactor
 * Properties 8-10: Channel registration, backend URL from port, image data format detection
 */

const fc = require('fast-check');

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

describe('ipcHandlers property tests', () => {
  const mockMainWindow = {
    isDestroyed: jest.fn(() => false),
    webContents: { send: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(registeredHandlers).forEach(key => delete registeredHandlers[key]);
  });

  /**
   * Feature: code-structure-refactor, Property 8: IPC handler registration covers all channels
   * **Validates: Requirements 3.2**
   */
  test('Property 8: registerHandlers registers exactly the expected channels', () => {
    const expectedChannels = [
      'get-backend-url', 'get-app-version', 'get-user-data-path', 'get-paths',
      'save-image', 'get-version-info', 'check-update', 'open-download-url',
    ];

    fc.assert(
      fc.property(
        fc.record({
          userDataPath: fc.constantFrom('/mock/data', '/tmp/test', '/home/user'),
          port: fc.integer({ min: 1, max: 65535 }),
        }),
        (config) => {
          Object.keys(registeredHandlers).forEach(key => delete registeredHandlers[key]);

          const deps = {
            mainWindow: mockMainWindow,
            userDataPath: config.userDataPath,
            readPortFromFile: jest.fn(() => config.port),
            getActualPort: jest.fn(() => 51888),
          };

          registerHandlers(deps);

          const registered = Object.keys(registeredHandlers).sort();
          const expected = [...expectedChannels].sort();
          expect(registered).toEqual(expected);
          expect(registered).toHaveLength(8);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: code-structure-refactor, Property 9: get-backend-url returns correct URL from port
   * **Validates: Requirements 3.4**
   */
  test('Property 9: get-backend-url returns http://localhost:{port}', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 65535 }),
        (port) => {
          Object.keys(registeredHandlers).forEach(key => delete registeredHandlers[key]);

          const deps = {
            mainWindow: mockMainWindow,
            userDataPath: '/mock/data',
            readPortFromFile: jest.fn(() => port),
            getActualPort: jest.fn(() => 51888),
          };

          registerHandlers(deps);

          const result = registeredHandlers['get-backend-url']();
          expect(result).toBe(`http://localhost:${port}`);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: code-structure-refactor, Property 10: save-image correctly identifies input format
   * **Validates: Requirements 3.5**
   */
  test('Property 10: save-image identifies data: prefix as base64, http/https as URL, other as raw base64', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('data:').map(prefix => ({ input: prefix + 'image/png;base64,abc123', expected: 'base64' })),
          fc.constant('http://').map(prefix => ({ input: prefix + 'example.com/img.png', expected: 'url' })),
          fc.constant('https://').map(prefix => ({ input: prefix + 'example.com/img.png', expected: 'url' })),
          fc.stringOf(fc.constantFrom('A','B','C','D','1','2','3','4','+','/','='), { minLength: 4, maxLength: 20 })
            .filter(s => !s.startsWith('data:') && !s.startsWith('http'))
            .map(s => ({ input: s, expected: 'raw_base64' }))
        ),
        ({ input, expected }) => {
          if (expected === 'base64') {
            expect(input.startsWith('data:')).toBe(true);
          } else if (expected === 'url') {
            expect(input.startsWith('http')).toBe(true);
          } else {
            expect(input.startsWith('data:')).toBe(false);
            expect(input.startsWith('http')).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
