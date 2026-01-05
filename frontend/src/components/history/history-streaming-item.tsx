/**
 * HistoryStreamingItem Component
 * 流式生成渲染组件（SSE 模式）
 * Requirements: 2.6
 */

import type { BatchResult } from '../../type/generation';
import ImageGrid from '../ImageGrid';

export interface HistoryStreamingItemProps {
  batch: BatchResult;
  onImageClick: (url: string) => void;
  onUseAsReference: (url: string) => void;
}

export function HistoryStreamingItem({
  batch,
  onImageClick,
  onUseAsReference,
}: HistoryStreamingItemProps) {
  // 计算已完成的图片数量
  const completedCount = batch.images.filter(img => !img.isLoading).length;

  return (
    <div key={`streaming-${batch.batchId}`} className="flex flex-col w-full fade-in-up mt-8">
      <div className="flex justify-end mb-3 px-2">
        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm opacity-50">
          {batch.prompt} ({batch.imageCount}张)
        </div>
      </div>
      <div className="flex flex-col items-start w-full pl-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold animate-pulse">
            AI
          </div>
          <span className="text-xs text-red-500 font-medium">
            正在生成 {completedCount}/{batch.imageCount} 张图片...
          </span>
        </div>
        <div className="w-full max-w-xl">
          <ImageGrid
            images={batch.images}
            onImageClick={onImageClick}
            onUseAsReference={onUseAsReference}
            prompt={batch.prompt}
            showFooter={true}
            refImages={batch.refImages}
            onRefImageClick={onImageClick}
          />
        </div>
      </div>
    </div>
  );
}
