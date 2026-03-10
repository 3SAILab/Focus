# 实施计划：Lightbox 导航与模型选择

## 概述

按自底向上的顺序实施：先扩展前端类型定义，再实现后端配置与处理器变更，然后实现前端组件变更（Lightbox 导航、模型选择器、宽高比扩展），最后集成联调。前端使用 TypeScript，后端使用 Go。每个任务递增构建，确保无孤立代码。

## Tasks

- [x] 1. 扩展前端类型定义与常量
  - [x] 1.1 在 `type/index.ts` 中新增 `ModelType` 类型和扩展 `AspectRatio` 类型
    - 新增 `export type ModelType = 'focus' | 'focus-fast'`
    - 扩展 `AspectRatio` 类型，新增 `'1:4' | '4:1' | '1:8' | '8:1'` 四个 Focus-Fast 专属比例
    - _需求: 2.1, 4.1_

  - [x] 1.2 在 `ImageSettingsSelector.tsx` 中定义宽高比常量数组
    - 定义 `baseAspectRatios` 基础宽高比数组
    - 定义 `focusFastExtraRatios` Focus-Fast 专属宽高比数组
    - _需求: 4.1, 4.2_

- [x] 2. 实现后端配置与处理器变更
  - [x] 2.1 在 `config/config.go` 中新增 Focus-Fast URL 常量和获取函数
    - 新增 `focusFastServiceConfig` 变量，存储 base64 编码的 Focus-Fast API URL
    - 实现 `GetAIServiceURLByModel(model string) string` 函数
    - Aiaimi 平台始终返回默认 URL，VectorEngine 平台根据 model 参数选择
    - 无效或空 model 值默认使用 Focus 模型 URL
    - _需求: 2.5, 2.6, 2.7, 5.2, 5.3, 5.4_

  - [ ]* 2.2 编写 Property 6 属性测试：URL 选择逻辑
    - **Property 6: URL 选择逻辑**
    - 使用 `testing/quick` 或 `gopter` 随机生成 model 字符串和平台类型
    - 验证：当且仅当 `model == "focus-fast"` 且平台为 VectorEngine 时返回 Focus-Fast URL，其他情况返回默认 URL
    - **验证需求: 2.5, 2.6, 5.2, 5.3**

  - [x] 2.3 修改 `handlers/config.go` 的 `CheckConfigHandler` 响应
    - 在响应 JSON 中新增 `platform` 字段，值来自 `config.GetAPIPlatform()`
    - _需求: 3.1_

  - [ ]* 2.4 编写 Property 9 属性测试：配置响应包含平台字段
    - **Property 9: 配置响应包含平台字段**
    - 验证 `/config/check` 响应 JSON 包含 `platform` 字段，值为 `'vectorengine'`、`'aiaimi'` 或 `'unknown'` 之一
    - **验证需求: 3.1**

  - [x] 2.5 修改 `handlers/generate.go` 解析 model 参数
    - 从 FormData 中解析 `model` 字段，缺失时默认 `"focus"`
    - 将 `config.GetCurrentAIServiceURL()` 替换为 `config.GetAIServiceURLByModel(model)`
    - _需求: 5.2, 5.3_

- [x] 3. 检查点 — 确保后端测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 4. 实现 Lightbox 批次导航
  - [x] 4.1 修改 `Lightbox.tsx` 组件接口和导航逻辑
    - 扩展 props：新增 `imageUrls?: string[]` 和 `currentIndex?: number`
    - 新增 `activeIndex` 内部状态，初始值为 `currentIndex`，随 prop 变化同步
    - 显示图片 URL：`imageUrls?.[activeIndex] ?? imageUrl`
    - 实现 ArrowRight/ArrowLeft 键盘事件处理，循环导航
    - 切换图片时重置 `zoom = 1`，`position = {x: 0, y: 0}`
    - 单图模式（`imageUrls` 未提供或长度 ≤ 1）方向键无效果
    - _需求: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [ ]* 4.2 编写 Property 1 属性测试：批次导航索引计算
    - **Property 1: 批次导航索引计算**
    - 使用 `fast-check` 随机生成 1-100 长度的 URL 列表、随机索引、随机方向
    - 验证导航后索引等于 `(currentIndex + delta + length) % length`，列表长度为 1 时索引不变
    - **验证需求: 1.2, 1.3, 1.4, 1.5, 1.6, 1.8**

  - [ ]* 4.3 编写 Property 2 属性测试：导航重置缩放与位置
    - **Property 2: 导航重置缩放与位置**
    - 验证批次导航切换到不同图片后，缩放比例为 1，拖拽位置为 `{x: 0, y: 0}`
    - **验证需求: 1.7**

  - [ ]* 4.4 编写 Property 3 属性测试：Lightbox 显示正确图片
    - **Property 3: Lightbox 显示正确图片**
    - 验证对于任意 URL 列表和有效索引，显示的图片 URL 等于 `imageUrls[activeIndex]`
    - **验证需求: 1.1**

  - [x] 4.5 修改 `ImageGrid.tsx` 的 `onImageClick` 回调签名
    - 扩展回调签名为 `(url: string, batchUrls?: string[], indexInBatch?: number) => void`
    - `GridImageCard` 点击时传递当前批次所有成功图片 URL 列表和当前索引
    - _需求: 1.1_

  - [x] 4.6 修改 `Create.tsx` 状态管理以支持批次数据
    - 将 `lightboxImage` 状态改为 `lightboxData: { url: string | null; urls?: string[]; index?: number } | null`
    - 更新 `onImageClick` 回调接收批次信息并传递给 Lightbox
    - _需求: 1.1_

