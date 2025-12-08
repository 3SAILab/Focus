import type { GenerationHistory } from '../../type';
import HistoryImageGrid from '../HistoryImageGrid';

export interface HistorySectionProps {
  title: string;
  history: GenerationHistory[];
  onImageClick: (item: GenerationHistory) => void;
  onImagePreview?: (url: string) => void;
  emptyText?: string;
}

export default function HistorySection({
  title,
  history,
  onImageClick,
  onImagePreview,
  emptyText = '暂无历史记录',
}: HistorySectionProps) {
  return (
    <div 
      className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
      data-testid="history-section"
    >
      <h2 
        className="text-sm font-semibold text-gray-700 mb-4"
        data-testid="history-section-title"
      >
        {title}
      </h2>
      {history.length > 0 ? (
        <div data-testid="history-section-grid">
          <HistoryImageGrid
            history={history}
            onImageClick={onImageClick}
            onImagePreview={onImagePreview}
            emptyText={emptyText}
          />
        </div>
      ) : (
        <div 
          className="py-12 text-center text-gray-400"
          data-testid="history-section-empty"
        >
          <p className="text-sm">{emptyText}</p>
        </div>
      )}
    </div>
  );
}
