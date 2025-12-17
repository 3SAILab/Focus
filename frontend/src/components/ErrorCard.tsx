import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorCardProps {
  errorMessage: string;
  prompt?: string;
  onRetry?: () => void;
}

export default function ErrorCard({ errorMessage, prompt, onRetry }: ErrorCardProps) {
  return (
    <div className="masonry-card bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
      {/* 错误图标区域 */}
      <div className="aspect-square bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-base font-medium text-gray-600 mb-2 text-center">生成失败</h3>
        <p className="text-sm text-gray-400 text-center max-w-[200px]">{errorMessage}</p>
        
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm rounded-full hover:bg-red-600 transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            重试
          </button>
        )}
      </div>
      
      {/* 提示词区域 */}
      {prompt && (
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 line-clamp-2">{prompt}</p>
        </div>
      )}
    </div>
  );
}
