import { RectangleHorizontal, RectangleVertical, Square, Maximize2, Maximize } from 'lucide-react';
import type { AspectRatio, ImageSize } from '../type';

interface ImageSettingsSelectorProps {
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onImageSizeChange: (size: ImageSize) => void;
  disabled?: boolean;
}

// 比例配置
const aspectRatiosConfig: Record<string, { icon: any; label: string }> = {
  '1:1': { icon: Square, label: '1:1' },
  '16:9': { icon: RectangleHorizontal, label: '16:9' },
  '9:16': { icon: RectangleVertical, label: '9:16' },
  '4:3': { icon: RectangleHorizontal, label: '4:3' },
  '3:4': { icon: RectangleVertical, label: '3:4' },
  '3:2': { icon: RectangleHorizontal, label: '3:2' },
  '2:3': { icon: RectangleVertical, label: '2:3' },
  '21:9': { icon: RectangleHorizontal, label: '21:9' },
};

// 尺寸配置
const imageSizeConfig: Record<ImageSize, { icon: any; label: string; description: string }> = {
  '2K': { icon: Maximize2, label: '2K', description: '标准' },
  '4K': { icon: Maximize, label: '4K', description: '高清(计2张)' },
};

export default function ImageSettingsSelector({
  aspectRatio,
  imageSize,
  onAspectRatioChange,
  onImageSizeChange,
  disabled = false,
}: ImageSettingsSelectorProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-[280px] animate-in fade-in zoom-in-95 duration-200"
      onClick={handleClick}
    >
      {/* 比例选择 */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 px-1 mb-2">
          <span className="text-xs font-bold text-gray-500">图片比例</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(aspectRatiosConfig).map(([ratio, config]) => {
            const Icon = config.icon;
            const isActive = aspectRatio === ratio;
            return (
              <button
                key={ratio}
                onClick={() => onAspectRatioChange(ratio as AspectRatio)}
                disabled={disabled}
                className={`flex flex-col items-center justify-center gap-0.5 p-1.5 rounded-lg transition-all border ${
                  isActive
                    ? 'bg-red-50 border-red-500 text-red-600 shadow-sm'
                    : 'bg-gray-50 hover:bg-gray-100 border-transparent text-gray-600'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className={`text-[9px] font-medium ${isActive ? 'font-bold' : ''}`}>{ratio}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 分隔线 */}
      <div className="border-t border-gray-100 my-2"></div>

      {/* 尺寸选择 */}
      <div>
        <div className="flex items-center gap-1.5 px-1 mb-2">
          <span className="text-xs font-bold text-gray-500">图片尺寸</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(imageSizeConfig) as ImageSize[]).map((size) => {
            const config = imageSizeConfig[size];
            const Icon = config.icon;
            const isActive = imageSize === size;
            return (
              <button
                key={size}
                onClick={() => onImageSizeChange(size)}
                disabled={disabled}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all border ${
                  isActive
                    ? 'bg-red-50 border-red-500 text-red-600 shadow-sm'
                    : 'bg-gray-50 hover:bg-gray-100 border-transparent text-gray-600'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                <span className={`text-xs font-medium ${isActive ? 'font-bold' : ''}`}>
                  {config.label}
                </span>
                <span className="text-[9px] text-gray-400 ml-auto">{config.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
