import { useState } from 'react';
import { RotateCw, ImagePlus } from 'lucide-react';
import type { GenerationHistory } from '../type';
import { downloadImage } from '../utils';
import { formatTime } from '../utils';
import { useToast } from '../context/ToastContext';

interface ImageCardProps {
  item: GenerationHistory;
  onImageClick: (url: string) => void;
  onRefImageClick?: (url: string) => void;
  onRegenerate?: (item: GenerationHistory) => void;
  onUseAsReference?: (url: string) => void;
}

export default function ImageCard({
  item,
  onImageClick,
  onRefImageClick,
  onRegenerate,
  onUseAsReference,
}: ImageCardProps) {
  const toast = useToast();
  const [isHovered, setIsHovered] = useState(false);

  // 解析参考图
  let refImages: string[] = [];
  try {
    if (item.ref_images) {
      const parsed = JSON.parse(item.ref_images);
      // 确保解析结果是数组
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
      await downloadImage(item.image_url);
      toast.success('图片下载成功');
    } catch (error) {
      toast.error('下载失败，请稍后重试');
    }
  };

  const handleRegenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRegenerate?.(item);
  };

  const handleUseAsReference = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUseAsReference?.(item.image_url);
  };

  return (
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
          onClick={() => onImageClick(item.image_url)}
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
                onClick={(e) => {
                  e.stopPropagation();
                  onRefImageClick?.(refUrl);
                }}
                title={`参考图 ${idx + 1}`}
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
            {onRegenerate && (
              <button
                onClick={handleRegenerate}
                className="text-white text-xs bg-white/20 backdrop-blur px-3 py-1.5 rounded-full hover:bg-white/40 cursor-pointer flex items-center gap-1.5 transition-all"
                title="重新生成"
              >
                <RotateCw className="w-3 h-3" />
                重新生成
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
      <div className="p-3">
        <p className="text-xs text-gray-500 line-clamp-2">
          {/* [!code --] 修改前: {item.prompt || '无提示词'} */}
          {/* [!code ++] 修改后: 如下 */}
          {item.original_prompt || item.prompt || '无提示词'}
        </p>
        <div className="mt-2 flex items-center justify-end">
          <span className="text-[10px] text-gray-300">{timeStr}</span>
        </div>
      </div>
    </div>
  );
}