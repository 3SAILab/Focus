import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Sparkles, PenTool, History, ImageIcon, Shield, MessageCircle, Settings, CheckCircle, Shirt, Star, ShoppingBag, Package, Sun, ChevronRight } from 'lucide-react';
import DisclaimerModal from '../components/DisclaimerModal';
import { ContactModal, SalesModal } from '../components/feedback/service-modal';
import { useConfig } from '../context/ConfigContext';

// 电商处理子菜单路径
const ecommercePaths = ['/white-background', '/clothing-change', '/product-scene', '/light-shadow'];

// 检查当前路径是否属于电商处理菜单
export function isEcommercePath(pathname: string): boolean {
  return ecommercePaths.some(path => pathname === path || pathname.startsWith(path + '/'));
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const [isEcommerceMenuOpen, setIsEcommerceMenuOpen] = useState(false);
  const { openSettings, hasAgreedDisclaimer } = useConfig();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // 电商处理菜单是否高亮
  const isEcommerceActive = isEcommercePath(location.pathname);

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
            {/* 创作菜单 */}
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

            {/* 电商处理菜单 - 带子菜单 */}
            <div 
              className="relative"
              onMouseEnter={() => setIsEcommerceMenuOpen(true)}
              onMouseLeave={() => setIsEcommerceMenuOpen(false)}
            >
              <button
                className={`w-full py-4 flex flex-col items-center justify-center transition-all ${
                  isEcommerceActive
                    ? 'text-red-600 bg-red-50 border-r-2 border-red-600'
                    : 'text-gray-400 hover:text-red-500 hover:bg-gray-50'
                }`}
              >
                <ShoppingBag className="w-6 h-6 mb-1" />
                <span className="text-[10px] font-medium">电商</span>
                <ChevronRight className={`w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 transition-transform ${isEcommerceMenuOpen ? 'rotate-90' : ''}`} />
              </button>

              {/* 子菜单 - hover 展开，使用透明桥接区域防止鼠标移动时菜单消失 */}
              {isEcommerceMenuOpen && (
                <>
                  {/* 透明桥接区域，连接主菜单和子菜单 */}
                  <div className="absolute left-full top-0 w-2 h-full" />
                  <div className="absolute left-full top-0 ml-2 bg-white rounded-lg shadow-lg border border-gray-100 py-2 min-w-[120px] z-50">
                    <button
                      onClick={() => {
                        navigate('/white-background');
                        setIsEcommerceMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 flex items-center gap-2 transition-all ${
                        isActive('/white-background')
                          ? 'text-red-600 bg-red-50'
                          : 'text-gray-600 hover:text-red-500 hover:bg-gray-50'
                      }`}
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-xs font-medium">白底图</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate('/clothing-change');
                        setIsEcommerceMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 flex items-center gap-2 transition-all ${
                        isActive('/clothing-change')
                          ? 'text-red-600 bg-red-50'
                          : 'text-gray-600 hover:text-red-500 hover:bg-gray-50'
                      }`}
                    >
                      <Shirt className="w-4 h-4" />
                      <span className="text-xs font-medium">换装</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate('/product-scene');
                        setIsEcommerceMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 flex items-center gap-2 transition-all ${
                        isActive('/product-scene')
                          ? 'text-red-600 bg-red-50'
                          : 'text-gray-600 hover:text-red-500 hover:bg-gray-50'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                      <span className="text-xs font-medium">商品图</span>
                    </button>
                    <button
                      onClick={() => {
                        navigate('/light-shadow');
                        setIsEcommerceMenuOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 flex items-center gap-2 transition-all ${
                        isActive('/light-shadow')
                          ? 'text-red-600 bg-red-50'
                          : 'text-gray-600 hover:text-red-500 hover:bg-gray-50'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span className="text-xs font-medium">光影</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 历史菜单 */}
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

        {/* 下半部分：设置、免责声明、联系我们、升级服务 */}
        <div className="w-full flex flex-col gap-1 px-2 pb-3">
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
          <button
            onClick={() => setShowSales(true)}
            className="w-full py-3 flex flex-col items-center justify-center text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
            title="需要更好的服务？联系销售"
          >
            <Star className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-medium">升级</span>
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
      <SalesModal isOpen={showSales} onClose={() => setShowSales(false)} />
    </div>
  );
}

