import { X, Headphones } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ 
  isOpen, 
  onClose,
}: ContactModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 - 不可点击关闭 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* 对话框 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">联系销售</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-6">
          {/* 微信二维码 */}
          <div className="text-center">
            <div className="text-sm text-gray-600 mb-4">扫码联系销售获取更多配额</div>
            <div className="inline-block p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
              <img 
                src="./sales_wxchat.jpg" 
                alt="销售微信二维码" 
                className="w-48 h-48 object-contain"
              />
            </div>
            <div className="mt-4 text-xs text-gray-400">微信扫一扫，添加销售顾问</div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-100 transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
