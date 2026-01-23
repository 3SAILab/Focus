import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRight, Loader2, Upload, Grid2X2, Settings } from 'lucide-react';
import ImageUpload from './ImageUpload';
import CountSelector from './CountSelector';
import ImageSettingsSelector from './ImageSettingsSelector';
import type { AspectRatio, GenerateResponse, GenerateMultiResponse, ImageCount, ImageSize, GenerationTypeValue } from '../type';
import { GenerationType } from '../type';
import type { SSEStartEvent, SSEImageEvent, SSECompleteEvent } from '../api';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { useGlobalTask } from '../context/GlobalTaskContext';
import { getErrorMessage } from '../utils/errorHandler';

// 防抖间隔（毫秒）- 防止快速双击
const DEBOUNCE_INTERVAL = 500;

interface PromptBarProps {
  onGenerate: (response: GenerateResponse, tempId?: string) => void;
  onGenerateMulti?: (response: GenerateMultiResponse, tempId?: string) => void; // 修复：传递 tempId
  onGenerateStart?: (prompt?: string, imageCount?: number) => string; // 修复：返回 tempId
  onError: (error: string, prompt?: string, imageCount?: number, tempId?: string) => void; // 修复：传递 tempId
  onPreviewImage?: (url: string) => void;
  initialPrompt?: string;
  initialFiles?: File[];
  initialImageCount?: ImageCount; // 新增：初始图片数量（用于重新生成时保留原数量）
  initialAspectRatio?: AspectRatio; // 新增：初始比例（用于重新生成时保留原比例）
  initialImageSize?: ImageSize; // 新增：初始尺寸（用于重新生成时保留原尺寸）
  onFilesChange?: (files: File[]) => void; // 新增：用于父子组件文件状态同步
  triggerGenerate?: boolean;
  onTriggered?: () => void;
  // SSE 流式回调 - 修复：传递 tempId
  onSSEStart?: (event: SSEStartEvent, tempId?: string) => void;
  onSSEImage?: (event: SSEImageEvent) => void;
  onSSEComplete?: (event: SSECompleteEvent, tempId?: string) => void;
  // 禁用状态（外部控制，用于创作工坊生成时禁用输入）
  disabled?: boolean;
  // 异步任务运行状态（外部控制，仅用于显示 loading 图标，不禁用发送）
  isTaskRunning?: boolean;
  // 修复：异步任务创建回调，传递 tempId 用于精确关联
  onTaskCreated?: (taskId: string, tempId?: string) => void;
  // 提示词更新版本号（用于强制更新 initialPrompt）
  promptVersion?: number;
}

