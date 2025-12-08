import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, PenTool, History, ImageIcon, Shield, MessageCircle, Settings, CheckCircle, Shirt } from 'lucide-react';
import DisclaimerModal from '../components/DisclaimerModal';
import ContactModal from '../components/ContactModal';
import { useConfig } from '../context/ConfigContext';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const { openSettings, hasAgreedDisclaimer } = useConfig();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex text-gray-800">
      <aside className="w-[80px] h-full bg-white border-r border-gray-100 flex flex-col items-center py-6 z-50 shrink-0 shadow-sm justify-between">
        {/* 上半部分：Logo 和导航 */}
        <div className="w-full flex flex-col items-center">
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
              onClick={() => navigate('/white-background')}
              className={`w-full py-4 flex flex-col items-center justify-center transition-all ${
                isActive('/white-background')
                  ? 'text-red-600 bg-red-50 border-r-2 border-red-600'
                  : 'text-gray-400 hover:text-red-500 hover:bg-gray-50'
              }`}
            >
              <ImageIcon className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-medium">白底图</span>
            </button>
            <button
              onClick={() => navigate('/clothing-change')}
              className={`w-full py-4 flex flex-col items-center justify-center transition-all ${
                isActive('/clothing-change')
                  ? 'text-red-600 bg-red-50 border-r-2 border-red-600'
                  : 'text-gray-400 hover:text-red-500 hover:bg-gray-50'
              }`}
            >
              <Shirt className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-medium">换装</span>
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
              <span className="text-[10px] font-medium">历史</span>
            </button>
          </nav>
        </div>

        {/* 下半部分：设置、免责声明和联系我们 */}
        <div className="w-full flex flex-col gap-1 px-2">
          <button
            onClick={openSettings}
            className="w-full py-3 flex flex-col items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all group"
            title="设置 API Key"
          >
            <Settings className="w-5 h-5 mb-0.5 group-hover:rotate-45 transition-transform duration-300" />
            <span className="text-[9px] font-medium">设置</span>
          </button>
          <button
            onClick={() => setShowDisclaimer(true)}
            className={`w-full py-3 flex flex-col items-center justify-center rounded-lg transition-all relative ${
              hasAgreedDisclaimer 
                ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
            }`}
            title={hasAgreedDisclaimer ? '免责声明（已同意）' : '免责声明'}
          >
            <Shield className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-medium">免责</span>
            {hasAgreedDisclaimer && (
              <CheckCircle className="w-3 h-3 absolute top-1 right-1 text-green-500" />
            )}
          </button>
          <button
            onClick={() => setShowContact(true)}
            className="w-full py-3 flex flex-col items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
            title="联系我们"
          >
            <MessageCircle className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-medium">联系</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 h-full relative flex flex-col bg-[#fafafa]">
        <Outlet />
      </main>

      {/* 弹窗 - 从侧边栏打开的免责声明只是查看，不需要再次同意 */}
      <DisclaimerModal 
        isOpen={showDisclaimer} 
        onClose={() => setShowDisclaimer(false)}
        hasAgreed={hasAgreedDisclaimer}
        requireAgree={false}
      />
      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />
    </div>
  );
}

