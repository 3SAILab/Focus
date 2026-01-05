import { useState, useEffect } from 'react';
import { ArrowRight, Sun } from 'lucide-react';
import {
  PageHeader,
  ImageUploadZone,
  GenerateButton,
  HistorySection,
  GenerationViewFooter,
  GenerationResultArea,
} from '../components/common';
import { useImageUpload } from '../hooks/useImageUpload';
import { useGenerationView } from '../hooks/useGenerationView';
import { GenerationType } from '../type';
import { useToast } from '../context/ToastContext';
import { getImageAspectRatio } from '../utils/aspectRatio';
import { buildLightShadowPrompt } from '../utils/promptBuilder';
import { api } from '../api';

export default function LightShadow() {
  const toast = useToast();
  
  // Use the custom hook for image upload management
  const { file: uploadedFile, previewUrl, setFile, clear: clearUpload } = useImageUpload();
  
  // Use unified generation view hook
  const {
    generatedImage,
    setGeneratedImage,
    history,
    lightboxImage,
    setLightboxImage,
    counterRefresh,
    showQuotaError,
    showContact,
    contextMenu,
    isGenerating,
    isRecovering,
    processingTasks,
    pendingTasks,
    loadHistory,
    startGeneration,
    handleHistoryClick,
    handleContextMenu,
    closeContextMenu,
    closeQuotaError,
    closeContact,
    openContactFromQuota,
  } = useGenerationView({
    type: GenerationType.LIGHT_SHADOW,
    loadHistoryFn: async () => {
      const response = await api.getLightShadowHistory();
      if (response.ok) return response.json();
      return [];
    },
  });

  // Local state
  const [productName, setProductName] = useState('');

  // Validation
  const isProductNameValid = productName.trim().length > 0;
  const canGenerate = uploadedFile && isProductNameValid;

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    setFile(file);
    setGeneratedImage(null);
  };

  // Handle clear upload
  const handleClearUpload = () => {
    clearUpload();
    setGeneratedImage(null);
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
      const aspectRatio = await getImageAspectRatio(uploadedFile);
      
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('aspectRatio', aspectRatio);
      formData.append('imageSize', '2K');
      formData.append('type', GenerationType.LIGHT_SHADOW);
      formData.append('images', uploadedFile);

      await startGeneration(formData);
    } catch {
      toast.error('生成失败');
    }
  };

  return (
    <>
      <PageHeader
        title="光影融合"
        statusColor="purple"
        showCounter
        counterRefresh={counterRefresh}
      />

      <div className="flex-1 overflow-y-auto bg-[#fafafa] p-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Left: Upload area and inputs */}
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
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                {!isProductNameValid && productName.length > 0 && (
                  <p className="mt-1 text-xs text-red-500">请输入产品名称</p>
                )}
              </div>

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

            {/* Right: Output area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">生成结果</h2>
              
              <GenerationResultArea
                isRecovering={isRecovering}
                isGenerating={isGenerating}
                generatedImage={generatedImage}
                accentColor="purple"
                generatingText="正在增强光影效果..."
                emptyText="增强后的图片将显示在这里"
                emptyIcon={<span className="text-3xl">✨</span>}
                onImageClick={setLightboxImage}
                onContextMenu={handleContextMenu}
              />
            </div>
          </div>

          <HistorySection
            title="光影融合历史记录"
            history={history}
            onImageClick={handleHistoryClick}
            onImagePreview={setLightboxImage}
            emptyText="暂无光影融合记录"
            processingTasks={processingTasks}
            pendingTasks={pendingTasks}
          />
        </div>
      </div>

      <GenerationViewFooter
        lightboxImage={lightboxImage}
        onLightboxClose={() => setLightboxImage(null)}
        showQuotaError={showQuotaError}
        showContact={showContact}
        onQuotaErrorClose={closeQuotaError}
        onContactClose={closeContact}
        onContactSales={openContactFromQuota}
        contextMenu={contextMenu}
        onContextMenuClose={closeContextMenu}
      />
    </>
  );
}
