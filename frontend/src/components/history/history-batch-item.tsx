/**
 * HistoryBatchItem Component
 * 批次历史记录项渲染组件
 * Requirements: 2.2
 */

import { Trash2 } from 'lucide-react';
import type { GenerationHistory } from '../../type';
import type { HistoryDisplayItem } from '../../hooks/useGroupedHistory';
import ImageGrid from '../ImageGrid';

export interface HistoryBatchItemProps {
  displayItem: HistoryDisplayItem;
  index: number;
  onImageClick: (url: string) => void;
  onRegenerate: (prompt: string, refImages?: string | string[], imageCount?: number) => void;
  onEditPrompt: (prompt: string, refImages?: string | string[], imageCount?: number) => void;
  onUseAsReference: (url: string) => void;
  onDelete: (batchId: string, items: GenerationHistory[]) => void;
}

/**
 * 解析参考图字符串为数组
 */
function parseRefImages(refImages?: string | string[]): string[] {
  if (!refImages) return [];
  if (Array.isArray(refImages)) return refImages;
  
  try {
    const parsed = JSON.parse(refImages);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function HistoryBatchItem({
  displayItem,
  index,
  onImageClick,
  onRegenerate,
  onEditPrompt,
  onUseAsReference,
  onDelete,
}: HistoryBatchItemProps) {
  const batchItems = displayItem.items || [];
  const batchTotal = displayItem.batchTotal || batchItems[0]?.batch_total || batchItems.length;

  // 构建完整的图片数组
  // 已加载的图片显示正常，未加载的位置显示占位符（loading 状态）
  const fullImages = displayItem.fullBatchItems 
    ? displayItem.fullBatchItems.map((item, idx) => {
        if (item) {
          return {
            url: item.image_url,
            isLoading: false,
            index: item.batch_index ?? idx,
          };
        } else {
          return {
            isLoading: true,
            index: idx,
          };
        }
      })
    : batchItems.map((item, idx) => ({
        url: item.image_url,
        isLoading: false,
        index: item.batch_index ?? idx,
      }));

  const refImagesArray = parseRefImages(displayItem.refImages);

  return (
    <div
      key={displayItem.batchId || `batch-${index}`}
      className="flex flex-col w-full"
    >
      {/* 用户指令气泡 */}
      <div className="flex justify-end items-center gap-2 mb-3 px-2">
        {/* 操作按钮 */}
        <div className="flex gap-1">
          <button
            onClick={() => onEditPrompt(displayItem.prompt, displayItem.refImages, batchTotal)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="编辑提示词"
          >
            <span className="text-xs">重新编辑</span>
          </button>
          <button
            onClick={() => onRegenerate(displayItem.prompt, displayItem.refImages, batchTotal)}
            className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50"
            title="重新生成"
          >
            <span className="text-xs">重新生成</span>
          </button>
          <button
            onClick={() => displayItem.batchId && onDelete(displayItem.batchId, batchItems)}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="删除批次"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[70%]">
          {displayItem.prompt} ({batchTotal}张)
        </div>
      </div>

      {/* 生成结果网格 */}
      <div className="flex flex-col items-start w-full pl-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-red-200">
            AI
          </div>
          <span className="text-xs text-gray-400 font-medium">Focus</span>
        </div>
        <div className="w-full max-w-xl">
          <ImageGrid
            images={fullImages}
            onImageClick={onImageClick}
            onUseAsReference={onUseAsReference}
            prompt={displayItem.prompt}
            refImages={refImagesArray}
            onRefImageClick={onImageClick}
          />
        </div>
      </div>
    </div>
  );
}
