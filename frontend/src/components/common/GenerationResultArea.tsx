/**
 * GenerationResultArea Component
 * 封装电商视图的生成结果显示区域
 * 统一处理 isRecovering/isGenerating/generatedImage/empty 四种状态的显示逻辑
 */

import type { ReactNode } from 'react';

export interface GenerationResultAreaProps {
  // 状态
  isRecovering: boolean;
  isGenerating: boolean;
  generatedImage: string | null;
  
  // 样式配置
  aspectRatio?: 'square' | '3:4';
  accentColor?: 'red' | 'purple' | 'orange' | 'blue' | 'green';
  
  // 文案配置
  generatingText?: string;
  emptyText?: string;
  emptyIcon?: ReactNode;
  
  // 事件处理
  onImageClick?: (url: string) => void;
  onContextMenu?: (e: React.MouseEvent, url: string) => void;
}

// 颜色映射
const colorMap = {
  red: {
    border: 'border-red-500',
    gradient: 'from-red-50 to-orange-50',
  },
  purple: {
    border: 'border-purple-500',
    gradient: 'from-purple-50 to-pink-50',
  },
  orange: {
    border: 'border-orange-500',
    gradient: 'from-orange-50 to-yellow-50',
  },
  blue: {
    border: 'border-blue-500',
    gradient: 'from-blue-50 to-cyan-50',
  },
  green: {
    border: 'border-green-500',
    gradient: 'from-green-50 to-emerald-50',
  },
};

/**
 * 生成结果显示区域组件
 * 统一处理四种状态：恢复中、生成中、已生成、空状态
 */
export function GenerationResultArea({
  isRecovering,
  isGenerating,
  generatedImage,
  aspectRatio = 'square',
  accentColor = 'red',
  generatingText = '正在生成...',
  emptyText = '生成结果将显示在这里',
  emptyIcon = <span className="text-3xl">🖼️</span>,
  onImageClick,
  onContextMenu,
}: GenerationResultAreaProps) {
  const colors = colorMap[accentColor];
  const aspectClass = aspectRatio === 'square' ? 'aspect-square' : 'aspect-3/4';

  // 恢复中状态
  if (isRecovering) {
    return (
      <div className={`${aspectClass} flex flex-col items-center justify-center text-gray-400`}>
        <div className={`w-8 h-8 border-2 ${colors.border} border-t-transparent rounded-full animate-spin mb-4`}></div>
        <p className="text-sm text-gray-500">正在恢复任务状态...</p>
      </div>
    );
  }

  // 生成中状态
  if (isGenerating) {
    return (
      <div className={`${aspectClass} flex flex-col items-center justify-center`}>
        <div className={`w-16 h-16 rounded-2xl bg-linear-to-br ${colors.gradient} flex items-center justify-center mb-4 animate-pulse`}>
          <div className={`w-8 h-8 border-2 ${colors.border} border-t-transparent rounded-full animate-spin`}></div>
        </div>
        <p className="text-sm text-gray-500">{generatingText}</p>
      </div>
    );
  }

  // 已生成状态
  if (generatedImage) {
    return (
      <div className={`relative ${aspectClass} rounded-xl overflow-hidden bg-gray-100`}>
        <img
          src={generatedImage}
          alt="生成结果"
          className="w-full h-full object-contain cursor-pointer"
          draggable
          onClick={() => onImageClick?.(generatedImage)}
          onContextMenu={(e) => onContextMenu?.(e, generatedImage)}
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-sigma-image', generatedImage);
            e.dataTransfer.effectAllowed = 'copy';
          }}
        />
      </div>
    );
  }

  // 空状态
  return (
    <div className={`${aspectClass} rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400`}>
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        {emptyIcon}
      </div>
      <p className="text-sm">{emptyText}</p>
    </div>
  );
}

export default GenerationResultArea;
