/**
 * HistorySessionBatch Component
 * 当前会话批次渲染组件
 * Requirements: 2.4
 */

import { Trash2 } from 'lucide-react';
import type { BatchResult } from '../../type/generation';
import ImageGrid from '../ImageGrid';

export interface HistorySessionBatchProps {
  batch: BatchResult;
  onImageClick: (url: string) => void;
  onUseAsReference: (url: string) => void;
  onEditPrompt: (batch: BatchResult) => void;
  onRegenerate: (batch: BatchResult) => void;
  onDelete: (batchId: string) => void;
}

export function HistorySessionBatch({
  batch,
  onImageClick,
  onUseAsReference,
  onEditPrompt,
  onRegenerate,
  onDelete,
}: HistorySessionBatchProps) {
  // 判断批次状态
  const allFailed = batch.images.every(img => img.error);
  const partialFailed = batch.images.some(img => img.error);

  return (
    <div key={batch.batchId} className="flex flex-col w-full fade-in-up mt-8">
      <div className="flex justify-end items-center gap-2 mb-3 px-2">
        {/* 操作按钮 */}
        <div className="flex gap-1">
          <button
            onClick={() => onEditPrompt(batch)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="编辑提示词"
          >
            <span className="text-xs">编辑</span>
          </button>
          <button
            onClick={() => onRegenerate(batch)}
            className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50"
            title="重新生成"
          >
            <span className="text-xs">重新生成</span>
          </button>
          <button
            onClick={() => onDelete(batch.batchId)}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {/* 提示词气泡 */}
        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[70%]">
          {batch.prompt} ({batch.imageCount}张)
        </div>
      </div>
      <div className="flex flex-col items-start w-full pl-2">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md ${
            allFailed ? 'bg-gray-400' : 'bg-red-600 shadow-red-200'
          }`}>
            AI
          </div>
          <span className="text-xs text-gray-400 font-medium">
            {allFailed 
              ? '生成失败' 
              : partialFailed
              ? '部分生成成功'
              : 'Focus'}
          </span>
        </div>
        <div className="w-full max-w-xl">
          <ImageGrid
            images={batch.images}
            onImageClick={onImageClick}
            onUseAsReference={onUseAsReference}
            prompt={batch.prompt}
            refImages={batch.refImages}
            onRefImageClick={onImageClick}
          />
        </div>
      </div>
    </div>
  );
}
