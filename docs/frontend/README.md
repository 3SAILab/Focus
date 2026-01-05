# 前端开发指南

Focus 前端使用 React 19 + TypeScript + TailwindCSS 构建。

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| TypeScript | 5.x | 类型系统 |
| Vite | 7.x | 构建工具 |
| TailwindCSS | 4.x | 样式框架 |
| React Router | 7.x | 路由管理 |
| Lucide React | - | 图标库 |

## 目录结构

```
frontend/src/
├── api/                 # API 客户端
│   └── index.ts        # API 方法封装
├── components/          # React 组件
│   ├── common/         # 通用组件
│   │   ├── GenerateButton.tsx
│   │   ├── HistorySection.tsx
│   │   ├── ImageUploadZone.tsx
│   │   ├── Modal.tsx
│   │   ├── PageHeader.tsx
│   │   └── QuotaErrorHandler.tsx
│   ├── ApiKeyModal.tsx
│   ├── ContactModal.tsx
│   ├── DeleteConfirmDialog.tsx
│   ├── DisclaimerModal.tsx
│   ├── ImageCard.tsx
│   ├── ImageContextMenu.tsx
│   ├── Lightbox.tsx
│   ├── PlaceholderCard.tsx
│   ├── PromptBar.tsx
│   ├── SalesModal.tsx
│   ├── UpdateModal.tsx
│   └── ...
├── context/             # React Context
│   ├── ConfigContext.tsx
│   ├── ToastContext.tsx
│   ├── GlobalTaskContext.tsx
│   └── VersionContext.tsx
├── hooks/               # 自定义 Hooks
│   ├── useDragDrop.ts
│   ├── useImageUpload.ts
│   ├── useTaskRecovery.ts
│   └── useToast.ts
├── layout/              # 布局组件
│   └── Layout.tsx
├── router/              # 路由配置
│   └── index.tsx
├── type/                # 类型定义
│   └── index.ts
├── types/               # TypeScript 声明
│   └── electron.d.ts
├── utils/               # 工具函数
│   ├── aspectRatio.ts
│   ├── errorHandler.ts
│   ├── index.ts
│   └── portDiscovery.ts
├── views/               # 页面视图
│   ├── Create.tsx
│   ├── WhiteBackground.tsx
│   ├── ClothingChange.tsx
│   ├── ProductScene.tsx
│   ├── LightShadow.tsx
│   ├── History.tsx
│   └── HistoryDetail.tsx
├── App.tsx              # 应用入口
├── main.tsx             # 渲染入口
└── index.css            # 全局样式
```

## 开发环境

### 安装依赖

```bash
cd frontend
npm install
```

### 启动开发服务器

```bash
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。

### 构建生产版本

```bash
npm run build
```

输出到 `frontend/dist/` 目录。

## 编码规范

### TypeScript

- 使用严格模式 (`strict: true`)
- 所有组件使用函数式组件
- Props 使用 interface 定义
- 避免使用 `any` 类型

```typescript
// ✅ 推荐
interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

function Button({ onClick, disabled, children }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// ❌ 避免
function Button(props: any) { ... }
```

### React

- 使用函数式组件和 Hooks
- 状态管理使用 useState 和 useReducer
- 副作用使用 useEffect
- 复杂逻辑抽取为自定义 Hook

```typescript
// ✅ 推荐
function useCounter(initial: number) {
  const [count, setCount] = useState(initial);
  const increment = useCallback(() => setCount(c => c + 1), []);
  return { count, increment };
}

// ❌ 避免
// 在组件内部定义复杂逻辑
```

### 样式

- 使用 TailwindCSS 工具类
- 避免内联样式
- 复杂样式使用 `@apply` 或组件化

```tsx
// ✅ 推荐
<button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
  提交
</button>

// ❌ 避免
<button style={{ padding: '8px 16px', backgroundColor: 'red' }}>
  提交
</button>
```

### 文件命名

- 组件文件：PascalCase (`ImageCard.tsx`)
- 工具函数：camelCase (`errorHandler.ts`)
- 类型文件：camelCase (`index.ts`)
- 测试文件：`*.test.ts` 或 `*.test.tsx`

## 状态管理

### ConfigContext

管理应用配置状态：

```typescript
const { 
  hasApiKey,           // 是否已配置 API Key
  hasAgreedDisclaimer, // 是否已同意免责声明
  openSettings,        // 打开设置弹窗
  refreshConfig        // 刷新配置
} = useConfig();
```

### ToastContext

管理 Toast 通知：

```typescript
const toast = useToast();

toast.success('操作成功');
toast.error('操作失败');
toast.warning('警告信息');
toast.info('提示信息');
```

### GlobalTaskContext

管理异步任务状态，支持跨页面任务恢复：

```typescript
const {
  registerTask,        // 注册新任务
  unregisterTask,      // 取消任务
  getCompletedTask,    // 获取已完成任务
  getFailedTask,       // 获取失败任务
  clearCompletedTask,  // 清除完成状态
  clearFailedTask,     // 清除失败状态
  isTaskPolling        // 检查任务是否在轮询
} = useGlobalTask();
```

## 多图生成状态管理

### tempId 机制

为解决并发请求的竞态条件，使用 tempId 显式关联请求和响应：

```typescript
// 1. handleGenerateStart 生成并返回 tempId
const tempId = handleGenerateStart(prompt, imageCount);

// 2. 请求完成时通过 tempId 精确清除对应的 pendingTask
if (tempId) {
  setPendingTasks(prev => prev.filter(p => p.id !== tempId));
}
```

### 布局稳定性

批次任务始终使用网格模式渲染，避免布局偏移：

```typescript
// 构建完整的批次图片数组，未加载的位置用 null 占位
const fullBatchItems = Array(batchTotal).fill(null);
for (const item of batchItems) {
  fullBatchItems[item.batch_index] = item;
}

// 渲染时，null 位置显示 loading 占位符
const images = fullBatchItems.map((item, idx) => 
  item ? { url: item.image_url, isLoading: false } : { isLoading: true }
);
```

## API 调用

使用 `api` 对象进行后端调用：

```typescript
import { api } from '../api';

// 生成图片
const response = await api.generate(formData);

// 获取历史
const history = await api.getHistory();

// 检查配置
const config = await api.checkConfig();
```

详见 [API 文档](../backend/API.md)。

## 文档索引

- [组件文档](./COMPONENTS.md) - 组件 Props 和用法
- [Hooks 文档](./HOOKS.md) - 自定义 Hooks
- [类型文档](./TYPES.md) - TypeScript 类型定义
- [路由文档](./ROUTING.md) - 路由配置
