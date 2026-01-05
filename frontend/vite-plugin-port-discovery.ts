import type { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface PortDiscoveryOptions {
  backendPortFile?: string;
  defaultBackendPort?: number;
  frontendPortFile?: string;
  enableFrontendPortFile?: boolean;
}

/**
 * Get the full path to a port file based on OS
 */
function getPortFilePath(filename: string): string {
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
 */
function readBackendPort(portFile: string): number | null {
  try {
    const filePath = getPortFilePath(portFile);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const portStr = content.trim();
    const port = parseInt(portStr, 10);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      return null;
    }
    
    return port;
  } catch {
    return null;
  }
}

/**
 * Write frontend port to port file
 */
function writeFrontendPort(port: number, portFile: string): void {
  try {
    const filePath = getPortFilePath(portFile);
    fs.writeFileSync(filePath, port.toString(), 'utf-8');
  } catch (error) {
    console.warn(`[port-discovery] Failed to write frontend port file: ${error}`);
  }
}

/**
 * Remove frontend port file
 */
function removeFrontendPortFile(portFile: string): void {
  try {
    const filePath = getPortFilePath(portFile);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`[port-discovery] Failed to remove frontend port file: ${error}`);
  }
}

/**
 * Vite plugin for backend port discovery and injection
 * Reads backend port from file and injects it into environment variables
 * Watches for port file changes and triggers HMR
 * Optionally writes frontend port to file for multi-instance support
 */
export default function portDiscoveryPlugin(options: PortDiscoveryOptions = {}): Plugin {
  const {
    backendPortFile = 'sigma-backend.port',
    defaultBackendPort = 8080,
    frontendPortFile = 'sigma-frontend.port',
    enableFrontendPortFile = true
  } = options;

  let backendURL = '';
  let portFilePath = '';
  let frontendPortFilePath = '';

  return {
    name: 'port-discovery',
    
    configResolved() {
      // Read backend port on plugin initialization
      portFilePath = getPortFilePath(backendPortFile);
      const port = readBackendPort(backendPortFile);
      const actualPort = port !== null ? port : defaultBackendPort;
      backendURL = `http://localhost:${actualPort}`;
      
      console.log(`[port-discovery] Backend URL: ${backendURL}`);
      
      // Set up frontend port file path
      frontendPortFilePath = getPortFilePath(frontendPortFile);
    },
    
    config() {
      // Inject backend URL into environment variables
      const port = readBackendPort(backendPortFile);
      const actualPort = port !== null ? port : defaultBackendPort;
      const url = `http://localhost:${actualPort}`;
      
      return {
        define: {
          'import.meta.env.VITE_BACKEND_URL': JSON.stringify(url)
        }
      };
    },
    
    configureServer(server) {
      // Watch for backend port file changes
      if (fs.existsSync(portFilePath)) {
        const watcher = fs.watch(portFilePath, (eventType) => {
          if (eventType === 'change') {
            const port = readBackendPort(backendPortFile);
            const actualPort = port !== null ? port : defaultBackendPort;
            const newURL = `http://localhost:${actualPort}`;
            
            if (newURL !== backendURL) {
              backendURL = newURL;
              console.log(`[port-discovery] Backend URL changed: ${backendURL}`);
              
              // Trigger HMR to update the application
              server.ws.send({
                type: 'full-reload',
                path: '*'
              });
            }
          }
        });
        
        // Clean up watcher on server close
        server.httpServer?.on('close', () => {
          watcher.close();
        });
      }
      
      // Write frontend port to file after server starts
      if (enableFrontendPortFile && server.httpServer) {
        if (typeof server.httpServer.once === 'function') {
          server.httpServer.once('listening', () => {
            const address = server.httpServer?.address();
            if (address && typeof address === 'object' && 'port' in address) {
              const frontendPort = address.port;
              writeFrontendPort(frontendPort, frontendPortFile);
              console.log(`[port-discovery] Frontend port ${frontendPort} written to ${frontendPortFilePath}`);
            }
          });
        }
        
        // Clean up frontend port file on server close
        if (typeof server.httpServer.on === 'function') {
          server.httpServer.on('close', () => {
            removeFrontendPortFile(frontendPortFile);
            console.log(`[port-discovery] Frontend port file cleaned up`);
          });
        }
      }
    }
  };
}
