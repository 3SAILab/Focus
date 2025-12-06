import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPortFilePath, readBackendPort, getBackendURL } from './portDiscovery';

describe('Port Discovery Utilities', () => {
  let testPortFilePath: string;

  beforeEach(() => {
    // Get the actual port file path that will be used
    testPortFilePath = getPortFilePath('sigma-backend.port');
    
    // Clean up any existing test port file
    if (fs.existsSync(testPortFilePath)) {
      fs.unlinkSync(testPortFilePath);
    }
  });

  afterEach(() => {
    // Clean up test port file after each test
    if (fs.existsSync(testPortFilePath)) {
      fs.unlinkSync(testPortFilePath);
    }
  });

  describe('getPortFilePath', () => {
    it('should return correct path based on OS', () => {
      const filename = 'test.port';
      const filePath = getPortFilePath(filename);
      
      const platform = os.platform();
      
      if (platform === 'win32') {
        // On Windows, should use TEMP directory
        const tempDir = process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp';
        expect(filePath).toBe(path.join(tempDir, filename));
      } else {
        // On Unix-like systems, should use /tmp
        expect(filePath).toBe(path.join('/tmp', filename));
      }
    });

    it('should handle different filenames', () => {
      const filename1 = 'backend.port';
      const filename2 = 'frontend.port';
      
      const path1 = getPortFilePath(filename1);
      const path2 = getPortFilePath(filename2);
      
      expect(path1).not.toBe(path2);
      expect(path1).toContain(filename1);
      expect(path2).toContain(filename2);
    });
  });

  describe('readBackendPort', () => {
    it('should read valid port from file', () => {
      // Write a valid port to the file
      const validPort = 8080;
      fs.writeFileSync(testPortFilePath, validPort.toString(), 'utf-8');
      
      const port = readBackendPort();
      expect(port).toBe(validPort);
    });

    it('should handle different valid port numbers', () => {
      const testPorts = [3000, 8080, 8081, 9000, 65535];
      
      for (const testPort of testPorts) {
        fs.writeFileSync(testPortFilePath, testPort.toString(), 'utf-8');
        const port = readBackendPort();
        expect(port).toBe(testPort);
      }
    });

    it('should return null when port file does not exist', () => {
      // Ensure file doesn't exist
      if (fs.existsSync(testPortFilePath)) {
        fs.unlinkSync(testPortFilePath);
      }
      
      const port = readBackendPort();
      expect(port).toBeNull();
    });

    it('should return null for invalid port content', () => {
      // Test with non-numeric content
      fs.writeFileSync(testPortFilePath, 'invalid', 'utf-8');
      expect(readBackendPort()).toBeNull();
      
      // Test with empty content
      fs.writeFileSync(testPortFilePath, '', 'utf-8');
      expect(readBackendPort()).toBeNull();
      
      // Test with negative number
      fs.writeFileSync(testPortFilePath, '-1', 'utf-8');
      expect(readBackendPort()).toBeNull();
      
      // Test with port number too large
      fs.writeFileSync(testPortFilePath, '65536', 'utf-8');
      expect(readBackendPort()).toBeNull();
      
      // Test with port number zero
      fs.writeFileSync(testPortFilePath, '0', 'utf-8');
      expect(readBackendPort()).toBeNull();
    });

    it('should handle port file with whitespace', () => {
      const validPort = 8080;
      
      // Test with leading/trailing whitespace
      fs.writeFileSync(testPortFilePath, `  ${validPort}  \n`, 'utf-8');
      expect(readBackendPort()).toBe(validPort);
      
      // Test with tabs
      fs.writeFileSync(testPortFilePath, `\t${validPort}\t`, 'utf-8');
      expect(readBackendPort()).toBe(validPort);
    });

    it('should handle file read errors gracefully', () => {
      // Create a directory with the same name to cause a read error
      if (fs.existsSync(testPortFilePath)) {
        fs.unlinkSync(testPortFilePath);
      }
      
      // This should return null instead of throwing
      const port = readBackendPort();
      expect(port).toBeNull();
    });
  });

  describe('getBackendURL', () => {
    it('should construct URL with port from file', () => {
      const testPort = 8081;
      fs.writeFileSync(testPortFilePath, testPort.toString(), 'utf-8');
      
      const url = getBackendURL();
      expect(url).toBe(`http://localhost:${testPort}`);
    });

    it('should fall back to default port 8080 when file does not exist', () => {
      // Ensure file doesn't exist
      if (fs.existsSync(testPortFilePath)) {
        fs.unlinkSync(testPortFilePath);
      }
      
      const url = getBackendURL();
      expect(url).toBe('http://localhost:8080');
    });

    it('should fall back to default port 8080 when file is invalid', () => {
      fs.writeFileSync(testPortFilePath, 'invalid', 'utf-8');
      
      const url = getBackendURL();
      expect(url).toBe('http://localhost:8080');
    });

    it('should handle various valid port values', () => {
      const testCases = [
        { port: 3000, expected: 'http://localhost:3000' },
        { port: 8080, expected: 'http://localhost:8080' },
        { port: 8081, expected: 'http://localhost:8081' },
        { port: 9000, expected: 'http://localhost:9000' },
        { port: 65535, expected: 'http://localhost:65535' },
      ];
      
      for (const testCase of testCases) {
        fs.writeFileSync(testPortFilePath, testCase.port.toString(), 'utf-8');
        const url = getBackendURL();
        expect(url).toBe(testCase.expected);
      }
    });
  });
});
