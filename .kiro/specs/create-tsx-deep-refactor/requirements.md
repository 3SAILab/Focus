# Requirements Document

## Introduction

本文档定义了对 Create.tsx 及相关视图组件进行深度重构的需求。当前 Create.tsx 文件超过 1800 行，包含大量内联工具函数、复杂的渲染逻辑和重复的状态管理模式。此外，WhiteBackground、LightShadow、ProductScene、ClothingChange 等视图存在大量相似的代码结构。本次重构旨在：
- 将 Create.tsx 拆分为更小、更可维护的模块
- 提取可复用的工具函数到独立文件
- 创建可复用的视图组件模式
- 减少跨视图的代码重复

## Glossary

- **Create.tsx**: AI 创意工坊主视图组件，支持多图生成、SSE 流式生成、历史记录管理等功能
- **BatchResult**: 批次生成结果的数据结构，包含多张图片的生成状态
- **PendingTask**: 正在处理中的任务数据结构
- **HistoryDisplayItem**: 历史记录显示项的联合类型，支持单图、批次、失败记录等多种类型
- **SSE (Server-Sent Events)**: 服务器推送事件，用于流式生成图片
- **useAsyncGeneration**: 异步生成 hook，管理任务状态和轮询

## Requirements

### Requirement 1

**User Story:** As a developer, I want utility functions extracted to separate files, so that Create.tsx is smaller and functions are reusable.

#### Acceptance Criteria

1. WHEN the application loads THEN the system SHALL import `loadReferenceFiles` and `parseReferenceUrls` from `frontend/src/utils/referenceImages.ts`
2. WHEN the application loads THEN the system SHALL import `createBatchResult` from `frontend/src/utils/batchResult.ts`
3. WHEN the application loads THEN the system SHALL import `removePendingTask` logic as a reusable utility or keep it as a component-specific callback
4. WHEN utility functions are moved THEN the system SHALL maintain identical function signatures and behavior
5. WHEN utility functions are moved THEN the system SHALL export TypeScript interfaces (TaskIdentifier, CreateBatchResultParams, BatchResult) from the utility files

### Requirement 2

**User Story:** As a developer, I want the history rendering logic extracted to separate components, so that Create.tsx is more readable and maintainable.

#### Acceptance Criteria

1. WHEN rendering a single history item THEN the system SHALL use a `HistorySingleItem` component from `frontend/src/components/history/HistorySingleItem.tsx`
2. WHEN rendering a batch history item THEN the system SHALL use a `HistoryBatchItem` component from `frontend/src/components/history/HistoryBatchItem.tsx`
3. WHEN rendering a failed generation THEN the system SHALL use a `HistoryFailedItem` component from `frontend/src/components/history/HistoryFailedItem.tsx`
4. WHEN rendering a session batch THEN the system SHALL use a `HistorySessionBatch` component from `frontend/src/components/history/HistorySessionBatch.tsx`
5. WHEN rendering a pending task THEN the system SHALL use a `HistoryPendingItem` component from `frontend/src/components/history/HistoryPendingItem.tsx`
6. WHEN rendering a streaming batch THEN the system SHALL use a `HistoryStreamingItem` component from `frontend/src/components/history/HistoryStreamingItem.tsx`
7. WHEN rendering a recovering task THEN the system SHALL use a `HistoryRecoveringItem` component from `frontend/src/components/history/HistoryRecoveringItem.tsx`

### Requirement 3

**User Story:** As a developer, I want the history grouping logic extracted to a custom hook, so that the complex useMemo logic is isolated and testable.

#### Acceptance Criteria

1. WHEN Create.tsx needs grouped history THEN the system SHALL call `useGroupedHistory` hook from `frontend/src/hooks/useGroupedHistory.ts`
2. WHEN `useGroupedHistory` is called THEN the system SHALL accept history, failedGenerations, batchResults, processingTasks, pendingTasks, and streamingBatch as parameters
3. WHEN `useGroupedHistory` processes data THEN the system SHALL return an array of `HistoryDisplayItem` sorted by timestamp
4. WHEN history items have batch_id THEN the system SHALL group them correctly with fullBatchItems array for layout stability

### Requirement 4

