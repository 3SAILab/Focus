# 后端 API 文档

Focus 后端提供 RESTful API，默认运行在 `http://localhost:8080`。

## 基础信息

- **Base URL**: `http://localhost:8080`
- **协议**: HTTP（本地通信）
- **内容类型**: `application/json`（除文件上传外）
- **端口**: 默认 8080，支持自动端口发现（如被占用自动切换到 8081-8099）

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

**请求参数（新增）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `count` | int | 否 | 生成数量，1-4，默认 1 |

**响应示例（单图成功）：**

```json
{
  "status": "success",
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "image_url": "http://localhost:8080/images/gen_1234567890.png",
  "text": "AI 生成的描述文本",
  "ref_images": [
    "http://localhost:8080/uploads/ref_1234567890_image.png"
  ]
}
```

**响应示例（多图成功）：**

```json
{
  "status": "success",
  "batch_id": "batch_1234567890",
  "prompt": "一只可爱的猫咪",
  "images": [
    {
      "image_url": "http://localhost:8080/images/gen_1234567890_0.png",
      "index": 0
    },
    {
      "image_url": "http://localhost:8080/images/gen_1234567890_1.png",
      "index": 1
    }
  ],
  "ref_images": [
    "http://localhost:8080/uploads/ref_1234567890_image.png"
  ]
}
```

**响应示例（异步模式）：**

当生成时间较长时，后端返回 task_id，前端需要轮询任务状态：

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000"
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
    "image_url": "http://localhost:8080/images/gen_123.png",
    "file_name": "gen_123.png",
    "ref_images": "[\"http://localhost:8080/uploads/ref_123.png\"]",
    "type": "create",
    "batch_id": "batch_123",
    "batch_index": 0,
    "batch_total": 2,
    "created_at": "2025-01-01T12:00:00Z",
    "updated_at": "2025-01-01T12:00:00Z"
  }
]
```

**注意**: 历史记录 API 会自动将旧数据中的 `https://` URL 转换为当前端口的 `http://` URL，确保兼容性。

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
  "image_count": 2,
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
  "ref_images": "[\"http://localhost:8080/uploads/ref_123.png\"]",
  "image_url": "http://localhost:8080/images/gen_123.png",
  "error_msg": "",
  "image_count": 1,
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
  "image_count": 1,
  "started_at": "2025-01-01T12:00:00Z",
  "created_at": "2025-01-01T12:00:00Z",
  "updated_at": "2025-01-01T12:01:00Z"
}
```

**任务状态说明：**

| 状态 | 说明 |
|------|------|
| `processing` | 正在处理 |
| `completed` | 处理完成 |
| `failed` | 处理失败 |

**任务字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `task_id` | string | 任务唯一标识 (UUID) |
| `status` | string | 任务状态 |
| `type` | string | 生成类型 |
| `prompt` | string | 提示词 |
| `image_url` | string | 生成的图片 URL（完成时） |
| `error_msg` | string | 错误信息（失败时） |
| `image_count` | int | 请求的图片数量 |
| `batch_id` | string | 批次 ID（多图生成时） |
| `batch_index` | int | 批次内索引（多图生成时） |

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
