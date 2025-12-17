#!/usr/bin/env node

/**
 * Build Validation Script
 * 
 * Validates that all required files exist before packaging with electron-builder.
 * This helps catch build issues early and provides clear error messages.
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  const exists = fs.existsSync(fullPath);
  
  if (exists) {
    const stats = fs.statSync(fullPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    log(`  ✓ ${description}: ${filePath} (${sizeKB} KB)`, 'green');
    return true;
  } else {
    log(`  ✗ ${description}: ${filePath} (NOT FOUND)`, 'red');
    return false;
  }
}

function checkDirectory(dirPath, description) {
  const fullPath = path.join(__dirname, '..', dirPath);
  const exists = fs.existsSync(fullPath);
  
  if (exists && fs.statSync(fullPath).isDirectory()) {
    const files = fs.readdirSync(fullPath);
    log(`  ✓ ${description}: ${dirPath} (${files.length} files)`, 'green');
    return true;
  } else {
    log(`  ✗ ${description}: ${dirPath} (NOT FOUND)`, 'red');
    return false;
  }
}

function main() {
  log('\n=== Build Validation ===\n', 'blue');
  
  const checks = [];
  
  // Check backend executable
  log('Checking backend executable...', 'yellow');
  const backendExe = process.platform === 'win32' 
    ? 'dist/backend/sigma-backend.exe'
    : 'dist/backend/sigma-backend';
  checks.push(checkFile(backendExe, 'Backend executable'));
  
  // Check frontend build
  log('\nChecking frontend build...', 'yellow');
  checks.push(checkFile('frontend/dist/index.html', 'Frontend index.html'));
  checks.push(checkDirectory('frontend/dist/assets', 'Frontend assets'));
  
  // Check assets
  log('\nChecking assets...', 'yellow');
  const hasWinIcon = checkFile('assets/icon.ico', 'Windows icon');
  const hasMacIcon = checkFile('assets/icon.icns', 'macOS icon');
  const hasLinuxIcon = checkFile('assets/icon.png', 'Linux icon');
  
  // Icons are optional but warn if missing
  if (!hasWinIcon || !hasMacIcon || !hasLinuxIcon) {
    log('\n  ⚠ Warning: Some platform icons are missing. Using default icons.', 'yellow');
  }
  
  // Check electron files
  log('\nChecking Electron files...', 'yellow');
  checks.push(checkFile('electron/main.js', 'Main process'));
  checks.push(checkFile('electron/preload.js', 'Preload script'));
  
  // Summary
  log('\n=== Validation Summary ===\n', 'blue');
  
  const failed = checks.filter(c => !c).length;
  const passed = checks.filter(c => c).length;
  
  if (failed === 0) {
    log(`✓ All ${passed} required files found`, 'green');
    log('\nBuild validation passed! Ready to package with electron-builder.\n', 'green');
    process.exit(0);
  } else {
    log(`✗ ${failed} required file(s) missing`, 'red');
    log(`✓ ${passed} file(s) found`, 'green');
    log('\nBuild validation failed! Please fix the issues above before packaging.\n', 'red');
    log('Common solutions:', 'yellow');
    log('  - Run "npm run build:frontend" to build the frontend', 'yellow');
    log('  - Run "npm run build:backend:win" to build the backend', 'yellow');
    log('  - Check that Go is installed and in PATH', 'yellow');
    log('  - Check that Node.js dependencies are installed\n', 'yellow');
    process.exit(1);
  }
}

// Run validation
main();
