import { useState, useEffect, useCallback } from 'react';
import { ArrowRight } from 'lucide-react';
import ImageContextMenu from '../components/ImageContextMenu';
import ShadowOptionDialog, { buildWhiteBackgroundPrompt } from '../components/ShadowOptionDialog';
import Lightbox from '../components/Lightbox';
import {
  PageHeader,
  ImageUploadZone,
  GenerateButton,
  HistorySection,
  QuotaErrorHandler,
} from '../components/common';
import { useImageUpload } from '../hooks/useImageUpload';
import type { GenerationHistory, GenerationTask } from '../type';
import { GenerationType } from '../type';
import { useToast } from '../context/ToastContext';
import { getImageAspectRatio } from '../utils/aspectRatio';
import { getErrorMessage } from '../utils/errorHandler';
import { useTaskRecovery } from '../hooks/useTaskRecovery';
import { useAsyncGeneration } from '../hooks/useAsyncGeneration';

export default function WhiteBackground() {
  const toast = useToast();
  
  // Use the custom hook for image upload management
  const { file: uploadedFile, previewUrl, setFile, clear: clearUpload } = useImageUpload();
  
  // State
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [showShadowDialog, setShowShadowDialog] = useState(false);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string } | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const { api } = await import('../api');
      const response = await api.getWhiteBackgroundHistory();
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('加载白底图历史失败:', error);
    }
  }, []);

  // Task completion callback - used by both async generation and task recovery
  // Note: Toast is shown by GlobalTaskContext, this only updates local state
  const handleTaskComplete = useCallback((task: GenerationTask) => {
    console.log('[WhiteBackground] Task completed:', task.task_id);
    // Update generated image with the completed task's result
    if (task.image_url) {
      setGeneratedImage(task.image_url);
    }
    // Reload history to show the completed task
    loadHistory();
    // Refresh generation counter
    setCounterRefresh(prev => prev + 1);
  }, [loadHistory]);

  // Error callback - used by both async generation and task recovery
  const handleError = useCallback((errorMsg: string, isQuotaError: boolean) => {
    console.log('[WhiteBackground] Error:', errorMsg, 'isQuotaError:', isQuotaError);
    if (isQuotaError) {
      setShowQuotaError(true);
    } else {
      const { message } = getErrorMessage(errorMsg);
      toast.error('生成失败: ' + message);
    }
  }, [toast]);

  const handleTaskFailed = useCallback((task: GenerationTask) => {
    console.log('[WhiteBackground] Task failed:', task.task_id, task.error_msg);
    const { message, isQuotaError } = getErrorMessage(task.error_msg);
    handleError(message, isQuotaError);
  }, [handleError]);

  // Async generation hook - for new generations
  const { isGenerating, startGeneration } = useAsyncGeneration({
    onComplete: handleTaskComplete,
    onError: handleError,
  });

  // Task recovery hook - for restoring in-progress tasks after page refresh
  const { processingTasks, isRecovering } = useTaskRecovery({
    type: GenerationType.WHITE_BACKGROUND,
    onTaskComplete: handleTaskComplete,
    onTaskFailed: handleTaskFailed,
  });

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Handle file selection from ImageUploadZone
  const handleFileSelect = (file: File) => {
    setFile(file);
    setGeneratedImage(null);
  };

  // Handle clear upload
  const handleClearUpload = () => {
    clearUpload();
    setGeneratedImage(null);
  };

  // Context menu handling
  const handleContextMenu = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setContextMenu({
      x: rect.right + 8,
      y: Math.min(e.clientY, window.innerHeight - 120),
      url,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleGenerateClick = () => {
    if (!uploadedFile) {
      toast.warning('请先上传产品图片');
      return;
    }
    setShowShadowDialog(true);
  };

  const handleGenerate = async (removeShadow: boolean) => {
    if (!uploadedFile) return;

    const prompt = buildWhiteBackgroundPrompt(removeShadow);

    try {
      // Auto-match image aspect ratio
      const aspectRatio = await getImageAspectRatio(uploadedFile);
      
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('aspectRatio', aspectRatio);
      formData.append('imageSize', '2K');
      formData.append('type', GenerationType.WHITE_BACKGROUND);
      formData.append('images', uploadedFile);

      // 使用异步生成 - 不阻塞等待结果
      await startGeneration(formData);
    } catch (error) {
      const { message, isQuotaError } = getErrorMessage(error);
      handleError(message, isQuotaError);
    }
  };

  const handleHistoryClick = (item: GenerationHistory) => {
    setGeneratedImage(item.image_url);
  };

  return (
    <>
      {/* Header */}
      <PageHeader
        title="一键白底图"
        statusColor="green"
        showCounter
        counterRefresh={counterRefresh}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto bg-[#fafafa] p-6">
        <div className="max-w-6xl mx-auto">
          {/* Upload and output area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Left: Upload area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">上传产品图片</h2>
              
              <ImageUploadZone
                file={uploadedFile}
                previewUrl={previewUrl}
                onFileSelect={handleFileSelect}
                onClear={handleClearUpload}
                onPreview={setLightboxImage}
                onContextMenu={handleContextMenu}
                emptyTitle="点击或拖拽上传图片"
                emptySubtitle="支持 JPG、PNG 格式"
                accentColor="red"
              />

              {/* Generate button */}
              <GenerateButton
                onClick={handleGenerateClick}
                isGenerating={isGenerating}
                disabled={!uploadedFile}
                text="生成白底图"
                loadingText="生成中..."
                icon={<ArrowRight className="w-5 h-5" />}
                color="red"
                fullWidth
                className="mt-4"
              />
            </div>

            {/* Right: Output area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">生成结果</h2>
              
              {/* Show recovering state - Requirement 1.4 */}
              {isRecovering ? (
                <div className="aspect-square flex flex-col items-center justify-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-gray-500">正在恢复任务状态...</p>
                </div>
              ) : isGenerating ? (
                /* 当页点击生成时，动画显示在这里 */
                <div className="aspect-square flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center mb-4 animate-pulse">
                    <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-sm text-gray-500">正在生成白底图...</p>
                </div>
              ) : generatedImage ? (
                <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={generatedImage}
                    alt="生成结果"
                    className="w-full h-full object-contain cursor-pointer"
                    draggable
                    onClick={() => setLightboxImage(generatedImage)}
                    onContextMenu={(e) => handleContextMenu(e, generatedImage)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-sigma-image', generatedImage);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  />
                </div>
              ) : (
                <div className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <span className="text-3xl">🖼️</span>
                  </div>
                  <p className="text-sm">生成的白底图将显示在这里</p>
                </div>
              )}
            </div>
          </div>

          {/* History section - 只有恢复的任务才显示在这里 */}
          <HistorySection
            title="白底图历史记录"
            history={history}
            onImageClick={handleHistoryClick}
            onImagePreview={setLightboxImage}
            emptyText="暂无白底图生成记录"
            processingTasks={processingTasks}
          />
        </div>
      </div>

      {/* Shadow option dialog */}
      <ShadowOptionDialog
        isOpen={showShadowDialog}
        onClose={() => setShowShadowDialog(false)}
        onConfirm={handleGenerate}
      />

      {/* Image lightbox */}
      <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />
      
      {/* Quota error handler */}
      <QuotaErrorHandler
        showQuotaError={showQuotaError}
        showContact={showContact}
        onQuotaErrorClose={() => setShowQuotaError(false)}
        onContactClose={() => setShowContact(false)}
        onContactSales={() => {
          setShowQuotaError(false);
          setShowContact(true);
        }}
      />

      {/* Context menu */}
      <ImageContextMenu
        imageUrl={contextMenu?.url || ''}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={closeContextMenu}
        showReferenceOption={false}
      />
    </>
  );
}
