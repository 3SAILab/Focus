#!/usr/bin/env node

/**
 * Batch Sales Packaging Script
 * 
 * 自动为多个销售打包 Focus 应用程序
 * 每个包包含对应销售的微信二维码图片
 * 
 * 功能：
 * 1. 自动扫描 frontend/public 中的所有 *_wxchat.jpg 文件
 * 2. 先构建最新的前端和后端
 * 3. 为每个销售打包 Windows (x64+ia32) 和 Mac 版本
 * 4. 所有安装包统一放到输出文件夹
 * 
 * Usage:
 *   node scripts/batch-build.js           # Build for all sales
 *   node scripts/batch-build.js --sales=dyf  # Build for specific sales
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ============================================================================
// Configuration
// ============================================================================

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'frontend', 'public');
const DIST_DIR = path.join(ROOT_DIR, 'frontend', 'dist');
const STANDARD_QR_NAME = 'sales_wxchat.jpg';
const OUTPUT_FOLDER = 'release-all-sales';  // 统一输出文件夹

// 读取 package.json 获取版本号和产品名
function getPackageInfo() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  return {
    version: packageJson.version,
    productName: packageJson.build?.productName || 'Focus'
  };
}

// ============================================================================
// Scanner Module - 扫描 frontend/public 目录
// ============================================================================

/**
 * 扫描 frontend/public 目录中的所有销售微信图片
 * @returns {string[]} 销售名称数组
 */
function findSalesQRImages() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    log(`❌ 目录不存在: ${PUBLIC_DIR}`, 'red');
    return [];
  }
  
  const files = fs.readdirSync(PUBLIC_DIR);
  const qrPattern = /_wxchat\.(jpg|png)$/i;
  
  const salesNames = files
    .filter(file => qrPattern.test(file))
    .map(file => extractSalesName(file))
    .filter(name => name !== null);
  
  return salesNames;
}

/**
 * 从文件名提取销售名称
 * @param {string} filename - 文件名 (e.g., 'dyf_wxchat.jpg')
 * @returns {string|null} 销售名称 (e.g., 'dyf')
 */
