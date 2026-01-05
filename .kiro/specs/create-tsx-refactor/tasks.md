# Implementation Plan

- [x] 1. 提取工具函数





  - [x] 1.1 创建 `loadReferenceFiles` 函数


    - 在 Create.tsx 中定义函数，接收 `string | string[] | undefined` 参数
    - 实现 JSON 字符串解析逻辑
    - 实现 URL 遍历和 loadImageAsFile 调用
    - 实现错误处理（跳过失败的图片）
    - _Requirements: 1.1, 1.2, 1.3_
  - [ ]* 1.2 编写 `loadReferenceFiles` 属性测试
    - **Property 1: 参考图输入解析一致性**
    - **Validates: Requirements 1.2**

  - [x] 1.3 创建 `removePendingTask` 函数
    - 定义 TaskIdentifier 接口（tempId、taskId、batchId）
    - 实现根据不同标识符类型移除任务的逻辑
    - _Requirements: 3.1_
  - [ ]* 1.4 编写 `removePendingTask` 属性测试
    - **Property 2: PendingTask 移除完整性**
    - **Validates: Requirements 3.1**
  - [x] 1.5 创建 `createBatchResult` 工厂函数

    - 定义 CreateBatchResultParams 接口
    - 实现成功批次、失败批次、流式批次三种类型的构建逻辑
    - _Requirements: 4.1, 4.2_
  - [ ]* 1.6 编写 `createBatchResult` 属性测试
    - **Property 3: BatchResult 类型构建正确性**
    - **Validates: Requirements 4.1, 4.2_

- [x] 2. Checkpoint - 确保工具函数测试通过





  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. 替换参考图加载逻辑






  - [x] 3.1 重构 `handleRegenerate` 函数

    - 使用 `loadReferenceFiles` 替代内联的参考图加载逻辑
    - _Requirements: 1.4_
  - [x] 3.2 重构 `handleEditPrompt` 函数


    - 使用 `loadReferenceFiles` 替代内联的参考图加载逻辑
    - _Requirements: 1.4_

  - [x] 3.3 重构 `handleRegenerateBatchWithRef` 函数

    - 使用 `loadReferenceFiles` 替代内联的参考图加载逻辑
    - _Requirements: 1.4_

  - [x] 3.4 重构 `handleEditBatchPromptWithRef` 函数

    - 使用 `loadReferenceFiles` 替代内联的参考图加载逻辑
    - _Requirements: 1.4_

  - [x] 3.5 重构批次记录渲染中的"重新编辑"按钮点击事件

    - 使用 `loadReferenceFiles` 替代内联的参考图加载逻辑
    - _Requirements: 1.5_

  - [x] 3.6 重构批次记录渲染中的"重新生成"按钮点击事件
    - 使用 `loadReferenceFiles` 替代内联的参考图加载逻辑
    - _Requirements: 1.5_

- [x] 4. 替换 PendingTask 清理逻辑





  - [x] 4.1 重构 `handleGenerate` 中的 pendingTask 清理


    - 使用 `removePendingTask` 替代内联清理逻辑
    - _Requirements: 3.3_
  - [x] 4.2 重构 `handleGenerateMulti` 中的 pendingTask 清理


    - 使用 `removePendingTask` 替代内联清理逻辑
    - _Requirements: 3.3_
  - [x] 4.3 重构 `handleTaskComplete` 中的 pendingTask 清理


    - 使用 `removePendingTask` 替代内联清理逻辑
    - _Requirements: 3.3_
  - [x] 4.4 重构 `handleTaskFailed` 中的 pendingTask 清理


    - 使用 `removePendingTask` 替代内联清理逻辑
    - _Requirements: 3.3_
  - [x] 4.5 重构 `handleGenerateError` 中的 pendingTask 清理


    - 使用 `removePendingTask` 替代内联清理逻辑
    - _Requirements: 3.3_
  - [x] 4.6 重构 `handleSSEComplete` 中的 pendingTask 清理


    - 使用 `removePendingTask` 替代内联清理逻辑
    - _Requirements: 3.3_

