import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Sun } from 'lucide-react';
import ImageContextMenu from '../components/ImageContextMenu';
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
import { buildLightShadowPrompt } from '../utils/promptBuilder';

export default function LightShadow() {
  const toast = useToast();
  
  // Use the custom hook for image upload management
  const { file: uploadedFile, previewUrl, setFile, clear: clearUpload } = useImageUpload();
  
  // State
  const [productName, setProductName] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string } | null>(null);

  // Validation: check if productName is valid (non-empty, non-whitespace)
  const isProductNameValid = productName.trim().length > 0;
  const canGenerate = uploadedFile && isProductNameValid;

  const loadHistory = useCallback(async () => {
    try {
      const { api } = await import('../api');
      const response = await api.getLightShadowHistory();
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('加载光影融合历史失败:', error);
    }
  }, []);

  // Task completion callback
  // Note: Toast is shown by GlobalTaskContext, this only updates local state
  const handleTaskComplete = useCallback((task: GenerationTask) => {
    console.log('[LightShadow] Task completed:', task.task_id);
    if (task.image_url) {
      setGeneratedImage(task.image_url);
    }
    loadHistory();
    setCounterRefresh(prev => prev + 1);
  }, [loadHistory]);

  // Error callback
  const handleError = useCallback((errorMsg: string, isQuotaError: boolean) => {
    console.log('[LightShadow] Error:', errorMsg, 'isQuotaError:', isQuotaError);
    if (isQuotaError) {
      setShowQuotaError(true);
    } else {
      const { message } = getErrorMessage(errorMsg);
      toast.error('生成失败: ' + message);
    }
  }, [toast]);

  const handleTaskFailed = useCallback((task: GenerationTask) => {
    console.log('[LightShadow] Task failed:', task.task_id, task.error_msg);
    const { message, isQuotaError } = getErrorMessage(task.error_msg);
    handleError(message, isQuotaError);
  }, [handleError]);

  // Async generation hook
  const { isGenerating, startGeneration } = useAsyncGeneration({
    onComplete: handleTaskComplete,
    onError: handleError,
  });

  // Task recovery hook
  const { processingTasks, isRecovering } = useTaskRecovery({
    type: GenerationType.LIGHT_SHADOW,
    onTaskComplete: handleTaskComplete,
    onTaskFailed: handleTaskFailed,
  });

  // Load history on mount - Requirements: 2.6
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

  // Handle generate
  const handleGenerate = async () => {
    if (!uploadedFile) {
      toast.warning('请先上传产品图片');
      return;
    }
    if (!isProductNameValid) {
      toast.warning('请输入产品名称');
      return;
    }

    const prompt = buildLightShadowPrompt(productName.trim());

    try {
      // Auto-match image aspect ratio
      const aspectRatio = await getImageAspectRatio(uploadedFile);
      
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('aspectRatio', aspectRatio);
      formData.append('imageSize', '2K');
      formData.append('type', GenerationType.LIGHT_SHADOW);
      formData.append('images', uploadedFile);

      // 使用异步生成
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
        title="光影融合"
        statusColor="purple"
        showCounter
        counterRefresh={counterRefresh}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto bg-[#fafafa] p-6">
        <div className="max-w-6xl mx-auto">
          {/* Upload and output area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Left: Upload area and inputs - Requirements: 2.1 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Sun className="w-4 h-4 text-purple-500" />
                上传产品图片
              </h2>
              
              <ImageUploadZone
                file={uploadedFile}
                previewUrl={previewUrl}
                onFileSelect={handleFileSelect}
                onClear={handleClearUpload}
                onPreview={setLightboxImage}
                onContextMenu={handleContextMenu}
                emptyTitle="点击或拖拽上传图片"
                emptySubtitle="支持 JPG、PNG 格式"
                accentColor="purple"
              />

              {/* Product name input - Requirements: 2.1, 2.2 */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  产品名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="例如：咖啡杯、运动鞋、手表"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                {!isProductNameValid && productName.length > 0 && (
                  <p className="mt-1 text-xs text-red-500">请输入产品名称</p>
                )}
              </div>

              {/* Generate button - Requirements: 2.2 */}
              <GenerateButton
                onClick={handleGenerate}
                isGenerating={isGenerating}
                disabled={!canGenerate}
                text="增强光影"
                loadingText="生成中..."
                icon={<ArrowRight className="w-5 h-5" />}
                color="purple"
                fullWidth
                className="mt-4"
              />
            </div>

            {/* Right: Output area - Requirements: 2.4 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">生成结果</h2>
              
              {/* Show recovering state */}
              {isRecovering ? (
                <div className="aspect-square flex flex-col items-center justify-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-gray-500">正在恢复任务状态...</p>
                </div>
              ) : isGenerating ? (
                /* 当页点击生成时，动画显示在这里 */
                <div className="aspect-square flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center mb-4 animate-pulse">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-sm text-gray-500">正在增强光影效果...</p>
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
                    <span className="text-3xl">✨</span>
                  </div>
                  <p className="text-sm">增强后的图片将显示在这里</p>
                </div>
              )}
            </div>
          </div>

          {/* History section - Requirements: 2.6 - 只有恢复的任务才显示在这里 */}
          <HistorySection
            title="光影融合历史记录"
            history={history}
            onImageClick={handleHistoryClick}
            onImagePreview={setLightboxImage}
            emptyText="暂无光影融合记录"
            processingTasks={processingTasks}
          />
        </div>
      </div>

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