**User Story:** As a developer, I want the prompt population logic extracted to a custom hook, so that the state management is cleaner.

#### Acceptance Criteria

1. WHEN Create.tsx needs to populate the prompt bar THEN the system SHALL call `usePromptPopulation` hook
2. WHEN `usePromptPopulation` is called THEN the system SHALL manage selectedPrompt, selectedFiles, selectedImageCount, promptUpdateKey, and triggerGenerate states
3. WHEN `populatePromptBar` is called THEN the system SHALL load reference files, set states, and optionally trigger generation
4. WHEN the hook is used THEN the system SHALL expose handleRegenerate, handleEditPrompt, handleRegenerateBatchWithRef, and handleEditBatchPromptWithRef functions

### Requirement 5

**User Story:** As a developer, I want a shared base pattern for generation views, so that WhiteBackground, LightShadow, ProductScene, and ClothingChange have consistent structure.

#### Acceptance Criteria

1. WHEN a generation view is created THEN the system SHALL use consistent state management patterns for generatedImage, history, lightboxImage, counterRefresh, showQuotaError, showContact, and contextMenu
2. WHEN a generation view handles task completion THEN the system SHALL use the same callback pattern (handleTaskComplete, handleTaskFailed, handleError)
3. WHEN a generation view renders THEN the system SHALL use PageHeader, ImageUploadZone, GenerateButton, HistorySection, Lightbox, QuotaErrorHandler, and ImageContextMenu components consistently
4. WHEN a generation view loads history THEN the system SHALL use a consistent loadHistory callback pattern

### Requirement 6

**User Story:** As a developer, I want the SSE handling logic extracted to a custom hook, so that Create.tsx is simpler and SSE logic is reusable.

#### Acceptance Criteria

1. WHEN Create.tsx needs SSE handling THEN the system SHALL call `useSSEGeneration` hook from `frontend/src/hooks/useSSEGeneration.ts`
2. WHEN `useSSEGeneration` is called THEN the system SHALL manage streamingBatch state internally
3. WHEN SSE events are received THEN the system SHALL expose handleSSEStart, handleSSEImage, and handleSSEComplete callbacks
4. WHEN SSE generation completes THEN the system SHALL call the provided onComplete callback with the final batch result

### Requirement 7

**User Story:** As a developer, I want the delete confirmation logic extracted to a custom hook, so that the delete state management is isolated.

#### Acceptance Criteria

1. WHEN Create.tsx needs delete confirmation THEN the system SHALL call `useDeleteConfirmation` hook
2. WHEN `useDeleteConfirmation` is called THEN the system SHALL manage deleteTarget and isDeleting states
3. WHEN delete is confirmed THEN the system SHALL call the appropriate API and refresh history
4. WHEN the hook is used THEN the system SHALL expose handleDeleteSingleClick, handleDeleteBatchClick, handleDeleteFailedRecord, handleDeleteSessionBatch, and handleDeleteConfirm functions

### Requirement 8

**User Story:** As a developer, I want components organized following shadcn/ui conventions, so that the codebase is consistent and maintainable.

#### Acceptance Criteria

1. WHEN organizing components THEN the system SHALL use kebab-case file names for all component files
2. WHEN organizing components THEN the system SHALL group UI primitives in `components/ui/` directory
3. WHEN organizing components THEN the system SHALL group feedback components in `components/feedback/` directory
4. WHEN organizing components THEN the system SHALL group history rendering components in `components/history/` directory

### Requirement 9

**User Story:** As a developer, I want redundant error handling components consolidated, so that there is a single source of truth for each error type.

#### Acceptance Criteria

1. WHEN handling quota errors THEN the system SHALL use a single `QuotaAlert` component from `components/feedback/quota-alert.tsx`
2. WHEN the `QuotaErrorHandler` wrapper is needed THEN the system SHALL import it from `components/feedback/quota-alert.tsx`
3. WHEN showing delete confirmation THEN the system SHALL use a generic `AlertDialog` component from `components/ui/alert-dialog.tsx`
4. WHEN the refactoring is complete THEN the system SHALL remove the deprecated `QuotaErrorAlert.tsx` and `DeleteConfirmDialog.tsx` files

