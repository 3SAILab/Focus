import { ImagePlus, X, Plus, Layers } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';

interface ImageUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onPreview?: (url: string) => void;
  enableReorder?: boolean;
  detectMasks?: boolean;
}

export default function ImageUpload({
  files,
  onFilesChange,
  onPreview,
  enableReorder = true,
  detectMasks = true,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  
  // 拖拽状态
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // 蒙版图片索引集合
  const [maskIndices, setMaskIndices] = useState<Set<number>>(new Set());

  // 生成预览 URL（使用 useMemo 优化性能）
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  // 检测蒙版图片
  useEffect(() => {
    if (!detectMasks) return;
    
    const newMaskIndices = new Set<number>();
    files.forEach((file, index) => {
      const fileName = file.name.toLowerCase();
      if (fileName.includes('mask') || fileName.includes('蒙版')) {
        newMaskIndices.add(index);
      }
    });
    setMaskIndices(newMaskIndices);
  }, [files, detectMasks]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      onFilesChange([...files, ...newFiles]);
      e.target.value = '';
    }
  };

  const handleRemove = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  // 拖拽排序事件处理
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (!enableReorder) return;
    e.stopPropagation(); // 阻止事件冒泡
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // 设置拖拽图像
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 28, 40);
    }
  }, [enableReorder]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    if (!enableReorder || draggedIndex === null) return;
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡
    e.dataTransfer.dropEffect = 'move';
    
    // 只有当悬停的索引与当前不同时才更新
    if (draggedIndex !== index && dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }, [enableReorder, draggedIndex, dragOverIndex]);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    if (!enableReorder || draggedIndex === null) return;
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡
    
    if (draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    
    // 重新排序文件数组
    const newFiles = [...files];
    const [draggedFile] = newFiles.splice(draggedIndex, 1);
    newFiles.splice(dropIndex, 0, draggedFile);
    
    onFilesChange(newFiles);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [enableReorder, draggedIndex, files, onFilesChange]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    e.stopPropagation(); // 阻止事件冒泡
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  // 保持之前的尺寸逻辑
  const STEP = 60; 
  const BASE_WIDTH = 64;

  const containerWidth = isHovered 
    ? Math.max(BASE_WIDTH, files.length * STEP + BASE_WIDTH) 
    : BASE_WIDTH;

  return (
    <div 
      className="relative group shrink-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]" 
      style={{ zIndex: 20, width: files.length > 0 ? `${containerWidth}px` : `${BASE_WIDTH}px` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
      />
      
      {files.length === 0 ? (
        <button
          onClick={triggerUpload}
          className="w-14 h-20 rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 hover:border-red-300 hover:bg-red-50/50 hover:text-red-500 text-gray-400 flex items-center justify-center transition-all shadow-sm group-hover:scale-105"
          title="上传参考图"
        >
          <ImagePlus className="w-6 h-6" />
        </button>
      ) : (
        <div className="relative h-20 w-full">
          {previewUrls.map((url, index) => {
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;
            const isMask = maskIndices.has(index);
            
            // 堆叠效果
            const stackRotate = index % 2 === 0 ? (index * 10) : -(index * 10);
            const stackX = index * 3; 
            const stackY = index * -2;
            
            // 展开效果 - 简化位置计算
            const hoverX = index * STEP;
            
            return (
              <div
                key={url}
                draggable={enableReorder}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`absolute top-0 w-14 h-20 rounded-xl shadow-md border-2 bg-gray-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-bottom-left ${
                  isMask ? 'border-blue-400' : 'border-white'
                } ${
                  isDragging ? 'opacity-30 scale-95 cursor-grabbing' : 'cursor-grab'
                } ${
                  isDragOver && !isDragging ? 'ring-2 ring-red-400 ring-offset-2' : ''
                }`}
                style={{
                  left: isHovered ? `${hoverX}px` : `${stackX}px`,
                  top: isHovered ? '0px' : `${stackY}px`,
                  transform: isHovered 
                    ? 'rotate(0deg) scale(1)' 
                    : `rotate(${stackRotate}deg) scale(${1 - index * 0.05})`,
                  zIndex: isDragging ? 1000 : (isHovered ? index + 1 : files.length - index),
                }}
              >
                <img
                  src={url}
                  className="w-full h-full object-cover rounded-lg cursor-pointer hover:brightness-95 pointer-events-none"
                  onClick={() => onPreview?.(url)}
                  alt={isMask ? "蒙版图片" : "参考图"}
                  draggable={false}
                />
                
                {/* 蒙版标识 */}
                {isMask && (
                  <div className="absolute top-1 left-1 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-sm">
                    <Layers className="w-3 h-3" />
                  </div>
                )}
                
                {/* 删除按钮 */}
                <button
                  onClick={(e) => handleRemove(e, index)}
                  className={`absolute -top-2 -right-2 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center transition-all duration-200 z-50 shadow-md border border-white hover:bg-red-500 ${
                    isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* 添加按钮 */}
          <button
            onClick={triggerUpload}
            className={`absolute top-0 w-14 h-20 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-red-300 hover:text-red-500 bg-white/80 backdrop-blur-sm flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              isHovered 
                ? 'opacity-100 translate-x-0 rotate-0' 
                : 'opacity-0 -translate-x-full rotate-45 pointer-events-none'
            }`}
            style={{
              left: `${files.length * STEP}px`,
              zIndex: 0
            }}
          >
            <Plus className="w-6 h-6" />
          </button>
          
          {/* 图片数量标识 */}
          {!isHovered && files.length > 1 && (
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold z-50 shadow-sm border-2 border-white animate-in zoom-in">
              {files.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}