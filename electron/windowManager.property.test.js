/**
 * Property-based tests for windowManager module
 *
 * Feature: code-structure-refactor
 * Property 7: Menu DevTools visibility follows config
 */

const fc = require('fast-check');

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readdirSync: jest.fn(() => []),
}));

const mockSetApplicationMenu = jest.fn();
const mockLoadURL = jest.fn();
const mockLoadFile = jest.fn();
const mockOpenDevTools = jest.fn();
const mockOn = jest.fn();

const mockBrowserWindow = jest.fn(() => ({
  loadURL: mockLoadURL,
  loadFile: mockLoadFile,
  webContents: { openDevTools: mockOpenDevTools },
  on: mockOn,
}));

jest.mock('electron', () => ({
  BrowserWindow: mockBrowserWindow,
  Menu: { setApplicationMenu: mockSetApplicationMenu },
  app: {
    getAppPath: jest.fn(() => '/mock/app'),
  },
}));

const { createWindow } = require('./windowManager');

describe('windowManager property tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Feature: code-structure-refactor, Property 7: Menu DevTools visibility follows config
   * **Validates: Requirements 2.5**
   */
  test('Property 7: Menu DevTools flag equals isDev || ENABLE_PROD_LOG', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        (isDev, ENABLE_PROD_LOG) => {
          jest.clearAllMocks();

          let receivedShowDevTools = null;
          const mockCreateChineseMenu = jest.fn((showDevTools) => {
            receivedShowDevTools = showDevTools;
            return { mock: 'menu' };
          });

          createWindow({ isDev, ENABLE_PROD_LOG, createChineseMenu: mockCreateChineseMenu });

          expect(mockCreateChineseMenu).toHaveBeenCalledTimes(1);
          expect(receivedShowDevTools).toBe(isDev || ENABLE_PROD_LOG);
        }
      ),
      { numRuns: 20 }
    );
  });
});
