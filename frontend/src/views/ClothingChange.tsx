import { useState, useEffect } from 'react';
import { ArrowRight, User, Shirt, Info } from 'lucide-react';
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
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { getImageAspectRatio, findClosestAspectRatio } from '../utils/aspectRatio';

const DEFAULT_PROMPT = '请你不要修改图一模特的姿势保持模特不变，将图一角色的衣服替换成图二的，需要符合图二衣服的上身逻辑';
const SAVED_MODELS_KEY = 'sigma_saved_models';

interface SavedModel {
  id: string;
  url: string;
  name: string;
}

export default function ClothingChange() {
  const toast = useToast();
  const modelUpload = useImageUpload();
  const clothingUpload = useImageUpload();
  
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
    handleContextMenu,
    closeContextMenu,
    closeQuotaError,
    closeContact,
    openContactFromQuota,
  } = useGenerationView({
    type: GenerationType.CLOTHING_CHANGE,
    loadHistoryFn: async () => {
      const response = await api.getClothingChangeHistory();
      if (response.ok) return response.json();
      return [];
    },
  });

  // Local state
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [modelPreviewFromSaved, setModelPreviewFromSaved] = useState<string | null>(null);

  // Load history and saved models on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const saved = localStorage.getItem(SAVED_MODELS_KEY);
    if (saved) {
      try {
        setSavedModels(JSON.parse(saved));
      } catch {
        // ignore parse error
      }
    }
  }, []);

  // Effective model preview (from file or saved)
  const effectiveModelPreview = modelUpload.previewUrl || modelPreviewFromSaved;

  // Handle model file selection
  const handleModelFileSelect = (file: File) => {
    setModelPreviewFromSaved(null);
    modelUpload.setFile(file);
  };

  // Handle model clear
  const handleModelClear = () => {
    modelUpload.clear();
    setModelPreviewFromSaved(null);
  };

  // Save current model to localStorage
  const saveCurrentModel = async () => {
    if (!modelUpload.file || !modelUpload.previewUrl) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const newModel: SavedModel = {
        id: Date.now().toString(),
        url: reader.result as string,
        name: modelUpload.file!.name,
      };
      const updated = [...savedModels, newModel];
      setSavedModels(updated);
      localStorage.setItem(SAVED_MODELS_KEY, JSON.stringify(updated));
      toast.success('模特图已保存');
    };
    reader.readAsDataURL(modelUpload.file);
  };

  // Select a saved model
  const selectSavedModel = (model: SavedModel) => {
    modelUpload.clear();
    setModelPreviewFromSaved(model.url);
  };

  // Delete a saved model
  const deleteSavedModel = (id: string) => {
    const updated = savedModels.filter(m => m.id !== id);
    setSavedModels(updated);
    localStorage.setItem(SAVED_MODELS_KEY, JSON.stringify(updated));
    toast.success('已删除');
  };

  // Handle generate
  const handleGenerate = async () => {
    if (!effectiveModelPreview) {
      toast.warning('请先上传模特图');
      return;
    }
    if (!clothingUpload.file) {
      toast.warning('请先上传服装图');
      return;
    }

    try {
      let aspectRatio = '1:1';
      
      if (modelUpload.file) {
        aspectRatio = await getImageAspectRatio(modelUpload.file);
      } else if (modelPreviewFromSaved) {
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = modelPreviewFromSaved;
        });
        if (img.width && img.height) {
          aspectRatio = findClosestAspectRatio(img.width, img.height);
        }
      }

      const formData = new FormData();
      formData.append('prompt', DEFAULT_PROMPT);
      formData.append('aspectRatio', aspectRatio);
      formData.append('imageSize', '2K');
      formData.append('type', GenerationType.CLOTHING_CHANGE);

      if (modelUpload.file) {
        formData.append('images', modelUpload.file);
      } else if (modelPreviewFromSaved) {
        const response = await fetch(modelPreviewFromSaved);
        const blob = await response.blob();
        formData.append('images', blob, 'model.png');
      }
      formData.append('images', clothingUpload.file);

      await startGeneration(formData);
    } catch {
      toast.error('生成失败');
    }
  };

  return (
    <>
      <PageHeader
        title="一键换装"
        statusColor="purple"
        showCounter
        counterRefresh={counterRefresh}
      />

      <div className="flex-1 overflow-y-auto bg-[#fafafa] p-6">
        <div className="max-w-6xl mx-auto">
          {/* Tips */}
          <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
              <div className="text-sm text-purple-700">
                <p className="font-medium mb-1">模特图拍摄建议</p>
                <ul className="list-disc list-inside space-y-1 text-purple-600">
                  <li>建议使用正面或微侧面的站立姿势</li>
                  <li>双手自然下垂或叉腰效果更好</li>
                  <li>避免遮挡身体主要部位</li>
                  <li>背景简洁、光线充足的照片效果最佳</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Model upload */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-500" />
                  模特图（图一）
                </h2>
                {modelUpload.file && (
                  <button
                    onClick={saveCurrentModel}
                    className="text-xs text-purple-600 hover:text-purple-700"
                  >
                    保存到收藏
                  </button>
                )}
              </div>
              
              {!effectiveModelPreview ? (
                <ImageUploadZone
                  file={modelUpload.file}
                  previewUrl={modelUpload.previewUrl}
                  onFileSelect={handleModelFileSelect}
                  onClear={handleModelClear}
                  onPreview={setLightboxImage}
                  onContextMenu={handleContextMenu}
                  aspectRatio="3:4"
                  icon={<User className="w-7 h-7 text-gray-400 group-hover:text-purple-500 transition-all" />}
                  emptyTitle="上传模特图"
                  emptySubtitle="点击或拖拽"
                  accentColor="purple"
                />
              ) : (
                <div className="relative aspect-3/4 rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={effectiveModelPreview}
                    alt="模特图"
                    className="w-full h-full object-cover cursor-pointer"
                    draggable
                    onClick={() => setLightboxImage(effectiveModelPreview)}
                    onContextMenu={(e) => handleContextMenu(e, effectiveModelPreview)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-sigma-image', effectiveModelPreview);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  />
                  <button
                    onClick={handleModelClear}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all"
                  >
                    <span className="text-sm">×</span>
                  </button>
                </div>
              )}

              {/* Saved models */}
              {savedModels.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">已保存的模特图</p>
                  <div className="flex gap-2 flex-wrap">
                    {savedModels.map((model) => (
                      <div
                        key={model.id}
                        className="relative group w-12 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-purple-300 cursor-pointer"
                        onClick={() => selectSavedModel(model)}
                      >
                        <img
                          src={model.url}
                          alt={model.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSavedModel(model.id);
                          }}
                          className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-bl text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Clothing upload */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Shirt className="w-4 h-4 text-blue-500" />
                服装图（图二）
              </h2>
              
              <ImageUploadZone
                file={clothingUpload.file}
                previewUrl={clothingUpload.previewUrl}
                onFileSelect={clothingUpload.setFile}
                onClear={clothingUpload.clear}
                onPreview={setLightboxImage}
                onContextMenu={handleContextMenu}
                aspectRatio="3:4"
                icon={<Shirt className="w-7 h-7 text-gray-400 group-hover:text-blue-500 transition-all" />}
                emptyTitle="上传服装图"
                emptySubtitle="点击或拖拽"
                accentColor="blue"
              />
            </div>

            {/* Result */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">生成结果</h2>
              
              <GenerationResultArea
                isRecovering={isRecovering}
                isGenerating={isGenerating}
                generatedImage={generatedImage}
                aspectRatio="3:4"
                accentColor="purple"
                generatingText="正在生成换装效果..."
                emptyText="换装结果将显示在这里"
                emptyIcon={<span className="text-2xl">👗</span>}
                onImageClick={setLightboxImage}
                onContextMenu={handleContextMenu}
              />
            </div>
          </div>

          <div className="flex justify-center mb-8">
            <GenerateButton
              onClick={handleGenerate}
              isGenerating={isGenerating}
              disabled={!effectiveModelPreview || !clothingUpload.file}
              text="开始换装"
              loadingText="生成中..."
              icon={<ArrowRight className="w-5 h-5" />}
              color="purple"
              className="px-12 py-4"
            />
          </div>

          <HistorySection
            title="换装历史记录"
            history={history}
            onImageClick={(item) => setGeneratedImage(item.image_url)}
            onImagePreview={setLightboxImage}
            emptyText="暂无换装生成记录"
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
