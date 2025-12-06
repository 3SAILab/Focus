import { ImagePlus, X, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ImageUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onPreview?: (url: string) => void;
}

export default function ImageUpload({
  files,
  onFilesChange,
  onPreview,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

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

  // 保持之前的尺寸逻辑
  const CARD_WIDTH = 56; // w-14
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
            // --- 修改点：加大旋转角度 ---
            // 原来是 index * 4，现在改为 index * 10，让扇形更明显
            // 同时稍微增加一点 X 轴错位 (index * 3) 让边缘更容易被看到
            const stackRotate = index % 2 === 0 ? (index * 10) : -(index * 10);
            const stackX = index * 3; 
            const stackY = index * -2;
            
            const hoverX = index * STEP;
            
            return (
              <div
                key={url}
                className="absolute top-0 w-14 h-20 rounded-xl shadow-md border-2 border-white bg-gray-100 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-bottom-left"
                style={{
                  left: isHovered ? `${hoverX}px` : `${stackX}px`,
                  top: isHovered ? '0px' : `${stackY}px`,
                  // 这里的 rotate 逻辑对应上面的计算
                  transform: isHovered 
                    ? 'rotate(0deg) scale(1)' 
                    : `rotate(${stackRotate}deg) scale(${1 - index * 0.05})`,
                  zIndex: isHovered ? index + 1 : files.length - index,
                  opacity: isHovered ? 1 : Math.max(0, 1 - index * 0.2)
                }}
              >
                <img
                  src={url}
                  className="w-full h-full object-cover rounded-lg cursor-pointer hover:brightness-95"
                  onClick={() => onPreview?.(url)}
                  alt="参考图"
                />
                
                <button
                  onClick={(e) => handleRemove(e, index)}
                  className={`absolute -top-2 -right-2 w-5 h-5 bg-gray-800 text-white rounded-full flex items-center justify-center transition-all duration-200 z-50 shadow-md border border-white ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

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