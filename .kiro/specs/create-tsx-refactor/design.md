# Design Document

## Overview

本设计文档描述了对 `frontend/src/views/Create.tsx` 组件进行重构的技术方案。重构的核心目标是消除代码冗余、统一逻辑处理、提高可维护性，同时确保所有现有功能正常运行。

重构将采用渐进式方法，每个步骤都保持组件可运行状态，避免大规模破坏性修改。

## Architecture

### 当前架构问题

```
Create.tsx (1767 行)
├── 状态管理 (30+ 个 useState)
├── 参考图加载逻辑 (重复 6 次)
├── 任务监控 (2 套冗余机制)
├── PendingTask 清理 (分散在 7+ 处)
├── BatchResult 构建 (重复 6 次)
├── 滚动控制 (分散在 10+ 处)
└── 渲染逻辑 (内联大量业务代码)
```

### 重构后架构

```
Create.tsx (预计 ~1200 行)
├── 状态管理 (精简后 ~25 个 useState)
├── 工具函数
│   ├── loadReferenceFiles()      - 统一参考图加载
│   ├── removePendingTask()       - 统一任务清理
│   └── createBatchResult()       - 统一批次构建
├── 任务监控 (仅 useTaskRecovery)
├── 滚动控制 (统一 useEffect)
└── 渲染逻辑 (简化后的事件处理)
```

## Components and Interfaces

### 1. loadReferenceFiles 函数

```typescript
/**
 * 统一的参考图加载函数
 * @param refImages - 参考图 URL 数组或 JSON 字符串
 * @returns Promise<File[]> - 加载成功的 File 对象数组
 */
const loadReferenceFiles = async (
  refImages: string | string[] | undefined
): Promise<File[]> => {
  // 1. 解析输入参数
  // 2. 遍历 URL 列表，调用 loadImageAsFile
  // 3. 过滤掉加载失败的图片
  // 4. 返回 File 数组
};
```

### 2. removePendingTask 函数

```typescript
/**
 * 统一的 PendingTask 清理函数
 * @param identifier - 任务标识符对象
 */
interface TaskIdentifier {
  tempId?: string;
  taskId?: string;
  batchId?: string;
}

const removePendingTask = (identifier: TaskIdentifier): void => {
  // 根据提供的标识符类型，从 pendingTasks 中移除对应任务
};
```

### 3. createBatchResult 工厂函数

```typescript
/**
 * 统一的 BatchResult 构建函数
 */
interface CreateBatchResultParams {
  batchId: string;
  prompt: string;
  imageCount: number;
  images?: Array<{ url?: string; error?: string; isLoading?: boolean }>;
  refImages?: string[];
  type: 'success' | 'failed' | 'streaming';
}

const createBatchResult = (params: CreateBatchResultParams): BatchResult => {
  // 根据类型构建对应的 BatchResult 对象
};
```

### 4. 统一的重新生成/编辑函数

```typescript
/**
 * 统一的提示词填充函数（合并 handleRegenerate 和 handleEditPrompt 逻辑）
 */
interface PopulatePromptParams {
  prompt: string;
  refImages?: string | string[];
  imageCount?: number;
  autoTrigger: boolean;  // true = 重新生成, false = 仅编辑
}

const populatePromptBar = async (params: PopulatePromptParams): Promise<void> => {
  // 1. 加载参考图
  // 2. 设置提示词、参考图、图片数量
  // 3. 根据 autoTrigger 决定是否触发生成
};
```

## Data Models

### 现有数据模型（保持不变）

```typescript
interface PendingTask {
  id: string;           // tempId
  prompt: string;
  imageCount: number;
  timestamp: number;
  taskId?: string;      // 后端任务 ID
  batchId?: string;     // 批次 ID (SSE 模式)
}

interface BatchResult {
  batchId: string;
  images: ImageGridItem[];
  prompt: string;
  timestamp: number;
  imageCount: number;
  refImages?: string[];
}

interface FailedGeneration {
  id: string;
  prompt: string;
  errorMessage: string;
  timestamp: number;
}
```

