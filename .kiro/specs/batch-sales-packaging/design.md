# Design Document: Batch Sales Packaging

## Overview

批量销售打包系统是一个 Node.js 脚本，用于自动化为多个销售人员生成独立的 Electron 应用安装包。脚本扫描 `frontend/dist` 目录下的销售二维码图片，为每个销售生成包含其专属二维码的安装包。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    batch-build.js                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Scanner   │  │   Builder   │  │   Progress Logger   │  │
│  │             │  │             │  │                     │  │
│  │ - findQR()  │  │ - prepare() │  │ - logStart()        │  │
│  │ - extract() │  │ - build()   │  │ - logProgress()     │  │
│  │             │  │ - restore() │  │ - logSummary()      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ electron-builder│
                    └─────────────────┘
```

## Components and Interfaces

### 1. Scanner Module

负责扫描和解析销售二维码文件。

```javascript
/**
 * 扫描 frontend/dist 目录，查找所有销售二维码图片
 * @returns {string[]} 销售名称数组，如 ['dyf', 'lyq', 'mzl']
 */
function findSalesQRImages() {}

/**
 * 从文件名提取销售名称
 * @param {string} filename - 文件名，如 'dyf_wxchat.jpg'
 * @returns {string} 销售名称，如 'dyf'
 */
function extractSalesName(filename) {}
```

### 2. Builder Module

负责准备文件和执行打包。

```javascript
/**
 * 准备打包环境：复制销售二维码为标准文件名
 * @param {string} salesName - 销售名称
 * @returns {Promise<void>}
 */
async function prepareBuild(salesName) {}

/**
 * 执行 electron-builder 打包
 * @param {string} salesName - 销售名称
 * @param {string} outputDir - 输出目录
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function runBuild(salesName, outputDir) {}

/**
 * 恢复原始的 sales_wxchat.jpg 文件（如果存在备份）
 * @returns {Promise<void>}
 */
async function restoreOriginal() {}
```

### 3. Progress Logger

负责显示打包进度和状态。

```javascript
/**
 * 显示开始信息
 * @param {string[]} salesList - 销售名称列表
 */
function logStart(salesList) {}

/**
 * 显示当前进度
 * @param {number} current - 当前索引（从1开始）
 * @param {number} total - 总数
 * @param {string} salesName - 当前销售名称
 */
function logProgress(current, total, salesName) {}

/**
 * 显示完成摘要
 * @param {string[]} successful - 成功的销售列表
 * @param {Array<{name: string, error: string}>} failed - 失败的销售列表
 */
function logSummary(successful, failed) {}
```

## Data Models

### Build Result

```typescript
interface BuildResult {
  salesName: string;
  success: boolean;
  outputDir: string;
  error?: string;
  duration: number; // 毫秒
}

interface BatchBuildSummary {
  total: number;
  successful: string[];
  failed: Array<{name: string, error: string}>;
  totalDuration: number;
}
```

### Configuration

```typescript
interface BatchBuildConfig {
  distDir: string;        // frontend/dist
  qrPattern: string;      // *_wxchat.jpg
  standardQRName: string; // sales_wxchat.jpg
  outputPrefix: string;   // release-
  singleSales?: string;   // 可选：只打包指定销售
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: QR Image Scanning and Name Extraction

*For any* directory containing files, the scanner SHALL return only files matching the pattern `*_wxchat.jpg`, and *for any* matching filename, the extracted sales name SHALL be the substring before `_wxchat.jpg`.

**Validates: Requirements 1.1, 1.2**

### Property 2: Output Directory Formatting

*For any* sales name, the output directory SHALL be formatted as `release-{salesName}/` where `{salesName}` is the exact sales name extracted from the QR image filename.

**Validates: Requirements 2.1**

### Property 3: Progress Message Formatting

*For any* batch build with N sales representatives, when processing the Kth sales representative (1 ≤ K ≤ N), the progress message SHALL contain the format "K/N" and the current sales name.

**Validates: Requirements 3.2**

### Property 4: Single Sales Filtering

*For any* batch build with a specified sales name parameter, the build process SHALL only process that single sales representative and skip all others.

**Validates: Requirements 4.1**

## Error Handling

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| No QR images found | 显示错误信息并退出，列出期望的文件格式 |
| Specified sales not found | 显示错误信息，列出所有可用的销售名称 |
| File copy failure | 记录错误，跳过当前销售，继续下一个 |
| electron-builder failure | 记录错误详情，跳过当前销售，继续下一个 |
| Restore failure | 记录警告，不影响整体流程 |

## Testing Strategy

### Property-Based Testing

使用 `fast-check` 库进行属性测试：

1. **文件名解析属性测试**: 生成随机的有效/无效文件名，验证解析逻辑
2. **输出目录格式属性测试**: 生成随机销售名称，验证目录格式
3. **进度消息格式属性测试**: 生成随机的 current/total 组合，验证消息格式

### Unit Testing

使用 Jest 进行单元测试：

1. Scanner 模块测试
2. Builder 模块测试（使用 mock）
3. Progress Logger 测试

### Integration Testing

1. 端到端测试：使用测试用的 QR 图片执行完整流程
2. 验证生成的安装包目录结构
