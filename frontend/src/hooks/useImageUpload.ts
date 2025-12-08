import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseImageUploadOptions {
  onFileSelect?: (file: File) => void;
}

export interface UseImageUploadReturn {
  file: File | null;
  previewUrl: string | null;
  setFile: (file: File | null) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleUrlLoad: (url: string) => Promise<void>;
  clear: () => void;
}

/**
 * Custom hook for managing image upload state and preview URL lifecycle
 * Handles URL.createObjectURL and URL.revokeObjectURL automatically
 * @param options - Optional configuration
 * @returns Image upload state and handler functions
 */
export function useImageUpload(options?: UseImageUploadOptions): UseImageUploadReturn {
  const [file, setFileState] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Track the current object URL for cleanup
  const objectUrlRef = useRef<string | null>(null);

  // Cleanup function to revoke object URL
  const revokeCurrentUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      revokeCurrentUrl();
    };
  }, [revokeCurrentUrl]);

  const setFile = useCallback((newFile: File | null) => {
    // Revoke previous URL before creating new one
    revokeCurrentUrl();
    
    if (newFile) {
      const newUrl = URL.createObjectURL(newFile);
      objectUrlRef.current = newUrl;
      setPreviewUrl(newUrl);
      setFileState(newFile);
      options?.onFileSelect?.(newFile);
    } else {
      setPreviewUrl(null);
      setFileState(null);
    }
  }, [revokeCurrentUrl, options]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [setFile]);

  const handleUrlLoad = useCallback(async (url: string): Promise<void> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const fileName = `upload_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
      const loadedFile = new File([blob], fileName, { type: blob.type });
      setFile(loadedFile);
    } catch (error) {
      console.error('Failed to load image from URL:', error);
      throw error;
    }
  }, [setFile]);

  const clear = useCallback(() => {
    revokeCurrentUrl();
    setPreviewUrl(null);
    setFileState(null);
  }, [revokeCurrentUrl]);

  return {
    file,
    previewUrl,
    setFile,
    handleFileSelect,
    handleUrlLoad,
    clear,
  };
}
