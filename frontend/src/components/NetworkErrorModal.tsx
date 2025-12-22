import { useState } from 'react';
import { WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import Modal from './common/Modal';

interface NetworkErrorModalProps {
  isOpen: boolean;
  errorMessage: string;
  onRetry: () => Promise<void>;
}

export default function NetworkErrorModal({
  isOpen,
  errorMessage,
  onRetry,
}: NetworkErrorModalProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Empty function - modal cannot be closed
      title="网络连接失败"
      icon={<WifiOff className="w-5 h-5" />}
      iconBgColor="bg-red-100"
      iconColor="text-red-600"
      headerBgClass="bg-gradient-to-r from-red-50 to-orange-50"
      closable={false}
      closeOnBackdropClick={false}
      maxWidth="sm"
      footer={
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="w-full px-4 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isRetrying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              正在重试...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              重试
            </>
          )}
        </button>
      }
    >
      <div className="space-y-4">
        {/* Error message */}
        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
          <p className="text-sm text-red-700 text-center">
            {errorMessage}
          </p>
        </div>

        {/* Help text */}
        <div className="text-xs text-gray-500 text-center space-y-1">
          <p>请检查您的网络连接后重试</p>
          <p>如果问题持续存在，请联系技术支持</p>
        </div>
      </div>
    </Modal>
  );
}
