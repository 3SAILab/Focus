import { useState, useEffect, useRef } from 'react';
import { ArrowRight, Loader2, X, User, Shirt, Info, Upload } from 'lucide-react';
import GenerationCounter from '../components/GenerationCounter';
import PlaceholderCard from '../components/PlaceholderCard';
import Lightbox from '../components/Lightbox';
import QuotaErrorAlert from '../components/QuotaErrorAlert';
import ContactModal from '../components/ContactModal';
import ImageContextMenu from '../components/ImageContextMenu';
import HistoryImageGrid from '../components/HistoryImageGrid';
import type { GenerationHistory } from '../type';
import { GenerationType } from '../type';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { getImageAspectRatio } from '../utils/aspectRatio';
import { getErrorMessage } from '../utils/errorHandler';

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
  const modelInputRef = useRef<HTMLInputElement>(null);
  const clothingInputRef = useRef<HTMLInputElement>(null);
  
  // 状态
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [modelPreview, setModelPreview] = useState<string | null>(null);
  const [clothingFile, setClothingFile] = useState<File | null>(null);
  const [clothingPreview, setClothingPreview] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [savedModels, setSavedModels] = useState<SavedModel[]>([]);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [isDraggingModel, setIsDraggingModel] = useState(false);
  const [isDraggingClothing, setIsDraggingClothing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string } | null>(null);

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await api.getClothingChangeHistory();
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('加载换装历史失败:', error);
    }
  };

  // 加载保存的模特图
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

  // 清理预览 URL
  useEffect(() => {
    return () => {
      if (modelPreview && !modelPreview.startsWith('data:')) {
        URL.revokeObjectURL(modelPreview);
      }
      if (clothingPreview) {
        URL.revokeObjectURL(clothingPreview);
      }
    };
  }, [modelPreview, clothingPreview]);

  const handleModelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (modelPreview && !savedModels.some(m => m.url === modelPreview)) {
        URL.revokeObjectURL(modelPreview);
      }
      setModelFile(file);
      setModelPreview(URL.createObjectURL(file));
    }
    e.target.value = '';
  };

  const handleClothingSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (clothingPreview) {
        URL.revokeObjectURL(clothingPreview);
      }
      setClothingFile(file);
      setClothingPreview(URL.createObjectURL(file));
    }
    e.target.value = '';
  };

  // 从 URL 加载图片为 File 对象
  const loadImageFromUrl = async (url: string): Promise<File | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const fileName = `upload_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
      return new File([blob], fileName, { type: blob.type });
    } catch (error) {
      console.error('加载图片失败:', error);
      return null;
    }
  };

  const handleDrop = (type: 'model' | 'clothing') => async (e: React.DragEvent) => {
    e.preventDefault();
    if (type === 'model') {
      setIsDraggingModel(false);
    } else {
      setIsDraggingClothing(false);
    }

    // 首先检查是否有文件
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      if (type === 'model') {
        if (modelPreview && !savedModels.some(m => m.url === modelPreview)) {
          URL.revokeObjectURL(modelPreview);
        }
        setModelFile(file);
        setModelPreview(URL.createObjectURL(file));
      } else {
        if (clothingPreview) {
          URL.revokeObjectURL(clothingPreview);
        }
        setClothingFile(file);
        setClothingPreview(URL.createObjectURL(file));
      }
      return;
    }

    // 检查是否是从应用内拖拽的图片 URL
    const sigmaImageUrl = e.dataTransfer.getData('application/x-sigma-image');
    const imageUrl = sigmaImageUrl || e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:'))) {
      const loadedFile = await loadImageFromUrl(imageUrl);
      if (loadedFile) {
        if (type === 'model') {
          if (modelPreview && !savedModels.some(m => m.url === modelPreview)) {
            URL.revokeObjectURL(modelPreview);
          }
          setModelFile(loadedFile);
          setModelPreview(URL.createObjectURL(loadedFile));
        } else {
          if (clothingPreview) {
            URL.revokeObjectURL(clothingPreview);
          }
          setClothingFile(loadedFile);
          setClothingPreview(URL.createObjectURL(loadedFile));
        }
        toast.success('已添加图片');
      } else {
        toast.error('加载图片失败');
      }
    }
  };

  const handleDragOver = (type: 'model' | 'clothing') => (e: React.DragEvent) => {
    e.preventDefault();
    if (type === 'model') {
      setIsDraggingModel(true);
    } else {
      setIsDraggingClothing(true);
    }
  };

  const handleDragLeave = (type: 'model' | 'clothing') => (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (type === 'model') {
      setIsDraggingModel(false);
    } else {
      setIsDraggingClothing(false);
    }
  };

  // 右键菜单处理
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

  const clearModel = () => {
    if (modelPreview && !savedModels.some(m => m.url === modelPreview)) {
      URL.revokeObjectURL(modelPreview);
    }
    setModelFile(null);
    setModelPreview(null);
  };

  const clearClothing = () => {
    if (clothingPreview) {
      URL.revokeObjectURL(clothingPreview);
    }
    setClothingFile(null);
    setClothingPreview(null);
  };

  // 保存当前模特图到收藏
  const saveCurrentModel = async () => {
    if (!modelFile || !modelPreview) return;
    
    // 转换为 base64 存储
    const reader = new FileReader();
    reader.onload = () => {
      const newModel: SavedModel = {
        id: Date.now().toString(),
        url: reader.result as string,
        name: modelFile.name,
      };
      const updated = [...savedModels, newModel];
      setSavedModels(updated);
      localStorage.setItem(SAVED_MODELS_KEY, JSON.stringify(updated));
      toast.success('模特图已保存');
    };
    reader.readAsDataURL(modelFile);
  };

  // 选择已保存的模特图
  const selectSavedModel = (model: SavedModel) => {
    if (modelPreview && !savedModels.some(m => m.url === modelPreview)) {
      URL.revokeObjectURL(modelPreview);
    }
    setModelFile(null); // 使用保存的图片时，file 为 null
    setModelPreview(model.url);
  };

  // 删除保存的模特图
  const deleteSavedModel = (id: string) => {
    const updated = savedModels.filter(m => m.id !== id);
    setSavedModels(updated);
    localStorage.setItem(SAVED_MODELS_KEY, JSON.stringify(updated));
    toast.success('已删除');
  };

  const handleGenerate = async () => {
    if (!modelPreview) {
      toast.warning('请先上传模特图');
      return;
    }
    if (!clothingFile) {
      toast.warning('请先上传服装图');
      return;
    }

    setIsGenerating(true);

    try {
      // 使用模特图的宽高比
      let aspectRatio = '1:1';
      if (modelFile) {
        aspectRatio = await getImageAspectRatio(modelFile);
      } else if (modelPreview) {
        // 如果是保存的模特图（base64），需要从 URL 获取
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = modelPreview;
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

      // 添加模特图（第一张）
      if (modelFile) {
        formData.append('images', modelFile);
      } else if (modelPreview) {
        // 将 base64 转换为 File
        const response = await fetch(modelPreview);
        const blob = await response.blob();
        formData.append('images', blob, 'model.png');
      }

      // 添加服装图（第二张）
      formData.append('images', clothingFile);

      const response = await api.generate(formData);

      if (!response.ok) {
        const errData = await response.json();
        // 处理嵌套的错误格式: {"error": {"message": "..."}}
        let errorMsg = '生成失败';
        if (errData.error) {
          if (typeof errData.error === 'string') {
            errorMsg = errData.error;
          } else if (typeof errData.error === 'object' && errData.error.message) {
            errorMsg = errData.error.message;
          } else {
            errorMsg = JSON.stringify(errData.error);
          }
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      if (data.image_url) {
        setGeneratedImage(data.image_url);
        setCounterRefresh(prev => prev + 1);
        await loadHistory();
        toast.success('换装生成成功！');
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

  return (
    <>
      {/* 头部 */}
      <header className="h-14 px-6 flex items-center bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 justify-between">
        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
          一键换装
        </h1>
        <GenerationCounter refreshTrigger={counterRefresh} />
      </header>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto bg-[#fafafa] p-6">
        <div className="max-w-6xl mx-auto">
          {/* 提示信息 */}
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

          {/* 上传区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* 模特图上传 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-500" />
                  模特图（图一）
                </h2>
                {modelFile && (
                  <button
                    onClick={saveCurrentModel}
                    className="text-xs text-purple-600 hover:text-purple-700"
                  >
                    保存到收藏
                  </button>
                )}
              </div>
              
              <input
                ref={modelInputRef}
                type="file"
                accept="image/*"
                onChange={handleModelSelect}
                className="hidden"
              />

              {!modelPreview ? (
                <div
                  onClick={() => modelInputRef.current?.click()}
                  onDrop={handleDrop('model')}
                  onDragOver={handleDragOver('model')}
                  onDragLeave={handleDragLeave('model')}
                  className={`aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group relative ${
                    isDraggingModel
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/30'
                  }`}
                >
                  {isDraggingModel && (
                    <div className="absolute inset-0 z-10 rounded-xl bg-purple-50/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                      <div className="flex flex-col items-center text-purple-500 animate-bounce">
                        <Upload className="w-6 h-6 mb-2" />
                        <span className="font-medium text-sm">释放上传</span>
                      </div>
                    </div>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 group-hover:bg-purple-100 flex items-center justify-center mb-3 transition-all">
                    <User className="w-7 h-7 text-gray-400 group-hover:text-purple-500 transition-all" />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">上传模特图</p>
                  <p className="text-xs text-gray-400">点击或拖拽</p>
                </div>
              ) : (
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={modelPreview}
                    alt="模特图"
                    className="w-full h-full object-cover cursor-pointer"
                    draggable
                    onClick={() => setLightboxImage(modelPreview)}
                    onContextMenu={(e) => handleContextMenu(e, modelPreview)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-sigma-image', modelPreview);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  />
                  <button
                    onClick={clearModel}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 已保存的模特图 */}
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

            {/* 服装图上传 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Shirt className="w-4 h-4 text-blue-500" />
                服装图（图二）
              </h2>
              
              <input
                ref={clothingInputRef}
                type="file"
                accept="image/*"
                onChange={handleClothingSelect}
                className="hidden"
              />

              {!clothingPreview ? (
                <div
                  onClick={() => clothingInputRef.current?.click()}
                  onDrop={handleDrop('clothing')}
                  onDragOver={handleDragOver('clothing')}
                  onDragLeave={handleDragLeave('clothing')}
                  className={`aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group relative ${
                    isDraggingClothing
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                  }`}
                >
                  {isDraggingClothing && (
                    <div className="absolute inset-0 z-10 rounded-xl bg-blue-50/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                      <div className="flex flex-col items-center text-blue-500 animate-bounce">
                        <Upload className="w-6 h-6 mb-2" />
                        <span className="font-medium text-sm">释放上传</span>
                      </div>
                    </div>
                  )}
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mb-3 transition-all">
                    <Shirt className="w-7 h-7 text-gray-400 group-hover:text-blue-500 transition-all" />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">上传服装图</p>
                  <p className="text-xs text-gray-400">点击或拖拽</p>
                </div>
              ) : (
                <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={clothingPreview}
                    alt="服装图"
                    className="w-full h-full object-cover cursor-pointer"
                    draggable
                    onClick={() => setLightboxImage(clothingPreview)}
                    onContextMenu={(e) => handleContextMenu(e, clothingPreview)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-sigma-image', clothingPreview);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  />
                  <button
                    onClick={clearClothing}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* 生成结果 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">生成结果</h2>
              
              {isGenerating ? (
                <div className="aspect-[3/4] flex items-center justify-center">
                  <PlaceholderCard />
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

          {/* 生成按钮 */}
          <div className="flex justify-center mb-8">
            <button
              onClick={handleGenerate}
              disabled={!modelPreview || !clothingFile || isGenerating}
              className="px-12 py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-200 disabled:shadow-none"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <ArrowRight className="w-5 h-5" />
                  开始换装
                </>
              )}
            </button>
          </div>

          {/* 历史记录区域 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">换装历史记录</h2>
            <HistoryImageGrid
              history={history}
              onImageClick={(item) => setGeneratedImage(item.image_url)}
              onImagePreview={setLightboxImage}
              emptyText="暂无换装生成记录"
            />
          </div>
        </div>
      </div>

      {/* 图片灯箱 */}
      <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />
      
      {/* 配额耗尽错误弹窗 */}
      <QuotaErrorAlert
        isOpen={showQuotaError}
        onClose={() => setShowQuotaError(false)}
        onContactSales={() => {
          setShowQuotaError(false);
          setShowContact(true);
        }}
      />
      
      {/* 联系销售弹窗 */}
      <ContactModal isOpen={showContact} onClose={() => setShowContact(false)} />

      {/* 右键菜单 */}
      <ImageContextMenu
        imageUrl={contextMenu?.url || ''}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={closeContextMenu}
        showReferenceOption={false}
      />
    </>
  );
}