function extractSalesName(filename) {
  const match = filename.match(/^(.+)_wxchat\.(jpg|png)$/i);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

/**
 * 获取销售的微信图片路径
 * @param {string} salesName - 销售名称
 * @returns {string|null} 图片完整路径
 */
function getSalesQRPath(salesName) {
  const jpgPath = path.join(PUBLIC_DIR, `${salesName}_wxchat.jpg`);
  const pngPath = path.join(PUBLIC_DIR, `${salesName}_wxchat.png`);
  
  if (fs.existsSync(jpgPath)) return jpgPath;
  if (fs.existsSync(pngPath)) return pngPath;
  return null;
}

// ============================================================================
// Build Module
// ============================================================================

/**
 * 执行命令并等待完成
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows ? command + (command === 'npm' ? '.cmd' : '') : command;
    
    log(`执行: ${command} ${args.join(' ')}`, 'cyan');
    
    const child = spawn(cmd, args, {
      cwd: options.cwd || ROOT_DIR,
      stdio: options.silent ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      shell: isWindows,
      env: { ...process.env, ...options.env }
    });
    
    let stdout = '';
    let stderr = '';
    
    if (options.silent) {
      child.stdout?.on('data', (data) => { stdout += data.toString(); });
      child.stderr?.on('data', (data) => { stderr += data.toString(); });
    }
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`命令失败 (code ${code}): ${stderr || stdout}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * 构建前端
 */
async function buildFrontend() {
  log('\n📦 构建前端...', 'blue');
  await runCommand('npm', ['run', 'build:frontend']);
  log('✓ 前端构建完成', 'green');
}

/**
 * 构建后端 (Windows)
 */
async function buildBackendWin() {
  log('\n📦 构建后端 (Windows)...', 'blue');
  await runCommand('npm', ['run', 'build:backend:win']);
  log('✓ Windows 后端构建完成', 'green');
}

/**
 * 构建后端 (Mac)
 */
async function buildBackendMac() {
  log('\n📦 构建后端 (Mac)...', 'blue');
  
  // 在 Windows 上交叉编译 Mac 后端
  const backendDir = path.join(ROOT_DIR, 'backend');
  const outputPath = path.join(ROOT_DIR, 'dist', 'backend', 'sigma-backend-mac');
  
  await runCommand('go', ['build', '-trimpath', '-ldflags=-s -w -buildid=', '-o', outputPath, '.'], {
    cwd: backendDir,
    env: { GOOS: 'darwin', GOARCH: 'amd64' }
  });
  
  log('✓ Mac 后端构建完成', 'green');
}

/**
 * 验证构建产物
 */
async function validateBuild() {
  log('\n🔍 验证构建产物...', 'blue');
  await runCommand('npm', ['run', 'validate:build']);
  log('✓ 构建验证通过', 'green');
}

/**
 * 准备销售的微信图片 - 复制到 frontend/dist
 */
async function prepareSalesQR(salesName) {
  const sourcePath = getSalesQRPath(salesName);
  if (!sourcePath) {
    throw new Error(`找不到销售 ${salesName} 的微信图片`);
  }
  
  const destPath = path.join(DIST_DIR, STANDARD_QR_NAME);
  await fs.promises.copyFile(sourcePath, destPath);
  log(`  准备微信图片: ${salesName}`, 'cyan');
}

/**
 * 为单个销售打包 Windows 版本
 */
async function buildWindowsPackage(salesName, packageInfo) {
  const { version, productName } = packageInfo;
  const tempOutputDir = `release-temp-${salesName}`;
  const artifactName = `${productName}-${version}-${salesName}.exe`;
  
  log(`  🪟 打包 Windows 版本...`, 'blue');
  
  await runCommand('npx', [
    'electron-builder',
    '--win',
    '--x64', '--ia32',
    `--config.directories.output=${tempOutputDir}`,
    `--config.win.artifactName=${artifactName}`
  ], { silent: true });
  
  return tempOutputDir;
}

/**
 * 为单个销售打包 Mac 版本
 */
async function buildMacPackage(salesName, packageInfo) {
  const { version, productName } = packageInfo;
  const tempOutputDir = `release-temp-${salesName}-mac`;
  const artifactName = `${productName}-${version}-${salesName}-mac.dmg`;
  
  log(`  🍎 打包 Mac 版本...`, 'blue');
  
  // 先切换后端为 Mac 版本
  const winBackend = path.join(ROOT_DIR, 'dist', 'backend', 'sigma-backend.exe');
  const macBackend = path.join(ROOT_DIR, 'dist', 'backend', 'sigma-backend-mac');
  const macBackendDest = path.join(ROOT_DIR, 'dist', 'backend', 'sigma-backend');
  
  // 备份 Windows 后端
  const winBackendBackup = winBackend + '.backup';
  if (fs.existsSync(winBackend)) {
    fs.renameSync(winBackend, winBackendBackup);
  }
  
  // 复制 Mac 后端
  if (fs.existsSync(macBackend)) {
    fs.copyFileSync(macBackend, macBackendDest);
  }
  
  try {
    await runCommand('npx', [
      'electron-builder',
      '--mac',
      `--config.directories.output=${tempOutputDir}`,
      `--config.mac.artifactName=${artifactName}`
    ], { silent: true });
  } finally {
    // 恢复 Windows 后端
    if (fs.existsSync(macBackendDest)) {
      fs.unlinkSync(macBackendDest);
    }
    if (fs.existsSync(winBackendBackup)) {
      fs.renameSync(winBackendBackup, winBackend);
    }
  }
  
  return tempOutputDir;
}

/**
 * 移动安装包到统一输出文件夹
 */
async function movePackagesToOutput(tempDir, outputDir) {
  if (!fs.existsSync(tempDir)) return [];
  
  const movedFiles = [];
  const files = fs.readdirSync(tempDir);
  
  for (const file of files) {
    // 只移动安装包文件
    if (file.endsWith('.exe') || file.endsWith('.dmg') || file.endsWith('.zip')) {
      const srcPath = path.join(tempDir, file);
      const destPath = path.join(outputDir, file);
      
      // 确保目标目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.copyFileSync(srcPath, destPath);
      movedFiles.push(file);
    }
  }
  
  // 清理临时目录
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  return movedFiles;
}

// ============================================================================
// Main Orchestration
// ============================================================================

async function batchBuild(singleSales = null) {
  const startTime = Date.now();
  const successful = [];
  const failed = [];
  const allPackages = [];
  
  // 获取包信息
  const packageInfo = getPackageInfo();
  log(`\n🚀 Focus 批量打包工具 v${packageInfo.version}`, 'magenta');
  log('═'.repeat(50), 'magenta');
  
  // 扫描销售微信图片
  let salesList = findSalesQRImages();
  
  if (salesList.length === 0) {
    log('\n❌ 在 frontend/public 中没有找到销售微信图片', 'red');
    log('期望的文件格式: *_wxchat.jpg', 'yellow');
    return { total: 0, successful, failed, totalDuration: Date.now() - startTime };
  }
  
  // 如果指定了单个销售
  if (singleSales) {
    if (!salesList.includes(singleSales)) {
      log(`\n❌ 销售 "${singleSales}" 不存在`, 'red');
      log('可用的销售:', 'yellow');
      salesList.forEach(name => log(`  - ${name}`, 'yellow'));
      return { total: 0, successful, failed, totalDuration: Date.now() - startTime };
    }
    salesList = [singleSales];
  }
  
  log(`\n📋 找到 ${salesList.length} 个销售:`, 'cyan');
  salesList.forEach(name => log(`  - ${name}`, 'green'));
  
  // 创建输出目录
  const outputDir = path.join(ROOT_DIR, OUTPUT_FOLDER);
  if (fs.existsSync(outputDir)) {
    log(`\n🗑️  清理旧的输出目录: ${OUTPUT_FOLDER}`, 'yellow');
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });
  
  try {
    // Step 1: 构建前端
    await buildFrontend();
    
    // Step 2: 构建 Windows 后端
    await buildBackendWin();
    
    // Step 3: 构建 Mac 后端（可选，失败不影响 Windows 打包）
    try {
      await buildBackendMac();
    } catch (macErr) {
      log(`⚠️ Mac 后端构建失败: ${macErr.message}`, 'yellow');
      log('将跳过 Mac 版本打包', 'yellow');
    }
    
    // Step 4: 验证构建
    await validateBuild();
    
  } catch (error) {
    log(`\n❌ 构建失败: ${error.message}`, 'red');
    return { total: 0, successful, failed: [{ name: 'build', error: error.message }], totalDuration: Date.now() - startTime };
  }
  
  // Step 5: 为每个销售打包
  const total = salesList.length;
  for (let i = 0; i < total; i++) {
    const salesName = salesList[i];
    const current = i + 1;
    
    log(`\n[${ current}/${total}] 打包: ${salesName}`, 'blue');
    log('─'.repeat(40), 'cyan');
    
    try {
      // 准备微信图片
      await prepareSalesQR(salesName);
      
      // 打包 Windows 版本
      const winTempDir = await buildWindowsPackage(salesName, packageInfo);
      const winFiles = await movePackagesToOutput(path.join(ROOT_DIR, winTempDir), outputDir);
      allPackages.push(...winFiles);
      
      // 打包 Mac 版本
      try {
        const macTempDir = await buildMacPackage(salesName, packageInfo);
        const macFiles = await movePackagesToOutput(path.join(ROOT_DIR, macTempDir), outputDir);
        allPackages.push(...macFiles);
      } catch (macError) {
        log(`  ⚠️ Mac 版本打包失败: ${macError.message}`, 'yellow');
        // Mac 打包失败不影响整体成功状态
      }
      
      log(`  ✓ ${salesName} 打包完成`, 'green');
      successful.push(salesName);
      
    } catch (error) {
      log(`  ✗ ${salesName} 打包失败: ${error.message}`, 'red');
      failed.push({ name: salesName, error: error.message });
    }
  }
  
  // 打印总结
  const totalDuration = Date.now() - startTime;
  
  log('\n' + '═'.repeat(50), 'magenta');
  log('📊 打包总结', 'magenta');
  log('═'.repeat(50), 'magenta');
  
  log(`\n总计: ${total} 个销售`, 'cyan');
  log(`成功: ${successful.length}`, 'green');
  log(`失败: ${failed.length}`, failed.length > 0 ? 'red' : 'green');
  log(`耗时: ${(totalDuration / 1000 / 60).toFixed(1)} 分钟`, 'cyan');
  
  if (allPackages.length > 0) {
    log(`\n📁 输出目录: ${OUTPUT_FOLDER}/`, 'green');
    log('生成的安装包:', 'green');
    allPackages.forEach(file => log(`  - ${file}`, 'cyan'));
  }
  
  if (failed.length > 0) {
    log('\n❌ 失败的打包:', 'red');
    failed.forEach(({ name, error }) => log(`  - ${name}: ${error}`, 'red'));
  }
  
  log('\n');
  
  return { total, successful, failed, totalDuration, packages: allPackages };
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(argv = process.argv.slice(2)) {
  let singleSales = null;
  let help = false;
  
  for (const arg of argv) {
    if (arg.startsWith('--sales=')) {
      singleSales = arg.substring('--sales='.length) || null;
    } else if (arg === '--help' || arg === '-h') {
      help = true;
    }
  }
  
  return { singleSales, help };
}

function showHelp() {
  log('\n用法: node scripts/batch-build.js [选项]\n', 'cyan');
  log('选项:', 'cyan');
  log('  --sales=<name>  只为指定销售打包', 'reset');
  log('  --help, -h      显示帮助信息\n', 'reset');
  log('示例:', 'cyan');
  log('  node scripts/batch-build.js              # 为所有销售打包', 'reset');
  log('  node scripts/batch-build.js --sales=dyf  # 只为 dyf 打包\n', 'reset');
}

// Export for testing
module.exports = {
  findSalesQRImages,
  extractSalesName,
  getSalesQRPath,
  batchBuild,
  parseArgs,
  showHelp,
  getPackageInfo
};

// Main entry point
if (require.main === module) {
  const { singleSales, help } = parseArgs();
  
  if (help) {
    showHelp();
    process.exit(0);
  }
  
  batchBuild(singleSales)
    .then(result => {
      process.exit(result.failed.length > 0 ? 1 : 0);
    })
    .catch(error => {
      log(`\n❌ 致命错误: ${error.message}`, 'red');
      process.exit(1);
    });
}
