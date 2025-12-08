import { AlertTriangle, X, Phone } from 'lucide-react';

interface QuotaErrorAlertProps {
  isOpen: boolean;
  onClose: () => void;
  onContactSales: () => void;
}

export default function QuotaErrorAlert({ isOpen, onClose, onContactSales }: QuotaErrorAlertProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* 对话框 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-red-500">
        {/* 头部 - 红色警告 */}
        <div className="flex items-center justify-between px-6 py-4 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-red-800">配额已耗尽</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">⚠️</span>
            </div>
            <p className="text-gray-700 font-medium mb-2">
              您的 API 配额已用完
            </p>
            <p className="text-sm text-gray-500">
              请联系销售人员更换新的卡密以继续使用
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={onContactSales}
              className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200"
            >
              <Phone className="w-4 h-4" />
              联系销售
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-all"
            >
              稍后处理
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