- [x] 5. 实现模型选择器与平台信息传递
  - [x] 5.1 扩展 `ConfigContext` 新增 `platform` 状态字段
    - 在 `ConfigContextType` 中新增 `platform: string`，默认值 `'unknown'`
    - 从 `checkConfig` 响应中读取 `platform` 字段并存储
    - _需求: 3.1, 3.2_

  - [x] 5.2 在 `PromptBar.tsx` 中实现模型选择器 UI
    - 新增 `model` 内部状态，类型 `ModelType`，默认值 `'focus'`
    - 接收 `platform` prop，仅在 `platform === 'vectorengine'` 时显示模型选择器
    - 模型选择器样式：紧凑切换按钮组，选项为 `Focus 1x` | `Focus-Fast 0.5x`
    - 当 `platform` 从 `vectorengine` 变为其他值时，自动将 `model` 重置为 `'focus'`
    - _需求: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.3 编写 Property 4 属性测试：模型选择器可见性
    - **Property 4: 模型选择器可见性**
    - 使用 `fast-check` 随机生成平台字符串（包括有效和无效值）
    - 验证模型选择器可见当且仅当平台为 `'vectorengine'`
    - **验证需求: 2.1, 2.2**

  - [ ]* 5.4 编写 Property 5 属性测试：平台切换重置模型
    - **Property 5: 平台切换重置模型**
    - 验证当平台变为非 `'vectorengine'` 时，模型自动重置为 `'focus'`
    - **验证需求: 2.4**

  - [x] 5.5 在 `PromptBar.tsx` 的 FormData 中添加 `model` 字段
    - 构建 FormData 时新增 `formData.append('model', model)`
    - _需求: 5.1_

- [x] 6. 实现 Focus-Fast 专属宽高比
  - [x] 6.1 修改 `ImageSettingsSelector.tsx` 根据模型动态显示宽高比
    - 接收 `model` prop（类型 `ModelType`）
    - 当 `model === 'focus-fast'` 时显示基础 + 专属宽高比
    - 当 `model === 'focus'` 时仅显示基础宽高比
    - 当模型从 `'focus-fast'` 切换为 `'focus'` 且当前宽高比为专属比例时，自动重置为 `'1:1'`
    - _需求: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 6.2 编写 Property 7 属性测试：宽高比可用集合
    - **Property 7: 宽高比可用集合**
    - 验证 `focus-fast` 模型的可用宽高比为基础集合 ∪ 专属集合，`focus` 模型仅为基础集合
    - **验证需求: 4.1, 4.2, 4.4**

  - [ ]* 6.3 编写 Property 8 属性测试：模型切换重置专属宽高比
    - **Property 8: 模型切换重置专属宽高比**
    - 验证从 `focus-fast` 切换为 `focus` 时，若当前宽高比为专属比例则自动重置为 `'1:1'`
    - **验证需求: 4.3**

- [x] 7. 检查点 — 确保所有前端测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 8. 集成联调
  - [x] 8.1 将模型选择器与 ImageSettingsSelector 联动
    - 在 `PromptBar.tsx` 或 `Create.tsx` 中将 `model` 状态传递给 `ImageSettingsSelector`
    - 确保模型切换时宽高比正确联动
    - _需求: 4.1, 4.2, 4.3_

  - [x] 8.2 将 ConfigContext 的 `platform` 传递给 PromptBar
    - 确保 PromptBar 能读取当前平台类型以控制模型选择器显示
    - _需求: 3.2, 2.1, 2.2_

  - [ ]* 8.3 编写集成测试
    - 测试完整流程：VectorEngine 平台下选择 Focus-Fast → 生成请求包含正确 model 字段
    - 测试平台切换：从 VectorEngine 切换到 Aiaimi → 模型重置为 Focus，专属宽高比重置
    - 测试 Lightbox 批次导航：多图批次点击 → 方向键切换 → 正确图片显示
    - _需求: 1.1–1.8, 2.1–2.7, 3.1–3.2, 4.1–4.4, 5.1–5.4_

- [x] 9. 最终检查点 — 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## Notes

- 标记 `*` 的任务为可选，可跳过以加速 MVP 交付
- 每个任务引用具体需求编号以确保可追溯性
- 检查点确保增量验证
- 属性测试验证设计文档中的 9 个正确性属性
- 前端属性测试使用 `fast-check`，后端属性测试使用 Go `testing/quick` 或 `gopter`
