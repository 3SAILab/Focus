# ImageUpload 组件使用指南

## 功能概述

ImageUpload 组件现在支持拖拽排序功能，允许用户通过拖拽来调整已上传图片的顺序。同时支持自动检测蒙版图片并给予特殊标识。

## 基本使用

```tsx
import ImageUpload from './components/ImageUpload';

function MyComponent() {
  const [files, setFiles] = useState<File[]>([]);
  
  return (
    <ImageUpload 
      files={files}
      onFilesChange={setFiles}
      onPreview={(url) => console.log('Preview:', url)}
    />
  );
}
```

## Props 说明

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `files` | `File[]` | 必填 | 已上传的文件数组 |
| `onFilesChange` | `(files: File[]) => void` | 必填 | 文件变化回调 |
| `onPreview` | `(url: string) => void` | 可选 | 点击图片预览回调 |
| `enableReorder` | `boolean` | `true` | 是否启用拖拽排序 |
| `detectMasks` | `boolean` | `true` | 是否自动检测蒙版图片 |

## 功能特性

### 1. 拖拽排序

- **触发方式**: 鼠标悬停在图片区域，图片展开后可拖拽
- **视觉反馈**: 
  - 被拖拽的图片会变透明并放大
  - 目标位置会显示红色高亮环
  - 其他图片会实时调整位置
- **操作**: 点击并拖拽图片到目标位置，松开鼠标完成排序

### 2. 蒙版图片识别

组件会自动识别文件名包含以下关键词的图片为蒙版：
- `mask`
- `蒙版`

**蒙版图片标识**:
- 蓝色边框
- 左上角蓝色图层图标

### 3. 图片管理

- **添加图片**: 点击 "+" 按钮或初始上传按钮
- **删除图片**: 鼠标悬停后点击右上角的 "×" 按钮
- **预览图片**: 点击图片本身

## 使用示例

### 示例 1: 基础使用

```tsx
function BasicExample() {
  const [files, setFiles] = useState<File[]>([]);
  
  return (
    <ImageUpload 
      files={files}
      onFilesChange={setFiles}
    />
  );
}
```

### 示例 2: 禁用拖拽排序

```tsx
function NoReorderExample() {
  const [files, setFiles] = useState<File[]>([]);
  
  return (
    <ImageUpload 
      files={files}
      onFilesChange={setFiles}
      enableReorder={false}
    />
  );
}
```

### 示例 3: 禁用蒙版检测

```tsx
function NoMaskDetectionExample() {
  const [files, setFiles] = useState<File[]>([]);
  
  return (
    <ImageUpload 
      files={files}
      onFilesChange={setFiles}
      detectMasks={false}
    />
  );
}
```

### 示例 4: 带预览功能

```tsx
function WithPreviewExample() {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  return (
    <>
      <ImageUpload 
        files={files}
        onFilesChange={setFiles}
        onPreview={setPreviewUrl}
      />
      
      {previewUrl && (
        <Lightbox 
          imageUrl={previewUrl} 
          onClose={() => setPreviewUrl(null)} 
        />
      )}
    </>
  );
}
```

## 蒙版图片命名规范

为了让组件正确识别蒙版图片，建议使用以下命名方式：

- ✅ `mask.png`
- ✅ `product_mask.jpg`
- ✅ `蒙版.png`
- ✅ `产品蒙版.jpg`
- ❌ `photo.png` (不会被识别为蒙版)

## 拖拽排序最佳实践

1. **确保图片顺序正确**: 拖拽前先确认目标位置
2. **蒙版位置**: 如果使用蒙版，确保蒙版图片在正确的位置（通常是第一张或最后一张）
3. **多图排序**: 对于多张图片，可以多次拖拽调整到理想顺序

## 性能优化

组件已经进行了以下性能优化：

- 使用 `useCallback` 缓存事件处理函数
- 使用 `useMemo` 缓存预览 URL
- 拖拽时禁用过渡动画以提高流畅度
- 使用 CSS `transform` 而非 `position` 进行动画

## 浏览器兼容性

- ✅ Chrome/Edge (推荐)
- ✅ Firefox
- ✅ Safari
- ⚠️ 移动端浏览器 (基础功能可用，拖拽排序可能需要长按)

## 故障排除

### 问题: 拖拽不生效

**解决方案**:
1. 确保 `enableReorder` 为 `true`
2. 确保鼠标悬停在图片区域，图片已展开
3. 检查浏览器是否支持 HTML5 Drag and Drop API

### 问题: 蒙版图片未被识别

**解决方案**:
1. 检查文件名是否包含 "mask" 或 "蒙版"
2. 确保 `detectMasks` 为 `true`
3. 可以手动调整图片顺序将蒙版放在正确位置

### 问题: 图片顺序混乱

**解决方案**:
1. 刷新页面重新上传
2. 逐个删除图片后重新添加
3. 使用拖拽功能手动调整顺序

## 更新日志

### v2.0.0 (2026-01-21)
- ✨ 新增拖拽排序功能
- ✨ 新增蒙版图片自动识别
- ✨ 新增蒙版图片视觉标识
- 🎨 优化拖拽动画效果
- ⚡ 性能优化

### v1.0.0
- 基础图片上传功能
- 图片预览和删除
- 堆叠展开动画
