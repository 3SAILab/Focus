import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import ShadowOptionDialog, { buildWhiteBackgroundPrompt } from '../components/ShadowOptionDialog';
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
import { api } from '../api';

export default function WhiteBackground() {
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
    type: GenerationType.WHITE_BACKGROUND,
    loadHistoryFn: async () => {
      const response = await api.getWhiteBackgroundHistory();
      if (response.ok) return response.json();
      return [];
    },
  });

  // Dialog state
  const [showShadowDialog, setShowShadowDialog] = useState(false);

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
      const aspectRatio = await getImageAspectRatio(uploadedFile);
      
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('aspectRatio', aspectRatio);
      formData.append('imageSize', '2K');
      formData.append('type', GenerationType.WHITE_BACKGROUND);
      formData.append('images', uploadedFile);

      await startGeneration(formData);
    } catch {
      toast.error('生成失败');
    }
  };

  return (
    <>
      <PageHeader
        title="一键白底图"
        statusColor="green"
        showCounter
        counterRefresh={counterRefresh}
      />

      <div className="flex-1 overflow-y-auto bg-[#fafafa] p-6">
        <div className="max-w-6xl mx-auto">
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
              
              <GenerationResultArea
                isRecovering={isRecovering}
                isGenerating={isGenerating}
                generatedImage={generatedImage}
                accentColor="red"
                generatingText="正在生成白底图..."
                emptyText="生成的白底图将显示在这里"
                emptyIcon={<span className="text-3xl">🖼️</span>}
                onImageClick={setLightboxImage}
                onContextMenu={handleContextMenu}
              />
            </div>
          </div>

          <HistorySection
            title="白底图历史记录"
            history={history}
            onImageClick={handleHistoryClick}
            onImagePreview={setLightboxImage}
            emptyText="暂无白底图生成记录"
            processingTasks={processingTasks}
            pendingTasks={pendingTasks}
          />
        </div>
      </div>

      <ShadowOptionDialog
        isOpen={showShadowDialog}
        onClose={() => setShowShadowDialog(false)}
        onConfirm={handleGenerate}
      />

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
