# Electron 打包完整指南

## 📋 项目结构分析

你的项目是一个**前后端分离**的应用：
- **前端**: React + TypeScript + Vite
- **后端**: Go + Gin + SQLite
- **通信**: HTTP REST API

## ⚠️ 关键注意事项

### 1. **API 地址问题** ✅ 已修复
- ✅ 前端改为动态获取 API 地址
- ✅ 后端改为使用环境变量配置端口和 URL
- ✅ 支持 Electron IPC 通信获取后端地址

### 2. **文件路径问题** ✅ 已修复
- ✅ 数据库路径使用环境变量 `DB_PATH`
- ✅ 输出目录使用环境变量 `OUTPUT_DIR`
- ✅ 上传目录使用环境变量 `UPLOAD_DIR`
- ✅ Electron 中使用用户数据目录

### 3. **后端进程管理** ✅ 已实现
- ✅ Electron 主进程自动启动后端
- ✅ 处理进程生命周期（启动、关闭）
- ✅ 健康检查机制

### 4. **静态资源服务** ✅ 已处理
- ✅ 后端静态文件服务路径可配置
- ✅ 图片 URL 动态生成

### 5. **环境变量** ⚠️ 需要配置
- ⚠️ 需要在 `.env` 文件中配置 `API_KEY`
- ⚠️ 打包时需要处理环境变量

### 6. **跨平台编译** ⚠️ 需要注意
- ⚠️ Windows: 需要编译 `.exe`
- ⚠️ macOS: 需要编译 macOS 版本
- ⚠️ Linux: 需要编译 Linux 版本

## 🚀 快速开始

### 步骤 1: 安装依赖

```bash
# 项目根目录
npm install

# 前端依赖
cd frontend && npm install && cd ..

# 后端依赖（Go 自动管理）
cd backend && go mod download && cd ..
```

### 步骤 2: 配置环境变量

在 `backend` 目录创建 `.env` 文件：

```env
API_KEY=your_api_key_here
```

### 步骤 3: 开发模式

```bash
# 终端 1: 前端开发服务器
cd frontend
npm run dev

# 终端 2: 后端服务
cd backend
go run main.go

# 终端 3: Electron
npm run electron:dev
```

### 步骤 4: 打包应用

#### Windows
```bash
# 1. 编译后端（Windows）
cd backend
go build -o ../dist/sigma-backend.exe main.go
cd ..

# 2. 打包前端
cd frontend
npm run build
cd ..

# 3. 打包 Electron
npm run electron:build
```

#### macOS
```bash
# 1. 编译后端（macOS）
cd backend
GOOS=darwin GOARCH=amd64 go build -o ../dist/sigma-backend-mac main.go
cd ..

# 2. 打包前端
cd frontend
npm run build
cd ..

# 3. 打包 Electron
npm run electron:build
```

#### Linux
```bash
# 1. 编译后端（Linux）
cd backend
GOOS=linux GOARCH=amd64 go build -o ../dist/sigma-backend-linux main.go
cd ..

# 2. 打包前端
cd frontend
npm run build
cd ..

# 3. 打包 Electron
npm run electron:build
```

## 📁 文件说明

### 新增文件

1. **`package.json`** (根目录)
   - Electron 主配置
   - 打包脚本
   - electron-builder 配置

2. **`electron/main.js`**
   - Electron 主进程
   - 启动后端服务
   - 创建窗口
   - IPC 通信

3. **`electron/preload.js`**
   - 预加载脚本
   - 暴露安全的 API 给渲染进程

4. **`frontend/src/types/electron.d.ts`**
   - TypeScript 类型定义

### 修改的文件

1. **`backend/main.go`**
   - ✅ 支持环境变量配置
   - ✅ 动态端口和 URL
   - ✅ 可配置的文件路径

2. **`frontend/src/api/index.ts`**
   - ✅ 动态获取 API 地址
   - ✅ 支持 Electron IPC

## 🔧 配置说明

### Electron Builder 配置

在 `package.json` 的 `build` 字段中配置了：
- 应用 ID: `com.sigma.app`
- 产品名称: `SIGMA`
- 输出目录: `release/`
- 各平台的打包配置

### 环境变量

后端支持以下环境变量：
- `API_KEY`: Gemini API 密钥
- `OUTPUT_DIR`: 输出目录（默认: `./output`）
- `UPLOAD_DIR`: 上传目录（默认: `./uploads`）
- `DB_PATH`: 数据库路径（默认: `./history.db`）
- `PORT`: 服务端口（默认: `8080`）
- `BASE_URL`: 基础 URL（用于生成图片链接）

## 🐛 常见问题

### 1. 后端启动失败
- 检查端口 8080 是否被占用
- 检查 API_KEY 是否配置
- 查看 Electron 控制台错误信息

### 2. 前端无法连接后端
- 确认后端已启动
- 检查 IPC 通信是否正常
- 查看浏览器控制台错误

### 3. 打包失败
- 确保所有依赖已安装
- 检查 Go 编译是否成功
- 查看 electron-builder 日志

### 4. 图片无法显示
- 检查文件路径是否正确
- 确认静态文件服务正常
- 查看网络请求

## 📦 打包输出

打包后的文件位于 `release/` 目录：
- **Windows**: `SIGMA Setup x.x.x.exe` (NSIS 安装包)
- **macOS**: `SIGMA-x.x.x.dmg` (磁盘镜像)
- **Linux**: `SIGMA-x.x.x.AppImage` (可执行文件)

## 🔐 安全注意事项

1. **API_KEY**: 不要提交到 Git
2. **环境变量**: 使用 `.env` 文件（已加入 .gitignore）
3. **IPC 通信**: 使用 contextBridge 确保安全
4. **文件路径**: 使用用户数据目录，避免权限问题

## 📝 后续优化建议

1. **自动更新**: 集成 electron-updater
2. **错误报告**: 集成 Sentry 等错误追踪
3. **日志系统**: 添加日志文件记录
4. **配置界面**: 添加设置界面配置 API_KEY
5. **多语言**: 支持国际化

