import { useState } from 'react';
import type { GenerationHistory, GenerationTask } from '../../type';
import PlaceholderCard from '../PlaceholderCard';
import ImageContextMenu from '../ImageContextMenu';
import { formatTime } from '../../utils';

export interface HistorySectionProps {
  title: string;
  history: GenerationHistory[];
  onImageClick: (item: GenerationHistory) => void;
  onImagePreview?: (url: string) => void;
  emptyText?: string;
  // 新增：正在处理的任务列表（仅用于恢复的任务，切换页面回来后显示）
  processingTasks?: GenerationTask[];
}

export default function HistorySection({
  title,
  history,
  onImageClick,
  onImagePreview,
  emptyText = '暂无历史记录',
  processingTasks = [],
}: HistorySectionProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string } | null>(null);
  
  // 是否有恢复的处理中任务
  const hasProcessing = processingTasks.length > 0;
  const hasContent = history.length > 0 || hasProcessing;

  const handleContextMenu = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setContextMenu({
      x: rect.right + 8,
      y: Math.min(e.clientY, window.innerHeight - 120),
      url,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };
  
  return (
    <div 
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
      data-testid="history-section"
    >
      <h2 
        className="text-sm font-semibold text-gray-700 mb-4"
        data-testid="history-section-title"
      >
        {title}
      </h2>
      
      {hasContent ? (
        <div 
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
          data-testid="history-section-scroll"
        >
          {/* 恢复的处理中任务占位卡片 - 显示在最前面 */}
          {processingTasks.map((task) => (
            <div key={task.task_id} className="flex-shrink-0 w-32">
              <div className="aspect-square">
                <PlaceholderCard />
              </div>
            </div>
          ))}
          
          {/* 历史记录 - 横向滚动 */}
          {history.map((item, index) => (
            <div
              key={item.id || `history-${index}`}
              className="flex-shrink-0 w-32 cursor-pointer group"
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
      ) : (
        <div 
          className="py-12 text-center text-gray-400"
          data-testid="history-section-empty"
        >
          <p className="text-sm">{emptyText}</p>
        </div>
      )}

      <ImageContextMenu
        imageUrl={contextMenu?.url || ''}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={closeContextMenu}
        showReferenceOption={false}
      />
    </div>
  );
}
