import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Upload, X } from 'lucide-react';
import { useDragDrop } from '../../hooks/useDragDrop';

export interface ImageUploadZoneProps {
  file: File | null;
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  onPreview?: (url: string) => void;
  onContextMenu?: (e: React.MouseEvent, url: string) => void;
  aspectRatio?: 'square' | '3:4' | '4:3' | 'auto';
  icon?: ReactNode;
  emptyTitle?: string;
  emptySubtitle?: string;
  accentColor?: 'red' | 'purple' | 'blue' | 'orange' | 'yellow';
  disabled?: boolean;
}

const aspectRatioClasses = {
  square: 'aspect-square',
  '3:4': 'aspect-[3/4]',
  '4:3': 'aspect-[4/3]',
  auto: '',
};

const accentColorClasses = {
  red: {
    border: 'border-red-500',
    bg: 'bg-red-50',
    ring: 'ring-red-500',
    hoverBorder: 'hover:border-red-300',
    hoverBg: 'hover:bg-red-50/30',
    iconBg: 'group-hover:bg-red-100',
    iconText: 'group-hover:text-red-500',
    dragText: 'text-red-500',
  },
  purple: {
    border: 'border-purple-500',
    bg: 'bg-purple-50',
    ring: 'ring-purple-500',
    hoverBorder: 'hover:border-purple-300',
    hoverBg: 'hover:bg-purple-50/30',
    iconBg: 'group-hover:bg-purple-100',
    iconText: 'group-hover:text-purple-500',
    dragText: 'text-purple-500',
  },
  blue: {
    border: 'border-blue-500',
    bg: 'bg-blue-50',
    ring: 'ring-blue-500',
    hoverBorder: 'hover:border-blue-300',
    hoverBg: 'hover:bg-blue-50/30',
    iconBg: 'group-hover:bg-blue-100',
    iconText: 'group-hover:text-blue-500',
    dragText: 'text-blue-500',
  },
  orange: {
    border: 'border-orange-500',
    bg: 'bg-orange-50',
    ring: 'ring-orange-500',
    hoverBorder: 'hover:border-orange-300',
    hoverBg: 'hover:bg-orange-50/30',
    iconBg: 'group-hover:bg-orange-100',
    iconText: 'group-hover:text-orange-500',
    dragText: 'text-orange-500',
  },
  yellow: {
    border: 'border-yellow-500',
    bg: 'bg-yellow-50',
    ring: 'ring-yellow-500',
    hoverBorder: 'hover:border-yellow-300',
    hoverBg: 'hover:bg-yellow-50/30',
    iconBg: 'group-hover:bg-yellow-100',
    iconText: 'group-hover:text-yellow-500',
    dragText: 'text-yellow-500',
  },
};

export default function ImageUploadZone({
  file: _file,
  previewUrl,
  onFileSelect,
  onClear,
  onPreview,
  onContextMenu,
  aspectRatio = 'square',
  icon,
  emptyTitle = '上传图片',
  emptySubtitle = '点击或拖拽上传',
  accentColor = 'red',
  disabled = false,
}: ImageUploadZoneProps) {
  // _file is kept in props for interface consistency with useImageUpload hook
  void _file;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colors = accentColorClasses[accentColor];

  // Load image from URL
  const loadImageFromUrl = async (url: string): Promise<void> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const fileName = `upload_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
      const loadedFile = new File([blob], fileName, { type: blob.type });
      onFileSelect(loadedFile);
    } catch (error) {
      console.error('Failed to load image from URL:', error);
    }
  };

  const { isDragging, dragProps } = useDragDrop({
    onFileDrop: onFileSelect,
    onUrlDrop: loadImageFromUrl,
    disabled,
  });

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
    e.target.value = '';
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleImageClick = () => {
    if (previewUrl && onPreview) {
      onPreview(previewUrl);
    }
  };

  const handleImageContextMenu = (e: React.MouseEvent) => {
    if (previewUrl && onContextMenu) {
      onContextMenu(e, previewUrl);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (previewUrl) {
      e.dataTransfer.setData('application/x-sigma-image', previewUrl);
      e.dataTransfer.effectAllowed = 'copy';
    }
  };

  return (
    <div data-testid="image-upload-zone" data-dragging={isDragging}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        data-testid="image-upload-input"
      />

      {!previewUrl ? (
        <div
          onClick={handleClick}
          {...dragProps}
          className={`
            ${aspectRatioClasses[aspectRatio]} rounded-xl border-2 border-dashed 
            flex flex-col items-center justify-center cursor-pointer transition-all group relative
            ${isDragging 
              ? `${colors.border} ${colors.bg} ring-2 ${colors.ring}` 
              : `border-gray-200 ${colors.hoverBorder} ${colors.hoverBg}`
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `.trim()}
          data-testid="image-upload-empty-state"
        >
          {isDragging && (
            <div 
              className={`absolute inset-0 z-10 rounded-xl ${colors.bg}/90 backdrop-blur-sm flex items-center justify-center pointer-events-none`}
              data-testid="image-upload-drag-overlay"
            >
              <div className={`flex flex-col items-center ${colors.dragText} animate-bounce`}>
                <Upload className="w-8 h-8 mb-2" />
                <span className="font-medium">释放鼠标上传图片</span>
              </div>
            </div>
          )}
          <div className={`w-16 h-16 rounded-2xl bg-gray-100 ${colors.iconBg} flex items-center justify-center mb-4 transition-all`}>
            {icon || <Upload className={`w-8 h-8 text-gray-400 ${colors.iconText} transition-all`} />}
          </div>
          <p className="text-sm text-gray-500 mb-1">{emptyTitle}</p>
          <p className="text-xs text-gray-400">{emptySubtitle}</p>
        </div>
      ) : (
        <div 
          className={`relative ${aspectRatioClasses[aspectRatio]} rounded-xl overflow-hidden bg-gray-100`}
          data-testid="image-upload-preview-state"
        >
          <img
            src={previewUrl}
            alt="预览"
            className="w-full h-full object-contain cursor-pointer"
            draggable
            onClick={handleImageClick}
            onContextMenu={handleImageContextMenu}
            onDragStart={handleDragStart}
            data-testid="image-upload-preview-image"
          />
          <button
            onClick={onClear}
            className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all"
            data-testid="image-upload-clear-button"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
