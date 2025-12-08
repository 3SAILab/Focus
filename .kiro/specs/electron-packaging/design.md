# Design Document

## Overview

本设计文档描述了 SIGMA Electron 应用打包系统的改进方案，重点解决当前打包配置中存在的路径管理、资源文件访问和环境隔离问题。通过参考 electron-demo-dst 项目的最佳实践，优化后端可执行文件的路径解析、简化资源文件管理、改进开发/生产环境的隔离机制。

核心改进：
- 简化后端可执行文件路径管理（直接从 resources 运行，不再复制）
- 使用标准的用户数据目录（app.getPath('userData')）
- 优化 electron-builder 配置确保所有文件正确打包
- 改进开发和生产环境的路径解析逻辑
- 增强错误处理和日志记录
- 移除不必要的调试对话框

## Architecture

### 路径管理架构改进

**当前问题：**
- 生产环境将后端从 `process.resourcesPath/backend` 复制到 `user-data/backend`，增加复杂性
- 用户数据目录使用 `path.dirname(app.getPath('exe'))` 不符合操作系统规范
- 开发和生产环境路径解析逻辑复杂且容易出错

**改进方案：**

```
开发环境路径结构：
project-root/
├── dist/backend/
│   └── sigma-backend.exe          # 后端可执行文件
├── frontend/dist/                  # 前端构建产物
└── electron/                       # Electron 主进程

生产环境路径结构：
app-installation/
├── SIGMA.exe                       # Electron 主程序
└── resources/
    ├── app.asar                    # 打包的应用代码（包含 electron/ 和 frontend/dist/）
    └── backend/
        └── sigma-backend.exe       # 后端可执行文件（extraResources）

用户数据目录（标准位置）：
Windows: C:\Users\<user>\AppData\Roaming\SIGMA\
macOS: ~/Library/Application Support/SIGMA/
Linux: ~/.config/SIGMA/
├── output/                         # 生成的图片
├── uploads/                        # 上传的文件
├── db/                            # 数据库
├── temp/                          # 临时文件
├── certs/                         # TLS 证书
└── logs/                          # 日志文件
```

### 核心改进点

1. **后端直接从 resources 运行**
   - 开发环境：`project-root/dist/backend/sigma-backend.exe`
   - 生产环境：`process.resourcesPath/backend/sigma-backend.exe`
   - 不再复制到用户数据目录

2. **使用标准用户数据目录**
   - 使用 `app.getPath('userData')` 获取平台标准路径
   - 所有用户数据（数据库、上传、输出）存储在此目录

3. **简化环境判断**
   - 使用 `app.isPackaged` 替代 `NODE_ENV` 判断
   - 更可靠的打包状态检测

## Components and Interfaces

### 1. 改进的路径管理模块

**新增文件**: `electron/path-manager.js`

**职责**：
- 统一管理所有路径解析逻辑
- 区分开发和生产环境
- 提供路径验证功能

**接口**：

```javascript
class PathManager {
  constructor(app) {
    this.app = app;
    this.isPackaged = app.isPackaged;
  }
  
  // 获取后端可执行文件路径
  getBackendExecutablePath(): string
  
  // 获取用户数据目录
  getUserDataPath(): string
  
  // 获取前端资源路径
  getFrontendPath(): string
  
  // 验证路径是否存在
  validatePath(path: string): boolean
  
  // 获取所有路径信息（用于调试）
  getAllPaths(): PathInfo
}
```

### 2. 改进的 Electron Main Process

**文件**: `electron/main.js`

**主要改进**：

```javascript
// 使用 app.isPackaged 判断环境
const isDev = !app.isPackaged;

// 使用标准用户数据目录
const userDataPath = app.getPath('userData');

// 简化后端路径解析
function getBackendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'dist', 'backend', 'sigma-backend.exe');
  } else {
    return path.join(process.resourcesPath, 'backend', 'sigma-backend.exe');
  }
}

// 移除复制逻辑，直接运行
async function startBackend() {
  const backendExe = getBackendPath();
  
  // 验证文件存在
  if (!fs.existsSync(backendExe)) {
    throw new Error(`Backend executable not found: ${backendExe}`);
  }
  
  // 直接启动，不复制
  backendProcess = spawn(backendExe, [], {
    env: { ...process.env, ...backendEnv },
    cwd: path.dirname(backendExe),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
}
```

