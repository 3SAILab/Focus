/**
 * HistoryRecoveringItem Component
 * 恢复中任务渲染组件（刷新后恢复的任务）
 * Requirements: 2.7
 */

import type { GenerationTask } from '../../type';
import ImageGrid from '../ImageGrid';

export interface HistoryRecoveringItemProps {
  task: GenerationTask;
}

export function HistoryRecoveringItem({ task }: HistoryRecoveringItemProps) {
  const taskImageCount = task.image_count || 1;

  return (
    <div key={`recovering-${task.task_id}`} className="flex flex-col w-full fade-in-up mt-8">
      <div className="flex justify-end mb-3 px-2">
        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm opacity-50">
          {task.prompt || '正在思考...'}
          {taskImageCount > 1 && ` (${taskImageCount}张)`}
        </div>
      </div>
      <div className="flex flex-col items-start w-full pl-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold animate-pulse">
            AI
          </div>
          <span className="text-xs text-red-500 font-medium">
            正在生成{taskImageCount > 1 ? ` ${taskImageCount} 张图片` : ''}...
          </span>
        </div>
        <div className="w-full max-w-xl">
          <ImageGrid
            images={Array.from({ length: taskImageCount }, (_, index) => ({
              isLoading: true,
              index,
            }))}
            onImageClick={() => {}}
            showFooter={true}
          />
        </div>
      </div>
    </div>
  );
}
