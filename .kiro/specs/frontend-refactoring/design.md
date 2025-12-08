# Design Document

## Overview

本设计文档描述了前端代码重构的技术方案。通过创建可复用的基础组件、自定义 Hooks 和布局组件，将现有代码中的重复模式抽象出来，减少代码量约 30-40%，同时保持所有现有功能不变。

## Architecture

重构后的组件架构分为三层：

```
┌─────────────────────────────────────────────────────────────┐
│                      Views (页面视图)                        │
│  Create.tsx | WhiteBackground.tsx | ClothingChange.tsx      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Composite Components (组合组件)            │
│  GenerationWorkspace | HistorySection | QuotaErrorHandler   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Base Components (基础组件)                │
│  Modal | ImageUploadZone | PageHeader | GenerateButton      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Hooks (自定义钩子)                      │
│  useImageUpload | useDragDrop | useModal                    │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Modal 基础组件

```typescript
// frontend/src/components/common/Modal.tsx

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;  // 如 'bg-red-50'
  iconColor?: string;    // 如 'text-red-600'
  headerBgClass?: string; // 头部背景样式
  closable?: boolean;    // 是否可关闭
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  borderColor?: string;  // 边框颜色（用于警告弹窗）
}

// 使用示例
<Modal
  isOpen={showContact}
  onClose={() => setShowContact(false)}
  title="联系销售"
  icon={<Headphones className="w-5 h-5" />}
  iconBgColor="bg-red-100"
  iconColor="text-red-600"
  headerBgClass="bg-gradient-to-r from-red-50 to-orange-50"
  footer={<button onClick={onClose}>关闭</button>}
>
  {/* 内容 */}
</Modal>
```

### 2. ImageUploadZone 组件

```typescript
// frontend/src/components/common/ImageUploadZone.tsx

interface ImageUploadZoneProps {
  file: File | null;
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  onPreview?: (url: string) => void;
  onContextMenu?: (e: React.MouseEvent, url: string) => void;
  aspectRatio?: 'square' | '3:4' | '4:3' | 'auto';
  icon?: React.ReactNode;
  emptyTitle?: string;
  emptySubtitle?: string;
  accentColor?: 'red' | 'purple' | 'blue';
  disabled?: boolean;
}

// 使用示例
<ImageUploadZone
  file={uploadedFile}
  previewUrl={previewUrl}
  onFileSelect={handleFileSelect}
  onClear={clearUpload}
  onPreview={setLightboxImage}
  icon={<Upload className="w-8 h-8" />}
  emptyTitle="上传产品图片"
  emptySubtitle="点击或拖拽上传"
  accentColor="red"
/>
```

### 3. PageHeader 组件

```typescript
// frontend/src/components/common/PageHeader.tsx

interface PageHeaderProps {
  title: string;
  statusColor?: 'green' | 'purple' | 'blue' | 'red';
  showCounter?: boolean;
  counterRefresh?: number;
  rightContent?: React.ReactNode;
  backButton?: {
    onClick: () => void;
  };
}

// 使用示例
<PageHeader
  title="一键白底图"
  statusColor="green"
  showCounter
  counterRefresh={counterRefresh}
/>
```

### 4. GenerateButton 组件

```typescript
// frontend/src/components/common/GenerateButton.tsx

interface GenerateButtonProps {
  onClick: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  text?: string;
  loadingText?: string;
  icon?: React.ReactNode;
  color?: 'red' | 'purple' | 'blue';
  fullWidth?: boolean;
  className?: string;
}

// 使用示例
<GenerateButton
  onClick={handleGenerate}
  isGenerating={isGenerating}
  disabled={!uploadedFile}
  text="生成白底图"
  loadingText="生成中..."
  icon={<ArrowRight className="w-5 h-5" />}
  color="red"
  fullWidth
/>
```

### 5. HistorySection 组件

```typescript
// frontend/src/components/common/HistorySection.tsx

interface HistorySectionProps {
  title: string;
  history: GenerationHistory[];
  onImageClick: (item: GenerationHistory) => void;
  onImagePreview?: (url: string) => void;
  emptyText?: string;
}

