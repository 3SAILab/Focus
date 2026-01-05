/**
 * HistoryFailedItem Component
 * 失败记录渲染组件（当前会话的失败记录）
 * Requirements: 2.3
 */

import { Trash2 } from 'lucide-react';
import type { FailedGeneration } from '../../hooks/useGroupedHistory';
import { ErrorCard } from '../feedback/error-card';

export interface HistoryFailedItemProps {
  failedRecord: FailedGeneration;
  onEditPrompt: (prompt: string) => void;
  onRegenerate: (prompt: string) => void;
  onDelete: (failedId: string) => void;
}

export function HistoryFailedItem({
  failedRecord,
  onEditPrompt,
  onRegenerate,
  onDelete,
}: HistoryFailedItemProps) {
  return (
    <div key={failedRecord.id} className="flex flex-col w-full fade-in-up mt-8">
      <div className="flex justify-end items-center gap-2 mb-3 px-2">
        {/* 操作按钮 */}
        <div className="flex gap-1">
          <button
            onClick={() => onEditPrompt(failedRecord.prompt)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="编辑提示词"
          >
            <span className="text-xs">编辑</span>
          </button>
          <button
            onClick={() => onRegenerate(failedRecord.prompt)}
            className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-red-500 hover:bg-red-50"
            title="重新生成"
          >
            <span className="text-xs">重新生成</span>
          </button>
          <button
            onClick={() => onDelete(failedRecord.id)}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {/* 提示词气泡 */}
        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[70%]">
          {failedRecord.prompt}
        </div>
      </div>
      <div className="flex flex-col items-start w-full pl-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-bold">
            AI
          </div>
          <span className="text-xs text-gray-400 font-medium">生成失败</span>
        </div>
        <div className="w-full max-w-xl">
          <ErrorCard
            errorMessage={failedRecord.errorMessage}
            prompt={failedRecord.prompt}
            onRetry={() => onRegenerate(failedRecord.prompt)}
          />
        </div>
      </div>
    </div>
  );
}
