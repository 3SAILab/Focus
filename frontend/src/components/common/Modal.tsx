import { useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  icon?: ReactNode;
  iconBgColor?: string;  // e.g., 'bg-red-50'
  iconColor?: string;    // e.g., 'text-red-600'
  headerBgClass?: string; // Header background style
  closable?: boolean;    // Whether modal can be closed
  closeOnBackdropClick?: boolean; // Whether clicking backdrop closes modal (default: true)
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
  borderColor?: string;  // Border color (for warning modals)
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  icon,
  iconBgColor = 'bg-red-100',
  iconColor = 'text-red-600',
  headerBgClass = 'bg-gradient-to-r from-red-50 to-orange-50',
  closable = true,
  closeOnBackdropClick = true,
  children,
  footer,
  maxWidth = 'sm',
  borderColor,
}: ModalProps) {
  // Handle Escape key press
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) {
        onClose();
      }
    },
    [closable, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && closable && closeOnBackdropClick) {
        onClose();
      }
    },
    [closable, closeOnBackdropClick, onClose]
  );

  // Add/remove escape key listener
  useEffect(() => {
    if (isOpen && closable) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, closable, handleKeyDown]);

  if (!isOpen) return null;

  const hasHeader = title || icon || closable;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
        data-testid="modal-backdrop"
      />

      {/* Dialog */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidthClasses[maxWidth]} mx-4 overflow-hidden animate-in zoom-in-95 duration-200 ${borderColor ? `border-2 ${borderColor}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Header */}
        {hasHeader && (
          <div
            className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 ${headerBgClass}`}
            data-testid="modal-header"
          >
            <div className="flex items-center gap-3">
              {icon && (
                <div
                  className={`w-10 h-10 rounded-xl ${iconBgColor} flex items-center justify-center`}
                  data-testid="modal-icon"
                >
                  <span className={iconColor}>{icon}</span>
                </div>
              )}
              {title && (
                <h3
                  id="modal-title"
                  className="text-lg font-bold text-gray-800"
                  data-testid="modal-title"
                >
                  {title}
                </h3>
              )}
            </div>
            {closable && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-all"
                aria-label="Close modal"
                data-testid="modal-close-button"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-6" data-testid="modal-content">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className="px-6 py-4 border-t border-gray-100 bg-gray-50"
            data-testid="modal-footer"
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
