#!/usr/bin/env node
/**
 * 一键打包脚本
 * 用法: node scripts/build-all.js [--skip-frontend] [--skip-backend] [--platform <win|mac|linux|all>] [--arch <x64|ia32|arm64|all>]
 * 
 * 示例:
 *   node scripts/build-all.js                    # 默认打包当前平台 x64
 *   node scripts/build-all.js --platform win --arch all  # Windows x64 + ia32
 *   node scripts/build-all.js --platform all     # 所有平台
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 解析命令行参数
const args = process.argv.slice(2);
const skipFrontend = args.includes('--skip-frontend');
const skipBackend = args.includes('--skip-backend');
const platformIndex = args.indexOf('--platform');
const archIndex = args.indexOf('--arch');
const targetPlatform = platformIndex !== -1 ? args[platformIndex + 1] : 'win';
const targetArch = archIndex !== -1 ? args[archIndex + 1] : 'x64';

// 平台和架构映射
const platformConfigs = {
  win: {
    goos: 'windows',
    ext: '.exe',
    electronTarget: '--win',
  },
  mac: {
    goos: 'darwin',
    ext: '',
    electronTarget: '--mac',
  },
  linux: {
    goos: 'linux',
    ext: '',
    electronTarget: '--linux',
  },
};

const archConfigs = {
  x64: { goarch: 'amd64' },
  ia32: { goarch: '386' },
  arm64: { goarch: 'arm64' },
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.cyan}${colors.bold}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function runCommand(command, options = {}) {
  try {
    execSync(command, { 
      stdio: 'inherit',
      ...options 
    });
    return true;
  } catch (error) {
    return false;
  }
}

// 构建后端（支持交叉编译）
function buildBackend(platform, arch, rootDir) {
  const config = platformConfigs[platform];
  const archConfig = archConfigs[arch];
  
  if (!config || !archConfig) {
    logError(`不支持的平台/架构: ${platform}/${arch}`);
    return false;
  }
  
  const backendDistDir = path.join(rootDir, 'dist', 'backend');
  if (!fs.existsSync(backendDistDir)) {
    fs.mkdirSync(backendDistDir, { recursive: true });
  }
  
  const outputName = `sigma-backend${config.ext}`;
  const outputPath = path.join('..', 'dist', 'backend', outputName);
  
  // 设置交叉编译环境变量
  const env = {
    ...process.env,
    GOOS: config.goos,
    GOARCH: archConfig.goarch,
    CGO_ENABLED: '0', // 禁用 CGO 以支持交叉编译
  };
  
  log(`  编译目标: ${config.goos}/${archConfig.goarch}`, 'cyan');
  
  try {
    execSync(
      `go build -trimpath -ldflags="-s -w -buildid=" -o ${outputPath} .`,
      { 
        cwd: path.join(rootDir, 'backend'),
        stdio: 'inherit',
        env,
      }
    );
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const startTime = Date.now();
  const rootDir = path.resolve(__dirname, '..');
  
  log('\n========================================', 'cyan');
  log('       Focus 一键打包工具', 'bold');
  log('========================================\n', 'cyan');
  log(`目标平台: ${targetPlatform}`, 'cyan');
  log(`目标架构: ${targetArch}`, 'cyan');

  // 确定要构建的平台和架构
  const platforms = targetPlatform === 'all' ? ['win', 'mac', 'linux'] : [targetPlatform];
  const archs = targetArch === 'all' ? ['x64', 'ia32'] : [targetArch];

  // 步骤 1: 构建后端
  if (!skipBackend) {
    logStep('1/4', '构建后端 (Go)...');
    
    // 对于 Windows，我们只需要构建一次（使用第一个架构）
    // 因为 electron-builder 会自动处理不同架构
    const backendPlatform = platforms[0];
    const backendArch = archs[0];
    
    const backendSuccess = buildBackend(backendPlatform, backendArch, rootDir);
    
    if (!backendSuccess) {
      logError('后端构建失败！');
      process.exit(1);
    }
    logSuccess('后端构建完成');
  } else {
    logStep('1/4', '跳过后端构建');
  }

  // 步骤 2: 构建前端
  if (!skipFrontend) {
    logStep('2/4', '构建前端 (Vite)...');
    
    const frontendSuccess = runCommand('npm run build', {
      cwd: path.join(rootDir, 'frontend')
    });
    
    if (!frontendSuccess) {
      logError('前端构建失败！');
      process.exit(1);
    }
    logSuccess('前端构建完成');
  } else {
    logStep('2/4', '跳过前端构建');
  }

  // 步骤 3: 验证构建产物
  logStep('3/4', '验证构建产物...');
  
  const requiredFiles = [
    'dist/backend/sigma-backend.exe',
    'frontend/dist/index.html',
  ];
  
  let allFilesExist = true;
  for (const file of requiredFiles) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      logSuccess(`找到: ${file}`);
    } else {
      logError(`缺失: ${file}`);
      allFilesExist = false;
    }
  }
  
  if (!allFilesExist) {
    logError('构建产物验证失败！');
    process.exit(1);
  }

  // 步骤 4: 打包 Electron
  logStep('4/4', '打包 Electron 应用...');
  
  // 构建 electron-builder 命令
  let electronCmd = 'npx electron-builder';
  
  // 添加平台参数
  for (const platform of platforms) {
    const config = platformConfigs[platform];
    if (config) {
      electronCmd += ` ${config.electronTarget}`;
    }
  }
  
  // 添加架构参数（仅对 Windows 有效）
  if (platforms.includes('win') && archs.length > 0) {
    const archFlags = archs.map(a => `--${a}`).join(' ');
    electronCmd += ` ${archFlags}`;
  }
  
  log(`  执行命令: ${electronCmd}`, 'cyan');
  
  const electronSuccess = runCommand(electronCmd, {
    cwd: rootDir
  });
  
  if (!electronSuccess) {
    logError('Electron 打包失败！');
    process.exit(1);
  }
  logSuccess('Electron 打包完成');

  // 完成
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // 读取 package.json 获取版本号
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const version = packageJson.version;
  
  log('\n========================================', 'green');
  log('           打包完成！', 'bold');
  log('========================================', 'green');
  log(`\n耗时: ${duration} 秒`, 'cyan');
  log(`\n输出目录: release-dev-test/`, 'cyan');
  log(`版本: ${version}`, 'cyan');
  
  // 列出生成的文件
  const outputPath = path.join(rootDir, 'release-dev-test');
  if (fs.existsSync(outputPath)) {
    const files = fs.readdirSync(outputPath).filter(f => 
      f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.deb') || f.endsWith('.AppImage')
    );
    if (files.length > 0) {
      log('\n生成的安装包:', 'cyan');
      files.forEach(f => log(`  - ${f}`, 'green'));
    }
  }
  log('');
}

main().catch(err => {
  logError(`打包失败: ${err.message}`);
  process.exit(1);
});
