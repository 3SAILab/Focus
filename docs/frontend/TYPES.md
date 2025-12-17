# 类型定义文档

Focus 前端使用 TypeScript 进行类型定义，主要类型位于 `frontend/src/type/index.ts`。

## 核心类型

### GenerationType

生成类型常量对象。

```typescript
export const GenerationType = {
  CREATE: 'create',                    // 创作空间
  WHITE_BACKGROUND: 'white_background', // 白底图
  CLOTHING_CHANGE: 'clothing_change',   // 换装
  PRODUCT_SCENE: 'product_scene',       // 商品图
  LIGHT_SHADOW: 'light_shadow',         // 光影融合
} as const;

export type GenerationTypeValue = typeof GenerationType[keyof typeof GenerationType];
// 等价于: 'create' | 'white_background' | 'clothing_change' | 'product_scene' | 'light_shadow'
```

**用法：**

```typescript
import { GenerationType, GenerationTypeValue } from '../type';

const type: GenerationTypeValue = GenerationType.CREATE;
```

---

### GenerationHistory

生成历史记录类型。

```typescript
export interface GenerationHistory {
  id?: number;                    // 记录 ID
  prompt: string;                 // 处理后的提示词
  original_prompt?: string;       // 用户原始输入
  image_url: string;              // 生成图片 URL
  file_name: string;              // 图片文件名
  ref_images?: string;            // 参考图片 URL 数组（JSON 字符串）
  type?: GenerationTypeValue;     // 生成类型
  created_at: string;             // 创建时间（ISO 格式）
  updated_at?: string;            // 更新时间
}
```

**示例数据：**

```json
{
  "id": 1,
  "prompt": "一只可爱的猫咪",
  "original_prompt": "画一只猫",
  "image_url": "https://localhost:8080/images/gen_123.png",
  "file_name": "gen_123.png",
  "ref_images": "[\"https://localhost:8080/uploads/ref_123.png\"]",
  "type": "create",
  "created_at": "2025-01-01T12:00:00Z",
  "updated_at": "2025-01-01T12:00:00Z"
}
```

---

### GenerationTask

生成任务类型，用于任务状态追踪和恢复。

```typescript
export type TaskStatus = 'processing' | 'completed' | 'failed';

export interface GenerationTask {
  id: number;                     // 数据库 ID
  task_id: string;                // 任务唯一标识（UUID）
  status: TaskStatus;             // 任务状态
  type: GenerationTypeValue;      // 生成类型
  prompt: string;                 // 提示词
  ref_images: string;             // 参考图片 URL 数组（JSON）
  image_url: string;              // 生成结果图片 URL
  error_msg: string;              // 错误信息
  started_at: string;             // 开始时间
  created_at: string;             // 创建时间
  updated_at: string;             // 更新时间
}
```

**状态流转：**

```
processing → completed  (生成成功)
processing → failed     (生成失败)
```

---

### GenerationStats

生成统计类型。

```typescript
export interface GenerationStats {
  total_count: number;            // 总生成次数
}
```

---

### AspectRatio

宽高比类型。

```typescript
export type AspectRatio = 
  | '智能' 
  | '21:9' 
  | '16:9' 
  | '3:2' 
  | '4:3' 
  | '1:1' 
  | '3:4' 
  | '2:3' 
  | '9:16';
```

---

### ImageSize

图片尺寸类型。

```typescript
export type ImageSize = '2K';
```

---

## 请求/响应类型

### GenerateRequest

生成请求类型（前端使用 FormData，此类型仅作参考）。

```typescript
export interface GenerateRequest {
  prompt: string;                 // 提示词
  aspectRatio: string;            // 宽高比
  imageSize: string;              // 图片尺寸
  images: File[];                 // 参考图片
}
```

---

### GenerateResponse

生成响应类型。

```typescript
export interface GenerateResponse {
  status: string;                 // 状态：'success'
  image_url: string;              // 生成图片 URL
  text?: string;                  // AI 返回的文本
  ref_images?: string[];          // 保存的参考图 URL
}
```

---

## Electron 类型声明

位于 `frontend/src/types/electron.d.ts`。

```typescript
interface ElectronAPI {
  getBackendUrl: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
```

**用法：**

```typescript
// 检查是否在 Electron 环境
if (window.electronAPI) {
  const url = await window.electronAPI.getBackendUrl();
}
```

---

## 类型使用示例

### 组件 Props 类型

```typescript
interface ImageCardProps {
  item: GenerationHistory;
  onImageClick: (url: string) => void;
  onRegenerate: (item: GenerationHistory) => void;
}

function ImageCard({ item, onImageClick, onRegenerate }: ImageCardProps) {
  // ...
}
```

### API 响应类型

```typescript
async function loadHistory(): Promise<GenerationHistory[]> {
  const response = await api.getHistory();
  if (response.ok) {
    const data: GenerationHistory[] = await response.json();
    return data;
  }
  return [];
}
```

### 状态类型

```typescript
const [history, setHistory] = useState<GenerationHistory[]>([]);
const [task, setTask] = useState<GenerationTask | null>(null);
const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
```

### 类型守卫

```typescript
function isValidGenerationType(type: string): type is GenerationTypeValue {
  return Object.values(GenerationType).includes(type as GenerationTypeValue);
}
```

---

## 类型导入

```typescript
// 从 type/index.ts 导入
import type { 
  GenerationHistory, 
  GenerationTask, 
  GenerationTypeValue,
  AspectRatio,
  TaskStatus 
} from '../type';

// 导入常量
import { GenerationType } from '../type';
```

---

## 与后端类型对应

| 前端类型 | 后端类型 | 说明 |
|----------|----------|------|
| `GenerationHistory` | `GenerationHistoryResponse` | 历史记录 |
| `GenerationTask` | `TaskResponse` | 任务状态 |
| `GenerationStats` | `GenerationStatsResponse` | 统计信息 |
| `GenerationTypeValue` | `string` (常量) | 生成类型 |
| `TaskStatus` | `TaskStatus` | 任务状态 |
