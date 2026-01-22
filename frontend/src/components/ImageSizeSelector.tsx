import { Maximize2, Maximize } from 'lucide-react';
import type { ImageSize } from '../type';

interface ImageSizeSelectorProps {
  value: ImageSize;
  onChange: (size: ImageSize) => void;
  disabled?: boolean;
}

// 配置：尺寸选项及其图标和标签
export const imageSizeConfig: Record<ImageSize, { icon: any; label: string; description: string }> = {
  '2K': { icon: Maximize2, label: '2K', description: '标准' },
  '4K': { icon: Maximize, label: '4K', description: '高清' },
};

export default function ImageSizeSelector({
  value,
  onChange,
  disabled = false,
}: ImageSizeSelectorProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="absolute bottom-full right-0 mb-3 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-[180px] z-50 animate-in fade-in zoom-in-95 duration-200"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold text-gray-500">图片尺寸</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(imageSizeConfig) as ImageSize[]).map((size) => {
          const config = imageSizeConfig[size];
          const Icon = config.icon;
          const isActive = value === size;
          return (
            <button
              key={size}
              onClick={() => onChange(size)}
              disabled={disabled}
              className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg transition-all border ${
                isActive
                  ? 'bg-red-50 border-red-500 text-red-600 shadow-sm'
                  : 'bg-gray-50 hover:bg-gray-100 border-transparent text-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              <span className={`text-xs font-medium ${isActive ? 'font-bold' : ''}`}>
                {config.label}
              </span>
              <span className="text-[9px] text-gray-400">{config.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
