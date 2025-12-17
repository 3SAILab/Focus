import { RectangleHorizontal, RectangleVertical, Square } from 'lucide-react';
import type { AspectRatio } from '../type';

interface AspectRatioSelectorProps {
  value: AspectRatio;
  onChange: (ratio: AspectRatio) => void;
  onClose: () => void;
}

// 导出配置供外部使用图标
export const aspectRatiosConfig: Record<string, { icon: any; label: string }> = {
  '1:1': { icon: Square, label: '1:1' },
  '16:9': { icon: RectangleHorizontal, label: '16:9' },
  '9:16': { icon: RectangleVertical, label: '9:16' },
  '4:3': { icon: RectangleHorizontal, label: '4:3' },
  '3:4': { icon: RectangleVertical, label: '3:4' },
  '3:2': { icon: RectangleHorizontal, label: '3:2' },
  '2:3': { icon: RectangleVertical, label: '2:3' },
  '21:9': { icon: RectangleHorizontal, label: '21:9' },
};

export default function AspectRatioSelector({
  value,
  onChange,
}: AspectRatioSelectorProps) {
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className="absolute bottom-full right-0 mb-3 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-[280px] z-50 animate-in fade-in zoom-in-95 duration-200"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold text-gray-500">选择图片比例</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(aspectRatiosConfig).map(([ratio, config]) => {
          const Icon = config.icon;
          const isActive = value === ratio;
          return (
            <button
              key={ratio}
              onClick={() => {
                onChange(ratio as AspectRatio);
                // 这里不再调用 onClose()，保持窗口常驻
              }}
              className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg transition-all border ${
                isActive
                  ? 'bg-red-50 border-red-500 text-red-600 shadow-sm'
                  : 'bg-gray-50 hover:bg-gray-100 border-transparent text-gray-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>{ratio}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}