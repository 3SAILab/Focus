/**
 * Version Checker Module
 * 
 * Handles version checking functionality for the Focus application.
 * - Network connection detection
 * - Remote version info fetching from OSS
 * - Version comparison
 * - Platform-specific download URL selection
 * 
 * Requirements: 1.1, 2.1, 2.2, 3.1, 3.3
 */

const https = require('https');
const http = require('http');

// Configuration constants
const VERSION_JSON_URL = 'https://sigma-focus.oss-cn-hangzhou.aliyuncs.com/version.json';
const NETWORK_CHECK_TIMEOUT = 5000;  // 5 seconds
const VERSION_FETCH_TIMEOUT = 10000; // 10 seconds

/**
 * Check network connection by attempting to reach the OSS endpoint
 * Requirements: 1.1
 * 
 * @returns {Promise<{connected: boolean, error?: string}>}
 */
async function checkNetworkConnection() {
  return new Promise((resolve) => {
    const url = new URL(VERSION_JSON_URL);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: '/',
      method: 'HEAD',
      timeout: NETWORK_CHECK_TIMEOUT,
    };

    const req = protocol.request(options, (res) => {
      // Any response means network is connected
      resolve({ connected: true });
    });

    req.on('error', (error) => {
      resolve({ 
        connected: false, 
        error: `网络连接失败: ${error.message}` 
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ 
        connected: false, 
        error: '网络连接超时，请检查网络后重试' 
      });
    });

    req.end();
  });
}

/**
 * Fetch version info from OSS
 * Requirements: 2.1, 2.2
 * 
 * @returns {Promise<{success: boolean, data?: RemoteVersionInfo, error?: string}>}
 */
async function fetchVersionInfo() {
  return new Promise((resolve) => {
    const url = new URL(VERSION_JSON_URL);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'GET',
      timeout: VERSION_FETCH_TIMEOUT,
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve({
            success: false,
            error: `获取版本信息失败，状态码: ${res.statusCode}`
          });
          return;
        }
        
        try {
          const versionInfo = JSON.parse(data);
          
          // Validate required fields
          if (!versionInfo.versionCode || !versionInfo.versionName) {
            resolve({
              success: false,
              error: '版本信息格式错误：缺少必要字段'
            });
            return;
          }
          
          resolve({
            success: true,
            data: versionInfo
          });
        } catch (parseError) {
          resolve({
            success: false,
            error: `解析版本信息失败: ${parseError.message}`
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: `获取版本信息失败: ${error.message}`
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: '获取版本信息超时，请稍后重试'
      });
    });

    req.end();
  });
}

/**
 * Compare local version with remote version
 * Requirements: 3.1
 * 
 * @param {Object} local - Local version info {versionCode, versionName}
 * @param {Object} remote - Remote version info {versionCode, versionName}
 * @returns {'update_required' | 'up_to_date'} - Comparison result
 */
function compareVersion(local, remote) {
  // If either versionCode OR versionName differs, update is required
  if (local.versionCode !== remote.versionCode || local.versionName !== remote.versionName) {
    return 'update_required';
  }
  return 'up_to_date';
}

/**
 * Get download URL based on platform and architecture
 * Requirements: 3.3
 * 
 * @param {Object} versionInfo - Remote version info with download URLs
 * @param {string} platform - Process platform (win32, darwin, linux)
 * @param {string} arch - Process architecture (x64, arm64, ia32)
 * @returns {string} - Download URL for the current platform
 */
function getDownloadUrl(versionInfo, platform = process.platform, arch = process.arch) {
  if (platform === 'win32') {
    return versionInfo.windowsUrl || '';
  }
  
  if (platform === 'darwin') {
    if (arch === 'arm64') {
      return versionInfo.macArm64Url || '';
    }
    // Default to x64 for Intel Macs
    return versionInfo.macX64Url || '';
  }
  
  // For other platforms (linux, etc.), return empty string
  // as we don't have specific URLs for them yet
  return '';
}

/**
 * Perform complete version check
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1
 * 
 * @param {Object} localVersion - Local version info {versionCode, versionName}
 * @returns {Promise<VersionCheckResult>}
 */
async function performVersionCheck(localVersion) {
  // Step 1: Check network connection
  const networkResult = await checkNetworkConnection();
  if (!networkResult.connected) {
    return {
      status: 'network_error',
      errorMessage: networkResult.error || '网络连接失败，请检查网络后重试'
    };
  }
  
  // Step 2: Fetch remote version info
  const fetchResult = await fetchVersionInfo();
  if (!fetchResult.success) {
    return {
      status: 'fetch_error',
      errorMessage: fetchResult.error || '获取版本信息失败，请稍后重试'
    };
  }
  
  const remoteVersion = fetchResult.data;
  
  // Step 3: Compare versions
  const comparisonResult = compareVersion(localVersion, remoteVersion);
  
  if (comparisonResult === 'update_required') {
    const downloadUrl = getDownloadUrl(remoteVersion);
    return {
      status: 'update_required',
      remoteVersion: remoteVersion,
      downloadUrl: downloadUrl
    };
  }
  
  return {
    status: 'up_to_date',
    remoteVersion: remoteVersion
  };
}

module.exports = {
  checkNetworkConnection,
  fetchVersionInfo,
  compareVersion,
  getDownloadUrl,
  performVersionCheck,
  VERSION_JSON_URL,
  NETWORK_CHECK_TIMEOUT,
  VERSION_FETCH_TIMEOUT
};
