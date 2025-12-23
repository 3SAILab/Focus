# 打包部署文档

Focus 使用 electron-builder 进行跨平台打包。

## 构建流程

```mermaid
flowchart LR
    A[清理] --> B[构建前端]
    B --> C[构建后端]
    C --> D[验证构建]
    D --> E[打包 Electron]
    E --> F[输出安装包]
```

## 快速构建

```bash
# 完整构建（推荐）
npm run build

# 此命令会顺序执行：
# 1. npm run clean
# 2. npm run build:frontend
# 3. npm run build:backend:win
# 4. npm run validate:build
# 5. npm run build:electron
```

## 分步构建

### 1. 清理构建产物

```bash
npm run clean
```

清理目录：`dist/`, `release*/`, `frontend/dist/`

### 2. 构建前端

```bash
npm run build:frontend
```

输出：`frontend/dist/`

### 3. 构建后端

```bash
# Windows
npm run build:backend:win

# macOS
npm run build:backend:mac

# Linux
npm run build:backend:linux
```

输出：`dist/backend/sigma-backend[.exe]`

### 4. 验证构建

```bash
npm run validate:build
```

检查：
- `frontend/dist/index.html` 存在
- `dist/backend/sigma-backend.exe` 存在且大小合理

### 5. 打包 Electron

```bash
npm run build:electron
```

输出：`release-dev-*/`

## 平台配置

### Windows

```json
{
  "win": {
    "target": [{ "target": "nsis", "arch": ["x64"] }],
    "icon": "assets/focus.ico",
    "artifactName": "${productName}-${version}-${arch}.${ext}",
    "requestedExecutionLevel": "asInvoker"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "Focus"
  }
}
```

**输出文件：**
- `Focus-1.0.0-x64.exe` - NSIS 安装程序
- `win-unpacked/` - 未打包版本

### macOS

```json
{
  "mac": {
    "target": [{ "target": "dmg", "arch": ["x64", "arm64"] }],
    "icon": "assets/icon.icns",
    "category": "public.app-category.graphics-design",
    "hardenedRuntime": true
  },
  "dmg": {
    "contents": [
      { "x": 130, "y": 220 },
      { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
    ]
  }
}
```

**输出文件：**
- `Focus-1.0.0-x64.dmg` - Intel Mac
- `Focus-1.0.0-arm64.dmg` - Apple Silicon

### Linux

```json
{
  "linux": {
    "target": [{ "target": "AppImage", "arch": ["x64"] }],
    "icon": "assets/icon.png",
    "category": "Graphics"
  }
}
```

**输出文件：**
- `Focus-1.0.0-x64.AppImage`

## 文件包含配置

```json
{
  "files": [
    "electron/**/*",
    "frontend/dist/**/*",
    "!electron/**/*.test.js",
    "!**/.DS_Store"
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
  ]
}
```

## 安装包结构

### Windows 安装后

```
C:\Program Files\Focus\
├── Focus.exe                    # Electron 主程序
├── resources/
│   ├── app.asar                # 打包的应用代码
│   └── backend/
│       ├── sigma-backend.exe   # Go 后端
│       └── .env                # 环境配置
└── ...（Electron 运行时文件）
```

### 用户数据目录

Windows 安装后数据存储在安装目录下：

```
安装目录/data/
├── db/
│   ├── history.db              # 数据库
│   └── config.json             # 配置文件
├── output/                     # 生成的图片
├── uploads/                    # 上传的文件
├── logs/                       # 日志文件
└── temp/                       # 临时文件
```

## 版本更新机制

### version.json 配置

在 OSS 上维护 `version.json` 文件：

```json
{
  "versionCode": "202512221621",
  "versionName": "1.0.2",
  "updateContent": "1. 添加删除功能\n2. 优化了用户体验",
  "windowsUrl": "https://example.com/Focus-1.0.2.zip",
  "macX64Url": "https://example.com/Focus-1.0.2-x64.dmg",
  "macArm64Url": "https://example.com/Focus-1.0.2-arm64.dmg"
}
```

### 平台自动识别

应用启动时自动检测平台并提供正确的下载链接：
- Windows → `windowsUrl`
- Mac Intel → `macX64Url`
- Mac M1/M2 → `macArm64Url`

## 故障排除

### 构建失败：找不到 Go

```
'go' is not recognized as an internal or external command
```

**解决：** 安装 Go 并添加到 PATH

### 构建失败：前端构建错误

```
npm run build:frontend failed
```

**解决：**
1. 检查 Node.js 版本 >= 18
2. 删除 `frontend/node_modules` 重新安装
3. 检查 TypeScript 错误

### 构建失败：后端编译错误

```
go build failed
```

**解决：**
1. 检查 Go 版本 >= 1.21
2. 运行 `go mod tidy`
3. 检查 CGO 依赖（SQLite）

### 打包失败：electron-builder 错误

```
electron-builder failed
```

**解决：**
1. 运行 `npm run clean`
2. 删除 `node_modules` 重新安装
3. 检查 `validate:build` 是否通过

### 应用启动失败：后端无法启动

**检查：**
1. 后端可执行文件是否存在
2. 端口是否被占用（支持自动端口切换）
3. 查看日志文件

## 代码签名

### Windows

使用 EV 代码签名证书：

```bash
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your_password
npm run build:electron
```

### macOS

需要 Apple Developer 账号：

```bash
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
npm run build:electron
```

### 公证 (macOS)

```bash
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app-specific-password
export APPLE_TEAM_ID=your_team_id
npm run build:electron
```

## 发布检查清单

- [ ] 更新 `package.json` 版本号
- [ ] 更新 `version.json` 版本信息和下载链接
- [ ] 准备所有平台图标
- [ ] 运行完整构建 `npm run build`
- [ ] 测试安装程序
- [ ] 测试应用功能
- [ ] 测试版本更新提示
- [ ] 检查日志无错误
- [ ] 上传安装包到 OSS
- [ ] 更新 OSS 上的 version.json
- [ ] 准备发布说明
- [ ] （可选）代码签名
- [ ] （可选）macOS 公证

## 自动化构建

### GitHub Actions 示例

```yaml
name: Build

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: release-${{ matrix.os }}
          path: release*/
```
