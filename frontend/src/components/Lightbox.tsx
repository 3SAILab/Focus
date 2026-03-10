import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import ImageContextMenu from './ImageContextMenu';

interface LightboxProps {
  imageUrl: string | null;
  imageUrls?: string[];          // 批次模式：所有图片 URL 列表
  currentIndex?: number;         // 批次模式：当前图片索引
  onClose: () => void;
}

export default function Lightbox({ imageUrl, imageUrls, currentIndex = 0, onClose }: LightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [imageRect, setImageRect] = useState<DOMRect | null>(null);
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  
  const imgRef = useRef<HTMLImageElement>(null);

  // 同步 currentIndex prop 变化
  useEffect(() => {
    setActiveIndex(currentIndex);
  }, [currentIndex]);

  // 计算当前显示的图片 URL
  const displayUrl = (imageUrls && imageUrls.length > 0) ? imageUrls[activeIndex] ?? imageUrl : imageUrl;
  const isBatchMode = imageUrls && imageUrls.length > 1;

  useEffect(() => {
    if (imageUrl || displayUrl) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setContextMenuPosition(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [imageUrl]);

  // 滚轮缩放
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (imageUrl) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((prev) => {
          const newZoom = Math.max(0.5, Math.min(4, prev + delta));
          if (newZoom <= 1) setPosition({ x: 0, y: 0 }); // 缩小回原位归零
          return newZoom;
        });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // 批次导航：方向键切换图片
      if (isBatchMode && imageUrls) {
        if (e.key === 'ArrowRight') {
          setActiveIndex(prev => (prev + 1) % imageUrls.length);
          setZoom(1);
          setPosition({ x: 0, y: 0 });
        } else if (e.key === 'ArrowLeft') {
          setActiveIndex(prev => (prev - 1 + imageUrls.length) % imageUrls.length);
          setZoom(1);
          setPosition({ x: 0, y: 0 });
        }
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageUrl, onClose, isBatchMode, imageUrls]);

  // 拖拽逻辑
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 右键菜单处理
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 在事件处理时获取 imageRect，而不是在渲染时
    setImageRect(imgRef.current?.getBoundingClientRect() ?? null);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenuPosition(null);
    setImageRect(null);
  };

  // 点击背景关闭 lightbox 和菜单
  const handleBackgroundClick = () => {
    closeContextMenu();
    onClose();
  };

  if (!displayUrl) return null;

  return (
    <div
      className="lightbox active"
      onClick={handleBackgroundClick}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <button
        className="lightbox-close"
        onClick={(e) => {
          e.stopPropagation();
          closeContextMenu();
          onClose();
        }}
      >
        <X className="w-5 h-5" />
      </button>

      {/* 批次导航指示器 */}
      {isBatchMode && imageUrls && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
          <span className="text-white/80 text-sm">{activeIndex + 1} / {imageUrls.length}</span>
        </div>
      )}
      
      <div 
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onMouseMove={handleMouseMove}
      >
        <img
          ref={imgRef}
          src={displayUrl}
          alt="预览"
          draggable={false}
          onMouseDown={handleMouseDown}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={handleContextMenu}
          className="transition-transform duration-75 ease-out max-w-[90vw] max-h-[90vh] object-contain"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
        />
      </div>

      {/* 右键菜单 */}
      <ImageContextMenu
        imageUrl={displayUrl}
        position={contextMenuPosition}
        imageRect={imageRect}
        onClose={closeContextMenu}
      />
    </div>
  );
}