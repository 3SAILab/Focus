# Requirements Document

## Introduction

本文档描述了 Focus 应用中图片生成功能的当前实现逻辑，包括单图生成和多图生成两种模式。系统采用异步任务架构，支持 SSE（Server-Sent Events）流式响应，实现了实时进度反馈和多任务并发处理。

## Glossary

- **Generation_System**: 图片生成系统，负责处理用户的图片生成请求
- **SSE (Server-Sent Events)**: 服务器推送事件，用于实时流式传输多图生成进度
- **BatchResult**: 批次结果，包含一次多图生成请求的所有图片结果
- **PendingTask**: 待处理任务，表示已提交但尚未完成的生成请求
- **GlobalTaskContext**: 全局任务上下文，用于跨页面管理异步任务轮询
- **tempId**: 临时 ID，用于在异步生命周期中精确关联请求和响应

## Requirements

### Requirement 1: 单图生成

**User Story:** As a user, I want to generate a single image from my prompt, so that I can quickly create AI-generated artwork.

#### Acceptance Criteria

1. WHEN a user submits a prompt with image count set to 1 THEN the Generation_System SHALL send a POST request to `/generate` endpoint
2. WHEN the backend returns `image_url` in response THEN the Generation_System SHALL display the generated image immediately
3. WHEN the backend returns `task_id` instead of `image_url` THEN the Generation_System SHALL register the task with GlobalTaskContext for polling
4. IF the generation request fails THEN the Generation_System SHALL display an error message and add a failed record to the history

### Requirement 2: 多图生成（SSE 流式模式）

**User Story:** As a user, I want to generate multiple images at once, so that I can have more options to choose from.

#### Acceptance Criteria

1. WHEN a user submits a prompt with image count greater than 1 THEN the Generation_System SHALL use SSE streaming mode via `generateWithSSE` API
2. WHEN the SSE connection receives a `start` event THEN the Generation_System SHALL create a streaming batch with loading placeholders for all images
3. WHEN the SSE connection receives an `image` event THEN the Generation_System SHALL update the corresponding image slot with the generated image or error
4. WHEN the SSE connection receives a `complete` event THEN the Generation_System SHALL finalize the batch and move it to completed results
5. IF partial images fail during generation THEN the Generation_System SHALL display error messages for failed images while showing successful ones

### Requirement 3: 任务状态管理

**User Story:** As a user, I want to see the progress of my generation tasks, so that I know when my images will be ready.

#### Acceptance Criteria

1. WHEN a generation request is submitted THEN the Generation_System SHALL create a PendingTask with a unique tempId
2. WHEN the backend returns a task_id THEN the Generation_System SHALL associate it with the corresponding tempId
3. WHILE a task is pending THEN the Generation_System SHALL display a loading placeholder card
4. WHEN a task completes or fails THEN the Generation_System SHALL remove the corresponding PendingTask

### Requirement 4: 多任务并发

**User Story:** As a user, I want to submit multiple generation requests without waiting, so that I can work more efficiently.

#### Acceptance Criteria

1. WHEN a user submits a new request while previous tasks are pending THEN the Generation_System SHALL allow the new submission
2. WHEN multiple tasks are pending THEN the Generation_System SHALL display multiple placeholder cards
3. WHEN any task completes THEN the Generation_System SHALL update only that specific task's display
4. WHEN the user navigates away and returns THEN the Generation_System SHALL recover pending tasks via useTaskRecovery hook

### Requirement 5: 输入处理

**User Story:** As a user, I want to provide prompts and reference images, so that I can guide the AI generation.

#### Acceptance Criteria

1. WHEN a user enters text in the prompt bar THEN the Generation_System SHALL include it in the generation request
2. WHEN a user uploads reference images THEN the Generation_System SHALL attach them to the FormData
3. WHEN a user pastes an image THEN the Generation_System SHALL add it to the reference images
4. WHEN a user drags and drops an image THEN the Generation_System SHALL add it to the reference images
5. WHEN a user selects an aspect ratio THEN the Generation_System SHALL include it in the generation request

### Requirement 6: 错误处理

**User Story:** As a user, I want to understand what went wrong when generation fails, so that I can take appropriate action.

#### Acceptance Criteria

1. WHEN a network error occurs THEN the Generation_System SHALL display a user-friendly error message
2. WHEN a quota error occurs THEN the Generation_System SHALL show the quota error dialog
3. WHEN a timeout occurs THEN the Generation_System SHALL inform the user that the request timed out
4. IF an error contains sensitive information THEN the Generation_System SHALL filter it using getErrorMessage utility

### Requirement 7: 历史记录集成

**User Story:** As a user, I want my generated images saved to history, so that I can access them later.

#### Acceptance Criteria

1. WHEN a generation completes successfully THEN the Generation_System SHALL reload the history from backend
2. WHEN displaying history THEN the Generation_System SHALL group batch results together
3. WHEN a user clicks regenerate on a history item THEN the Generation_System SHALL populate the prompt bar with original parameters
4. WHEN a user clicks "use as reference" THEN the Generation_System SHALL add the image to reference images

## Current Architecture Summary

### 核心组件

1. **PromptBar.tsx** - 用户输入组件
   - 处理提示词输入、图片上传、比例选择、数量选择
   - 根据 imageCount 决定使用普通请求还是 SSE 流式请求
   - 实现防抖机制防止重复提交

2. **useAsyncGeneration.ts** - 异步生成 Hook（已弃用，保留兼容）
   - 支持多任务并发
   - 使用 GlobalTaskContext 进行跨页面任务管理

3. **useSSEGeneration.ts** - SSE 流式生成 Hook
   - 管理 streamingBatch 状态
   - 处理 start/image/complete 三种 SSE 事件
   - 实时更新图片生成进度

4. **api/index.ts** - API 层
   - `generate()` - 普通生成请求
   - `generateWithSSE()` - SSE 流式生成请求
   - 支持 Mock 模式用于测试

### 数据流

```
用户输入 → PromptBar → FormData
                ↓
        imageCount > 1?
           ↓         ↓
          Yes       No
           ↓         ↓
    generateWithSSE  generate
           ↓         ↓
    SSE Events    JSON Response
           ↓         ↓
    streamingBatch  直接显示/轮询
           ↓         ↓
    BatchResult   历史记录
```

### 状态管理

- **pendingTasks**: 待处理任务列表，用于显示占位卡片
- **streamingBatch**: 当前流式生成的批次，实时更新
- **batchResults**: 已完成的批次结果列表
- **failedGenerations**: 失败的生成记录
