export default function PlaceholderCard() {
  return (
    <div className="masonry-card bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 relative max-w-[320px] mx-auto w-full">
      {/* 将高度限制为固定值或更小的比例，比如 h-64 或 aspect-square */}
      <div className="relative w-full h-64 bg-gray-50 overflow-hidden">
        <div className="shimmer-bg absolute inset-0 w-full h-full opacity-50"></div>
        <div className="scan-line opacity-30"></div>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="w-10 h-10 rounded-full border-3 border-red-100 border-t-red-500 animate-spin mb-3"></div>
          <span className="text-xs font-bold text-gray-400 tracking-wider">CREATING...</span>
        </div>
      </div>
      <div className="p-3 bg-white relative z-20">
        <div className="h-2.5 bg-gray-100 rounded-full w-2/3 mb-2 shimmer-bg"></div>
        <div className="h-2.5 bg-gray-100 rounded-full w-1/3 shimmer-bg delay-75"></div>
      </div>
    </div>
  );
}