// 使用示例
<HistorySection
  title="白底图历史记录"
  history={history}
  onImageClick={handleHistoryClick}
  onImagePreview={setLightboxImage}
  emptyText="暂无白底图生成记录"
/>
```

### 6. QuotaErrorHandler 组件

```typescript
// frontend/src/components/common/QuotaErrorHandler.tsx

interface QuotaErrorHandlerProps {
  showQuotaError: boolean;
  showContact: boolean;
  onQuotaErrorClose: () => void;
  onContactClose: () => void;
  onContactSales: () => void;
}

// 使用示例
<QuotaErrorHandler
  showQuotaError={showQuotaError}
  showContact={showContact}
  onQuotaErrorClose={() => setShowQuotaError(false)}
  onContactClose={() => setShowContact(false)}
  onContactSales={() => {
    setShowQuotaError(false);
    setShowContact(true);
  }}
/>
```

## Hooks

### 1. useImageUpload Hook

```typescript
// frontend/src/hooks/useImageUpload.ts

interface UseImageUploadOptions {
  onFileSelect?: (file: File) => void;
}

interface UseImageUploadReturn {
  file: File | null;
  previewUrl: string | null;
  setFile: (file: File | null) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUrlLoad: (url: string) => Promise<void>;
  clear: () => void;
}

function useImageUpload(options?: UseImageUploadOptions): UseImageUploadReturn;

// 使用示例
const { file, previewUrl, handleFileSelect, clear } = useImageUpload({
  onFileSelect: (file) => console.log('Selected:', file.name)
});
```

### 2. useDragDrop Hook

```typescript
// frontend/src/hooks/useDragDrop.ts

interface UseDragDropOptions {
  onFileDrop: (file: File) => void;
  onUrlDrop?: (url: string) => Promise<void>;
  disabled?: boolean;
}