### 3. TLS Certificate Manager（保持不变）

**文件**: `electron/tls-manager.js`

TLS 管理器保持现有实现，但证书存储位置改为标准用户数据目录：

```javascript
class TLSManager {
  constructor(userDataPath) {
    // userDataPath 现在使用 app.getPath('userData')
    this.certsDir = path.join(userDataPath, 'certs');
  }
  
  async initialize(): Promise<{certPath: string, keyPath: string}>
  getCertificatePaths(): {certPath: string, keyPath: string}
  certificateExists(): boolean
}
```

### 4. 改进的错误处理和日志

**文件**: `electron/logger.js`（新增）

**职责**：
- 统一日志管理
- 区分开发和生产环境的日志级别
- 提供结构化日志输出

```javascript
class Logger {
  constructor(userDataPath, isDev) {
    this.logPath = path.join(userDataPath, 'logs', 'app.log');
    this.isDev = isDev;
  }
  
  log(level: string, component: string, message: string, data?: any): void
  error(component: string, error: Error, context?: any): void
  debug(component: string, message: string, data?: any): void
  
  // 获取日志文件路径（用于错误对话框）
  getLogPath(): string
}
```

### 5. 调试信息管理

**改进**：
- 移除生产环境的调试对话框
- 仅在开发模式或启动失败时显示详细信息
- 提供日志文件路径供用户查看

```javascript
// 仅在开发模式显示调试信息
if (isDev) {
  console.log('[Debug] Path Information:', {
    __dirname,
    resourcesPath: process.resourcesPath,
    userDataPath,
    backendPath: getBackendPath()
  });
}

// 启动失败时提供有用信息
function showStartupError(error) {
  const { dialog } = require('electron');
  dialog.showErrorBox(
    'Application Startup Failed',
    `Failed to start SIGMA:\n\n${error.message}\n\nLog file: ${logger.getLogPath()}`
  );
}
```

### 6. 改进的构建系统

**文件**: `package.json`

**改进的构建脚本**：

```json
{
  "scripts": {
    "dev": "cross-env NODE_ENV=development electron .",
    "build": "npm run build:sequential",
    "build:sequential": "npm run build:frontend && npm run build:backend:win && npm run build:electron",
    "build:frontend": "cd frontend && npm run build && cd ..",
    "build:backend:win": "cd backend && go build -ldflags=\"-s -w\" -o ../dist/backend/sigma-backend.exe . && cd ..",
    "build:backend:mac": "cd backend && GOOS=darwin GOARCH=amd64 go build -ldflags=\"-s -w\" -o ../dist/backend/sigma-backend . && cd ..",
    "build:backend:linux": "cd backend && GOOS=linux GOARCH=amd64 go build -ldflags=\"-s -w\" -o ../dist/backend/sigma-backend . && cd ..",
    "build:electron": "electron-builder",
    "clean": "rimraf dist release* frontend/dist",
    "prebuild": "npm run clean"
  }
}
```

**关键改进**：
1. 使用 `&&` 确保顺序执行（前一步失败则停止）
2. 添加 `-ldflags="-s -w"` 减小后端可执行文件大小
3. 添加 `clean` 和 `prebuild` 脚本确保干净构建
4. 使用 `rimraf` 跨平台删除文件

## Data Models

### 路径信息模型

