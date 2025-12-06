import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, PenTool, History } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex text-gray-800">
      <aside className="w-[80px] h-full bg-white border-r border-gray-100 flex flex-col items-center py-6 z-50 shrink-0 shadow-sm">
        <div className="mb-8">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </div>
        <nav className="flex flex-col w-full gap-2">
          <button
            onClick={() => navigate('/create')}
            className={`w-full py-4 flex flex-col items-center justify-center transition-all ${
              isActive('/create')
                ? 'text-red-600 bg-red-50 border-r-2 border-red-600'
                : 'text-gray-400 hover:text-red-500 hover:bg-gray-50'
            }`}
          >
            <PenTool className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">创作</span>
          </button>
          <button
            onClick={() => navigate('/history')}
            className={`w-full py-4 flex flex-col items-center justify-center transition-all ${
              isActive('/history')
                ? 'text-red-600 bg-red-50 border-r-2 border-red-600'
                : 'text-gray-400 hover:text-red-500 hover:bg-gray-50'
            }`}
          >
            <History className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">历史记录</span>
          </button>
        </nav>
      </aside>

      <main className="flex-1 h-full relative flex flex-col bg-[#fafafa]">
        <Outlet />
      </main>
    </div>
  );
}

