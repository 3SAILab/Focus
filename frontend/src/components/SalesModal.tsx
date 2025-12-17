import { Phone } from 'lucide-react';
import Modal from './common/Modal';

interface SalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SalesModal({ 
  isOpen, 
  onClose,
}: SalesModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="获取更好的服务"
      icon={<Phone className="w-5 h-5" />}
      iconBgColor="bg-blue-100"
      iconColor="text-blue-600"
      headerBgClass="bg-gradient-to-r from-blue-50 to-indigo-50"
      closeOnBackdropClick={true}
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
      <div className="text-center space-y-4">
        <div className="text-sm text-gray-600">
          需要更好的生成效果或更多配额？
        </div>
        
        {/* 服务特点 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 text-left">
          <div className="text-sm font-medium text-gray-700 mb-2">专业服务包含：</div>
          <ul className="text-xs text-gray-600 space-y-1.5">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              更高质量的图片生成效果
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              更大的生成配额
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              专属技术支持
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              定制化解决方案
            </li>
          </ul>
        </div>
        
        {/* 微信二维码 */}
        <div>
          <div className="text-sm text-gray-600 mb-3">扫码联系销售顾问</div>
          <div className="inline-block p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
            <img 
              src="./dyf_wxchat.jpg" 
              alt="销售微信二维码" 
              className="w-40 h-40 object-contain"
            />
          </div>
          <div className="mt-3 text-xs text-gray-400">微信扫一扫，获取专属服务</div>
        </div>
      </div>
    </Modal>
  );
}
