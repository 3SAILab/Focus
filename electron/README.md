# Electron 打包说明

## 安装步骤

### 1. 安装依赖

```bash
# 在项目根目录
npm install

# 安装前端依赖
cd frontend
npm install
cd ..

# 安装后端依赖（Go 会自动处理）
cd backend
go mod download
cd ..
```

### 2. 配置环境变量

创建 `.env` 文件（在项目根目录或 backend 目录）：

```
API_KEY=your_api_key_here
```

### 3. 开发模式运行

```bash
# 终端 1: 启动前端开发服务器
cd frontend
npm run dev

# 终端 2: 启动后端服务
cd backend
go run main.go

# 终端 3: 启动 Electron
npm run electron:dev
```

### 4. 打包应用

#### Windows
```bash
npm run build:backend
npm run build:frontend
npm run electron:build
```

#### macOS
```bash
npm run build:backend:mac
npm run build:frontend
npm run electron:build
```

#### Linux
```bash
npm run build:backend:linux
npm run build:frontend
npm run electron:build
```

## 文件结构

```
sigma/
├── electron/
│   ├── main.js          # Electron 主进程
│   ├── preload.js       # 预加载脚本
│   └── README.md        # 本文件
├── frontend/            # React 前端
├── backend/             # Go 后端
├── package.json         # Electron 配置
└── dist/                # 编译后的文件
    └── sigma-backend.exe # 后端可执行文件
```

## 注意事项

1. **API_KEY**: 需要在环境变量或 `.env` 文件中配置
2. **端口冲突**: 确保 8080 端口未被占用
3. **文件路径**: 应用数据会保存在用户数据目录
4. **跨平台**: 需要为每个平台编译对应的后端可执行文件

## 打包后的文件位置

- Windows: `release/SIGMA Setup x.x.x.exe`
- macOS: `release/SIGMA-x.x.x.dmg`
- Linux: `release/SIGMA-x.x.x.AppImage`

