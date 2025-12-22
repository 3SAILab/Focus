import { Headphones } from 'lucide-react';
import Modal from './common/Modal';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ 
  isOpen, 
  onClose,
}: ContactModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="联系销售"
      icon={<Headphones className="w-5 h-5" />}
      iconBgColor="bg-red-100"
      iconColor="text-red-600"
      headerBgClass="bg-gradient-to-r from-red-50 to-orange-50"
      closeOnBackdropClick={false}
      maxWidth="sm"
      footer={
        <button
          onClick={onClose}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-100 transition-all"
        >
          关闭
        </button>
      }
    >
      {/* 微信二维码 */}
      <div className="text-center">
        <div className="text-sm text-gray-600 mb-4">扫码联系客服获取更多配额</div>
        <div className="inline-block p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
          <img 
            src="./kefu.png" 
            alt="客服微信二维码" 
            className="w-48 h-48 object-contain"
          />
        </div>
        <div className="mt-4 text-xs text-gray-400">微信扫一扫，添加客服顾问</div>
      </div>
    </Modal>
  );
}
