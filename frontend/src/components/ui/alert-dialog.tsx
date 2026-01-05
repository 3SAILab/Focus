import { useEffect, useCallback } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
}

export function AlertDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'default',
  isLoading = false,
}: AlertDialogProps) {
  // Handle Escape key press
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose]
  );

  // Add/remove escape key listener
  useEffect(() => {
    if (isOpen && !isLoading) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, isLoading, handleKeyDown]);

  if (!isOpen) return null;

  const isDestructive = variant === 'destructive';
  const Icon = isDestructive ? AlertTriangle : Info;
  const iconBgColor = isDestructive ? 'bg-red-100' : 'bg-blue-100';
  const iconColor = isDestructive ? 'text-red-600' : 'text-blue-600';
  const confirmBgColor = isDestructive
    ? 'bg-red-500 hover:bg-red-600'
    : 'bg-blue-500 hover:bg-blue-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
        data-testid="alert-dialog-backdrop"
      />

      {/* Dialog */}
      <div
        className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 animate-in fade-in zoom-in-95 duration-200"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div
            className={`w-12 h-12 rounded-full ${iconBgColor} flex items-center justify-center`}
            data-testid="alert-dialog-icon"
          >
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
        </div>

        {/* Title */}
        <h3
          id="alert-dialog-title"
          className="text-lg font-semibold text-gray-900 text-center mb-2"
          data-testid="alert-dialog-title"
        >
          {title}
        </h3>

        {/* Description */}
        <p
          id="alert-dialog-description"
          className="text-sm text-gray-500 text-center mb-6"
          data-testid="alert-dialog-description"
        >
          {description}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
            data-testid="alert-dialog-cancel"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white ${confirmBgColor} rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
            data-testid="alert-dialog-confirm"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                处理中...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AlertDialog;
