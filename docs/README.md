# Focus - AI 图片生成桌面应用

Focus 是一款基于 AI 的图片生成桌面应用，支持多种电商场景的图片处理，包括创意生成、白底图、换装、商品图和光影融合等功能。

**当前版本**: 1.0.2

## 主要功能

- **AI 创意工坊**: 文本生成图片、图生图、多图批量生成
- **白底图生成**: 一键去除背景，生成电商白底图
- **一键换装**: AI 智能换装功能
- **商品图生成**: 产品场景图生成
- **光影融合**: 产品光影效果处理
- **任务恢复**: 页面刷新后自动恢复进行中的任务
- **历史记录**: 完整的生成历史管理

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **桌面框架** | Electron | 33.x |
| **前端** | React + TypeScript | 19.x / 5.x |
| **构建工具** | Vite | 7.x |
| **样式** | TailwindCSS | 4.x |
| **后端** | Go + Gin | 1.25 / 1.11 |
| **数据库** | SQLite + GORM | - |
| **打包** | electron-builder | 25.x |
| **AI 模型** | Google Gemini | gemini-3-pro-image-preview |

## 项目结构

```
focus/
├── electron/                 # Electron 主进程
│   ├── main.js              # 主进程入口
│   ├── preload.js           # 预加载脚本
│   └── tls-manager.js       # TLS 证书管理
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── api/             # API 客户端
│   │   ├── components/      # React 组件
│   │   │   └── common/      # 公共组件
│   │   ├── context/         # React Context（含 GlobalTaskContext）
│   │   ├── hooks/           # 自定义 Hooks（含 useTaskRecovery）
│   │   ├── layout/          # 布局组件
│   │   ├── router/          # 路由配置
│   │   ├── type/            # 类型定义
│   │   ├── utils/           # 工具函数
│   │   └── views/           # 页面视图
│   └── dist/                # 构建输出
├── backend/                  # Go 后端
│   ├── main.go              # 服务入口
│   ├── handlers/            # HTTP 处理器
│   ├── models/              # 数据模型（含异步任务模型）
│   ├── config/              # 配置管理
│   ├── server/              # TLS 服务器
│   └── utils/               # 工具函数
├── assets/                   # 应用图标
├── build/                    # 构建配置
├── scripts/                  # 构建脚本
├── docs/                     # 项目文档
│   ├── frontend/            # 前端文档
│   ├── backend/             # 后端文档
│   ├── electron/            # Electron 文档
│   └── ui/                  # UI 文档
├── .github/workflows/        # GitHub Actions 工作流
└── release*/                 # 打包输出
```

## 快速开始

### 环境要求

- Node.js 18.x+
- Go 1.21+
- npm 9.x+

### 安装依赖

```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 配置 API Key

应用需要 Google Gemini API Key，可通过以下方式配置：

1. **应用内设置**（推荐）：启动应用后在设置中配置
2. **环境变量**：设置 `GEMINI_API_KEY=your_key`
3. **配置文件**：在 `backend/.env` 中设置

### 开发模式

```bash
# 启动开发模式（自动启动前端、后端和 Electron）
npm run dev
```

开发模式下：
- 前端运行在 Vite 开发服务器（支持热更新）
- 后端运行在 HTTP 模式（本地通信无需 HTTPS）
- Electron 开启 DevTools
- 支持自动端口发现（默认 8080，如被占用自动切换）

### 构建应用

```bash
# 完整构建（前端 + 后端 + 打包）
npm run build

# 仅构建前端
npm run build:frontend

# 仅构建后端（Windows）
npm run build:backend:win
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式运行 |
| `npm run build` | 完整构建 |
| `npm run build:frontend` | 构建前端 |
| `npm run build:backend:win` | 构建 Windows 后端 |
| `npm run build:backend:mac` | 构建 macOS 后端 |
| `npm run build:backend:linux` | 构建 Linux 后端 |
| `npm run build:electron` | 打包 Electron |
| `npm run clean` | 清理构建产物 |
| `npm test` | 运行测试 |

## 文档索引

- [系统架构](./ARCHITECTURE.md) - 三层架构详解
- [前端文档](./frontend/README.md) - 前端开发指南
- [后端文档](./backend/README.md) - 后端开发指南
- [Electron 文档](./electron/README.md) - Electron 开发指南
- [UI 文档](./ui/LAYOUT.md) - 布局和设计规范

## 贡献指南

### Git 工作流

1. Fork 项目仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: add new feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 创建 Pull Request

### 提交规范

使用 Conventional Commits 格式：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式
- `refactor:` 重构
- `test:` 测试
- `chore:` 构建/工具

### 编码规范

- **前端**：遵循 ESLint 配置，使用 TypeScript 严格模式
- **后端**：遵循 Go 标准格式（`go fmt`）
- **提交前**：确保所有测试通过

## 许可证

Copyright © 2025 希革马（宁波市）人工智能有限责任公司 保留所有权利