interface UseDragDropReturn {
  isDragging: boolean;
  dragProps: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

function useDragDrop(options: UseDragDropOptions): UseDragDropReturn;

// 使用示例
const { isDragging, dragProps } = useDragDrop({
  onFileDrop: (file) => setUploadedFile(file),
  onUrlDrop: async (url) => {
    const file = await loadImageFromUrl(url);
    if (file) setUploadedFile(file);
  }
});

<div {...dragProps} className={isDragging ? 'border-red-500' : ''}>
  Drop zone
</div>
```

### 3. useModal Hook

```typescript
// frontend/src/hooks/useModal.ts

interface UseModalReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

function useModal(initialState?: boolean): UseModalReturn;

// 使用示例
const quotaErrorModal = useModal();
const contactModal = useModal();

// 在组件中
<QuotaErrorAlert
  isOpen={quotaErrorModal.isOpen}
  onClose={quotaErrorModal.close}
  onContactSales={() => {
    quotaErrorModal.close();
    contactModal.open();
  }}
/>
```

## Data Models

数据模型保持不变，继续使用现有的类型定义：

```typescript
// frontend/src/type/index.ts (现有)
interface GenerationHistory {
  id: number;
  prompt: string;
  original_prompt?: string;
  image_url: string;
  ref_images?: string;
  type?: GenerationType;
  created_at: string;
}

enum GenerationType {
  CREATE = 'create',
  WHITE_BACKGROUND = 'white_background',
  CLOTHING_CHANGE = 'clothing_change',
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Modal closable behavior
*For any* Modal component with closable=true, clicking outside the modal or pressing Escape key SHALL trigger the onClose callback exactly once.
**Validates: Requirements 1.5, 1.6**

### Property 2: Modal header rendering
*For any* combination of title, icon, and closable props, the Modal component SHALL render the header elements that correspond to the provided props.
**Validates: Requirements 1.3**

### Property 3: ImageUploadZone drag feedback
*For any* ImageUploadZone component, when isDragging state is true, the component SHALL apply the highlight border and animation CSS classes.
**Validates: Requirements 2.2**

### Property 4: ImageUploadZone file drop handling
*For any* valid image file dropped on the ImageUploadZone, the onFileSelect callback SHALL be called with the dropped file.
**Validates: Requirements 2.3**

### Property 5: ImageUploadZone URL drop handling
*For any* valid image URL dropped on the ImageUploadZone, the component SHALL load the image and convert it to a File object before calling onFileSelect.
**Validates: Requirements 2.4**

### Property 6: ImageUploadZone preview rendering
*For any* ImageUploadZone with a non-null file and previewUrl, the component SHALL render the preview image and clear button.
**Validates: Requirements 2.5**

### Property 7: PageHeader title rendering
*For any* title string and statusColor, the PageHeader component SHALL render the title with the corresponding colored status dot.
**Validates: Requirements 3.2**

### Property 8: PageHeader counter rendering
*For any* PageHeader with showCounter=true, the component SHALL render the GenerationCounter component.
**Validates: Requirements 3.3**

### Property 9: GenerationWorkspace loading state
*For any* GenerationWorkspace with isGenerating=true, the component SHALL render the PlaceholderCard in the result area.
**Validates: Requirements 4.4**

### Property 10: GenerationWorkspace result rendering
*For any* GenerationWorkspace with a non-null resultImage, the component SHALL render the image with context menu support.
**Validates: Requirements 4.5**

### Property 11: useImageUpload lifecycle
*For any* useImageUpload hook instance, selecting a file SHALL create a preview URL, clearing SHALL revoke the URL and reset state, and unmounting SHALL revoke any active URLs.
**Validates: Requirements 5.2, 5.3, 5.4**

### Property 12: useImageUpload return structure
*For any* useImageUpload hook call, the return value SHALL contain file, previewUrl, setFile, handleFileSelect, handleUrlLoad, and clear properties.
**Validates: Requirements 5.1**

### Property 13: useImageUpload URL conversion
*For any* valid image URL passed to handleUrlLoad, the hook SHALL convert it to a File object and update the file state.
**Validates: Requirements 5.5**

### Property 14: useDragDrop return structure
*For any* useDragDrop hook call, the return value SHALL contain isDragging state and dragProps with onDragOver, onDragLeave, and onDrop handlers.
**Validates: Requirements 6.1**

### Property 15: useDragDrop drag state
*For any* useDragDrop hook instance, dragover events SHALL set isDragging to true, and dragleave events SHALL set isDragging to false.
**Validates: Requirements 6.2, 6.3**

### Property 16: useDragDrop file filtering
*For any* drop event with mixed file types, the useDragDrop hook SHALL extract only image files and pass them to the onFileDrop callback.
**Validates: Requirements 6.4**

### Property 17: useDragDrop URL handling
*For any* drop event containing an image URL, the useDragDrop hook SHALL detect the URL and call the onUrlDrop callback.
**Validates: Requirements 6.5**

### Property 18: Error parsing consistency
*For any* API error response (including nested formats like {error: {message: "..."}}), the ErrorHandler utility SHALL extract a user-friendly message string and correctly identify quota errors.
**Validates: Requirements 7.1, 7.2, 7.3**

### Property 19: HistorySection data rendering
*For any* non-empty history array, the HistorySection component SHALL render the HistoryImageGrid with the provided data.
**Validates: Requirements 8.2**

### Property 20: HistorySection empty state
*For any* empty history array, the HistorySection component SHALL display the empty state message.
**Validates: Requirements 8.3**

### Property 21: GenerateButton disabled states
*For any* GenerateButton with isGenerating=true or disabled=true, the button SHALL show appropriate visual feedback (spinner/opacity) and prevent click events.
**Validates: Requirements 9.2, 9.3**

### Property 22: GenerateButton text customization
*For any* custom text and loadingText props, the GenerateButton SHALL display the appropriate text based on isGenerating state.
**Validates: Requirements 9.4**

### Property 23: QuotaErrorHandler state management
*For any* QuotaErrorHandler component, showQuotaError=true SHALL render QuotaErrorAlert, and closing either modal SHALL call the appropriate close callback.
**Validates: Requirements 10.1, 10.3**

## Error Handling

### API Error Parsing

统一的错误解析逻辑，处理各种嵌套格式：

```typescript
// frontend/src/utils/errorHandler.ts (已存在，需扩展)

interface ParsedError {
  message: string;
  isQuotaError: boolean;
}

export function parseApiError(error: unknown): ParsedError {
  let message = '操作失败';
  let isQuotaError = false;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (err.error) {
      if (typeof err.error === 'string') {
        message = err.error;
      } else if (typeof err.error === 'object' && err.error !== null) {
        const nested = err.error as Record<string, unknown>;
        message = String(nested.message || JSON.stringify(err.error));
      }
    }
  }

  // 检测配额错误
  const quotaKeywords = ['quota', 'limit', 'exceeded', '配额', '耗尽', 'exhausted'];
  isQuotaError = quotaKeywords.some(keyword => 
    message.toLowerCase().includes(keyword)
  );

  return { message, isQuotaError };
}
```

## Testing Strategy

### 测试框架

- 单元测试：Vitest
- 组件测试：@testing-library/react
- 属性测试：fast-check

### 单元测试

针对工具函数和 Hooks 的单元测试：

```typescript
// 示例：useImageUpload hook 测试
describe('useImageUpload', () => {
  it('should return initial state with null values', () => {
    const { result } = renderHook(() => useImageUpload());
    expect(result.current.file).toBeNull();
    expect(result.current.previewUrl).toBeNull();
  });

  it('should create preview URL when file is selected', async () => {
    const { result } = renderHook(() => useImageUpload());
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    
    act(() => {
      result.current.setFile(file);
    });

    expect(result.current.file).toBe(file);
    expect(result.current.previewUrl).toBeTruthy();
  });
});
```

### 属性测试

使用 fast-check 进行属性测试：

```typescript
import * as fc from 'fast-check';

// 示例：错误解析属性测试
describe('parseApiError properties', () => {
  it('should always return a string message', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = parseApiError(input);
        return typeof result.message === 'string' && result.message.length > 0;
      })
    );
  });

  it('should detect quota errors from keywords', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('quota exceeded', 'limit reached', '配额耗尽'),
        (errorMsg) => {
          const result = parseApiError(new Error(errorMsg));
          return result.isQuotaError === true;
        }
      )
    );
  });
});
```

### 组件测试

针对可复用组件的渲染测试：

```typescript
// 示例：Modal 组件测试
describe('Modal', () => {
  it('should render children when open', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <div data-testid="content">Content</div>
      </Modal>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('should call onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} closable>
        Content
      </Modal>
    );
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

## File Structure

重构后的文件结构：

```
frontend/src/
├── components/
│   ├── common/                    # 新增：通用组件目录
│   │   ├── Modal.tsx              # 通用模态框
│   │   ├── ImageUploadZone.tsx    # 图片上传区域
│   │   ├── PageHeader.tsx         # 页面头部
│   │   ├── GenerateButton.tsx     # 生成按钮
│   │   ├── HistorySection.tsx     # 历史记录区域
│   │   ├── QuotaErrorHandler.tsx  # 配额错误处理
│   │   └── index.ts               # 导出文件
│   ├── ApiKeyModal.tsx            # 重构：使用 Modal
│   ├── ContactModal.tsx           # 重构：使用 Modal
│   ├── DisclaimerModal.tsx        # 重构：使用 Modal
│   ├── QuotaErrorAlert.tsx        # 重构：使用 Modal
│   ├── ShadowOptionDialog.tsx     # 重构：使用 Modal
│   └── ... (其他组件保持不变)
├── hooks/
│   ├── useImageUpload.ts          # 新增：图片上传 Hook
│   ├── useDragDrop.ts             # 新增：拖拽上传 Hook
│   ├── useModal.ts                # 新增：模态框状态 Hook
│   └── useToast.ts                # 现有
├── views/
│   ├── WhiteBackground.tsx        # 重构：使用新组件
│   ├── ClothingChange.tsx         # 重构：使用新组件
│   ├── Create.tsx                 # 重构：使用新组件
│   └── ... (其他视图)
└── utils/
    ├── errorHandler.ts            # 扩展：统一错误处理
    └── ... (其他工具)

