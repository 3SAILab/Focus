# Implementation Plan

- [x] 1. 创建基础 UI 组件目录结构





  - [x] 1.1 创建 `components/ui/` 目录和 `alert-dialog.tsx`


    - 创建通用确认对话框组件，支持 default 和 destructive 变体
    - 支持 isLoading 状态
    - _Requirements: 8.2, 9.3_
  - [x] 1.2 迁移 `Modal` 组件到 `components/ui/modal.tsx`


    - 重命名文件为 kebab-case
    - 更新导出
    - _Requirements: 8.1, 8.2_

- [x] 2. 整理反馈组件







  - [x] 2.1 创建 `components/feedback/` 目录


    - 创建目录结构
    - _Requirements: 8.3_
  - [x] 2.2 合并 `QuotaErrorAlert` 和 `QuotaErrorHandler` 到 `feedback/quota-alert.tsx`




    - 将两个组件合并到一个文件
    - 导出 `QuotaAlert` 和 `QuotaErrorHandler`
    - _Requirements: 9.1, 9.2_


  - [x] 2.3 迁移 `ErrorCard` 到 `feedback/error-card.tsx`


    - 重命名文件为 kebab-case


    - _Requirements: 8.1, 8.3_
  - [ ] 2.4 迁移 `NetworkErrorModal` 到 `feedback/network-error.tsx`
    - 重命名文件为 kebab-case
    - _Requirements: 8.1, 8.3_
  - [ ] 2.5 迁移 `ContactModal` 到 `feedback/contact-modal.tsx`
    - 重命名文件为 kebab-case
    - _Requirements: 8.1, 8.3_

- [x] 3. 提取工具函数





  - [x] 3.1 创建 `utils/referenceImages.ts`


    - 从 Create.tsx 提取 `parseReferenceUrls` 和 `loadReferenceFiles`
    - 导出函数和类型
    - _Requirements: 1.1, 1.4, 1.5_
  - [ ]* 3.2 编写 `parseReferenceUrls` 属性测试
    - **Property 1: 工具函数行为保持一致**
    - **Validates: Requirements 1.4**
  - [x] 3.3 创建 `utils/batchResult.ts`


    - 从 Create.tsx 提取 `createBatchResult` 和相关类型
    - 导出 `BatchResult`, `CreateBatchResultParams`, `createBatchResult`
    - _Requirements: 1.2, 1.4, 1.5_
  - [ ]* 3.4 编写 `createBatchResult` 属性测试
    - **Property 1: 工具函数行为保持一致**
    - **Validates: Requirements 1.4**

- [x] 4. Checkpoint - 确保工具函数和组件迁移正常





  - Ensure all tests pass, ask the user if questions arise.


- [x] 5. 创建历史记录分组 Hook





  - [x] 5.1 创建 `hooks/useGroupedHistory.ts`

    - 从 Create.tsx 提取 `groupedHistory` useMemo 逻辑
    - 导出 `HistoryDisplayItem`, `FailedGeneration`, `PendingTask` 类型
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ]* 5.2 编写 `useGroupedHistory` 属性测试 - 时间戳排序
    - **Property 2: 历史分组按时间戳排序**
    - **Validates: Requirements 3.3**
  - [ ]* 5.3 编写 `useGroupedHistory` 属性测试 - 批次分组
    - **Property 3: 批次分组正确性**
    - **Validates: Requirements 3.4**

