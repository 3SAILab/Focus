import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import GenerationCounter from '../GenerationCounter';

export interface PageHeaderProps {
  title: string;
  statusColor?: 'green' | 'purple' | 'blue' | 'red' | 'orange';
  showCounter?: boolean;
  counterRefresh?: number;
  rightContent?: ReactNode;
  backButton?: {
    onClick: () => void;
  };
}

const statusColorClasses = {
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
};

export default function PageHeader({
  title,
  statusColor = 'green',
  showCounter = false,
  counterRefresh = 0,
  rightContent,
  backButton,
}: PageHeaderProps) {
  return (
    <header
      className="h-14 px-6 flex items-center bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 justify-between"
      data-testid="page-header"
    >
      <div className="flex items-center gap-3">
        {backButton && (
          <button
            onClick={backButton.onClick}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            aria-label="Go back"
            data-testid="page-header-back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1
          className="text-lg font-bold text-gray-800 flex items-center gap-2"
          data-testid="page-header-title"
        >
          <span
            className={`w-2 h-2 rounded-full ${statusColorClasses[statusColor]}`}
            data-testid="page-header-status-dot"
            data-status-color={statusColor}
          />
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        {showCounter && (
          <GenerationCounter
            refreshTrigger={counterRefresh}
            data-testid="page-header-counter"
          />
        )}
        {rightContent}
      </div>
    </header>
  );
}
