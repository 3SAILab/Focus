# 图片上传拖拽排序 - 设计文档

## 1. 架构设计

### 1.1 组件结构
```
ImageUpload (修改)
├── DraggableImage (新增)
│   ├── 拖拽逻辑
│   ├── 视觉反馈
│   └── 蒙版标识
└── DropZone (新增)
    └── 插入位置指示器
```

### 1.2 数据流
```
用户拖拽 → onDragStart → 记录源索引
         ↓
    onDragOver → 计算目标索引 → 更新预览
         ↓
    onDrop → 重新排序 files 数组 → onFilesChange
         ↓
    父组件更新 → 重新渲染
```

## 2. 技术实现

### 2.1 使用 HTML5 Drag and Drop API

**优点：**
- 原生支持，无需额外依赖
- 性能好
- 浏览器兼容性好

**实现方案：**
```typescript
// 拖拽状态
const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

// 拖拽事件处理
const handleDragStart = (e: React.DragEvent, index: number) => {
  setDraggedIndex(index);
  e.dataTransfer.effectAllowed = 'move';
};

const handleDragOver = (e: React.DragEvent, index: number) => {
  e.preventDefault();
  if (draggedIndex !== null && draggedIndex !== index) {
    setDragOverIndex(index);
  }
};

const handleDrop = (e: React.DragEvent, dropIndex: number) => {
  e.preventDefault();
  if (draggedIndex === null) return;
  
  const newFiles = [...files];
  const [draggedFile] = newFiles.splice(draggedIndex, 1);
  newFiles.splice(dropIndex, 0, draggedFile);
  
  onFilesChange(newFiles);
  setDraggedIndex(null);
  setDragOverIndex(null);
};
```

### 2.2 蒙版图片识别

**识别策略：**
1. 文件名包含 "mask" 或 "蒙版"
2. 图片主要为黑白色（色彩饱和度低）
3. 用户手动标记

**实现：**
```typescript
interface FileWithMeta extends File {
  isMask?: boolean;
}

const detectMask = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    // 检查文件名
    if (file.name.toLowerCase().includes('mask') || 
        file.name.includes('蒙版')) {
      resolve(true);
      return;
    }
    
    // 检查图片色彩（可选，较复杂）
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // 分析图片色彩饱和度
      // 简化版：假设蒙版图片文件名包含关键词
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
};
```

### 2.3 视觉反馈设计

**CSS 类名设计：**
```css
/* 正常状态 */
.image-card { }

/* 拖拽中 */
.image-card--dragging {
  opacity: 0.5;
  transform: scale(1.05);
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  cursor: grabbing;
}

/* 拖拽目标 */
.image-card--drag-over {
  transform: translateX(10px);
}

/* 蒙版图片 */
.image-card--mask {
  border-color: #3b82f6; /* 蓝色边框 */
}
```

## 3. 状态管理

### 3.1 组件状态
```typescript
interface ImageUploadState {
  files: File[];              // 图片文件列表
  previewUrls: string[];      // 预览 URL
  draggedIndex: number | null; // 正在拖拽的图片索引
  dragOverIndex: number | null; // 拖拽悬停的位置
  isHovered: boolean;         // 鼠标是否悬停
  maskIndices: Set<number>;   // 蒙版图片的索引集合
}
```

### 3.2 Props 接口
```typescript
interface ImageUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onPreview?: (url: string) => void;
  enableReorder?: boolean;    // 是否启用拖拽排序
  detectMasks?: boolean;      // 是否自动检测蒙版
}
```

## 4. 动画设计

### 4.1 拖拽动画
```css
.image-card {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* 拖拽时禁用过渡 */
.image-card--dragging {
  transition: none;
}
```

### 4.2 位置调整动画
```typescript
// 使用 transform 而非 left/top 以获得更好性能
style={{
  transform: `translateX(${position}px)`,
  transition: isDragging ? 'none' : 'transform 0.3s ease'
}}
```

## 5. 性能优化

### 5.1 避免不必要的重渲染
```typescript
// 使用 useMemo 缓存预览 URL
const previewUrls = useMemo(() => {
  return files.map(file => URL.createObjectURL(file));
}, [files]);

// 清理 URL
useEffect(() => {
  return () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
  };
}, [previewUrls]);
```

### 5.2 使用 CSS transform
- 使用 `transform` 而非 `left/top` 进行位置动画
- 使用 `will-change` 提示浏览器优化
- 避免在拖拽过程中进行复杂计算

## 6. 兼容性处理

### 6.1 触摸设备支持
```typescript
// 添加触摸事件处理
const handleTouchStart = (e: React.TouchEvent, index: number) => {
  // 转换为拖拽逻辑
};

const handleTouchMove = (e: React.TouchEvent) => {
  // 计算位置
};

const handleTouchEnd = (e: React.TouchEvent) => {
  // 完成拖拽
};
```

### 6.2 降级方案
- 不支持拖拽的浏览器：显示上下箭头按钮进行排序
- 触摸设备：长按触发拖拽模式

## 7. 错误处理

### 7.1 拖拽失败
```typescript
const handleDragEnd = () => {
  // 重置状态
  setDraggedIndex(null);
  setDragOverIndex(null);
};
```

### 7.2 无效操作
```typescript
// 拖拽到组件外
const handleDragLeave = (e: React.DragEvent) => {
  if (e.currentTarget === e.target) {
    setDragOverIndex(null);
  }
};
```

## 8. 测试策略

### 8.1 单元测试
- 测试拖拽排序逻辑
- 测试蒙版检测逻辑
- 测试边界情况

### 8.2 集成测试
- 测试与父组件的交互
- 测试文件上传后的排序
- 测试删除后的顺序保持

### 8.3 E2E 测试
- 模拟用户拖拽操作
- 验证视觉反馈
- 验证最终结果

## 9. 实现步骤

### Phase 1: 基础拖拽
1. 添加 draggable 属性
2. 实现拖拽事件处理
3. 实现文件数组重排序

### Phase 2: 视觉反馈
1. 添加拖拽状态样式
2. 实现插入位置指示
3. 优化动画效果

### Phase 3: 蒙版支持
1. 实现蒙版检测
2. 添加蒙版视觉标识
3. 添加蒙版位置提示

### Phase 4: 优化和测试
1. 性能优化
2. 触摸设备支持
3. 完整测试覆盖

## 10. 正确性属性

### 10.1 顺序保持性
**属性**: 拖拽操作后，未被移动的图片相对顺序保持不变

**验证**: 
```typescript
// 拖拽前: [A, B, C, D]
// 拖拽 A 到 C 后面: [B, C, A, D]
// B, C, D 的相对顺序不变
```

### 10.2 索引一致性
**属性**: 拖拽操作后，files 数组和 previewUrls 数组的索引对应关系保持一致

**验证**:
```typescript
files.forEach((file, index) => {
  assert(previewUrls[index] === URL.createObjectURL(file));
});
```

### 10.3 蒙版标识持久性
**属性**: 拖拽操作不改变图片的蒙版属性

**验证**:
```typescript
// 拖拽前后，同一文件的 isMask 属性不变
```
