/**
 * HistorySingleItem Component
 * 单图历史记录项渲染组件
 * Requirements: 2.1
 */

import { Trash2 } from 'lucide-react';
import type { GenerationHistory } from '../../type';
import { GenerationType } from '../../type';
import ImageCard from '../ImageCard';
import { ErrorCard } from '../feedback/error-card';
import { getErrorMessage } from '../../utils/errorHandler';

export interface HistorySingleItemProps {
  item: GenerationHistory;
  index: number;
  onImageClick: (url: string) => void;
  onRegenerate: (item: GenerationHistory) => void;
  onEditPrompt: (item: GenerationHistory) => void;
  onUseAsReference: (url: string) => void;
  onDelete: (item: GenerationHistory) => void;
  onRetry: (prompt: string) => void;
}

/**
 * 获取显示用的提示词
 * 根据生成类型返回友好的显示名称
 */
function getDisplayPrompt(item: GenerationHistory): string {
  if (item.type === GenerationType.WHITE_BACKGROUND) {
    return '白底图创作';
  }
  if (item.type === GenerationType.CLOTHING_CHANGE) {
    return '一键换装';
  }
  return item.original_prompt || item.prompt || '无提示词';
}

export function HistorySingleItem({
  item,
  index,
  onImageClick,
  onRegenerate,
  onEditPrompt,
  onUseAsReference,
  onDelete,
  onRetry,
}: HistorySingleItemProps) {
  const isFailedRecord = !!item.error_msg && !item.image_url;

  return (
    <div
      key={item.id || `history-${index}`}
      className="flex flex-col w-full"
    >
      {/* 用户指令气泡 */}
      <div className="flex justify-end items-center gap-2 mb-3 px-2">
        {/* 删除按钮 */}
        <button
          onClick={() => onDelete(item)}
          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[80%]">
          {getDisplayPrompt(item)}
        </div>
      </div>

      {/* 生成结果卡片 */}
      <div className="flex flex-col items-start w-full pl-2">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
            isFailedRecord ? 'bg-gray-400' : 'bg-red-600 shadow-md shadow-red-200'
          }`}>
            AI
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {isFailedRecord ? '生成失败' : 'Focus'}
          </span>
        </div>
        <div className="w-full max-w-xl">
          {isFailedRecord ? (
            <ErrorCard
              errorMessage={getErrorMessage(item.error_msg || '未知错误').message}
              prompt={item.prompt}
              onRetry={() => onRetry(item.prompt)}
            />
          ) : (
            <ImageCard
              item={item}
              onImageClick={onImageClick}
              onRefImageClick={onImageClick}
              onRegenerate={onRegenerate}
              onEditPrompt={onEditPrompt}
              onUseAsReference={onUseAsReference}
            />
          )}
        </div>
      </div>
    </div>
  );
}
