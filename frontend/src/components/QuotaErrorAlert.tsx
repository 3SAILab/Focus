import { AlertTriangle, Phone } from 'lucide-react';
import Modal from './common/Modal';

interface QuotaErrorAlertProps {
  isOpen: boolean;
  onClose: () => void;
  onContactSales: () => void;
}

export default function QuotaErrorAlert({ isOpen, onClose, onContactSales }: QuotaErrorAlertProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="配额已耗尽"
      icon={<AlertTriangle className="w-5 h-5" />}
      iconBgColor="bg-red-100"
      iconColor="text-red-600"
      headerBgClass="bg-red-50"
      borderColor="border-red-500"
      maxWidth="md"
    >
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
    </Modal>
  );
}
