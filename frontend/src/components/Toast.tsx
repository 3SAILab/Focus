import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: 'text-green-600',
    iconBg: 'bg-green-100',
    defaultDuration: 3000,
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: 'text-red-600',
    iconBg: 'bg-red-100',
    defaultDuration: 5000, // 错误信息显示更长时间
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
    defaultDuration: 4000,
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: 'text-blue-600',
    iconBg: 'bg-blue-100',
    defaultDuration: 3000,
  },
};

export default function ToastItem({ toast, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose(toast.id);
    }, 300);
  };

  useEffect(() => {
    // 进入动画
    setTimeout(() => setIsVisible(true), 10);

    // 自动关闭 - 根据类型使用不同的默认时长
    const style = styles[toast.type];
    const duration = toast.duration || style.defaultDuration || 3000;
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.duration, toast.type, toast.id]);

  const Icon = icons[toast.type];
  const style = styles[toast.type];

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border-2 shadow-lg backdrop-blur-sm
        ${style.bg} ${style.border} ${style.text}
        transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
        min-w-[320px] max-w-[420px]
      `}
    >
      <div className={`${style.iconBg} rounded-full p-1.5 flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${style.icon}`} />
      </div>
      <div className="flex-1 text-sm font-medium leading-relaxed">
        {toast.message}
      </div>
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-200/50 transition-colors opacity-60 hover:opacity-100"
        aria-label="关闭"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
