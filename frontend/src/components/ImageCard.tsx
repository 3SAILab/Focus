import { useState } from 'react';
import { RotateCw, ImagePlus, Pencil } from 'lucide-react';
import type { GenerationHistory } from '../type';
import { GenerationType } from '../type';
import { downloadImage } from '../utils';
import { formatTime } from '../utils';
import { useToast } from '../context/ToastContext';
import ImageContextMenu from './ImageContextMenu';

interface ImageCardProps {
  item: GenerationHistory;
  onImageClick: (url: string) => void;
  onRefImageClick?: (url: string) => void;
  onRegenerate?: (item: GenerationHistory) => void;
  onEditPrompt?: (item: GenerationHistory) => void; // 编辑提示词（不自动发送）
  onUseAsReference?: (url: string) => void;
  hidePrompt?: boolean; // 是否隐藏 prompt 显示
  disabled?: boolean; // 是否禁用重新生成按钮
}

// 根据类型获取友好的显示名称
function getDisplayPrompt(item: GenerationHistory): string {
  if (item.type === GenerationType.WHITE_BACKGROUND) {
    return '白底图创作';
  }
  if (item.type === GenerationType.CLOTHING_CHANGE) {
    return '一键换装';
  }
  return item.original_prompt || item.prompt || '无提示词';
}

export default function ImageCard({
  item,
  onImageClick,
  onRefImageClick,
  onRegenerate,
  onEditPrompt,
  onUseAsReference,
  hidePrompt = false,
  disabled = false,
}: ImageCardProps) {
  const toast = useToast();
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string; imageRect?: DOMRect } | null>(null);

  // 解析参考图
  let refImages: string[] = [];
  try {
    if (item.ref_images) {
      const parsed = JSON.parse(item.ref_images);
      refImages = Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.warn('解析参考图失败:', e);
    refImages = [];
  }

  const timeStr = formatTime(item.created_at);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const saved = await downloadImage(item.image_url);
      // 只有在实际保存成功时才显示成功提示，用户取消时不显示
      if (saved) {
        toast.success('图片保存成功');
      }
    } catch (error) {
      toast.error('保存失败，请稍后重试');
    }
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRegenerate?.(item);
  };

  const handleEditPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditPrompt?.(item);
  };

  const handleUseAsReference = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUseAsReference?.(item.image_url);
  };

  // 右键菜单处理 - 传递图片的 rect 信息，让 ImageContextMenu 负责计算位置
  const handleContextMenu = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    // 只传递图片的位置信息，让 ImageContextMenu 负责计算菜单位置
    setContextMenu({ 
      x: rect.right, // 图片右边缘
      y: rect.top + rect.height / 2, // 图片垂直中心
      url,
      imageRect: rect // 传递完整的 rect 信息
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  // 拖拽开始处理 - 设置拖拽数据
  const handleDragStart = (e: React.DragEvent, url: string) => {
    e.dataTransfer.setData('text/uri-list', url);
    e.dataTransfer.setData('text/plain', url);
    e.dataTransfer.setData('application/x-sigma-image', url);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <>
      <div className="masonry-card bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 relative">
        <div
          className="relative overflow-hidden group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <img
            src={item.image_url}
            className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105 cursor-pointer"
            loading="lazy"
            draggable
            onClick={() => onImageClick(item.image_url)}
            onContextMenu={(e) => handleContextMenu(e, item.image_url)}
            onDragStart={(e) => handleDragStart(e, item.image_url)}
            style={{ pointerEvents: 'auto' }}
            alt={item.prompt || '生成的图片'}
          />
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
                  onContextMenu={(e) => handleContextMenu(e, refUrl)}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    handleDragStart(e, refUrl);
                  }}
                  title={`参考图 ${idx + 1} (可拖拽)`}
                  alt={`参考图 ${idx + 1}`}
                />
              ))}
            </div>
          )}
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity flex items-end justify-between p-4 pointer-events-none ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex gap-2 pointer-events-auto">
              {onEditPrompt && (
                <button
                  onClick={handleEditPrompt}
                  className="text-white text-xs bg-white/20 backdrop-blur px-3 py-1.5 rounded-full hover:bg-white/40 cursor-pointer flex items-center gap-1.5 transition-all"
                  title="重新编辑"
                >
                  <Pencil className="w-3 h-3" />
                  重新编辑
                </button>
              )}
              {onRegenerate && (
                <button
                  onClick={handleRegenerate}
                  disabled={disabled}
                  className={`text-white text-xs backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
                    disabled 
                      ? 'bg-white/10 cursor-not-allowed opacity-50' 
                      : 'bg-white/20 hover:bg-white/40 cursor-pointer'
                  }`}
                  title={disabled ? '请等待当前任务完成' : '重新生成'}
                >
                  <RotateCw className="w-3 h-3" />
                  {disabled ? '请等待...' : '重新生成'}
                </button>
              )}
              {onUseAsReference && (
                <button
                  onClick={handleUseAsReference}
                  className="text-white text-xs bg-white/20 backdrop-blur px-3 py-1.5 rounded-full hover:bg-white/40 cursor-pointer flex items-center gap-1.5 transition-all"
                  title="引用为参考图"
                >
                  <ImagePlus className="w-3 h-3" />
                  引用
                </button>
              )}
            </div>
            <button
              onClick={handleDownload}
              className="text-white text-xs bg-white/20 backdrop-blur px-3 py-1.5 rounded-full hover:bg-white/40 cursor-pointer pointer-events-auto"
            >
              下载原图
            </button>
          </div>
        </div>
        {!hidePrompt && (
          <div className="p-3">
            <p className="text-xs text-gray-500 line-clamp-2">
              {getDisplayPrompt(item)}
            </p>
            <div className="mt-2 flex items-center justify-end">
              <span className="text-[10px] text-gray-300">{timeStr}</span>
            </div>
          </div>
        )}
      </div>

      {/* 右键菜单 */}
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
