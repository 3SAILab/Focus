# Requirements Document

## Introduction

本文档定义了对 `frontend/src/views/Create.tsx` 组件进行代码重构的需求。该组件是图片生成功能的核心页面，当前存在大量重复代码，包括参考图加载逻辑、任务状态监控机制、PendingTask 清理逻辑、BatchResult 对象构建以及滚动控制等。重构目标是消除代码冗余，提高可维护性，同时确保所有现有功能正常运行。

## Glossary

- **Create 组件**: 图片生成页面的主组件，位于 `frontend/src/views/Create.tsx`
- **参考图 (Reference Image)**: 用户上传的参考图片，用于指导 AI 生成
- **PendingTask**: 正在处理中的生成任务，显示为占位卡片
- **BatchResult**: 批次生成结果对象，包含多张图片的生成结果
- **SSE (Server-Sent Events)**: 服务器推送事件，用于流式返回生成结果
- **useTaskRecovery**: 任务恢复 Hook，用于页面刷新后恢复进行中的任务
- **GlobalTaskContext**: 全局任务上下文，管理任务状态和轮询

## Requirements

### Requirement 1: 参考图加载逻辑统一

**User Story:** 作为开发者，我希望参考图加载逻辑被提取为公共函数，以便减少代码重复并统一错误处理。

#### Acceptance Criteria

1. THE Create 组件 SHALL 提供一个 `loadReferenceFiles` 函数，该函数接收参考图 URL 数组或 JSON 字符串，返回 `Promise<File[]>`
2. WHEN `loadReferenceFiles` 函数被调用时，THE Create 组件 SHALL 解析输入参数（支持 `string[]` 或 JSON 字符串格式）
3. WHEN 参考图 URL 加载失败时，THE `loadReferenceFiles` 函数 SHALL 跳过该图片并继续处理其他图片，不抛出异常
4. WHEN `handleRegenerate`、`handleEditPrompt`、`handleRegenerateBatchWithRef`、`handleEditBatchPromptWithRef` 被调用时，THE Create 组件 SHALL 使用 `loadReferenceFiles` 函数替代内联的加载逻辑
5. WHEN 渲染批次记录的"重新编辑"和"重新生成"按钮点击事件时，THE Create 组件 SHALL 使用 `loadReferenceFiles` 函数替代内联的加载逻辑

### Requirement 2: 任务状态监控机制统一

**User Story:** 作为开发者，我希望消除任务状态监控的冗余机制，避免潜在的竞态条件。

#### Acceptance Criteria

1. THE Create 组件 SHALL 移除 `useEffect` 中手动设置的 `setInterval` 轮询逻辑
2. THE Create 组件 SHALL 仅依赖 `useTaskRecovery` Hook 的 `onTaskComplete` 和 `onTaskFailed` 回调来处理任务完成和失败事件
3. WHEN 任务完成时，THE `onTaskComplete` 回调 SHALL 处理所有必要的状态更新，包括清除 pendingTask、刷新历史记录、更新计数器
4. WHEN 任务失败时，THE `onTaskFailed` 回调 SHALL 处理所有必要的状态更新，包括清除 pendingTask、显示错误卡片、处理配额错误

### Requirement 3: PendingTask 清理逻辑封装

**User Story:** 作为开发者，我希望 PendingTask 的清理逻辑被封装为统一函数，以便保持一致性并减少错误。

#### Acceptance Criteria

1. THE Create 组件 SHALL 提供一个 `removePendingTask` 函数，该函数接收任务标识符（tempId、taskId 或 batchId）并从 `pendingTasks` 数组中移除对应任务
2. WHEN `removePendingTask` 函数被调用时，THE 函数 SHALL 同时清理 `pendingTaskMapRef` 中的对应条目
3. WHEN 任务完成、失败或 SSE 流结束时，THE Create 组件 SHALL 使用 `removePendingTask` 函数替代分散的清理逻辑

### Requirement 4: BatchResult 对象构建统一

**User Story:** 作为开发者，我希望 BatchResult 对象的构建逻辑被提取为工厂函数，以便减少重复代码。

#### Acceptance Criteria

1. THE Create 组件 SHALL 提供一个 `createBatchResult` 工厂函数，该函数接收必要参数并返回 `BatchResult` 对象
2. THE `createBatchResult` 函数 SHALL 支持创建成功批次、失败批次和流式批次三种类型
3. WHEN 需要创建 BatchResult 对象时（包括 `handleGenerateMulti`、`handleTaskFailed`、`handleGenerateError`、`handleSSEStart`、`handleSSEComplete`），THE Create 组件 SHALL 使用 `createBatchResult` 函数

### Requirement 5: 滚动控制逻辑统一

**User Story:** 作为开发者，我希望滚动到底部的逻辑通过 useEffect 统一管理，而不是散布在各个业务函数中。

#### Acceptance Criteria

1. THE Create 组件 SHALL 使用 `useEffect` 监听 `batchResults.length`、`failedGenerations.length`、`pendingTasks.length` 和 `streamingBatch` 的变化
2. WHEN 上述状态发生变化且不是首次加载时，THE `useEffect` SHALL 自动触发滚动到底部
3. THE Create 组件 SHALL 移除业务函数中分散的 `setTimeout(scrollToBottom, 100)` 调用
4. WHEN 首次加载历史记录时，THE Create 组件 SHALL 保持现有的多阶段滚动逻辑不变

### Requirement 6: 冗余代码清理

**User Story:** 作为开发者，我希望清理组件中的冗余代码和未使用的变量，以提高代码质量。

#### Acceptance Criteria

1. THE Create 组件 SHALL 移除所有未使用的变量和导入
2. THE Create 组件 SHALL 移除 `handleRegenerateWithCheck` 函数，因为它只是直接执行回调，没有实际检查逻辑
3. THE Create 组件 SHALL 移除 `currentImageCount` 状态，统一使用 `selectedImageCount` 管理图片数量
4. THE Create 组件 SHALL 移除 `pendingTaskMapRef`，因为 `pendingTasks` 数组已经包含了 tempId 到任务的映射
5. THE Create 组件 SHALL 合并 `handleRegenerate` 和 `handleRegenerateBatchWithRef` 中的重复逻辑
6. THE Create 组件 SHALL 合并 `handleEditPrompt` 和 `handleEditBatchPromptWithRef` 中的重复逻辑

### Requirement 7: 功能完整性保证

**User Story:** 作为用户，我希望重构后的组件保持所有现有功能正常运行。

#### Acceptance Criteria

1. WHEN 用户点击"重新生成"按钮时，THE Create 组件 SHALL 正确加载参考图并触发生成
2. WHEN 用户点击"编辑提示词"按钮时，THE Create 组件 SHALL 正确填充提示词和参考图到输入框
3. WHEN 生成任务完成时，THE Create 组件 SHALL 正确显示结果并更新历史记录
4. WHEN 生成任务失败时，THE Create 组件 SHALL 正确显示错误卡片并支持重试
5. WHEN 使用 SSE 流式生成时，THE Create 组件 SHALL 正确实时显示每张图片的生成进度
6. WHEN 页面刷新后，THE Create 组件 SHALL 正确恢复进行中的任务状态
