import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Package } from 'lucide-react';
import ImageContextMenu from '../components/ImageContextMenu';
import PlaceholderCard from '../components/PlaceholderCard';
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
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { getImageAspectRatio } from '../utils/aspectRatio';
import { getErrorMessage } from '../utils/errorHandler';
import { useTaskRecovery } from '../hooks/useTaskRecovery';
import { buildProductScenePrompt } from '../utils/promptBuilder';

export default function ProductScene() {
  const toast = useToast();
  
  // Use the custom hook for image upload management
  const { file: uploadedFile, previewUrl, setFile, clear: clearUpload } = useImageUpload();
  
  // State
  const [productName, setProductName] = useState('');
  const [sceneDescription, setSceneDescription] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string } | null>(null);

  // Validation: check if inputs are valid (non-empty, non-whitespace)
  const isProductNameValid = productName.trim().length > 0;
  const isSceneDescriptionValid = sceneDescription.trim().length > 0;
  const canGenerate = uploadedFile && isProductNameValid && isSceneDescriptionValid;

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.getProductSceneHistory();
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('加载一键商品图历史失败:', error);
    }
  }, []);

  // Task recovery callbacks
  const handleTaskComplete = useCallback((task: GenerationTask) => {
    console.log('[ProductScene] Task completed:', task.task_id);
    if (task.image_url) {
      setGeneratedImage(task.image_url);
    }
    loadHistory();
    setCounterRefresh(prev => prev + 1);
    toast.success('商品图生成完成！');
  }, [loadHistory, toast]);

  const handleTaskFailed = useCallback((task: GenerationTask) => {
    console.log('[ProductScene] Task failed:', task.task_id, task.error_msg);
    const { message, isQuotaError } = getErrorMessage(task.error_msg);
    if (isQuotaError) {
      setShowQuotaError(true);
    } else {
      toast.error('生成失败: ' + message);
    }
  }, [toast]);

  // Use task recovery hook to restore in-progress tasks after page refresh
  const { processingTasks, isRecovering } = useTaskRecovery({
    type: GenerationType.PRODUCT_SCENE,
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


  const handleGenerate = async () => {
    if (!uploadedFile) {
      toast.warning('请先上传产品图片');
      return;
    }
    if (!isProductNameValid) {
      toast.warning('请输入产品名称');
      return;
    }
    if (!isSceneDescriptionValid) {
      toast.warning('请输入使用场景');
      return;
    }

    setIsGenerating(true);
    const prompt = buildProductScenePrompt(productName.trim(), sceneDescription.trim());

    try {
      // Auto-match image aspect ratio
      const aspectRatio = await getImageAspectRatio(uploadedFile);
      
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('aspectRatio', aspectRatio);
      formData.append('imageSize', '2K');
      formData.append('type', GenerationType.PRODUCT_SCENE);
      formData.append('images', uploadedFile);

      const response = await api.generate(formData);

      if (!response.ok) {
        const errData = await response.json();
        const { message: errorMsg, isQuotaError } = getErrorMessage(errData, response.status);
        if (isQuotaError) {
          setShowQuotaError(true);
          return;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      if (data.image_url) {
        setGeneratedImage(data.image_url);
        setCounterRefresh(prev => prev + 1);
        await loadHistory();
        toast.success('商品图生成成功！');
      } else {
        throw new Error('未返回图片');
      }
    } catch (error) {
      const { message, isQuotaError } = getErrorMessage(error);
      if (isQuotaError) {
        setShowQuotaError(true);
      } else {
        toast.error(message);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHistoryClick = (item: GenerationHistory) => {
    setGeneratedImage(item.image_url);
  };

  return (
    <>
      {/* Header */}
      <PageHeader
        title="一键商品图"
        statusColor="orange"
        showCounter
        counterRefresh={counterRefresh}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto bg-[#fafafa] p-6">
        <div className="max-w-6xl mx-auto">
          {/* Upload and output area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Left: Upload area and inputs */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" />
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
                accentColor="orange"
              />

              {/* Product name input */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  产品名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="例如：咖啡杯、运动鞋、手表"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
                {!isProductNameValid && productName.length > 0 && (
                  <p className="mt-1 text-xs text-red-500">请输入产品名称</p>
                )}
              </div>

              {/* Scene description input */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  使用场景 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sceneDescription}
                  onChange={(e) => setSceneDescription(e.target.value)}
                  placeholder="例如：办公室桌面、户外运动、商务会议"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                />
                {!isSceneDescriptionValid && sceneDescription.length > 0 && (
                  <p className="mt-1 text-xs text-red-500">请输入使用场景</p>
                )}
              </div>

              {/* Generate button */}
              <GenerateButton
                onClick={handleGenerate}
                isGenerating={isGenerating}
                disabled={!canGenerate}
                text="生成商品图"
                loadingText="生成中..."
                icon={<ArrowRight className="w-5 h-5" />}
                color="orange"
                fullWidth
                className="mt-4"
              />
            </div>


            {/* Right: Output area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">生成结果</h2>
              
              {/* Show recovering state */}
              {isRecovering ? (
                <div className="aspect-square flex flex-col items-center justify-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-gray-500">正在恢复任务状态...</p>
                </div>
              ) : isGenerating || processingTasks.length > 0 ? (
                /* Show loading state for generating or recovered processing tasks */
                <div className="aspect-square flex flex-col items-center justify-center">
                  <PlaceholderCard />
                  {processingTasks.length > 0 && (
                    <p className="text-xs text-orange-500 mt-2">正在生成中...</p>
                  )}
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
                    <span className="text-3xl">📦</span>
                  </div>
                  <p className="text-sm">生成的商品图将显示在这里</p>
                </div>
              )}
            </div>
          </div>

          {/* History section */}
          <HistorySection
            title="商品图历史记录"
            history={history}
            onImageClick={handleHistoryClick}
            onImagePreview={setLightboxImage}
            emptyText="暂无商品图生成记录"
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
