import { useState, useCallback } from 'react';

export interface UseDragDropOptions {
  onFileDrop: (file: File) => void;
  onUrlDrop?: (url: string) => Promise<void>;
  disabled?: boolean;
}

export interface UseDragDropReturn {
  isDragging: boolean;
  dragProps: {
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
}

/**
 * Check if a file is an image based on MIME type
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if a URL is likely an image URL
 */
export function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext)) ||
    lowerUrl.startsWith('data:image/');
}

/**
 * Extract image files from a FileList
 */
export function extractImageFiles(files: FileList): File[] {
  return Array.from(files).filter(isImageFile);
}

/**
 * Custom hook for drag-and-drop functionality
 * Handles drag state management and drop handling for images
 * @param options - Configuration options
 * @returns Drag state and event handlers
 */
export function useDragDrop(options: UseDragDropOptions): UseDragDropReturn {
  const { onFileDrop, onUrlDrop, disabled = false } = options;
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only set isDragging to false if we're leaving the target element
    // and not entering a child element
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    // First check for files
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const imageFiles = extractImageFiles(files);
      if (imageFiles.length > 0) {
        onFileDrop(imageFiles[0]);
        return;
      }
    }

    // Check for image URLs (from app internal drag or external)
    const sigmaImageUrl = e.dataTransfer.getData('application/x-sigma-image');
    const uriList = e.dataTransfer.getData('text/uri-list');
    const plainText = e.dataTransfer.getData('text/plain');
    
    const imageUrl = sigmaImageUrl || uriList || plainText;
    
    if (imageUrl && onUrlDrop) {
      const isValidUrl = imageUrl.startsWith('http://') || 
                         imageUrl.startsWith('https://') || 
                         imageUrl.startsWith('data:');
      if (isValidUrl) {
        await onUrlDrop(imageUrl);
      }
    }
  }, [disabled, onFileDrop, onUrlDrop]);

  return {
    isDragging,
    dragProps: {
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
}
