import { Grid2X2, Image, Images } from 'lucide-react';
import type { ImageCount } from '../type';

interface CountSelectorProps {
  value: ImageCount;
  onChange: (count: ImageCount) => void;
  disabled?: boolean;
}

// 配置：数量选项及其图标和标签
export const countConfig: Record<ImageCount, { icon: any; label: string }> = {
  1: { icon: Image, label: '1张' },
  2: { icon: Images, label: '2张' },
  3: { icon: Grid2X2, label: '3张' },
  4: { icon: Grid2X2, label: '4张' },
};

export default function CountSelector({
  value,
  onChange,
  disabled = false,
}: CountSelectorProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="absolute bottom-full right-0 mb-3 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-[200px] z-50 animate-in fade-in zoom-in-95 duration-200"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold text-gray-500">生成数量</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(countConfig) as unknown as ImageCount[]).map((count) => {
          const numCount = Number(count) as ImageCount;
          const config = countConfig[numCount];
          const Icon = config.icon;
          const isActive = value === numCount;
          return (
            <button
              key={count}
              onClick={() => onChange(numCount)}
              disabled={disabled}
              className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all border ${
                isActive
                  ? 'bg-red-50 border-red-500 text-red-600 shadow-sm'
                  : 'bg-gray-50 hover:bg-gray-100 border-transparent text-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
                {numCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