```typescript
// electron/types.ts
interface PathInfo {
  // 环境信息
  isPackaged: boolean
  isDev: boolean
  platform: string
  
  // 核心路径
  appPath: string              // 应用根目录
  resourcesPath: string        // resources 目录
  userDataPath: string         // 用户数据目录
  
  // 后端相关
  backendExecutable: string    // 后端可执行文件完整路径
  backendWorkingDir: string    // 后端工作目录
  
  // 前端相关
  frontendPath: string         // 前端资源路径
  
  // 用户数据子目录
  outputDir: string            // 输出目录
  uploadsDir: string           // 上传目录
  dbDir: string                // 数据库目录
  tempDir: string              // 临时目录
  certsDir: string             // 证书目录
  logsDir: string              // 日志目录
}
```

### 改进的 Electron Builder 配置

```json
{
  "build": {
    "appId": "com.sigma.app",
    "productName": "SIGMA",
    "directories": {
      "output": "release",
      "buildResources": "assets"
    },
    "files": [
      "electron/**/*",
      "frontend/dist/**/*",
      "!electron/**/*.test.js",
      "!electron/**/*.test.ts",
      "!**/.DS_Store",
      "!**/.git*",
      "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
      "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
      "!**/node_modules/*.d.ts",
      "!**/node_modules/.bin"
    ],
    "extraResources": [
      {
        "from": "dist/backend",
        "to": "backend",
        "filter": ["**/*"]
      }
    ],
    "asarUnpack": [
      "node_modules/node-forge/**/*"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "assets/icon.ico",
      "artifactName": "${productName}-${version}-${arch}.${ext}",
      "requestedExecutionLevel": "asInvoker"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "allowElevation": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "SIGMA",
      "deleteAppDataOnUninstall": false,
      "runAfterFinish": true
    }
  }
}
```

**关键改进**：
1. 更严格的 `files` 过滤规则，排除不必要的文件
2. 添加 `requestedExecutionLevel: "asInvoker"` 避免不必要的管理员权限请求
3. 保持 `extraResources` 配置将后端复制到 resources/backend

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Backend Path Resolution Consistency
*For any* environment (development or production), the backend executable path should resolve correctly and the file should exist before attempting to spawn the process.
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: User Data Directory Standards Compliance
*For any* platform (Windows, macOS, Linux), the user data directory should be located at the platform-specific standard location returned by `app.getPath('userData')`.
**Validates: Requirements 3.1, 3.2, 3.3**

### Property 3: Resource File Accessibility
*For any* resource file access (frontend, backend, assets), the path resolution should correctly handle both ASAR-packed and unpacked scenarios.
**Validates: Requirements 3.1, 3.2, 3.4**

### Property 4: Build Artifact Completeness
*For any* successful build, the output package should contain all required files: frontend dist in ASAR, backend executable in extraResources, and all assets.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 5: Environment Isolation
*For any* code path that depends on environment, the behavior should be determined by `app.isPackaged` and should not require manual environment variable configuration.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Backend Process Lifecycle
*For any* application startup, the backend process should spawn from the correct location without requiring file copying operations.
**Validates: Requirements 1.1, 1.2, 5.1, 5.2**

### Property 7: Error Reporting Clarity
*For any* startup failure, the error message should include the expected path, actual path, and log file location for debugging.
**Validates: Requirements 1.4, 7.1, 7.2, 7.3, 10.1, 10.2**

### Property 8: Debug Information Visibility
*For any* production build, debug dialogs should not be displayed unless a critical error occurs that prevents application startup.
**Validates: Requirements 4.4, 7.5, 10.1**

## Error Handling

### 1. 后端可执行文件未找到

**场景**: 后端可执行文件路径解析失败或文件不存在

**改进的处理策略**:
```javascript
function validateBackendPath(backendPath) {
  if (!fs.existsSync(backendPath)) {
    const errorInfo = {
      message: 'Backend executable not found',
      expectedPath: backendPath,
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      __dirname: __dirname,
      suggestions: [
        'Verify the application was built correctly',
        'Check if antivirus software quarantined the file',
        'Try reinstalling the application'
      ]
    };
    
    logger.error('Backend', new Error('Backend not found'), errorInfo);
    
    dialog.showErrorBox(
      'Backend Service Missing',
      `Cannot find backend executable:\n${backendPath}\n\nLog file: ${logger.getLogPath()}`
    );
    
    throw new Error(`Backend executable not found: ${backendPath}`);
  }
}
```

