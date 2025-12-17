# Multi-Image Generation Design Document

## Overview

实现一次生成 1-4 张图片的功能，包括前端 UI 选择器、网格布局展示、后端批量生成支持。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
├─────────────────────────────────────────────────────────────┤
│  PromptBar                                                   │
│  ├── CountSelector (新增: 1/2/3/4 选择)                      │
│  ├── AspectRatioSelector (现有)                              │
│  └── Submit Button                                           │
├─────────────────────────────────────────────────────────────┤
│  Create.tsx                                                  │
│  ├── ImageGrid (新增: 网格布局组件)                          │
│  │   ├── 1 image: 单列全宽                                   │
│  │   ├── 2 images: 2列并排                                   │
│  │   └── 3-4 images: 2x2 网格                                │
│  ├── ImageCard (现有: 单图卡片)                              │
│  └── ErrorCard (现有: 错误占位)                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
├─────────────────────────────────────────────────────────────┤
│  POST /generate                                              │
│  ├── 接收 count 参数 (1-4)                                   │
│  ├── 循环调用 AI API                                         │
│  ├── 返回 image_urls 数组                                    │
│  └── 存储多条历史记录 (共享 batch_id)                        │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. CountSelector 组件 (新增)

```typescript
interface CountSelectorProps {
  value: number;        // 当前选择的数量 (1-4)
  onChange: (count: number) => void;
  disabled?: boolean;
}
```

位置：放在 PromptBar 右侧，与 AspectRatioSelector 并排

### 2. ImageGrid 组件 (新增)

```typescript
interface ImageGridProps {
  images: Array<{
    url?: string;           // 图片 URL (成功时)
    error?: string;         // 错误信息 (失败时)
    isLoading?: boolean;    // 是否加载中
  }>;
  onImageClick: (url: string) => void;
  onRetry?: (index: number) => void;
  onUseAsReference?: (url: string) => void;
}
```

布局逻辑：
- 1 张图：`grid-cols-1`，图片最大宽度 `max-w-xl`
- 2 张图：`grid-cols-2`，每张图宽度 50%
- 3-4 张图：`grid-cols-2`，2x2 网格

### 3. API 接口变更

**请求参数新增：**
```typescript
interface GenerateRequest {
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  images?: File[];
  count?: number;  // 新增：生成数量 (1-4)，默认 1
}
```

**响应结构变更：**
```typescript
// 单图响应 (向后兼容)
interface GenerateResponse {
  image_url: string;
  prompt: string;
  batch_id?: string;
}

// 多图响应
interface GenerateMultiResponse {
  images: Array<{
    image_url?: string;
    error?: string;
  }>;
  prompt: string;
  batch_id: string;
}
```

### 4. 数据库模型变更

```go
type GenerationHistory struct {
    // ... 现有字段
    BatchID    string `json:"batch_id"`     // 新增：批次 ID
    BatchIndex int    `json:"batch_index"`  // 新增：批次内序号 (0-3)
    BatchTotal int    `json:"batch_total"`  // 新增：批次总数
}
```

## Data Models

### 前端状态

```typescript
// Create.tsx 新增状态
const [imageCount, setImageCount] = useState(1);
const [batchResults, setBatchResults] = useState<BatchResult[]>([]);

interface BatchResult {
  batchId: string;
  images: Array<{
    url?: string;
    error?: string;
    isLoading: boolean;
  }>;
  prompt: string;
  timestamp: number;
}
```

## Error Handling

1. **部分失败处理**：
   - 后端返回成功和失败的混合结果
   - 前端在对应位置显示 ErrorCard
   - 用户可单独重试失败的图片

2. **全部失败处理**：
   - 显示完整的 ErrorCard 网格
   - 提供"全部重试"按钮

3. **超时处理**：
   - 每张图独立超时 (270s)
   - 超时的图显示为失败

## Testing Strategy

### 单元测试
- CountSelector 组件渲染和交互
- ImageGrid 布局计算
- API 参数序列化

### 集成测试
- 完整的多图生成流程
- 部分失败场景
- 历史记录加载和显示

## UI 布局细节

### 网格尺寸计算

当前 ImageCard 容器最大宽度为 `max-w-xl` (576px)。

多图布局：
- 2 张图：每张 ~280px 宽，间距 16px
- 4 张图：每张 ~280px 宽，2x2 网格

```css
/* 网格布局样式 */
.image-grid-1 { grid-template-columns: 1fr; max-width: 576px; }
.image-grid-2 { grid-template-columns: repeat(2, 1fr); max-width: 576px; gap: 12px; }
.image-grid-4 { grid-template-columns: repeat(2, 1fr); max-width: 576px; gap: 12px; }
```

### 图片比例处理

- 保持原始比例，使用 `object-contain` 或 `object-cover`
- 网格单元格使用固定宽高比 `aspect-square` 或根据选择的比例动态调整
