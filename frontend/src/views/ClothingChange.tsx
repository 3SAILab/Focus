import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, User, Shirt, Info } from 'lucide-react';
import Lightbox from '../components/Lightbox';
import ImageContextMenu from '../components/ImageContextMenu';
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
import { useAsyncGeneration } from '../hooks/useAsyncGeneration';

// 默认提示词
const DEFAULT_PROMPT = '请你不要修改图一模特的姿势保持模特不变，将图一角色的衣服替换成图二的，需要符合图二衣服的上身逻辑';

// 本地存储 key
const SAVED_MODELS_KEY = 'sigma_saved_models'; 

interface SavedModel {
  id: string;
  url: string;
  name: string;
}

export default function ClothingChange() {
  const toast = useToast();
  
  // Use custom hooks for image upload management
  const modelUpload = useImageUpload();
  const clothingUpload = useImageUpload();
  
  // State
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string } | null>(null);
  // Track if model preview is from saved models (not from file upload)
  const [modelPreviewFromSaved, setModelPreviewFromSaved] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.getClothingChangeHistory();
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('加载换装历史失败:', error);
    }
  }, []);

  // Task completion callback
  // Note: Toast is shown by GlobalTaskContext, this only updates local state
  const handleTaskComplete = useCallback((task: GenerationTask) => {
    console.log('[ClothingChange] Task completed:', task.task_id);
    if (task.image_url) {
      setGeneratedImage(task.image_url);
    }
    loadHistory();
    setCounterRefresh(prev => prev + 1);
  }, [loadHistory]);

  // Error callback
  const handleError = useCallback((errorMsg: string, isQuotaError: boolean) => {
    console.log('[ClothingChange] Error:', errorMsg, 'isQuotaError:', isQuotaError);
    if (isQuotaError) {
      setShowQuotaError(true);
    } else {
      const { message } = getErrorMessage(errorMsg);
      toast.error(message);
    }
  }, [toast]);

  const handleTaskFailed = useCallback((task: GenerationTask) => {
    console.log('[ClothingChange] Task failed:', task.task_id, task.error_msg);
    const { message, isQuotaError } = getErrorMessage(task.error_msg);
    handleError(message, isQuotaError);
  }, [handleError]);

  // Async generation hook
  const { isGenerating, startGeneration, pendingTasks } = useAsyncGeneration({
    onComplete: handleTaskComplete,
    onError: handleError,
  });

  // Task recovery hook
  const { processingTasks, isRecovering } = useTaskRecovery({
    type: GenerationType.CLOTHING_CHANGE,
    onTaskComplete: handleTaskComplete,
    onTaskFailed: handleTaskFailed,
  });

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Load saved models from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SAVED_MODELS_KEY);
    if (saved) {
      try {
        setSavedModels(JSON.parse(saved));
      } catch (e) {
        console.error('加载保存的模特图失败:', e);
      }
    }
  }, []);

  // Get the effective model preview URL (from hook or saved model)
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

  // Handle clothing file selection
  const handleClothingFileSelect = (file: File) => {
    clothingUpload.setFile(file);
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

  // Save current model to favorites
  const saveCurrentModel = async () => {
    if (!modelUpload.file || !modelUpload.previewUrl) return;
    
    // Convert to base64 for storage
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
      // Use model image aspect ratio
      let aspectRatio = '1:1';
      if (modelUpload.file) {
        aspectRatio = await getImageAspectRatio(modelUpload.file);
      } else if (modelPreviewFromSaved) {
        // If using saved model (base64), get aspect ratio from URL
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = modelPreviewFromSaved;
        });
        if (img.width && img.height) {
          const { findClosestAspectRatio } = await import('../utils/aspectRatio');
          aspectRatio = findClosestAspectRatio(img.width, img.height);
        }
      }

      const formData = new FormData();
      formData.append('prompt', DEFAULT_PROMPT);
      formData.append('aspectRatio', aspectRatio);
      formData.append('imageSize', '2K');
      formData.append('type', GenerationType.CLOTHING_CHANGE);

      // Add model image (first image)
      if (modelUpload.file) {
        formData.append('images', modelUpload.file);
      } else if (modelPreviewFromSaved) {
        // Convert base64 to File
        const response = await fetch(modelPreviewFromSaved);
        const blob = await response.blob();
        formData.append('images', blob, 'model.png');
      }

      // Add clothing image (second image)
      formData.append('images', clothingUpload.file);

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
        title="一键换装"
        statusColor="purple"
        showCounter
        counterRefresh={counterRefresh}
      />

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto bg-[#fafafa] p-6">
        <div className="max-w-6xl mx-auto">
          {/* Tips info box */}
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

          {/* Upload areas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Model image upload */}
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
              
              {/* Custom upload zone for model - need to handle saved models */}
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
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100">
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

            {/* Clothing image upload */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Shirt className="w-4 h-4 text-blue-500" />
                服装图（图二）
              </h2>
              
              <ImageUploadZone
                file={clothingUpload.file}
                previewUrl={clothingUpload.previewUrl}
                onFileSelect={handleClothingFileSelect}
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

            {/* Generated result */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">生成结果</h2>
              
              {/* Show recovering state - Requirement 1.4 */}
              {isRecovering ? (
                <div className="aspect-[3/4] flex flex-col items-center justify-center text-gray-400">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-gray-500">正在恢复任务状态...</p>
                </div>
              ) : isGenerating ? (
                /* 当页点击生成时，动画显示在这里 */
                <div className="aspect-[3/4] flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center mb-4 animate-pulse">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <p className="text-sm text-gray-500">正在生成换装效果...</p>
                </div>
              ) : generatedImage ? (
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={generatedImage}
                    alt="生成结果"
                    className="w-full h-full object-cover cursor-pointer"
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
                <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                    <span className="text-2xl">👗</span>
                  </div>
                  <p className="text-sm">换装结果将显示在这里</p>
                </div>
              )}
            </div>
          </div>

          {/* Generate button */}
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

          {/* History section */}
          <HistorySection
            title="换装历史记录"
            history={history}
            onImageClick={handleHistoryClick}
            onImagePreview={setLightboxImage}
            emptyText="暂无换装生成记录"
            processingTasks={processingTasks}
            pendingTasks={pendingTasks}
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
