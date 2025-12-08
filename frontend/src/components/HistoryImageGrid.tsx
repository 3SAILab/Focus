import { useState } from 'react';
import type { GenerationHistory } from '../type';
import { formatTime } from '../utils';
import ImageContextMenu from './ImageContextMenu';

interface HistoryImageGridProps {
  history: GenerationHistory[];
  onImageClick: (item: GenerationHistory) => void;
  onImagePreview?: (url: string) => void;
  emptyText?: string;
}

export default function HistoryImageGrid({
  history,
  onImageClick,
  onImagePreview,
  emptyText = '暂无历史记录',
}: HistoryImageGridProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string; imageRect?: DOMRect } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setContextMenu({
      x: rect.right,
      y: rect.top + rect.height / 2,
      url,
      imageRect: rect,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  if (history.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400">
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
        {history.map((item, index) => (
          <div
            key={item.id || `history-${index}`}
            className="relative group cursor-pointer"
            onClick={() => onImageClick(item)}
          >
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:border-red-300 transition-all">
              <img
                src={item.image_url}
                alt="历史记录"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                draggable
                onContextMenu={(e) => handleContextMenu(e, item.image_url)}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/uri-list', item.image_url);
                  e.dataTransfer.setData('text/plain', item.image_url);
                  e.dataTransfer.setData('application/x-sigma-image', item.image_url);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={(e) => {
                  if (onImagePreview) {
                    e.stopPropagation();
                    onImagePreview(item.image_url);
                  }
                }}
              />
            </div>
            <div className="text-[10px] text-gray-400 mt-1 text-center truncate">
              {formatTime(item.created_at)}
            </div>
          </div>
        ))}
      </div>

      <ImageContextMenu
        imageUrl={contextMenu?.url || ''}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        imageRect={contextMenu?.imageRect || null}
        onClose={closeContextMenu}
        showReferenceOption={false}
      />
    </>
  );
}