- [x] 5. 替换 BatchResult 构建逻辑





  - [x] 5.1 重构 `handleGenerate` 中的 BatchResult 构建


    - 使用 `createBatchResult` 替代内联构建逻辑
    - _Requirements: 4.3_
  - [x] 5.2 重构 `handleGenerateMulti` 中的 BatchResult 构建


    - 使用 `createBatchResult` 替代内联构建逻辑
    - _Requirements: 4.3_
  - [x] 5.3 重构 `handleTaskFailed` 中的 BatchResult 构建


    - 使用 `createBatchResult` 替代内联构建逻辑
    - _Requirements: 4.3_
  - [x] 5.4 重构 `handleGenerateError` 中的 BatchResult 构建


    - 使用 `createBatchResult` 替代内联构建逻辑
    - _Requirements: 4.3_
  - [x] 5.5 重构 `handleSSEStart` 中的 BatchResult 构建


    - 使用 `createBatchResult` 替代内联构建逻辑
    - _Requirements: 4.3_
  - [x] 5.6 重构 `handleSSEComplete` 中的 BatchResult 构建


    - 使用 `createBatchResult` 替代内联构建逻辑
    - _Requirements: 4.3_

- [x] 6. Checkpoint - 确保替换后功能正常





  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. 移除冗余的任务监控机制





  - [x] 7.1 移除 useEffect 中的 setInterval 轮询逻辑


    - 删除监听 pendingTasks 的 useEffect 中的 setInterval 代码
    - 确保 useTaskRecovery 的回调能处理所有场景
    - _Requirements: 2.1, 2.2_
  - [x] 7.2 增强 `handleTaskComplete` 回调


    - 确保处理所有必要的状态更新
    - _Requirements: 2.3_
  - [x] 7.3 增强 `handleTaskFailed` 回调


    - 确保处理所有必要的状态更新
    - _Requirements: 2.4_

- [x] 8. 统一滚动控制逻辑





  - [x] 8.1 创建统一的滚动 useEffect


    - 监听 batchResults.length、failedGenerations.length、pendingTasks.length、streamingBatch 变化
    - 在非首次加载时自动触发滚动到底部
    - _Requirements: 5.1, 5.2_
  - [x] 8.2 移除业务函数中分散的 scrollToBottom 调用


    - 移除 handleGenerate、handleGenerateMulti、handleGenerateStart 等函数中的 setTimeout(scrollToBottom, 100)
    - _Requirements: 5.3_
  - [x] 8.3 保持首次加载的多阶段滚动逻辑


    - 确保 initialHistoryLoadedRef 相关逻辑不受影响
    - _Requirements: 5.4_

- [x] 9. 清理冗余代码





  - [x] 9.1 移除 `handleRegenerateWithCheck` 函数


    - 删除函数定义
    - 将所有调用点改为直接执行回调
    - _Requirements: 6.2_
  - [x] 9.2 移除 `currentImageCount` 状态


    - 删除 useState 定义
    - 将所有使用点改为 selectedImageCount
    - _Requirements: 6.3_
  - [x] 9.3 移除 `pendingTaskMapRef`


    - 删除 useRef 定义
    - 移除所有对 pendingTaskMapRef 的操作
    - _Requirements: 6.4_
  - [x] 9.4 合并重新生成函数


    - 创建统一的 `populatePromptBar` 函数
    - 重构 handleRegenerate 和 handleRegenerateBatchWithRef 使用新函数
    - _Requirements: 6.5_
  - [x] 9.5 合并编辑提示词函数


    - 重构 handleEditPrompt 和 handleEditBatchPromptWithRef 使用 populatePromptBar 函数
    - _Requirements: 6.6_
  - [x] 9.6 移除未使用的变量和导入


    - 运行 lint 检查
    - 清理所有未使用的代码
    - _Requirements: 6.1_

- [x] 10. Final Checkpoint - 确保所有测试通过





  - Ensure all tests pass, ask the user if questions arise.