### 2. 用户数据目录访问失败

**场景**: 无法创建或访问用户数据目录

**处理策略**:
```javascript
function ensureUserDataDirectory() {
  const userDataPath = app.getPath('userData');
  
  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // 测试写入权限
    const testFile = path.join(userDataPath, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    return userDataPath;
  } catch (error) {
    dialog.showErrorBox(
      'Permission Error',
      `Cannot access user data directory:\n${userDataPath}\n\nError: ${error.message}`
    );
    throw error;
  }
}
```

### 3. 构建验证失败

**场景**: 构建产物不完整或配置错误

**处理策略**:
- 在构建脚本中添加验证步骤
- 检查必需文件是否存在
- 验证文件大小合理性

```javascript
// build-validate.js
function validateBuild() {
  const requiredFiles = [
    'dist/backend/sigma-backend.exe',
    'frontend/dist/index.html',
    'assets/icon.ico'
  ];
  
  const missing = requiredFiles.filter(f => !fs.existsSync(f));
  
  if (missing.length > 0) {
    console.error('Build validation failed. Missing files:');
    missing.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }
  
  console.log('✓ Build validation passed');
}
```

### 4. 环境检测失败

**场景**: 无法正确判断开发/生产环境

**处理策略**:
```javascript
function getEnvironmentInfo() {
  const info = {
    isPackaged: app.isPackaged,
    isDev: !app.isPackaged,
    nodeEnv: process.env.NODE_ENV,
    execPath: process.execPath,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath()
  };
  
  // 记录环境信息用于调试
  logger.debug('Environment', 'Environment detection', info);
  
  return info;
}
```

### 5. 日志文件访问失败

**场景**: 无法写入日志文件

**处理策略**:
```javascript
function initializeLogger() {
  try {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    return new Logger(logsDir);
  } catch (error) {
    // 降级到控制台日志
    console.warn('Cannot initialize file logging, using console only:', error.message);
    return new ConsoleLogger();
  }
}
```

## Testing Strategy

### Unit Testing

**前端单元测试**:
- API 客户端函数（模拟 fetch）
- Electron API 集成（模拟 window.electronAPI）
- 组件渲染和交互

**后端单元测试**:
- TLS 证书生成和加载
- 配置初始化
- 路径工具函数

**Electron 主进程测试**:
- 后端进程启动（模拟 child_process）
- IPC 处理器注册和响应
- 窗口创建和生命周期

**测试框架**: Vitest（前端）、Go testing（后端）、Jest（Electron）

### Integration Testing

**端到端场景**:
1. 应用启动 → 后端启动 → 前端加载 → API 调用
2. TLS 证书生成 → HTTPS 服务器启动 → 安全请求
3. 应用关闭 → 后端终止 → 清理
4. 构建过程 → 包生成 → 安装

**测试工具**: Playwright 或 Spectron

### Property-Based Testing

**测试库**: fast-check（JavaScript/TypeScript）

**属性测试**:
1. **后端进程管理**: 对于任何启动序列，后端应达到健康状态
2. **路径解析**: 对于任何用户数据路径，解析的路径应在用户目录内
3. **TLS 证书**: 对于任何生成的证书，它应对 localhost 有效
4. **IPC 安全**: 对于任何 IPC 调用，它不应暴露 Node.js API

**配置**: 每个属性测试最少 100 次迭代

### Build Testing

**场景**:
- 从头开始的干净构建
- 增量构建
- 跨平台构建
- 不同配置的构建（开发 vs 生产）

**验证**:
- 包大小在预期范围内
- 包中存在所有必需文件
- 可执行文件权限正确
- 安装和卸载正常工作

## Implementation Notes

### 关键改进点总结

#### 1. 路径管理简化

