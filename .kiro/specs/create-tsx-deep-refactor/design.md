# Design Document

## Overview

本设计文档描述了对 Create.tsx 及相关视图组件进行深度重构的技术方案。重构的核心目标是：

1. **模块化**：将 1800+ 行的 Create.tsx 拆分为多个小型、职责单一的模块
2. **可复用性**：提取通用逻辑为 hooks 和工具函数
3. **可维护性**：通过组件化减少代码重复，提高可读性
4. **一致性**：统一跨视图的代码模式
5. **组件整理**：按 shadcn/ui 风格整理组件目录，合并冗余的错误处理组件

## Architecture

```
frontend/src/
├── utils/
│   ├── referenceImages.ts      # 参考图加载工具函数
│   ├── batchResult.ts          # BatchResult 工厂函数
│   └── index.ts                # 现有工具函数
├── hooks/
│   ├── useGroupedHistory.ts    # 历史记录分组 hook
│   ├── usePromptPopulation.ts  # 提示词填充 hook
│   ├── useSSEGeneration.ts     # SSE 流式生成 hook
│   ├── useDeleteConfirmation.ts # 删除确认 hook
│   └── ...existing hooks
├── components/
│   ├── ui/                     # 基础 UI 组件（shadcn/ui 风格）
│   │   ├── modal.tsx           # 通用 Modal（合并 Modal + DeleteConfirmDialog）
│   │   ├── alert-dialog.tsx    # 确认对话框（从 DeleteConfirmDialog 提取）
│   │   ├── toast.tsx           # Toast 组件
│   │   └── button.tsx          # 按钮组件
│   ├── feedback/               # 反馈类组件（合并错误处理）
│   │   ├── error-card.tsx      # 错误卡片（保留）
│   │   ├── quota-alert.tsx     # 配额警告（合并 QuotaErrorAlert + QuotaErrorHandler）
│   │   ├── network-error.tsx   # 网络错误（保留 NetworkErrorModal）
│   │   └── contact-modal.tsx   # 联系客服（保留）
│   ├── history/                # 历史记录渲染组件
│   │   ├── history-single-item.tsx
│   │   ├── history-batch-item.tsx
│   │   ├── history-failed-item.tsx
│   │   ├── history-session-batch.tsx
│   │   ├── history-pending-item.tsx
│   │   ├── history-streaming-item.tsx
│   │   ├── history-recovering-item.tsx
│   │   └── index.ts
│   ├── generation/             # 生成相关组件
│   │   ├── prompt-bar.tsx      # 提示词输入栏
│   │   ├── image-card.tsx      # 图片卡片
│   │   ├── image-grid.tsx      # 图片网格
│   │   └── placeholder-card.tsx # 占位卡片
│   └── common/                 # 通用业务组件（保留）
│       ├── page-header.tsx
│       ├── image-upload-zone.tsx
│       ├── generate-button.tsx
│       ├── history-section.tsx
│       └── index.ts
└── views/
    ├── Create.tsx              # 重构后的主视图（目标 < 500 行）
    └── ...other views
```

## 组件整理方案

### 错误处理组件合并

当前存在多个错误处理组件，职责重叠：

| 组件 | 用途 | 处理方案 |
|------|------|----------|
| ErrorCard | 显示生成失败的卡片 | 保留，移到 `feedback/` |
| QuotaErrorAlert | 配额耗尽弹窗 | 合并到 `quota-alert.tsx` |
| QuotaErrorHandler | 包装 QuotaErrorAlert + ContactModal | 删除，逻辑内联到视图 |
| NetworkErrorModal | 网络错误弹窗 | 保留，移到 `feedback/` |
| ContactModal | 联系客服弹窗 | 保留，移到 `feedback/` |
| DeleteConfirmDialog | 删除确认对话框 | 重构为通用 `alert-dialog.tsx` |

### 组件命名规范（shadcn/ui 风格）

- 使用 kebab-case 文件名：`error-card.tsx`
- 组件导出使用 PascalCase：`export function ErrorCard()`
- Props 接口命名：`ErrorCardProps`

## Components and Interfaces

### 0. 基础 UI 组件（ui/）

#### alert-dialog.tsx

通用确认对话框，替代 DeleteConfirmDialog：

```typescript
// frontend/src/components/ui/alert-dialog.tsx
export interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
}

export function AlertDialog(props: AlertDialogProps): JSX.Element;
```

### 1. 工具函数模块

#### referenceImages.ts

```typescript
// frontend/src/utils/referenceImages.ts

/**
 * 解析参考图输入为 URL 数组
 */
export function parseReferenceUrls(
  refImages: string | string[] | undefined
): string[];

/**
 * 统一的参考图加载函数
 */
export async function loadReferenceFiles(
  refImages: string | string[] | undefined
): Promise<File[]>;
```

#### batchResult.ts