- [x] 6. 创建历史记录渲染组件





  - [x] 6.1 创建 `components/history/` 目录和 `index.ts`


    - 创建目录结构和导出文件
    - _Requirements: 8.4_
  - [x] 6.2 创建 `history/history-single-item.tsx`


    - 从 Create.tsx 提取单图历史项渲染逻辑
    - _Requirements: 2.1_
  - [x] 6.3 创建 `history/history-batch-item.tsx`


    - 从 Create.tsx 提取批次历史项渲染逻辑
    - _Requirements: 2.2_
  - [x] 6.4 创建 `history/history-failed-item.tsx`


    - 从 Create.tsx 提取失败记录渲染逻辑
    - _Requirements: 2.3_
  - [x] 6.5 创建 `history/history-session-batch.tsx`


    - 从 Create.tsx 提取当前会话批次渲染逻辑
    - _Requirements: 2.4_
  - [x] 6.6 创建 `history/history-pending-item.tsx`


    - 从 Create.tsx 提取待处理任务渲染逻辑
    - _Requirements: 2.5_
  - [x] 6.7 创建 `history/history-streaming-item.tsx`


    - 从 Create.tsx 提取流式生成渲染逻辑
    - _Requirements: 2.6_
  - [x] 6.8 创建 `history/history-recovering-item.tsx`


    - 从 Create.tsx 提取恢复中任务渲染逻辑
    - _Requirements: 2.7_

- [x] 7. Checkpoint - 确保历史组件正常工作





  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. 创建提示词填充 Hook







  - [ ] 8.1 创建 `hooks/usePromptPopulation.ts`
    - 提取 selectedPrompt, selectedFiles, selectedImageCount 等状态
    - 提取 populatePromptBar, handleRegenerate, handleEditPrompt 等函数
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. 创建 SSE 生成 Hook






  - [x] 9.1 创建 `hooks/useSSEGeneration.ts`

    - 提取 streamingBatch 状态
    - 提取 handleSSEStart, handleSSEImage, handleSSEComplete 回调
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 10. 创建删除确认 Hook






  - [x] 10.1 创建 `hooks/useDeleteConfirmation.ts`

    - 提取 deleteTarget, isDeleting 状态
    - 提取删除相关的处理函数
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 11. 重构 Create.tsx






  - [x] 11.1 更新 Create.tsx 导入

    - 导入新的工具函数、hooks 和组件
    - 移除内联定义的函数和类型
    - _Requirements: 1.1, 1.2, 1.3_


  - [x] 11.2 使用新的 hooks 替换内联逻辑





    - 使用 useGroupedHistory 替换 groupedHistory useMemo
    - 使用 usePromptPopulation 替换提示词状态管理
    - 使用 useSSEGeneration 替换 SSE 处理逻辑


    - 使用 useDeleteConfirmation 替换删除确认逻辑

    - _Requirements: 3.1, 4.1, 6.1, 7.1_

  - [ ] 11.3 使用新的历史组件替换内联渲染
    - 使用 HistorySingleItem, HistoryBatchItem 等组件
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  - [ ] 11.4 使用 AlertDialog 替换 DeleteConfirmDialog
    - 更新删除确认对话框的使用
    - _Requirements: 9.3_

- [x] 12. 更新其他视图的导入






  - [x] 12.1 更新 WhiteBackground.tsx 的导入

    - 更新 QuotaErrorHandler 的导入路径
    - _Requirements: 9.2_

  - [x] 12.2 更新 LightShadow.tsx 的导入

    - 更新 QuotaErrorHandler 的导入路径
    - _Requirements: 9.2_

  - [x] 12.3 更新 ProductScene.tsx 的导入

    - 更新 QuotaErrorHandler 的导入路径
    - _Requirements: 9.2_
  - [x] 12.4 更新 ClothingChange.tsx 的导入


    - 更新 QuotaErrorHandler 的导入路径
    - _Requirements: 9.2_

- [x] 13. 清理冗余文件





  - [x] 13.1 删除 `components/QuotaErrorAlert.tsx`


    - 已合并到 feedback/quota-alert.tsx
    - _Requirements: 9.4_
  - [x] 13.2 删除 `components/DeleteConfirmDialog.tsx`


    - 已替换为 ui/alert-dialog.tsx
    - _Requirements: 9.4_
  - [x] 13.3 删除 `components/common/QuotaErrorHandler.tsx`


    - 已合并到 feedback/quota-alert.tsx
    - _Requirements: 9.4_
  - [x] 13.4 更新 `components/common/index.ts`


    - 移除已删除组件的导出
    - 添加新组件的导出
    - _Requirements: 8.2, 8.3_

- [x] 14. Final Checkpoint - 确保所有测试通过
















































  - Ensure all tests pass, ask the user if questions arise.

