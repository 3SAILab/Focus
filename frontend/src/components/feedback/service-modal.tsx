import { Headphones, Phone, Star } from 'lucide-react';
import { Modal } from '../ui/modal';

export type ServiceModalVariant = 'contact' | 'sales' | 'quota';

export interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: ServiceModalVariant;
}

const variantConfig = {
  contact: {
    title: '联系销售',
    icon: <Headphones className="w-5 h-5" />,
    iconBgColor: 'bg-red-100',
    iconColor: 'text-red-600',
    headerBgClass: 'bg-gradient-to-r from-red-50 to-orange-50',
    description: '扫码联系客服获取更多配额',
    showFeatures: false,
  },
  sales: {
    title: '获取更好的服务',
    icon: <Phone className="w-5 h-5" />,
    iconBgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
    headerBgClass: 'bg-gradient-to-r from-blue-50 to-indigo-50',
    description: '需要更好的生成效果或更多配额？',
    showFeatures: true,
  },
  quota: {
    title: '配额不足',
    icon: <Star className="w-5 h-5" />,
    iconBgColor: 'bg-amber-100',
    iconColor: 'text-amber-600',
    headerBgClass: 'bg-gradient-to-r from-amber-50 to-orange-50',
    description: '您的配额已用完，请联系客服获取更多',
    showFeatures: false,
  },
};

export function ServiceModal({ 
  isOpen, 
  onClose,
  variant = 'contact',
}: ServiceModalProps) {
  const config = variantConfig[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={config.title}
      icon={config.icon}
      iconBgColor={config.iconBgColor}
      iconColor={config.iconColor}
      headerBgClass={config.headerBgClass}
      closeOnBackdropClick={variant !== 'quota'}
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
          {config.description}
        </div>
        
        {/* 服务特点 - 仅在 sales 变体显示 */}
        {config.showFeatures && (
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
        )}
        
        {/* 微信二维码 */}
        <div>
          <div className="text-sm text-gray-600 mb-3">扫码联系客服顾问</div>
          <div className="inline-block p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
            <img 
              src="./kefu.png" 
              alt="客服微信二维码" 
              className="w-40 h-40 object-contain"
            />
          </div>
          <div className="mt-3 text-xs text-gray-400">微信扫一扫，添加客服顾问</div>
        </div>
      </div>
    </Modal>
  );
}

// 为了向后兼容，导出别名
export const ContactModal = (props: Omit<ServiceModalProps, 'variant'>) => (
  <ServiceModal {...props} variant="contact" />
);

export const SalesModal = (props: Omit<ServiceModalProps, 'variant'>) => (
  <ServiceModal {...props} variant="sales" />
);

export default ServiceModal;
