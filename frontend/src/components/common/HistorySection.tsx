import { useState, useMemo } from 'react';
import type { GenerationHistory, GenerationTask } from '../../type';
import PlaceholderCard from '../PlaceholderCard';
import ImageContextMenu from '../ImageContextMenu';
import { formatTime } from '../../utils';
import type { PendingTaskInfo } from '../../hooks/useAsyncGeneration';

// 统一的显示项类型，用于合并排序
interface DisplayItem {
  type: 'pending' | 'recovering' | 'history';
  timestamp: number;
  // 根据类型，以下字段可选
  pendingTask?: PendingTaskInfo;
  recoveringTask?: GenerationTask;
  historyItem?: GenerationHistory;
}

export interface HistorySectionProps {
  title: string;
  history: GenerationHistory[];
  onImageClick: (item: GenerationHistory) => void;
  onImagePreview?: (url: string) => void;
  emptyText?: string;
  // 正在处理的任务列表（仅用于恢复的任务，切换页面回来后显示）
  processingTasks?: GenerationTask[];
  // 新增：当前会话正在处理的任务（来自 useAsyncGeneration）
  pendingTasks?: PendingTaskInfo[];
}

export default function HistorySection({
  title,
  history,
  onImageClick,
  onImagePreview,
  emptyText = '暂无历史记录',
  processingTasks = [],
  pendingTasks = [],
}: HistorySectionProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string } | null>(null);
  
  // 合并所有项目并按时间戳排序（最新的在前面）
  const sortedItems = useMemo(() => {
    const items: DisplayItem[] = [];
    
    // 收集恢复的任务的 taskId，用于去重
    const recoveringTaskIds = new Set(processingTasks.map(t => t.task_id));
    
    // 添加当前会话的待处理任务（排除已经在 processingTasks 中的）
    pendingTasks.forEach(task => {
      // 如果这个 pendingTask 已经有 taskId，且该 taskId 在 processingTasks 中，则跳过（避免重复）
      if (task.taskId && recoveringTaskIds.has(task.taskId)) {
        return;
      }
      items.push({
        type: 'pending',
        timestamp: task.timestamp,
        pendingTask: task,
      });
    });
    
    // 添加恢复的处理中任务
    processingTasks.forEach(task => {
      items.push({
        type: 'recovering',
        timestamp: new Date(task.created_at).getTime(),
        recoveringTask: task,
      });
    });
    
    // 添加历史记录
    history.forEach(item => {
      items.push({
        type: 'history',
        timestamp: new Date(item.created_at).getTime(),
        historyItem: item,
      });
    });
    
    // 按时间戳降序排序（最新的在前面）
    items.sort((a, b) => b.timestamp - a.timestamp);
    
    return items;
  }, [pendingTasks, processingTasks, history]);
  
  const hasContent = sortedItems.length > 0;

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
          {sortedItems.map((item, index) => {
            // 当前会话的待处理任务
            if (item.type === 'pending' && item.pendingTask) {
              return (
                <div key={item.pendingTask.id} className="flex-shrink-0 w-32">
                  <div className="aspect-square rounded-lg overflow-hidden">
                    <PlaceholderCard showFooter={false} />
                  </div>
                </div>
              );
            }
            
            // 恢复的处理中任务
            if (item.type === 'recovering' && item.recoveringTask) {
              return (
                <div key={item.recoveringTask.task_id} className="flex-shrink-0 w-32">
                  <div className="aspect-square rounded-lg overflow-hidden">
                    <PlaceholderCard showFooter={false} />
                  </div>
                </div>
              );
            }
            
            // 历史记录
            if (item.type === 'history' && item.historyItem) {
              const historyItem = item.historyItem;
              return (
                <div
                  key={historyItem.id || `history-${index}`}
                  className="flex-shrink-0 w-32 cursor-pointer group"
                  onClick={() => onImageClick(historyItem)}
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:border-red-300 transition-all">
                    <img
                      src={historyItem.image_url}
                      alt="历史记录"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      draggable
                      onContextMenu={(e) => handleContextMenu(e, historyItem.image_url)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/uri-list', historyItem.image_url);
                        e.dataTransfer.setData('text/plain', historyItem.image_url);
                        e.dataTransfer.setData('application/x-sigma-image', historyItem.image_url);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={(e) => {
                        if (onImagePreview) {
                          e.stopPropagation();
                          onImagePreview(historyItem.image_url);
                        }
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 text-center truncate">
                    {formatTime(historyItem.created_at)}
                  </div>
                </div>
              );
            }
            
            return null;
          })}
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
