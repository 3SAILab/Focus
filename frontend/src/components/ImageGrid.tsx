import { useState } from 'react';
import { ImagePlus, Download, AlertTriangle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { downloadImage } from '../utils';
import ImageContextMenu from './ImageContextMenu';

// 单个图片项的状态
export interface ImageGridItem {
  url?: string;           // 图片 URL (成功时)
  error?: string;         // 错误信息 (失败时)
  isLoading?: boolean;    // 是否加载中
  index: number;          // 在批次中的索引
}

interface ImageGridProps {
  images: ImageGridItem[];
  onImageClick: (url: string) => void;
  onUseAsReference?: (url: string) => void;
  prompt?: string;        // 用于显示在错误卡片中
  showFooter?: boolean;   // 是否在加载占位卡片中显示底部区域（与 ImageCard 保持一致）
  refImages?: string[];   // 参考图 URL 列表（多图批次时显示）
  onRefImageClick?: (url: string) => void; // 点击参考图的回调
}

// 加载中占位卡片
// showFooter: 是否显示底部占位区域（与 ImageCard 保持一致的高度）
function LoadingCard({ showFooter = false }: { showFooter?: boolean }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 relative w-full">
      <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
        <div className="shimmer-bg absolute inset-0 w-full h-full opacity-50"></div>
        <div className="scan-line opacity-30"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="w-8 h-8 rounded-full border-2 border-red-100 border-t-red-500 animate-spin mb-2"></div>
          <span className="text-xs font-medium text-gray-400">生成中...</span>
        </div>
      </div>
      {/* 底部占位区域，与 ImageCard 的 p-3 区域保持一致 */}
      {showFooter && (
        <div className="p-3">
          <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"></div>
          <div className="flex items-center justify-end">
            <div className="h-3 bg-gray-100 rounded w-12"></div>
          </div>
        </div>
      )}
    </div>
  );
}

// 错误卡片 - 不显示重试按钮，重试操作在提示词旁边
function GridErrorCard({ 
  errorMessage, 
}: { 
  errorMessage: string; 
}) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 w-full">
      <div className="aspect-square bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-sm font-medium text-gray-600 mb-1 text-center">生成失败</h3>
        <p className="text-xs text-gray-400 text-center line-clamp-2 max-w-[150px]">{errorMessage}</p>
      </div>
    </div>
  );
}

// 成功图片卡片
function GridImageCard({
  url,
  onImageClick,
  onUseAsReference,
}: {
  url: string;
  onImageClick: (url: string) => void;
  onUseAsReference?: (url: string) => void;
}) {
  const toast = useToast();
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string; imageRect?: DOMRect } | null>(null);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const saved = await downloadImage(url);
      if (saved) {
        toast.success('图片保存成功');
      }
    } catch (error) {
      toast.error('保存失败，请稍后重试');
    }
  };

  const handleUseAsReference = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUseAsReference?.(url);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    setContextMenu({ 
      x: rect.right,
      y: rect.top + rect.height / 2,
      url,
      imageRect: rect
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/uri-list', url);
    e.dataTransfer.setData('text/plain', url);
    e.dataTransfer.setData('application/x-sigma-image', url);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <>
      <div 
        className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 relative w-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative overflow-hidden group">
          <img
            src={url}
            className="w-full aspect-square object-cover transition-transform duration-700 group-hover:scale-105 cursor-pointer"
            loading="lazy"
            draggable
            onClick={() => onImageClick(url)}
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
            alt="生成的图片"
          />
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity flex items-end justify-between p-3 pointer-events-none ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex gap-1.5 pointer-events-auto">
              {onUseAsReference && (
                <button
                  onClick={handleUseAsReference}
                  className="text-white text-xs bg-white/20 backdrop-blur px-2.5 py-1 rounded-full hover:bg-white/40 cursor-pointer flex items-center gap-1 transition-all"
                  title="引用为参考图"
                >
                  <ImagePlus className="w-3 h-3" />
                  引用
                </button>
              )}
            </div>
            <button
              onClick={handleDownload}
              className="text-white text-xs bg-white/20 backdrop-blur px-2.5 py-1 rounded-full hover:bg-white/40 cursor-pointer pointer-events-auto flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              下载
            </button>
          </div>
        </div>
      </div>

      <ImageContextMenu
        imageUrl={contextMenu?.url || ''}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        imageRect={contextMenu?.imageRect || null}
        onClose={closeContextMenu}
        onUseAsReference={onUseAsReference}
        showReferenceOption={!!onUseAsReference}
      />
    </>
  );
}

/**
 * ImageGrid 组件 - 多图网格布局
 * 
 * 布局规则 (Requirements 2.1, 2.2, 2.3, 2.4):
 * - 1 张图：单列，宽度约为双图单张的宽度 (max-w-[280px])
 * - 2 张图：2 列并排
 * - 3-4 张图：2x2 网格
 */
export default function ImageGrid({
  images,
  onImageClick,
  onUseAsReference,
  showFooter = false,
  refImages = [],
  onRefImageClick,
}: ImageGridProps) {
  const count = images.length;

  // 根据图片数量确定网格样式
  const getGridClassName = () => {
    if (count === 1) {
      // 单图：使用与 ImageCard 容器相同的最大宽度 (max-w-xl)
      // 这样加载动画和最终图片大小一致
      return 'grid grid-cols-1 max-w-xl';
    }
    // 2, 3, 4 张图都使用 2 列布局
    return 'grid grid-cols-2 gap-3 max-w-xl';
  };

  const renderItem = (item: ImageGridItem) => {
    if (item.isLoading) {
      return <LoadingCard key={`loading-${item.index}`} showFooter={showFooter} />;
    }

    if (item.error) {
      return (
        <GridErrorCard
          key={`error-${item.index}`}
          errorMessage={item.error}
        />
      );
    }

    if (item.url) {
      return (
        <GridImageCard
          key={`image-${item.index}`}
          url={item.url}
          onImageClick={onImageClick}
          onUseAsReference={onUseAsReference}
        />
      );
    }

    // 默认显示加载状态
    return <LoadingCard key={`default-${item.index}`} showFooter={showFooter} />;
  };

  return (
    <div className="relative">
      {/* 参考图显示在左上角 */}
      {refImages.length > 0 && (
        <div className="absolute top-2 left-2 flex gap-1 z-10">
          {refImages.slice(0, 3).map((refUrl, idx) => (
            <img
              key={idx}
              src={refUrl}
              className="w-8 h-8 rounded border-2 border-white shadow-md object-cover cursor-pointer hover:scale-110 transition-transform"
              draggable
              onClick={(e) => {
                e.stopPropagation();
                onRefImageClick?.(refUrl);
              }}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/uri-list', refUrl);
                e.dataTransfer.setData('text/plain', refUrl);
                e.dataTransfer.setData('application/x-sigma-image', refUrl);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              title={`参考图 ${idx + 1} (可拖拽)`}
              alt={`参考图 ${idx + 1}`}
            />
          ))}
        </div>
      )}
      <div className={getGridClassName()}>
        {images.map(renderItem)}
      </div>
    </div>
  );
}