```typescript
// frontend/src/utils/batchResult.ts
import type { ImageGridItem } from '../type';

export interface CreateBatchResultParams {
  batchId: string;
  prompt: string;
  imageCount: number;
  images?: Array<{ url?: string; error?: string; isLoading?: boolean }>;
  refImages?: string[];
  type: 'success' | 'failed' | 'streaming';
}

export interface BatchResult {
  batchId: string;
  images: ImageGridItem[];
  prompt: string;
  timestamp: number;
  imageCount: number;
  refImages?: string[];
}

export function createBatchResult(params: CreateBatchResultParams): BatchResult;
```

### 2. 自定义 Hooks

#### useGroupedHistory.ts

```typescript
// frontend/src/hooks/useGroupedHistory.ts
import type { GenerationHistory, GenerationTask } from '../type';
import type { BatchResult } from '../utils/batchResult';

export interface FailedGeneration {
  id: string;
  prompt: string;
  errorMessage: string;
  timestamp: number;
}

export interface PendingTask {
  id: string;
  prompt: string;
  imageCount: number;
  timestamp: number;
  taskId?: string;
  batchId?: string;
}

export interface HistoryDisplayItem {
  type: 'single' | 'batch' | 'failed' | 'session-batch' | 'pending' | 'recovering' | 'streaming';
  item?: GenerationHistory;
  batchId?: string;
  items?: GenerationHistory[];
  fullBatchItems?: (GenerationHistory | null)[];
  batchTotal?: number;
  prompt: string;
  timestamp: string | number;
  refImages?: string | string[];
  failedRecord?: FailedGeneration;
  sessionBatch?: BatchResult;
  pendingTask?: PendingTask;
  recoveringTask?: GenerationTask;
}

export interface UseGroupedHistoryParams {
  history: GenerationHistory[];
  failedGenerations: FailedGeneration[];
  batchResults: BatchResult[];
  processingTasks: GenerationTask[];
  pendingTasks: PendingTask[];
  streamingBatch: BatchResult | null;
}

export function useGroupedHistory(params: UseGroupedHistoryParams): HistoryDisplayItem[];
```

#### usePromptPopulation.ts

```typescript
// frontend/src/hooks/usePromptPopulation.ts
import type { GenerationHistory } from '../type';
import type { BatchResult } from '../utils/batchResult';

export interface UsePromptPopulationResult {
  // States
  selectedPrompt: string;
  selectedFiles: File[];
  selectedImageCount: 1 | 2 | 3 | 4;
  promptUpdateKey: number;
  triggerGenerate: boolean;
  
  // Setters
  setSelectedFiles: (files: File[]) => void;
  
  // Actions
  populatePromptBar: (params: PopulatePromptParams) => Promise<void>;
  handleRegenerate: (item: GenerationHistory) => Promise<void>;
  handleEditPrompt: (item: GenerationHistory) => Promise<void>;
  handleRegenerateBatchWithRef: (batch: BatchResult) => Promise<void>;
  handleEditBatchPromptWithRef: (batch: BatchResult) => Promise<void>;
  
  // Reset
  resetPromptState: () => void;
}

export function usePromptPopulation(toast: ToastContext): UsePromptPopulationResult;
```

#### useSSEGeneration.ts

```typescript
// frontend/src/hooks/useSSEGeneration.ts
import type { SSEStartEvent, SSEImageEvent, SSECompleteEvent } from '../api';
import type { BatchResult } from '../utils/batchResult';

export interface UseSSEGenerationParams {
  onBatchComplete: (batch: BatchResult) => void;
  loadHistory: () => Promise<void>;
}

export interface UseSSEGenerationResult {
  streamingBatch: BatchResult | null;
  handleSSEStart: (event: SSEStartEvent, tempId?: string) => void;
  handleSSEImage: (event: SSEImageEvent) => void;
  handleSSEComplete: (event: SSECompleteEvent, tempId?: string) => Promise<void>;
}

export function useSSEGeneration(params: UseSSEGenerationParams): UseSSEGenerationResult;
```

#### useDeleteConfirmation.ts

```typescript
// frontend/src/hooks/useDeleteConfirmation.ts
import type { GenerationHistory } from '../type';

export interface DeleteTarget {
  type: 'single' | 'batch' | 'failed' | 'session-batch';
  item?: GenerationHistory;
  batchId?: string;
  items?: GenerationHistory[];
  failedId?: string;
  message: string;
}

export interface UseDeleteConfirmationParams {
  loadHistory: () => Promise<void>;
  setFailedGenerations: React.Dispatch<React.SetStateAction<FailedGeneration[]>>;
  setBatchResults: React.Dispatch<React.SetStateAction<BatchResult[]>>;
  toast: ToastContext;
}

export interface UseDeleteConfirmationResult {
  deleteTarget: DeleteTarget | null;
  isDeleting: boolean;
  handleDeleteSingleClick: (item: GenerationHistory) => void;
  handleDeleteBatchClick: (batchId: string, items: GenerationHistory[]) => void;
  handleDeleteFailedRecord: (failedId: string) => void;
  handleDeleteSessionBatch: (batchId: string) => void;
  handleDeleteConfirm: () => Promise<void>;
  closeDeleteDialog: () => void;
}

export function useDeleteConfirmation(params: UseDeleteConfirmationParams): UseDeleteConfirmationResult;
```

