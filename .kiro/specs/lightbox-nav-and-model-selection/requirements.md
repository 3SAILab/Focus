# 需求文档

## 简介

本功能包含两个主要增强：
1. **Lightbox 方向键导航**：在多图批次生成场景下，用户点击放大图片后可通过键盘左右方向键在同一批次的图片之间切换。
2. **模型选择（Focus / Focus-Fast）**：为 VectorEngine 平台新增 `gemini-3.1-flash-image-preview` 模型（别名 Focus-Fast，0.5x 价格），与现有 `gemini-3-pro-image-preview` 模型（别名 Focus，1x 价格）并列可选。Focus-Fast 支持额外的宽高比。

## 术语表

- **Lightbox**：图片放大预览组件，支持缩放、拖拽和键盘操作
- **批次（Batch）**：一次生成请求产生的多张图片集合，通过 `batch_id` 标识
- **ImageGrid**：多图网格布局组件，展示同一批次的图片
- **VectorEngine**：API 平台之一，通过 `api.vectorengine.ai` 提供图片生成服务
- **Aiaimi**：另一个 API 平台，通过 `aiaimi.cc` 提供图片生成服务
- **Focus**：`gemini-3-pro-image-preview` 模型的别名，价格 1x
- **Focus-Fast**：`gemini-3.1-flash-image-preview` 模型的别名，价格 0.5x
- **宽高比（AspectRatio）**：图片的宽高比例参数
- **图片尺寸（ImageSize）**：图片分辨率参数，使用大写 "K" 表示（如 2K、4K）
- **PromptBar**：底部提示词输入栏组件，包含图片设置选择器

## 需求

### 需求 1：Lightbox 批次图片导航

**用户故事：** 作为用户，我希望在放大查看批次图片时能通过方向键切换上下一张图片，以便快速浏览同一批次的所有生成结果。

#### 验收标准

1. WHEN 用户在 ImageGrid 中点击某张批次图片放大时，THE Lightbox SHALL 接收该批次所有已成功生成的图片 URL 列表及当前图片的索引。
2. WHEN 用户在 Lightbox 中按下右方向键（ArrowRight）时，THE Lightbox SHALL 切换显示批次中的下一张图片。
3. WHEN 用户在 Lightbox 中按下左方向键（ArrowLeft）时，THE Lightbox SHALL 切换显示批次中的上一张图片。
4. WHEN 当前图片为批次中最后一张且用户按下右方向键时，THE Lightbox SHALL 循环切换到批次中的第一张图片。
5. WHEN 当前图片为批次中第一张且用户按下左方向键时，THE Lightbox SHALL 循环切换到批次中的最后一张图片。
6. WHEN 批次中仅有一张图片时，THE Lightbox SHALL 保持当前行为不变，方向键操作无效果。
7. WHEN 用户切换图片时，THE Lightbox SHALL 重置缩放比例为 1 并重置拖拽位置为原点。
8. WHEN 用户通过单张图片（非批次）打开 Lightbox 时，THE Lightbox SHALL 保持现有的单图预览行为，方向键导航不生效。

### 需求 2：模型选择器

**用户故事：** 作为用户，我希望能自由切换生成模型（Focus 或 Focus-Fast），以便根据需求在画质和价格之间做出选择。

#### 验收标准

1. WHILE 当前 API 平台为 VectorEngine 时，THE PromptBar SHALL 显示模型选择器，提供 Focus（1x）和 Focus-Fast（0.5x）两个选项。
2. WHILE 当前 API 平台为 Aiaimi 时，THE PromptBar SHALL 隐藏模型选择器，默认使用 Focus 模型（Aiaimi 平台不支持 Focus-Fast）。
3. THE 模型选择器 SHALL 默认选中 Focus（1x）模型。
4. WHEN 用户从 VectorEngine 平台切换到 Aiaimi 平台且当前选中的模型为 Focus-Fast 时，THE 系统 SHALL 自动回退到 Focus 模型。
5. WHEN 用户选择 Focus 模型时，THE 后端 SHALL 使用 `gemini-3-pro-image-preview` 模型的 API URL 发送请求。
6. WHEN 用户选择 Focus-Fast 模型时，THE 后端 SHALL 使用 `gemini-3.1-flash-image-preview` 模型的 API URL 发送请求。
7. THE 后端 SHALL 仅更改 API URL 中的模型名称，请求体结构保持不变。

### 需求 3：平台信息传递

**用户故事：** 作为前端组件，我需要获取当前 API 平台类型，以便决定是否显示模型选择器。

#### 验收标准

1. WHEN 前端调用配置检查接口时，THE 后端 SHALL 在响应中包含当前 API 平台类型字段（`platform`）。
2. THE ConfigContext SHALL 存储并提供当前平台类型信息供子组件使用。

### 需求 4：Focus-Fast 专属宽高比

**用户故事：** 作为用户，我希望在选择 Focus-Fast 模型时能使用额外的宽高比选项（1:4、4:1、1:8、8:1），以便生成更多样化比例的图片。

#### 验收标准

1. WHILE 用户选择 Focus-Fast 模型时，THE 图片设置选择器 SHALL 在现有宽高比选项基础上额外显示 1:4、4:1、1:8、8:1 四个选项。
2. WHILE 用户选择 Focus 模型时，THE 图片设置选择器 SHALL 仅显示现有的宽高比选项（21:9、16:9、3:2、4:3、1:1、3:4、2:3、9:16、9:21），不显示 1:4、4:1、1:8、8:1。
3. WHEN 用户从 Focus-Fast 切换到 Focus 模型且当前选中的宽高比为 Focus-Fast 专属比例时，THE 图片设置选择器 SHALL 自动将宽高比重置为默认值 1:1。
4. WHILE 当前平台为 Aiaimi 时，THE 图片设置选择器 SHALL 仅显示现有的宽高比选项（因为 Aiaimi 不支持 Focus-Fast 模型）。

### 需求 5：模型参数传递

**用户故事：** 作为系统，我需要将用户选择的模型信息从前端传递到后端，以便后端构建正确的 API 请求。

#### 验收标准

1. WHEN 用户发起图片生成请求时，THE 前端 SHALL 在请求的 FormData 中包含 `model` 字段，值为 `focus` 或 `focus-fast`。
2. WHEN 后端收到包含 `model` 字段的生成请求时，THE 后端 SHALL 根据 `model` 值选择对应的 API URL。
3. IF 后端收到的 `model` 字段值无效或缺失，THEN THE 后端 SHALL 默认使用 Focus（`gemini-3-pro-image-preview`）模型。
4. THE 后端 SHALL 将 Focus-Fast 模型的 API URL 以 base64 编码形式存储在配置中，与现有 Focus 模型 URL 的存储方式一致。