export default function PromptBar({
  onGenerate,
  onGenerateMulti,
  onGenerateStart,
  onError,
  onPreviewImage,
  initialPrompt = '',
  initialFiles = [],
  initialImageCount = 1,
  initialAspectRatio = '1:1',
  initialImageSize = '2K',
  onFilesChange,
  triggerGenerate = false,
  onTriggered,
  onSSEStart,
  onSSEImage,
  onSSEComplete,
  disabled = false,
  // isTaskRunning 保留 prop 但不使用，保持 API 兼容性
  isTaskRunning: _isTaskRunning = false,
  onTaskCreated,
  promptVersion = 0,
}: PromptBarProps) {
  // 标记 _isTaskRunning 为已使用（避免 lint 警告）
  void _isTaskRunning;
  
  const toast = useToast();
  const { registerTask } = useGlobalTask();
  
  // 综合禁用状态：外部禁用
  const isDisabled = disabled;
  const [prompt, setPrompt] = useState(initialPrompt);
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialAspectRatio);
  const [imageSize, setImageSize] = useState<ImageSize>(initialImageSize);
  const [showSettingsSelector, setShowSettingsSelector] = useState(false); // 合并的设置选择器
  const [isDragging, setIsDragging] = useState(false); // 拖拽状态
  const [imageCount, setImageCount] = useState<ImageCount>(initialImageCount); // 生成数量状态
  const [showCountSelector, setShowCountSelector] = useState(false); // 数量选择器显示状态
  const [isSending, setIsSending] = useState(false); // 正在发送请求（用于按钮 loading 状态）
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settingsSelectorRef = useRef<HTMLDivElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const countSelectorRef = useRef<HTMLDivElement>(null);
  const countBtnRef = useRef<HTMLButtonElement>(null);
  
  // 防抖：记录上次提交时间
  const lastSubmitTimeRef = useRef<number>(0);
  // 标记是否正在发送请求（用于防止同一次点击的重复提交）
  const isSubmittingRef = useRef<boolean>(false);

  // 当 initialPrompt 或 promptVersion 变化时更新 prompt
  // promptVersion 用于强制更新，即使 initialPrompt 值相同
  useEffect(() => {
    console.log('[PromptBar] initialPrompt 或 promptVersion 变化:', { initialPrompt, promptVersion });
    setPrompt(initialPrompt);
  }, [initialPrompt, promptVersion]);

  useEffect(() => {
    console.log('[PromptBar] initialFiles 变化:', initialFiles.length, '个文件');
    setFiles(initialFiles);
  }, [initialFiles]);

  // 当 initialImageCount 或 promptVersion 变化时更新 imageCount
  // promptVersion 用于强制更新，即使 initialImageCount 值相同
  useEffect(() => {
    console.log('[PromptBar] initialImageCount 或 promptVersion 变化:', { initialImageCount, promptVersion });
    setImageCount(initialImageCount);
  }, [initialImageCount, promptVersion]);

  // 当 initialAspectRatio 或 promptVersion 变化时更新 aspectRatio
  useEffect(() => {
    console.log('[PromptBar] initialAspectRatio 或 promptVersion 变化:', { initialAspectRatio, promptVersion });
    setAspectRatio(initialAspectRatio);
  }, [initialAspectRatio, promptVersion]);

  // 当 initialImageSize 或 promptVersion 变化时更新 imageSize
  useEffect(() => {
    console.log('[PromptBar] initialImageSize 或 promptVersion 变化:', { initialImageSize, promptVersion });
    setImageSize(initialImageSize);
  }, [initialImageSize, promptVersion]);

  // 统一更新文件的辅助函数（同时更新内部状态和通知父组件）
  const updateFiles = (newFiles: File[]) => {
    setFiles(newFiles);
    onFilesChange?.(newFiles);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 处理设置选择器（比例+尺寸）
      if (settingsBtnRef.current && settingsBtnRef.current.contains(event.target as Node)) {
        return;
      }
      if (
        showSettingsSelector &&
        settingsSelectorRef.current &&
        !settingsSelectorRef.current.contains(event.target as Node)
      ) {
        setShowSettingsSelector(false);
      }
      
      // 处理数量选择器
      if (countBtnRef.current && countBtnRef.current.contains(event.target as Node)) {
        return;
      }
      if (
        showCountSelector &&
        countSelectorRef.current &&
        !countSelectorRef.current.contains(event.target as Node)
      ) {
        setShowCountSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsSelector, showCountSelector]);

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
    // 检查是否是内部图片排序拖拽
    const isInternalDrag = e.dataTransfer.types.includes('text/plain') && 
                          e.dataTransfer.effectAllowed === 'move';
    
    // 如果是内部拖拽，不显示上传提示
    if (isInternalDrag) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
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
    // 检查是否是内部图片排序拖拽
    const isInternalDrag = e.dataTransfer.types.includes('text/plain') && 
                          e.dataTransfer.effectAllowed === 'move';
    
    // 如果是内部拖拽，不处理
    if (isInternalDrag) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

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

  const handleSubmit = useCallback(async () => {
    // 防抖：防止快速双击
    const now = Date.now();
    if (now - lastSubmitTimeRef.current < DEBOUNCE_INTERVAL) {
      console.log('[PromptBar] Debounced - too fast');
      return;
    }
    
    // 防止重复提交（同一次点击）
    if (isSubmittingRef.current) {
      console.log('[PromptBar] Already submitting');
      return;
    }
    
    if (!prompt.trim() && files.length === 0) {
      toast.warning('请输入提示词或上传参考图');
      return;
    }

    // 记录提交时间并标记正在提交
    lastSubmitTimeRef.current = now;
    isSubmittingRef.current = true;
    setIsSending(true); // 显示发送中状态

    // 保存当前输入值用于发送
    const currentPrompt = prompt;
    const currentFiles = [...files];
    const currentImageCount = imageCount;
    const currentAspectRatio = aspectRatio;
    const currentImageSize = imageSize;

    // 立即清空输入框，让用户可以编辑下一个任务
    setPrompt('');
    updateFiles([]);
    if(textareaRef.current) textareaRef.current.style.height = '80px';

    // 修复：通知父组件开始生成，并获取 tempId
    // tempId 用于在整个异步生命周期中精确关联请求和响应
    const tempId = onGenerateStart?.(currentPrompt, currentImageCount);
    console.log('[PromptBar] Generated tempId:', tempId);

    try {
      console.log('[PromptBar] Building FormData...');
      const formData = new FormData();
      formData.append('prompt', currentPrompt || ' ');
      formData.append('aspectRatio', currentAspectRatio);
      formData.append('imageSize', currentImageSize);
      formData.append('count', String(currentImageCount));
      
      currentFiles.forEach((file) => {
        formData.append('images', file);
      });
      console.log('[PromptBar] FormData built, count:', currentImageCount);

      // 多图生成使用 SSE 流式接口
      if (currentImageCount > 1 && (onSSEStart || onSSEImage || onSSEComplete)) {
        console.log('[PromptBar] Using SSE mode for multi-image generation');
        // SSE 模式：请求发送后立即重置状态，允许用户继续发送新请求
        isSubmittingRef.current = false;
        setIsSending(false);
        
        console.log('[PromptBar] Calling api.generateWithSSE...');
        await api.generateWithSSE(formData, {
          onStart: (event) => {
            console.log('[PromptBar] SSE Start:', event);
            // 修复：传递 tempId 给父组件，用于精确关联
            onSSEStart?.(event, tempId);
          },
          onImage: (event) => {
            console.log('[PromptBar] SSE Image:', event);
            onSSEImage?.(event);
          },
          onComplete: (event) => {
            console.log('[PromptBar] SSE Complete 收到:', event);
            console.log('[PromptBar] tempId:', tempId);
            console.log('[PromptBar] 调用 onSSEComplete');
            // 修复：传递 tempId 给父组件，用于精确清除
            onSSEComplete?.(event, tempId);
            console.log('[PromptBar] onSSEComplete 调用完成');
          },
          onError: (error) => {
            console.error('[PromptBar] SSE Error:', error);
            const { message } = getErrorMessage(error.message || error);
            // 修复：传递 tempId 给父组件，用于精确清除
            onError(message, currentPrompt, currentImageCount, tempId);
          },
        });
        return;
      }

      // 单图或无 SSE 回调时，使用传统方式
      console.log('[PromptBar] Using traditional mode, calling api.generate...');
      const response = await api.generate(formData);
      console.log('[PromptBar] Received response, status:', response.status);

      if (!response.ok) {
        console.error('[PromptBar] Response not OK:', response.status);
        const errData = await response.json();
        const { message: errorMsg } = getErrorMessage(errData, response.status);
        throw new Error(errorMsg);
      }

      console.log('[PromptBar] Parsing response JSON...');
      const data = await response.json();
      console.log('[PromptBar] Response data received');
      
      // 调试：打印后端返回的数据结构
      console.log('[PromptBar] Backend response data:', {
        hasImages: !!data.images,
        hasImageUrl: !!data.image_url,
        hasTaskId: !!data.task_id,
        status: data.status,
        tempId: tempId,
        data: data
      });
      
      // 处理多图响应 (Requirements: 5.2)
      if (currentImageCount > 1 && data.images && onGenerateMulti) {
        console.log('[PromptBar] 多图响应，调用 onGenerateMulti');
        // 修复：传递 tempId 给父组件
        onGenerateMulti(data as GenerateMultiResponse, tempId);
      } else if (data.image_url) {
        console.log('[PromptBar] 单图同步响应，调用 onGenerate');
        // 单图响应格式 (向后兼容 - 同步模式)
        // 修复：传递 tempId 给父组件
        onGenerate(data as GenerateResponse, tempId);
      } else if (data.task_id) {
        console.log('[PromptBar] 异步模式，task_id:', data.task_id, 'tempId:', tempId);
        // 异步模式：后端返回 task_id，前端需要轮询
        registerTask(data.task_id, GenerationType.CREATE as GenerationTypeValue);
        // 修复：传递 tempId 给父组件，用于精确关联
        console.log('[PromptBar] 调用 onTaskCreated');
        onTaskCreated?.(data.task_id, tempId);
      } else {
        throw new Error('后端未返回图片地址');
      }
    } catch (error) {
      const { message } = getErrorMessage(error);
      // 修复：传递 tempId 给父组件，用于精确清除
      onError(message, currentPrompt, currentImageCount, tempId);
    } finally {
      isSubmittingRef.current = false;
      setIsSending(false); // 重置发送状态
    }
  }, [prompt, files, imageCount, aspectRatio, imageSize, onGenerateStart, onSSEStart, onSSEImage, onSSEComplete, onGenerateMulti, onGenerate, onTaskCreated, onError, toast, registerTask]);

  // 监听外部触发生成（用于"再次生成"功能）
  useEffect(() => {
    if (triggerGenerate && (prompt.trim() || files.length > 0)) {
      // 防抖检查
      const now = Date.now();
      if (now - lastSubmitTimeRef.current < DEBOUNCE_INTERVAL) {
        console.log('[PromptBar] External trigger debounced');
        onTriggered?.();
        return;
      }
      
      if (isSubmittingRef.current) {
        console.log('[PromptBar] External trigger blocked - already submitting');
        onTriggered?.();
        return;
      }
      
      const timer = setTimeout(() => {
        handleSubmit();
        onTriggered?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [triggerGenerate, prompt, files, handleSubmit, onTriggered]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // 根据拖拽状态动态调整容器样式
  const containerStyle = isDragging 
    ? 'ring-2 ring-red-500 border-red-500 bg-red-50' 
    : 'focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 focus-within:bg-white bg-gray-50 border-gray-200';

  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl px-4 pb-6">
      
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex items-end rounded-[28px] p-2 transition-all duration-300 border shadow-lg bg-white/80 backdrop-blur-xl ${containerStyle}`}
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
            disabled={isDisabled} // 只在外部禁用时禁用，生成中仍可编辑
            style={{ minHeight: '80px' }}
          />
        </div>

        {/* 右侧：功能按钮区 */}
        <div className="flex flex-col items-center gap-2 pb-1 shrink-0 relative w-[70px]">
          {/* 合并的设置选择器（比例+尺寸） */}
          {showSettingsSelector && (
            <div ref={settingsSelectorRef} className="absolute bottom-full right-0 mb-2 z-50">
              <ImageSettingsSelector
                aspectRatio={aspectRatio}
                imageSize={imageSize}
                onAspectRatioChange={setAspectRatio}
                onImageSizeChange={setImageSize}
                disabled={isDisabled}
              />
            </div>
          )}

          {showCountSelector && (
            <div ref={countSelectorRef} className="absolute bottom-full right-0 mb-2 z-50">
              <CountSelector
                value={imageCount}
                onChange={(count) => {
                  setImageCount(count);
                  setShowCountSelector(false);
                }}
                disabled={isDisabled}
              />
            </div>
          )}

          {/* 合并的设置按钮（比例+尺寸） */}
          <button
            ref={settingsBtnRef}
            onClick={() => {
              setShowSettingsSelector(!showSettingsSelector);
              setShowCountSelector(false);
            }}
            className={`h-8 px-2.5 rounded-lg flex items-center justify-center gap-1 transition-all border text-xs font-medium w-full ${
              aspectRatio !== '1:1' || imageSize !== '2K' || showSettingsSelector
                ? 'bg-red-50 text-red-600 border-red-100' 
                : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50'
            }`}
            title="图片设置"
          >
            <Settings className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${showSettingsSelector ? 'rotate-90' : ''}`} />
            <span className="truncate text-[10px]">{aspectRatio}/{imageSize}</span>
          </button>

          <button
            ref={countBtnRef}
            onClick={() => {
              setShowCountSelector(!showCountSelector);
              setShowSettingsSelector(false);
            }}
            className={`h-8 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all border text-xs font-medium w-full ${
              imageCount > 1 || showCountSelector
                ? 'bg-red-50 text-red-600 border-red-100' 
                : 'bg-white text-gray-400 border-gray-200 hover:text-gray-600 hover:bg-gray-50'
            }`}
            title="选择生成数量"
          >
            <Grid2X2 className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${showCountSelector ? 'rotate-90' : ''}`} />
            <span className="truncate">{imageCount}张</span>
          </button>

          <button
            onClick={handleSubmit}
            disabled={isDisabled || isSending || (!prompt.trim() && files.length === 0)}
            className="btn-red w-12 h-12 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            {isSending ? (
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