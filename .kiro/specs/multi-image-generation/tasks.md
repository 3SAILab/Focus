# Implementation Plan

## Phase 1: 前端 Mock 测试环境

- [x] 1. 在 api/index.ts 添加多图 Mock 模式





  - 添加 `MOCK_MULTI_IMAGE` 开关
  - 模拟返回 1-4 张图片的响应（使用 picsum.photos 占位图）
  - 模拟部分失败场景（如 4 张中有 1 张失败）
  - 模拟延迟加载效果
  - _Requirements: 测试需求_

## Phase 2: 前端 UI 基础

- [x] 2. 创建 CountSelector 组件





  - 创建 `frontend/src/components/CountSelector.tsx`
  - 实现 1/2/3/4 数量选择按钮
  - 样式与 AspectRatioSelector 保持一致
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. 集成 CountSelector 到 PromptBar





  - [x] 3.1 在 PromptBar 中添加 imageCount 状态


  - [x] 3.2 在右侧按钮区添加 CountSelector


  - [x] 3.3 将 count 参数传递给 API 调用


  - _Requirements: 1.1, 1.2_

## Phase 3: 前端网格布局

- [x] 4. 创建 ImageGrid 组件











  - [x] 4.1 创建 `frontend/src/components/ImageGrid.tsx`

  - [x] 4.2 实现 1/2/4 图的自适应网格布局




  - [x] 4.3 支持 loading、success、error 三种状态

  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. 修改 Create.tsx 使用 ImageGrid





  - [x] 5.1 添加 batchResults 状态管理


  - [x] 5.2 修改 handleGenerate 处理多图响应


  - [x] 5.3 渲染 ImageGrid 替代单个 ImageCard（多图时）


  - [x] 5.4 保持单图时使用现有 ImageCard（向后兼容）


  - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.3_

- [x] 6. 前端 Mock 测试验证





  - 使用 Mock 模式测试各种场景
  - 验证 1/2/3/4 张图的布局
  - 验证部分失败时 ErrorCard 位置
  - 验证重试功能
  - _Requirements: 测试需求_

## Phase 4: 后端实现（前端验证通过后）

- [x] 7. 修改数据库模型（安全迁移）






  - [x] 7.1 在 GenerationHistory 添加可空字段：batch_id, batch_index, batch_total

  - [x] 7.2 使用 GORM AutoMigrate 自动迁移（不影响现有数据）



  - [x] 7.3 现有记录的新字段默认为空值


  - _Requirements: 4.4_

- [x] 8. 修改生成接口





  - [x] 8.1 解析 count 参数 (默认 1，最大 4)



  - [x] 8.2 count=1 时保持现有逻辑（完全向后兼容）


  - [x] 8.3 count>1 时循环调用 AI API


  - [x] 8.4 返回 images 数组格式的响应


  - [x] 8.5 存储多条历史记录，共享 batch_id

  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. 关闭 Mock 模式，真实测试





  - 将 `MOCK_MULTI_IMAGE` 设为 false
  - 使用真实后端测试
  - _Requirements: 测试需求_

- [x] 10. Final Checkpoint



  - 确保所有测试通过，如有问题请询问用户

## 注意事项

1. **Mock 测试优先**：先用 Mock 数据验证前端 UI，避免浪费 API 调用费用
2. **数据库安全迁移**：
   - 新字段使用可空类型（`*string`, `*int`）
   - GORM AutoMigrate 只添加字段，不删除/修改现有字段
   - 现有数据不受影响，新字段为 NULL
3. **向后兼容**：count=1 时保持现有行为，返回单图响应格式
4. **API 超时**：多图生成时总超时时间需要相应增加
5. **Toast 提示**：
   - 生成成功时不显示 toast（已在之前移除）
   - 生成失败时显示 ErrorCard 而非 toast