### 移除的状态

```typescript
// 移除：currentImageCount - 统一使用 selectedImageCount
// 移除：pendingTaskMapRef - pendingTasks 数组已包含映射关系
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

经过分析，大部分需求是代码结构和架构方面的要求，需要通过代码审查验证，而非运行时属性测试。可测试的属性主要集中在工具函数的行为上：

1. `loadReferenceFiles` 的输入解析属性
2. `removePendingTask` 的数组操作属性
3. `createBatchResult` 的类型构建属性

这些属性可以合并为更通用的测试。

### Correctness Properties

**Property 1: 参考图输入解析一致性**

*For any* 有效的参考图输入（无论是 `string[]` 数组还是 JSON 字符串格式），`loadReferenceFiles` 函数解析后应产生相同的 URL 列表用于加载。

**Validates: Requirements 1.2**

**Property 2: PendingTask 移除完整性**

*For any* `pendingTasks` 数组和有效的任务标识符（tempId、taskId 或 batchId），调用 `removePendingTask` 后，数组中不应存在匹配该标识符的任务。

**Validates: Requirements 3.1**

**Property 3: BatchResult 类型构建正确性**

*For any* `createBatchResult` 的输入参数，返回的 `BatchResult` 对象应包含所有必需字段（batchId、images、prompt、timestamp、imageCount），且 `images` 数组长度应等于 `imageCount`。

**Validates: Requirements 4.1, 4.2**

## Error Handling

### 参考图加载错误

- 单个图片加载失败时，跳过该图片，继续处理其他图片
- 所有图片加载失败时，返回空数组，不抛出异常
- 在 catch 块中记录警告日志，便于调试

### 任务状态错误

- 任务标识符不存在时，`removePendingTask` 静默返回，不抛出异常
- 任务状态不一致时（如 pendingTask 已被移除），保持幂等性

### 批次构建错误

- 参数缺失时，使用合理的默认值
- `imageCount` 为 0 或负数时，默认为 1

## Testing Strategy

### 单元测试

由于本次重构主要是代码结构优化，单元测试将聚焦于提取的工具函数：

1. **loadReferenceFiles 测试**
   - 测试 `string[]` 输入格式
   - 测试 JSON 字符串输入格式
   - 测试空输入和 undefined 输入
   - 测试部分 URL 加载失败的情况

2. **removePendingTask 测试**
   - 测试通过 tempId 移除
   - 测试通过 taskId 移除
   - 测试通过 batchId 移除
   - 测试标识符不存在的情况

3. **createBatchResult 测试**
   - 测试成功批次创建
   - 测试失败批次创建
   - 测试流式批次创建

### 属性测试

使用 fast-check 库进行属性测试：

1. **Property 1 测试**: 生成随机 URL 数组，验证 `string[]` 和 JSON 字符串格式解析结果一致
2. **Property 2 测试**: 生成随机 pendingTasks 数组和标识符，验证移除后数组不包含该任务
3. **Property 3 测试**: 生成随机参数，验证返回的 BatchResult 结构正确

### 集成测试

通过手动测试验证功能完整性：

1. 重新生成功能（单图和批次）
2. 编辑提示词功能（单图和批次）
3. 任务完成和失败处理
4. SSE 流式生成
5. 页面刷新后任务恢复

## Implementation Notes

### 重构顺序

为确保每步都保持组件可运行，建议按以下顺序进行：

1. **第一阶段**: 提取工具函数（不修改调用点）
2. **第二阶段**: 替换调用点使用新函数
3. **第三阶段**: 移除冗余代码和状态
4. **第四阶段**: 统一滚动控制
5. **第五阶段**: 清理和优化

### 风险点

1. **任务监控机制变更**: 移除 setInterval 轮询后，需确保 useTaskRecovery 能正确处理所有场景
2. **滚动控制变更**: 统一滚动逻辑后，需确保不影响首次加载和加载更多的滚动行为
3. **状态依赖**: 移除 currentImageCount 后，需确保所有使用点都改为 selectedImageCount
