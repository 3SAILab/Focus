# 配置文档

Focus 后端通过环境变量和配置文件进行配置。

## 环境变量

### 核心配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `8080` | 服务器监听端口 |
| `API_KEY` | - | AI 服务 API Key |
| `DISCLAIMER_AGREED` | `false` | 免责声明同意状态 |
| `PRODUCTION` | `false` | 是否为生产环境 |

### 路径配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `OUTPUT_DIR` | `./output` | 生成图片输出目录 |
| `UPLOAD_DIR` | `./uploads` | 上传文件存储目录 |
| `DB_PATH` | `./history.db` | SQLite 数据库路径 |
| `LOG_DIR` | - | 日志文件目录 |

### TLS 配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `TLS_CERT_PATH` | - | TLS 证书文件路径 |
| `TLS_KEY_PATH` | - | TLS 私钥文件路径 |

当 `TLS_CERT_PATH` 和 `TLS_KEY_PATH` 都设置时，自动启用 HTTPS。

### 端口发现配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `AUTO_PORT_DISCOVERY` | `true` | 是否启用自动端口发现 |

启用后，如果默认端口被占用，会自动尝试下一个可用端口。

### AI 服务配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `AI_SERVICE_URL` | 内置默认值 | AI 服务 API 地址 |

## 配置文件

### 持久化配置 (config.json)

位置：与数据库同目录（如 `db/config.json`）

```json
{
  "api_key": "your-api-key",
  "disclaimer_agreed": true
}
```

配置文件会覆盖环境变量的值，用于存储用户在应用内设置的配置。

### .env 文件

开发环境可使用 `.env` 文件配置环境变量：

```bash
# backend/.env
PORT=8080
API_KEY=your-api-key
OUTPUT_DIR=./output
UPLOAD_DIR=./uploads
DB_PATH=./history.db
```

## 配置优先级

1. **配置文件** (config.json) - 最高优先级
2. **环境变量** - 中等优先级
3. **.env 文件** - 开发环境
4. **默认值** - 最低优先级

## 生产环境路径

在打包后的应用中，路径会自动调整：

### Windows

```
%APPDATA%/Focus/
├── db/
│   ├── history.db      # 数据库
│   └── config.json     # 配置文件
├── output/             # 生成的图片
├── uploads/            # 上传的文件
├── certs/              # TLS 证书
│   ├── cert.pem
│   └── key.pem
├── logs/               # 日志文件
│   └── app.log
└── temp/               # 临时文件
```

### macOS

```
~/Library/Application Support/Focus/
├── db/
├── output/
├── uploads/
├── certs/
├── logs/
└── temp/
```

### Linux

```
~/.config/Focus/
├── db/
├── output/
├── uploads/
├── certs/
├── logs/
└── temp/
```

## TLS 证书管理

### 自动生成

Electron 主进程会在首次启动时自动生成自签名证书：

```javascript
// electron/tls-manager.js
const { generateCertificate } = require('./tls-manager');
await generateCertificate(certDir);
```

### 证书文件

- `cert.pem` - 自签名证书
- `key.pem` - 私钥

### 证书有效期

默认有效期为 365 天，过期后会自动重新生成。

## 端口发现机制

### 工作流程

1. 尝试绑定默认端口 (8080)
2. 如果被占用，尝试下一个端口
3. 最多尝试 10 次
4. 成功后写入端口文件

### 端口文件

位置：用户临时目录下的 `sigma-backend.port`

前端通过读取此文件获取实际端口号。

## 配置 API

### 获取配置

```go
// 获取 API Token
token := config.GetAPIToken()

// 获取免责声明状态
agreed := config.GetDisclaimerAgreed()
```

### 设置配置

```go
// 设置 API Token（自动持久化）
config.SetAPIToken("new-token")

// 设置免责声明状态（自动持久化）
config.SetDisclaimerAgreed(true)
```

### 配置初始化

```go
// 在 main.go 中初始化
config.Init()
config.LogConfig() // 仅在非生产环境输出
```

## 敏感信息过滤

后端会自动过滤错误信息中的敏感关键词：

```go
// 过滤敏感信息
filteredMsg := config.FilterSensitiveInfo(errorMessage)
```

敏感关键词包括：
- AI 模型名称
- API 端点信息
- 服务提供商名称

## 开发环境配置示例

```bash
# backend/.env.template
PORT=8080
API_KEY=
OUTPUT_DIR=./output
UPLOAD_DIR=./uploads
DB_PATH=./history.db
DISCLAIMER_AGREED=false
AUTO_PORT_DISCOVERY=true
```

## 生产环境配置

生产环境通过 Electron 主进程设置环境变量：

```javascript
// electron/main.js
const env = {
  PORT: '8080',
  OUTPUT_DIR: path.join(userDataPath, 'output'),
  UPLOAD_DIR: path.join(userDataPath, 'uploads'),
  DB_PATH: path.join(userDataPath, 'db', 'history.db'),
  TLS_CERT_PATH: path.join(userDataPath, 'certs', 'cert.pem'),
  TLS_KEY_PATH: path.join(userDataPath, 'certs', 'key.pem'),
  PRODUCTION: 'true'
};
```
