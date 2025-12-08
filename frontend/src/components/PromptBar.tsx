import { useState, useRef, useEffect } from 'react';
import { ArrowRight, Loader2, Settings, Upload } from 'lucide-react';
import ImageUpload from './ImageUpload';
import AspectRatioSelector, { aspectRatiosConfig } from './AspectRatioSelector';
import type { AspectRatio, GenerateResponse } from '../type';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorHandler';

interface PromptBarProps {
  onGenerate: (response: GenerateResponse) => void;
  onGenerateStart?: () => void;
  onError: (error: string) => void;
  onPreviewImage?: (url: string) => void;
  initialPrompt?: string;
  initialFiles?: File[];
  onFilesChange?: (files: File[]) => void; // 新增：用于父子组件文件状态同步
  triggerGenerate?: boolean;
  onTriggered?: () => void;
}

export default function PromptBar({
  onGenerate,
  onGenerateStart,
  onError,
  onPreviewImage,
  initialPrompt = '',
  initialFiles = [],
  onFilesChange,
  triggerGenerate = false,
  onTriggered,
}: PromptBarProps) {
  const toast = useToast();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('智能');
  const [showAspectSelector, setShowAspectSelector] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false); // 新增：拖拽状态
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aspectSelectorRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setPrompt(initialPrompt);
  }, [initialPrompt]);

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  // 统一更新文件的辅助函数（同时更新内部状态和通知父组件）
  const updateFiles = (newFiles: File[]) => {
    setFiles(newFiles);
    onFilesChange?.(newFiles);
  };

  // 监听外部触发生成
  useEffect(() => {
    if (triggerGenerate && (prompt.trim() || files.length > 0) && !isGenerating) {
      const timer = setTimeout(() => {
        const doSubmit = async () => {
          if (isGenerating) return;
          if (!prompt.trim() && files.length === 0) {
            toast.warning('请输入提示词或上传参考图');
            return;
          }

          setIsGenerating(true);
          onGenerateStart?.();

          try {
            const formData = new FormData();
            formData.append('prompt', prompt || ' ');
            formData.append('aspectRatio', aspectRatio === '智能' ? '1:1' : aspectRatio);
            formData.append('imageSize', '2K');
            
            files.forEach((file) => {
              formData.append('images', file);
            });

            const response = await api.generate(formData);

            if (!response.ok) {
              const errData = await response.json();
              // 使用统一的错误处理，根据状态码显示不同提示
              const { message: errorMsg } = getErrorMessage(errData, response.status);
              throw new Error(errorMsg);
            }

            const data: GenerateResponse = await response.json();
            
            if (data.image_url) {
              onGenerate(data);
              setPrompt('');
              updateFiles([]); // 生成成功后清空文件
              if(textareaRef.current) textareaRef.current.style.height = '80px';
            } else {
              throw new Error('后端未返回图片地址');
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : '生成失败';
            onError(message);
          } finally {
            setIsGenerating(false);
          }
        };
        doSubmit();
        onTriggered?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [triggerGenerate, prompt, files, isGenerating, aspectRatio, onGenerate, onGenerateStart, onError, onTriggered, toast]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsBtnRef.current && settingsBtnRef.current.contains(event.target as Node)) {
        return;
      }
      if (
        showAspectSelector &&
        aspectSelectorRef.current &&
        !aspectSelectorRef.current.contains(event.target as Node)
      ) {
        setShowAspectSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAspectSelector]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 200);
      textareaRef.current.style.height = `${Math.max(newHeight, 80)}px`;
    }
  }, [prompt]);

  // 处理粘贴图片
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault(); // 阻止粘贴二进制数据到文本框
      updateFiles([...files, ...pastedFiles]);
      toast.success(`已粘贴 ${pastedFiles.length} 张图片`);
    }
  };

  // 处理拖拽进入
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isGenerating) {
      setIsDragging(true);
    }
  };

  // 处理拖拽离开
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 防止拖拽到子元素时触发 leave
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  // 从 URL 加载图片为 File 对象
  const loadImageFromUrl = async (url: string): Promise<File | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const fileName = `ref_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
      return new File([blob], fileName, { type: blob.type });
    } catch (error) {
      console.error('加载图片失败:', error);
      return null;
    }
  };

  // 处理拖拽释放
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isGenerating) return;

    // 首先检查是否有文件
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      f.type.startsWith('image/')
    );

    if (droppedFiles.length > 0) {
      updateFiles([...files, ...droppedFiles]);
      toast.success(`已添加 ${droppedFiles.length} 张图片`);
      return;
    }

    // 检查是否是从应用内拖拽的图片 URL
    const sigmaImageUrl = e.dataTransfer.getData('application/x-sigma-image');
    if (sigmaImageUrl) {
      const file = await loadImageFromUrl(sigmaImageUrl);
      if (file) {
        updateFiles([...files, file]);
        toast.success('已添加参考图');
      } else {
        toast.error('加载图片失败');
      }
      return;
    }

    // 检查是否是普通的图片 URL
    const imageUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      const file = await loadImageFromUrl(imageUrl);
      if (file) {
        updateFiles([...files, file]);
        toast.success('已添加参考图');
      } else {
        toast.error('加载图片失败');
      }
      return;
    }

    if (e.dataTransfer.files.length > 0) {
      toast.warning('只能上传图片文件');
    }
  };

  const handleSubmit = async () => {
    if (isGenerating) return;
    if (!prompt.trim() && files.length === 0) {
      toast.warning('请输入提示词或上传参考图');
      return;
    }

    setIsGenerating(true);
    onGenerateStart?.();

    try {
      const formData = new FormData();
      formData.append('prompt', prompt || ' ');
      formData.append('aspectRatio', aspectRatio === '智能' ? '1:1' : aspectRatio);
      formData.append('imageSize', '2K');
      
      files.forEach((file) => {
        formData.append('images', file);
      });

      const response = await api.generate(formData);

      if (!response.ok) {
        const errData = await response.json();
        // 使用统一的错误处理，根据状态码显示不同提示
        const { message: errorMsg } = getErrorMessage(errData, response.status);
        throw new Error(errorMsg);
      }

      const data: GenerateResponse = await response.json();
      
      if (data.image_url) {
        onGenerate(data);
        setPrompt('');
        updateFiles([]); // 生成成功后清空文件
        if(textareaRef.current) textareaRef.current.style.height = '80px';
      } else {
        throw new Error('后端未返回图片地址');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成失败';
      onError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const CurrentRatioIcon = aspectRatiosConfig[aspectRatio]?.icon || Settings;

  // 根据拖拽状态动态调整容器样式
  const containerStyle = isDragging 
    ? 'ring-2 ring-red-500 border-red-500 bg-red-50' 
    : 'focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 focus-within:bg-white bg-gray-50 border-gray-200';

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-100 px-6 py-6 shadow-[0_-5px_30px_rgba(0,0,0,0.03)]">
      
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`max-w-4xl mx-auto relative flex items-end rounded-[28px] p-2 transition-all duration-300 border shadow-inner ${containerStyle}`}
      >
        
        {/* 拖拽上传时的遮罩层 */}
        {isDragging && (
          <div className="absolute inset-0 z-50 rounded-[28px] bg-red-50/90 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center text-red-500 animate-bounce">
              <Upload className="w-8 h-8 mb-2" />
              <span className="font-medium">释放鼠标上传图片</span>
            </div>
          </div>
        )}

        {/* 左侧：图片上传区域 */}
        <div className="flex-shrink-0 flex flex-col justify-start self-start pt-2 pl-2 min-w-[70px] h-full">
          <ImageUpload 
            files={files} 
            onFilesChange={updateFiles} // 使用新的 updateFiles
            onPreview={onPreviewImage}
          />
        </div>

        {/* 中间：文本输入框 */}
        <div className="flex-1 py-3 px-2">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste} // 绑定粘贴事件
            className="w-full bg-transparent border-none outline-none text-gray-800 placeholder-gray-400 text-base leading-relaxed resize-none py-1"
            rows={3}
            placeholder="描述你想要的画面，或拖入/粘贴图片..."
            disabled={isGenerating}
            style={{ minHeight: '80px' }}
          />
        </div>

        {/* 右侧：功能按钮区 */}
        <div className="flex flex-col items-center gap-2 pb-1 shrink-0 relative w-[70px]">
           {showAspectSelector && (
            <div ref={aspectSelectorRef} className="absolute bottom-[105%] right-0 z-50">
               <AspectRatioSelector 
                value={aspectRatio} 
                onChange={setAspectRatio}
                onClose={() => setShowAspectSelector(false)} 
              />
            </div>
          )}

          <button
            ref={settingsBtnRef}
            onClick={() => setShowAspectSelector(!showAspectSelector)}
            className={`h-8 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all border text-xs font-medium w-full ${
              aspectRatio !== '智能' || showAspectSelector
                ? 'bg-red-50 text-red-600 border-red-100' 
                : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50'
            }`}
            title="选择比例"
          >
            <CurrentRatioIcon className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-300 ${aspectRatio === '智能' && showAspectSelector ? 'rotate-90' : ''}`} />
            <span className="truncate">{aspectRatio}</span>
          </button>

          <button
            onClick={handleSubmit}
            disabled={isGenerating || (!prompt.trim() && files.length === 0)}
            className="btn-red w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <ArrowRight className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}