import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface GenerateButtonProps {
  onClick: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  text?: string;
  loadingText?: string;
  icon?: ReactNode;
  color?: 'red' | 'purple' | 'blue' | 'orange';
  fullWidth?: boolean;
  className?: string;
}

const colorClasses = {
  red: 'bg-red-600 hover:bg-red-700 shadow-red-200',
  purple: 'bg-purple-600 hover:bg-purple-700 shadow-purple-200',
  blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
  orange: 'bg-orange-600 hover:bg-orange-700 shadow-orange-200',
};

export default function GenerateButton({
  onClick,
  isGenerating,
  disabled = false,
  text = '生成',
  loadingText = '生成中...',
  icon,
  color = 'red',
  fullWidth = false,
  className = '',
}: GenerateButtonProps) {
  const isDisabled = disabled || isGenerating;
  
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        px-6 py-3 font-medium rounded-xl flex items-center justify-center gap-2 transition-all
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled 
          ? 'bg-gray-300 cursor-not-allowed text-white shadow-none' 
          : `${colorClasses[color]} text-white shadow-lg`
        }
        ${className}
      `.trim()}
      data-testid="generate-button"
      data-generating={isGenerating}
      data-disabled={isDisabled}
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" data-testid="generate-button-spinner" />
          {loadingText}
        </>
      ) : (
        <>
          {icon && <span data-testid="generate-button-icon">{icon}</span>}
          {text}
        </>
      )}
    </button>
  );
}
