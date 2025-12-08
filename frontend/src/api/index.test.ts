// src/api/index.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the api module
const mockGetBackendUrl = vi.fn();

// Extend global type for tests
declare global {
  // eslint-disable-next-line no-var
  var window: Window & typeof globalThis;
}

describe('API Client', () => {
  let originalWindow: any;

  beforeEach(() => {
    // Save original values
    originalWindow = globalThis.window;
    
    // Reset mocks
    vi.resetModules();
    mockGetBackendUrl.mockReset();
  });

  afterEach(() => {
    // Restore original values
    if (originalWindow) {
      globalThis.window = originalWindow;
    }
    vi.clearAllMocks();
  });

  describe('getApiBaseUrl', () => {
    it('should return HTTPS URL from Electron API when available', async () => {
      // Setup: Mock window with electronAPI
      globalThis.window = {
        electronAPI: {
          getBackendUrl: mockGetBackendUrl,
        },
      } as any;

      mockGetBackendUrl.mockResolvedValue('https://localhost:8080');

      // Import the module after setting up mocks
      const { api } = await import('./index.ts');

      // Execute: Make an API call
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
      await api.checkConfig();

      // Verify: Should use HTTPS URL from Electron API
      expect(mockGetBackendUrl).toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://localhost:8080/config/check',
        expect.any(Object)
      );

      fetchSpy.mockRestore();
    });

    it('should return default HTTPS URL when Electron API fails', async () => {
      // Setup: Mock window with failing electronAPI
      globalThis.window = {
        electronAPI: {
          getBackendUrl: mockGetBackendUrl,
        },
      } as any;

      mockGetBackendUrl.mockRejectedValue(new Error('API not available'));

      // Import the module after setting up mocks
      const { api } = await import('./index.ts');

      // Execute: Make an API call
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
      await api.checkConfig();

      // Verify: Should fall back to default HTTPS URL
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://localhost:8080/config/check',
        expect.any(Object)
      );

      fetchSpy.mockRestore();
    });

    it('should return HTTPS URL from environment variable when not in Electron', async () => {
      // Setup: No Electron API
      globalThis.window = {} as any;

      // Mock import.meta.env
      vi.stubEnv('VITE_BACKEND_URL', 'https://localhost:9090');

      // Import the module after setting up mocks
      const { api } = await import('./index.ts');

      // Execute: Make an API call
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
      await api.checkConfig();

      // Verify: Should use environment variable or default HTTPS
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\//),
        expect.any(Object)
      );

      fetchSpy.mockRestore();
      vi.unstubAllEnvs();
    });

    it('should use default HTTPS URL when no environment variable is set', async () => {
      // Setup: No Electron API and no env var
      globalThis.window = {} as any;

      // Import the module after setting up mocks
      const { api } = await import('./index.ts');

      // Execute: Make an API call
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
      await api.checkConfig();

      // Verify: Should use default HTTPS URL
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://localhost:8080/config/check',
        expect.any(Object)
      );

      fetchSpy.mockRestore();
    });
  });

  describe('API methods', () => {
    beforeEach(() => {
      // Setup default window without Electron API
      globalThis.window = {} as any;
    });

    it('should make HTTPS POST request for generate', async () => {
      const { api } = await import('./index.ts');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());
      
      const formData = new FormData();
      formData.append('prompt', 'test');

      await api.generate(formData);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://localhost:8080/generate',
        {
          method: 'POST',
          body: formData,
        }
      );

      fetchSpy.mockRestore();
    });

    it('should make HTTPS GET request for getHistory', async () => {
      const { api } = await import('./index.ts');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

      await api.getHistory();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://localhost:8080/history',
        {
          method: 'GET',
        }
      );

      fetchSpy.mockRestore();
    });

    it('should make HTTPS GET request for checkConfig', async () => {
      const { api } = await import('./index.ts');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

      await api.checkConfig();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://localhost:8080/config/check',
        {
          method: 'GET',
        }
      );

      fetchSpy.mockRestore();
    });

    it('should make HTTPS POST request for setApiKey', async () => {
      const { api } = await import('./index.ts');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

      await api.setApiKey('test-key');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://localhost:8080/config/apikey',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ api_key: 'test-key' }),
        }
      );

      fetchSpy.mockRestore();
    });
  });

  describe('URL caching', () => {
    it('should cache API URL after first call', async () => {
      // Setup: Mock window with electronAPI
      globalThis.window = {
        electronAPI: {
          getBackendUrl: mockGetBackendUrl,
        },
      } as any;

      mockGetBackendUrl.mockResolvedValue('https://localhost:8080');

      // Import the module after setting up mocks
      const { api } = await import('./index.ts');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response());

      // Execute: Make multiple API calls
      await api.checkConfig();
      await api.getHistory();

      // Verify: getBackendUrl should only be called once due to caching
      expect(mockGetBackendUrl).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      fetchSpy.mockRestore();
    });
  });
});
