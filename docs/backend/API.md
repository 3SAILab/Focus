# 后端 API 文档

Focus 后端提供 RESTful API，默认运行在 `https://localhost:8080`。

## 基础信息

- **Base URL**: `https://localhost:8080`
- **协议**: HTTPS（自签名证书）
- **内容类型**: `application/json`（除文件上传外）

## API 端点

### 配置接口

#### 检查配置状态

检查 API Key 是否已配置以及免责声明是否已同意。

```
GET /config/check
```

**响应示例：**

```json
{
  "has_api_key": true,
  "masked_key": "sk-a****xyz",
  "disclaimer_agreed": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `has_api_key` | boolean | 是否已配置 API Key |
| `masked_key` | string | 脱敏后的 API Key（前4后4位） |
| `disclaimer_agreed` | boolean | 是否已同意免责声明 |

---

#### 设置 API Key

```
POST /config/apikey
```

**请求体：**

```json
{
  "api_key": "your-api-key-here"
}
```

**响应示例：**

```json
{
  "status": "success"
}
```

**错误响应：**

```json
{
  "error": "API Key 不能为空"
}
```

---

#### 设置免责声明同意状态

```
POST /config/disclaimer
```

**请求体：**

```json
{
  "agreed": true
}
```

**响应示例：**

```json
{
  "status": "success",
  "agreed": true
}
```

---

### 生成接口

#### 生成图片

使用 AI 生成图片，支持文本提示词和参考图片。

```
POST /generate
```

**Content-Type**: `multipart/form-data`

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | 否 | 文本提示词，默认 "image" |
| `aspectRatio` | string | 否 | 宽高比，默认 "1:1" |
| `imageSize` | string | 否 | 图片尺寸，默认 "2K" |
| `type` | string | 否 | 生成类型，默认 "create" |
| `images` | File[] | 否 | 参考图片（可多个） |

**生成类型 (type)：**

| 值 | 说明 |
|------|------|
| `create` | 创作空间 |
| `white_background` | 白底图 |
| `clothing_change` | 换装 |
| `product_scene` | 商品图 |
| `light_shadow` | 光影融合 |

**宽高比 (aspectRatio)：**

支持值：`智能`, `21:9`, `16:9`, `3:2`, `4:3`, `1:1`, `3:4`, `2:3`, `9:16`

**响应示例（成功）：**

```json
{
  "status": "success",
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "image_url": "https://localhost:8080/images/gen_1234567890.png",
  "text": "AI 生成的描述文本",
  "ref_images": [
    "https://localhost:8080/uploads/ref_1234567890_image.png"
  ]
}
```

**响应示例（错误）：**

```json
{
  "error": "请先配置 API Key",
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status_code": 401
}
```

---

### 历史记录接口

#### 获取历史记录

```
GET /history
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `date` | string | 日期筛选，格式 YYYY-MM-DD |
| `type` | string | 类型筛选 |
| `page` | int | 页码，默认 1 |
| `page_size` | int | 每页数量，默认 20，最大 100 |

**响应示例：**

```json
[
  {
    "id": 1,
    "prompt": "一只可爱的猫咪",
    "original_prompt": "用户原始输入",
    "image_url": "https://localhost:8080/images/gen_123.png",
    "file_name": "gen_123.png",
    "ref_images": "[\"https://localhost:8080/uploads/ref_123.png\"]",
    "type": "create",
    "created_at": "2025-01-01T12:00:00Z",
    "updated_at": "2025-01-01T12:00:00Z"
  }
]
```

---

#### 获取白底图历史

```
GET /history/white-background
```

**查询参数：** 同 `/history`

**响应格式：** 同 `/history`

---

#### 获取换装历史

```
GET /history/clothing-change
```

**查询参数：** 同 `/history`

**响应格式：** 同 `/history`

---

### 统计接口

#### 获取生成计数

```
GET /stats/generation-count
```

**响应示例：**

```json
{
  "total_count": 42
}
```

---

#### 增加生成计数

```
POST /stats/increment-count
```

**响应示例：**

```json
{
  "total_count": 43
}
```

---

### 任务接口

#### 获取处理中的任务

获取指定类型的正在处理的任务列表。

```
GET /tasks/processing
```

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `type` | string | 任务类型筛选 |

**响应示例：**

```json
[
  {
    "id": 1,
    "task_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "processing",
    "type": "create",
    "prompt": "一只可爱的猫咪",
    "ref_images": "[]",
    "image_url": "",
    "error_msg": "",
    "started_at": "2025-01-01T12:00:00Z",
    "created_at": "2025-01-01T12:00:00Z",
    "updated_at": "2025-01-01T12:00:00Z"
  }
]
```

---

#### 获取任务状态

```
GET /tasks/:id
```

**路径参数：**

| 参数 | 说明 |
|------|------|
| `id` | 任务 ID (UUID) |

**响应示例（处理中）：**

```json
{
  "id": 1,
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "type": "create",
  "prompt": "一只可爱的猫咪",
  "ref_images": "[]",
  "image_url": "",
  "error_msg": "",
  "started_at": "2025-01-01T12:00:00Z",
  "created_at": "2025-01-01T12:00:00Z",
  "updated_at": "2025-01-01T12:00:00Z"
}
```

**响应示例（完成）：**

```json
{
  "id": 1,
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "type": "create",
  "prompt": "一只可爱的猫咪",
  "ref_images": "[]",
  "image_url": "https://localhost:8080/images/gen_123.png",
  "error_msg": "",
  "started_at": "2025-01-01T12:00:00Z",
  "created_at": "2025-01-01T12:00:00Z",
  "updated_at": "2025-01-01T12:01:00Z"
}
```

**响应示例（失败）：**

```json
{
  "id": 1,
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "failed",
  "type": "create",
  "prompt": "一只可爱的猫咪",
  "ref_images": "[]",
  "image_url": "",
  "error_msg": "API 配额已用尽",
  "started_at": "2025-01-01T12:00:00Z",
  "created_at": "2025-01-01T12:00:00Z",
  "updated_at": "2025-01-01T12:01:00Z"
}
```

---

### 静态文件服务

#### 生成的图片

```
GET /images/:filename
```

返回生成的图片文件。

---

#### 上传的参考图

```
GET /uploads/:filename
```

返回上传的参考图片文件。

---

## 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未配置 API Key |
| 404 | 资源不存在 |
| 429 | API 配额已用尽 |
| 500 | 服务器内部错误 |

### 错误响应格式

```json
{
  "error": "错误描述信息"
}
```

### 常见错误

| 错误信息 | 说明 | 解决方案 |
|----------|------|----------|
| 请先配置 API Key | 未设置 API Key | 调用 `/config/apikey` 设置 |
| API Key 不能为空 | 提交的 Key 为空 | 提供有效的 API Key |
| 模型未返回内容 | AI 未生成结果 | 重试或修改提示词 |
| 图片生成失败 | 生成过程出错 | 检查提示词和参考图 |
| 任务不存在 | 任务 ID 无效 | 检查任务 ID |
| API 配额已用尽 | Gemini 配额耗尽 | 等待配额重置或升级 |
