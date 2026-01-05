import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Get the full path to a port file based on OS
 * Matches the Go implementation in backend/utils/port.go
 */
export function getPortFilePath(filename: string): string {
  let tempDir: string;
  
  const platform = os.platform();
  
  if (platform === 'win32') {
    tempDir = process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp';
  } else {
    // linux, darwin, etc.
    tempDir = '/tmp';
  }
  
  return path.join(tempDir, filename);
}

/**
 * Read backend port from port file
 * Returns the port number or null if file doesn't exist or is invalid
 */
export function readBackendPort(): number | null {
  try {
    const filePath = getPortFilePath('sigma-backend.port');
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const portStr = content.trim();
    const port = parseInt(portStr, 10);
    
    // Validate port number
    if (isNaN(port) || port < 1 || port > 65535) {
      return null;
    }
    
    return port;
  } catch {
    // Handle any file read errors gracefully
    return null;
  }
}

/**
 * Get backend URL with fallback to default port (8080)
 * Constructs the full backend URL based on the port file or default
 */
export function getBackendURL(): string {
  const port = readBackendPort();
  const actualPort = port !== null ? port : 8080;
  return `http://localhost:${actualPort}`;
}
