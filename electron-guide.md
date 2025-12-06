# Electron 打包指南

## 项目结构分析

### 当前架构
- **前端**: React + TypeScript + Vite (端口 5174)
- **后端**: Go + Gin (端口 8080)
- **数据库**: SQLite (history.db)
- **静态资源**: output/ (生成图片), uploads/ (参考图)

## 关键注意事项

### 1. **API 地址问题** ⚠️
- 前端硬编码了 `http://localhost:8080`
- 后端返回的图片 URL 也硬编码了 `http://localhost:8080`
- **解决方案**: 需要改为动态获取或使用环境变量

### 2. **文件路径问题** ⚠️
- 数据库路径: `history.db` (相对路径)
- 输出目录: `./output` (相对路径)
- 上传目录: `./uploads` (相对路径)
- **解决方案**: 使用 Electron 的 `app.getPath('userData')` 获取应用数据目录

### 3. **后端进程管理** ⚠️
- 需要在 Electron 主进程中启动 Go 后端
- 需要处理后端进程的生命周期（启动、关闭）
- 需要检测端口是否被占用

### 4. **静态资源服务** ⚠️
- 后端需要服务静态文件（图片）
- 在 Electron 中可能需要调整路径

### 5. **环境变量** ⚠️
- API_KEY 需要从 .env 文件读取
- 打包时需要包含或配置环境变量

### 6. **CORS 问题** ⚠️
- 在 Electron 中，如果使用 file:// 协议，CORS 可能有问题
- 建议使用 http://localhost 或自定义协议

### 7. **打包大小** ⚠️
- Go 可执行文件需要为不同平台编译（Windows, macOS, Linux）
- 前端打包后的文件需要包含在 Electron 中

## 推荐方案

### 方案 A: 使用 electron-builder (推荐)
- 支持多平台打包
- 自动处理依赖
- 支持自动更新

### 方案 B: 使用 electron-forge
- 官方推荐
- 配置简单

## 需要修改的文件

1. **前端 API 配置** (`frontend/src/api/index.ts`)
   - 改为动态获取 API 地址

2. **后端路径配置** (`backend/main.go`)
   - 使用环境变量或参数配置路径
   - 修改硬编码的 localhost:8080

3. **创建 Electron 主进程文件**
   - 启动后端进程
   - 创建窗口
   - 处理 IPC 通信

4. **创建 Electron 配置文件**
   - package.json 配置
   - electron-builder 配置

