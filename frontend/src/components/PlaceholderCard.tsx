interface PlaceholderCardProps {
  // 是否显示底部文字区域（默认 true）
  showFooter?: boolean;
  // 自定义类名
  className?: string;
}

export default function PlaceholderCard({ showFooter = true, className = '' }: PlaceholderCardProps) {
  return (
    <div className={`bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 relative w-full h-full flex flex-col ${className}`}>
      {/* 图片区域 - 使用 flex-1 填满剩余空间 */}
      <div className="relative w-full flex-1 min-h-0 bg-gray-50 overflow-hidden aspect-square">
        <div className="shimmer-bg absolute inset-0 w-full h-full opacity-50"></div>
        <div className="scan-line opacity-30"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="w-8 h-8 rounded-full border-2 border-red-100 border-t-red-500 animate-spin mb-2"></div>
          <span className="text-[10px] font-bold text-gray-400 tracking-wider">CREATING...</span>
        </div>
      </div>
      {/* 底部文字区域 - 可选 */}
      {showFooter && (
        <div className="p-2 bg-white relative z-20 flex-shrink-0">
          <div className="h-2 bg-gray-100 rounded-full w-2/3 mb-1.5 shimmer-bg"></div>
          <div className="h-2 bg-gray-100 rounded-full w-1/3 shimmer-bg delay-75"></div>
        </div>
      )}
    </div>
  );
}