**之前的问题**:
```javascript
// 复杂的复制逻辑
const sourceBackendPath = path.join(process.resourcesPath, 'backend');
const targetBackendPath = path.join(userDataPath, 'backend');
// ... 复制文件 ...
```

**改进后**:
```javascript
// 直接使用，无需复制
function getBackendPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'sigma-backend.exe')
    : path.join(__dirname, '..', 'dist', 'backend', 'sigma-backend.exe');
}
```

#### 2. 用户数据目录标准化

**之前的问题**:
```javascript
// 非标准位置
const userDataPath = path.join(path.dirname(app.getPath('exe')), 'user-data');
```

**改进后**:
```javascript
// 使用平台标准位置
const userDataPath = app.getPath('userData');
// Windows: C:\Users\<user>\AppData\Roaming\SIGMA
// macOS: ~/Library/Application Support/SIGMA
// Linux: ~/.config/SIGMA
```

#### 3. 环境判断改进

**之前的问题**:
```javascript
const isDev = process.env.NODE_ENV === 'development';
```

**改进后**:
```javascript
const isDev = !app.isPackaged;
// 更可靠，不依赖环境变量
```

#### 4. 调试信息控制

**之前的问题**:
```javascript
// 生产环境也显示调试对话框
if (!isDev) {
  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '调试信息',
    message: debugInfo
  });
}
```

**改进后**:
```javascript
// 仅在开发模式或失败时显示
if (isDev) {
  logger.debug('Paths', 'Path information', pathInfo);
}

// 失败时提供有用信息
if (startupFailed) {
  dialog.showErrorBox('Startup Failed', 
    `Error: ${error.message}\n\nLog: ${logger.getLogPath()}`);
}
```

### 构建流程改进

#### 构建顺序保证

```json
{
  "scripts": {
    "build": "npm run build:sequential",
    "build:sequential": "npm run build:frontend && npm run build:backend:win && npm run build:electron",
    "prebuild": "npm run clean",
    "clean": "rimraf dist release* frontend/dist"
  }
}
```

**关键点**:
1. 使用 `&&` 确保顺序执行
2. 添加 `prebuild` 清理旧文件
3. 每步失败则停止构建

#### 构建验证

```javascript
// 在 build:electron 之前验证
"prebuild:electron": "node scripts/validate-build.js"
```

### 测试策略

#### 路径解析测试

```javascript
describe('Path Resolution', () => {
  test('should resolve backend path correctly in dev mode', () => {
    const pathManager = new PathManager(mockApp, false);
    const backendPath = pathManager.getBackendExecutablePath();
    expect(fs.existsSync(backendPath)).toBe(true);
  });
  
  test('should resolve backend path correctly in production mode', () => {
    const pathManager = new PathManager(mockApp, true);
    const backendPath = pathManager.getBackendExecutablePath();
    expect(backendPath).toContain('resources');
  });
});
```

#### 构建产物验证测试

```javascript
describe('Build Artifacts', () => {
  test('should include all required files', () => {
    const requiredFiles = [
      'resources/backend/sigma-backend.exe',
      'resources/app.asar'
    ];
    
    requiredFiles.forEach(file => {
      expect(fs.existsSync(path.join(appPath, file))).toBe(true);
    });
  });
});
```

### 迁移指南

从当前实现迁移到改进版本的步骤：

1. **更新 main.js 路径逻辑**
   - 移除后端复制代码
   - 使用 `app.isPackaged` 替代 `NODE_ENV`
   - 使用 `app.getPath('userData')`

2. **更新 package.json 构建脚本**
   - 改为顺序执行（`&&`）
   - 添加清理和验证步骤

3. **移除调试对话框**
   - 删除生产环境的调试对话框代码
   - 仅在失败时显示错误信息

4. **测试验证**
   - 在开发模式测试
   - 构建并测试生产版本
   - 验证所有路径正确解析

5. **更新文档**
   - 更新 BUILD.md 反映新的构建流程
   - 更新 README.md 说明新的路径结构
