# Implementation Plan: Image Upload Optimization

## Overview

本实现计划将图片上传优化功能分解为可执行的编码任务。实现顺序为：先完成核心压缩模块，再更新错误处理，然后集成到组件中，最后添加测试模拟功能。

## Tasks

- [x] 1. 创建图片压缩模块
  - [x] 1.1 创建 `frontend/src/utils/imageCompressor.ts` 文件
    - 定义 CompressOptions、CompressResult 接口
    - 实现 COMPRESS_CONFIG 常量（QUALITY: 0.92, MAX_TOTAL_SIZE: 25MB, MAX_COUNT: 5）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 1.2 实现 compressImage 单图压缩函数
    - 使用 Canvas API 进行压缩
    - JPEG 使用 0.92 质量压缩
    - PNG 保持原格式（使用 image/png）
    - 如果压缩后更大，返回原文件
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [x] 1.3 实现 compressImages 批量压缩函数
    - 遍历所有文件调用 compressImage
    - 计算压缩后总大小
    - 返回 CompressResult
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [x] 1.4 实现验证函数
    - validateImageCount: 验证图片数量 ≤ 5
    - validateTotalSize: 验证总大小 ≤ 25MB
    - _Requirements: 1.1, 1.5_
  
  - [ ]* 1.5 编写图片压缩模块属性测试
    - **Property 2: Compression Behavior**
    - **Validates: Requirements 1.2, 1.3, 1.4**

- [x] 2. 更新错误处理模块
  - [x] 2.1 修改 `frontend/src/utils/errorHandler.ts`
    - 更新 ERROR_MESSAGES 常量，添加新的错误消息
    - 网络错误: "网络出了点小差，请稍后重试"
    - 图片数量超限: "最多支持上传 5 张参考图"
    - 大小超限: "图片总大小过大，请减少图片数量或选择较小的图片"
    - AI 无图片: "未能生成图片，请尝试修改提示词后重试"
    - 余额不足: "余额不足请联系销售充值"（保持不变）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 2.2 扩展 ParsedError 接口
    - 添加 isNoImageError 字段
    - 添加 suggestEdit 字段
    - 更新 UserAction 类型
    - _Requirements: 2.4, 3.3_
  
  - [x] 2.3 更新 parseApiError 函数
    - 添加网络超时错误检测
    - 添加 AI 无图片错误检测
    - 设置正确的 userAction 和 suggestEdit
    - _Requirements: 2.1, 2.4_
  
  - [ ]* 2.4 编写错误消息映射属性测试
    - **Property 4: Error Message Mapping**
    - **Validates: Requirements 2.1, 2.4, 2.5**

- [x] 3. Checkpoint - 确保核心模块测试通过
  - 运行单元测试确保压缩和错误处理模块正常工作
  - 如有问题请询问用户

- [x] 4. 更新 ErrorCard 组件
  - [x] 4.1 修改 `frontend/src/components/feedback/error-card.tsx`
    - 添加 onEdit 回调属性
    - 添加 suggestEdit 属性
    - 添加"重新编辑"按钮
    - 当 suggestEdit 为 true 时突出显示"重新编辑"按钮
    - _Requirements: 3.1, 3.3_
  
  - [x] 4.2 更新 ErrorCard 样式
    - "重试"按钮保持现有样式
    - "重新编辑"按钮使用次要样式
    - suggestEdit 时"重新编辑"按钮使用主要样式
    - _Requirements: 3.1, 3.3_

- [x] 5. 更新 HistoryFailedItem 组件
  - [x] 5.1 修改 `frontend/src/components/history/history-failed-item.tsx`
    - 传递 onEdit 回调到 ErrorCard
    - 传递 suggestEdit 属性
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 6. 集成图片压缩到 ImageUpload 组件
  - [x] 6.1 修改 `frontend/src/components/ImageUpload.tsx`
    - 导入 imageCompressor 模块
    - 在 handleFileSelect 中添加图片数量验证
    - 超过 5 张时显示错误提示
    - _Requirements: 1.1, 2.2_
  
  - [x] 6.2 添加压缩和大小验证逻辑
    - 选择图片后调用 compressImages
    - 验证压缩后总大小
    - 超过 25MB 时显示错误提示
    - _Requirements: 1.5, 1.6, 2.3_
  
  - [ ]* 6.3 编写图片数量和大小验证属性测试
    - **Property 1: Image Count Limit Validation**
    - **Property 3: Total Size Validation**
    - **Validates: Requirements 1.1, 1.5, 2.2, 2.3**

- [x] 7. 添加测试模拟功能
  - [x] 7.1 修改 `frontend/src/api/index.ts`
    - 添加 SimulatorConfig 接口
    - 添加 SIMULATOR_CONFIG 配置对象
    - 默认 enabled: false
    - _Requirements: 4.1, 4.6_
  
  - [x] 7.2 实现错误模拟逻辑
    - 在 generate 函数中添加模拟检查
    - 支持模拟: network, count_exceeded, size_exceeded, no_image, quota
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  
  - [x] 7.3 添加模拟配置注释说明
    - 说明如何启用模拟
    - 说明各种错误类型的用途
    - _Requirements: 4.1_

- [x] 8. 更新 Create.tsx 集成
  - [x] 8.1 修改 `frontend/src/views/Create.tsx`
    - 更新 handleEditFailedPrompt 传递到 HistoryFailedItem
    - 确保重新编辑功能正确恢复输入状态
    - _Requirements: 3.2, 3.5_
  
  - [ ]* 8.2 编写操作按钮行为属性测试
    - **Property 5: Action Button Behavior**
    - **Validates: Requirements 3.4, 3.5**

- [x] 9. Final Checkpoint - 确保所有测试通过
  - 运行所有单元测试和属性测试
  - 验证错误提示文案正确
  - 验证重新编辑功能正常
  - 如有问题请询问用户

## Notes

- 任务标记 `*` 的为可选测试任务，可跳过以加快 MVP 开发
- 每个任务都引用了具体的需求编号以便追溯
- 检查点任务用于确保增量验证
- 属性测试验证通用正确性属性
- 单元测试验证具体示例和边界情况