### 3. 历史记录渲染组件

每个组件接收特定类型的 HistoryDisplayItem 和必要的回调函数：

```typescript
// frontend/src/components/history/history-single-item.tsx
export interface HistorySingleItemProps {
  item: GenerationHistory;
  onImageClick: (url: string) => void;
  onRegenerate: (item: GenerationHistory) => void;
  onEditPrompt: (item: GenerationHistory) => void;
  onUseAsReference: (url: string) => void;
  onDelete: (item: GenerationHistory) => void;
}

// frontend/src/components/history/history-batch-item.tsx
export interface HistoryBatchItemProps {
  displayItem: HistoryDisplayItem;
  onImageClick: (url: string) => void;
  onRegenerate: (prompt: string, refImages?: string | string[], imageCount?: number) => void;
  onEditPrompt: (prompt: string, refImages?: string | string[], imageCount?: number) => void;
  onUseAsReference: (url: string) => void;
  onDelete: (batchId: string, items: GenerationHistory[]) => void;
}

// ... similar interfaces for other history item components
```

### 4. 反馈组件整理（feedback/）

#### quota-alert.tsx

合并 QuotaErrorAlert 和 QuotaErrorHandler 的功能：

```typescript
// frontend/src/components/feedback/quota-alert.tsx
export interface QuotaAlertProps {
  isOpen: boolean;
  onClose: () => void;
  onContactSales: () => void;
}

export function QuotaAlert(props: QuotaAlertProps): JSX.Element;

// 同时导出一个组合组件，包含 QuotaAlert + ContactModal
export interface QuotaErrorHandlerProps {
  showQuotaError: boolean;
  showContact: boolean;
  onQuotaErrorClose: () => void;
  onContactClose: () => void;
  onContactSales: () => void;
}

export function QuotaErrorHandler(props: QuotaErrorHandlerProps): JSX.Element;
```

## Data Models

### 现有数据模型（保持不变）

- `GenerationHistory`: 历史记录数据结构
- `GenerationTask`: 任务数据结构
- `ImageGridItem`: 图片网格项数据结构

### 新增/提取的数据模型

- `BatchResult`: 从 Create.tsx 提取到 `utils/batchResult.ts`
- `FailedGeneration`: 从 Create.tsx 提取到 `hooks/useGroupedHistory.ts`
- `PendingTask`: 从 Create.tsx 提取到 `hooks/useGroupedHistory.ts`
- `HistoryDisplayItem`: 从 Create.tsx 提取到 `hooks/useGroupedHistory.ts`
- `DeleteTarget`: 从 Create.tsx 提取到 `hooks/useDeleteConfirmation.ts`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Utility Function Behavior Preservation

*For any* valid input to `loadReferenceFiles` or `createBatchResult`, the output from the extracted utility function SHALL be identical to the output from the original inline implementation.

**Validates: Requirements 1.4**

### Property 2: History Grouping Timestamp Ordering

*For any* combination of history items, failed generations, batch results, processing tasks, pending tasks, and streaming batch, the output of `useGroupedHistory` SHALL be sorted in ascending order by timestamp.

**Validates: Requirements 3.3**

### Property 3: Batch Grouping Correctness

*For any* history array containing items with the same `batch_id`, `useGroupedHistory` SHALL group them into a single `HistoryDisplayItem` of type 'batch' with `fullBatchItems` array of length equal to `batch_total`.

**Validates: Requirements 3.4**

## Error Handling

1. **参考图加载失败**：`loadReferenceFiles` 跳过失败的图片，继续处理其他图片，返回成功加载的文件数组
2. **历史记录分组异常**：`useGroupedHistory` 对无效数据进行防御性处理，确保不会崩溃
3. **删除操作失败**：`useDeleteConfirmation` 捕获 API 错误并通过 toast 显示友好消息
4. **SSE 连接中断**：`useSSEGeneration` 处理连接错误，清理 streamingBatch 状态

## Testing Strategy

### 单元测试

使用 Vitest 进行单元测试：

1. **工具函数测试**
   - `parseReferenceUrls`: 测试各种输入格式（数组、JSON 字符串、单个 URL、空值）
   - `createBatchResult`: 测试三种类型（success、failed、streaming）的创建

2. **Hook 测试**
   - `useGroupedHistory`: 测试分组逻辑、排序、边界情况
   - `usePromptPopulation`: 测试状态管理和回调函数
   - `useDeleteConfirmation`: 测试删除流程

3. **组件测试**
   - 各 History 组件的渲染测试
   - Props 传递和回调触发测试

### 属性测试

使用 fast-check 进行属性测试：

1. **Property 1**: 生成随机的参考图输入，验证提取后的函数行为与原实现一致
2. **Property 2**: 生成随机的历史数据组合，验证输出按时间戳排序
3. **Property 3**: 生成带有 batch_id 的历史数据，验证分组正确性

### 测试配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // 属性测试运行 100 次迭代
    testTimeout: 30000,
  },
});
```

