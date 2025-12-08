import { useState, useEffect, useRef } from 'react';
import { Upload, ArrowRight, Loader2, X } from 'lucide-react';
import ImageContextMenu from '../components/ImageContextMenu';
import HistoryImageGrid from '../components/HistoryImageGrid';
import GenerationCounter from '../components/GenerationCounter';
import ShadowOptionDialog, { buildWhiteBackgroundPrompt } from '../components/ShadowOptionDialog';
import PlaceholderCard from '../components/PlaceholderCard';
import Lightbox from '../components/Lightbox';
import QuotaErrorAlert from '../components/QuotaErrorAlert';
import ContactModal from '../components/ContactModal';
import type { GenerationHistory } from '../type';
import { GenerationType } from '../type';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { getImageAspectRatio } from '../utils/aspectRatio';
import { getErrorMessage } from '../utils/errorHandler';

export default function WhiteBackground() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 状态
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showShadowDialog, setShowShadowDialog] = useState(false);
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url: string } | null>(null);

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, []);

  // 清理预览 URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const loadHistory = async () => {
    try {
      const response = await api.getWhiteBackgroundHistory();
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('加载白底图历史失败:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setUploadedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setGeneratedImage(null);
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

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    // 首先检查是否有文件
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setUploadedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setGeneratedImage(null);
      return;
    }

    // 检查是否是从应用内拖拽的图片 URL
    const sigmaImageUrl = e.dataTransfer.getData('application/x-sigma-image');
    const imageUrl = sigmaImageUrl || e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      const loadedFile = await loadImageFromUrl(imageUrl);
      if (loadedFile) {
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }
        setUploadedFile(loadedFile);
        setPreviewUrl(URL.createObjectURL(loadedFile));
        setGeneratedImage(null);
        toast.success('已添加图片');
      } else {
        toast.error('加载图片失败');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
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

  const clearUpload = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setUploadedFile(null);
    setPreviewUrl(null);
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

    setIsGenerating(true);
    const prompt = buildWhiteBackgroundPrompt(removeShadow);

    try {
      // 自动匹配图片宽高比
      const aspectRatio = await getImageAspectRatio(uploadedFile);
      
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('aspectRatio', aspectRatio);
      formData.append('imageSize', '2K');
      formData.append('type', GenerationType.WHITE_BACKGROUND);
      formData.append('images', uploadedFile);

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
        toast.success('白底图生成成功！');
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
      {/* 头部 */}
      <header className="h-14 px-6 flex items-center bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 justify-between">
        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          一键白底图
        </h1>
        <GenerationCounter refreshTrigger={counterRefresh} />
      </header>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto bg-[#fafafa] p-6">
        <div className="max-w-6xl mx-auto">
          {/* 上传和输出区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* 左侧：上传区域 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">上传产品图片</h2>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!previewUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group relative ${
                    isDragging 
                      ? 'border-red-500 bg-red-50 ring-2 ring-red-500' 
                      : 'border-gray-200 hover:border-red-300 hover:bg-red-50/30'
                  }`}
                >
                  {isDragging && (
                    <div className="absolute inset-0 z-10 rounded-xl bg-red-50/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
                      <div className="flex flex-col items-center text-red-500 animate-bounce">
                        <Upload className="w-8 h-8 mb-2" />
                        <span className="font-medium">释放鼠标上传图片</span>
                      </div>
                    </div>
                  )}
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 group-hover:bg-red-100 flex items-center justify-center mb-4 transition-all">
                    <Upload className="w-8 h-8 text-gray-400 group-hover:text-red-500 transition-all" />
                  </div>
                  <p className="text-sm text-gray-500 mb-1">点击或拖拽上传图片</p>
                  <p className="text-xs text-gray-400">支持 JPG、PNG 格式</p>
                </div>
              ) : (
                <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={previewUrl}
                    alt="预览"
                    className="w-full h-full object-contain cursor-pointer"
                    draggable
                    onClick={() => setLightboxImage(previewUrl)}
                    onContextMenu={(e) => handleContextMenu(e, previewUrl)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-sigma-image', previewUrl);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  />
                  <button
                    onClick={clearUpload}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* 生成按钮 */}
              <button
                onClick={handleGenerateClick}
                disabled={!uploadedFile || isGenerating}
                className="w-full mt-4 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200 disabled:shadow-none"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5" />
                    生成白底图
                  </>
                )}
              </button>
            </div>

            {/* 右侧：输出区域 */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">生成结果</h2>
              
              {isGenerating ? (
                <div className="aspect-square flex items-center justify-center">
                  <PlaceholderCard />
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

          {/* 历史记录区域 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">白底图历史记录</h2>
            <HistoryImageGrid
              history={history}
              onImageClick={handleHistoryClick}
              onImagePreview={setLightboxImage}
              emptyText="暂无白底图生成记录"
            />
          </div>
        </div>
      </div>

      {/* 光影选项对话框 */}
      <ShadowOptionDialog
        isOpen={showShadowDialog}
        onClose={() => setShowShadowDialog(false)}
        onConfirm={handleGenerate}
      />

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
