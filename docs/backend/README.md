# 后端开发指南

Focus 后端使用 Go + Gin + GORM 构建，提供 RESTful API 服务。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Go | 1.25+ | 编程语言 |
| Gin | 1.11 | Web 框架 |
| GORM | 1.31 | ORM 框架 |
| SQLite | - | 数据库 |
| godotenv | 1.5 | 环境变量 |

## 目录结构

```
backend/
├── main.go              # 服务入口
├── go.mod               # Go 模块定义
├── go.sum               # 依赖锁定
├── .env                 # 环境配置（开发）
├── .env.template        # 环境配置模板
├── config/              # 配置管理
│   ├── config.go        # 配置加载和管理
│   └── config_test.go   # 配置测试
├── handlers/            # HTTP 处理器
│   ├── config.go        # 配置接口
│   ├── generate.go      # 生成接口
│   ├── history.go       # 历史接口
│   ├── stats.go         # 统计接口
│   └── task.go          # 任务接口
├── models/              # 数据模型
│   ├── generation_history.go
│   ├── generation_stats.go
│   └── generation_task.go
├── server/              # 服务器配置
│   └── tls.go           # TLS 配置
├── types/               # 类型定义
│   └── ai_types.go      # AI API 类型
└── utils/               # 工具函数
    ├── env.go           # 环境变量工具
    ├── logger.go        # 日志工具
    └── port.go          # 端口管理
```

## 开发环境

### 安装 Go

下载并安装 Go 1.21+：https://go.dev/dl/

### 安装依赖

```bash
cd backend
go mod download
```

### 配置环境

复制环境配置模板：

```bash
cp .env.template .env
```

编辑 `.env` 设置 API Key：

```bash
API_KEY=your-api-key-here
```

### 运行开发服务器

```bash
go run main.go
```

服务器默认运行在 `http://localhost:8080`。

## 编码规范

### 代码格式

使用 Go 标准格式化：

```bash
go fmt ./...
```

### 命名规范

- **包名**：小写，简短，无下划线
- **导出函数/类型**：PascalCase
- **私有函数/变量**：camelCase
- **常量**：PascalCase 或 UPPER_SNAKE_CASE

### 错误处理

```go
// ✅ 推荐
if err != nil {
    c.JSON(500, gin.H{"error": "操作失败"})
    return
}

// ❌ 避免
if err != nil {
    panic(err)
}
```

### 日志

```go
// 开发环境
log.Printf("处理请求: %s", requestID)

// 生产环境（自动禁用）
if !config.IsProduction {
    log.Printf("调试信息: %v", data)
}
```

## 测试

### 运行所有测试

```bash
go test ./...
```

### 运行特定包测试

```bash
go test ./handlers/...
go test ./models/...
```

### 带覆盖率

```bash
go test -cover ./...
```

## 构建

### 开发构建

```bash
go build -o sigma-backend.exe .
```

### 生产构建（优化）

```bash
go build -trimpath -ldflags="-s -w -buildid=" -o sigma-backend.exe .
```

参数说明：
- `-trimpath`：移除文件路径信息
- `-s`：移除符号表
- `-w`：移除 DWARF 调试信息
- `-buildid=`：移除构建 ID

## 文档索引

- [API 文档](./API.md) - 所有 API 端点
- [数据模型](./MODELS.md) - 数据库模型
- [配置文档](./CONFIG.md) - 环境变量和配置

## 添加新功能

### 添加新的 API 端点

1. 在 `handlers/` 创建处理器函数
2. 在 `main.go` 注册路由
3. 更新 API 文档
4. 编写测试

### 添加新的数据模型

1. 在 `models/` 定义模型结构
2. 在 `main.go` 添加自动迁移
3. 更新模型文档
4. 编写测试
