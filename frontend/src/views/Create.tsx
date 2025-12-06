// src/views/Create.tsx

import { useState, useEffect, useRef } from 'react';
import Lightbox from '../components/Lightbox';
import ImageCard from '../components/ImageCard';
import PlaceholderCard from '../components/PlaceholderCard';
import PromptBar from '../components/PromptBar';
import type { GenerationHistory } from '../type';
import { api } from '../api';
import { loadImageAsFile } from '../utils';
import { useToast } from '../context/ToastContext';

export default function Create() {
  const toast = useToast();
  const [history, setHistory] = useState<GenerationHistory[]>([]);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  
  // PromptBar state lifting for repopulation
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [triggerGenerate, setTriggerGenerate] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true); // 标记是否为首次加载

  useEffect(() => {
    loadHistory();
  }, []);

  // 核心滚动逻辑：首次加载直接跳到底部，后续更新平滑滚动
  useEffect(() => {
    if (history.length > 0) {
      // 首次加载时直接跳到底部（instant），避免长时间滚动
      if (isInitialLoadRef.current) {
        
        // 定义强制跳转底部的函数
        const jumpToBottom = () => {
            if (scrollContainerRef.current) {
                // 1. 临时覆盖 CSS 的 scroll-smooth，强制变为 auto 以实现瞬间跳转
                scrollContainerRef.current.style.scrollBehavior = 'auto';
                // 2. 设置滚动位置
                scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
            }
        };

        // 策略：分阶段多次执行，确保在 DOM 渲染和图片初步布局后都能滚动到底部
        
        // 第一次：React 渲染循环结束后立即执行
        requestAnimationFrame(() => {
            jumpToBottom();
            
            // 第二次：给一点时间让 DOM 布局稳定 (100ms)
            setTimeout(() => {
                jumpToBottom();
            }, 100);

            // 第三次：给更多时间等待部分图片占位 (300ms)
            // 并在结束后恢复平滑滚动，关闭初始加载标记
            setTimeout(() => {
                jumpToBottom();
                
                // 恢复 CSS 定义的平滑滚动
                if (scrollContainerRef.current) {
                    scrollContainerRef.current.style.scrollBehavior = '';
                }
                isInitialLoadRef.current = false;
            }, 300);
        });

      } else {
        // 后续更新使用平滑滚动
        scrollToBottom();
      }
    }
  }, [history.length]);

  // 生成状态改变时也滚动到底部
  useEffect(() => {
    if (!isInitialLoadRef.current) {
      scrollToBottom();
    }
  }, [isGenerating]);

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadHistory = async () => {
    try {
      const response = await api.getHistory();
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(false);
    setGeneratingId(null);
    await loadHistory();
    
    // [!code ++] 修复点：生成成功后，清空父组件选中的文件，防止下次引用时带入旧图
    setSelectedFiles([]); 

    // 强制滚动到底部
    setTimeout(scrollToBottom, 100);
  };

  const handleGenerateStart = () => {
    setIsGenerating(true);
    setGeneratingId('gen-' + Date.now());
    setTimeout(scrollToBottom, 100);
  };

  const handleGenerateError = (error: string) => {
    setIsGenerating(false);
    setGeneratingId(null);
    toast.error('生成失败: ' + error);
  };

  // 重新生成：使用历史记录的提示词和参考图
  const handleRegenerate = async (item: GenerationHistory) => {
    try {
      // 解析参考图
      let refImageUrls: string[] = [];
      try {
        if (item.ref_images) {
          const parsed = JSON.parse(item.ref_images);
          refImageUrls = Array.isArray(parsed) ? parsed : [];
        }
      } catch (e) {
        console.warn('解析参考图失败:', e);
      }

      // 加载参考图为 File 对象
      const refFiles: File[] = [];
      for (const url of refImageUrls) {
        const file = await loadImageAsFile(url);
        if (file) {
          refFiles.push(file);
        }
      }

      // 设置提示词和参考图
      setSelectedPrompt(item.prompt || '');
      setSelectedFiles(refFiles);

      // 等待状态更新后触发生成
      setTimeout(() => {
        setTriggerGenerate(true);
      }, 200);
    } catch (error) {
      console.error('重新生成失败:', error);
      toast.error('重新生成失败，请稍后重试');
    }
  };

  // 引用图片：将图片添加到参考图列表
  const handleUseAsReference = async (imageUrl: string) => {
    try {
      const file = await loadImageAsFile(imageUrl);
      if (file) {
        // [!code note] 由于上面 handleGenerate 清空了 selectedFiles，这里 [...prev, file] 就只会包含新添加的图片了
        setSelectedFiles((prev) => [...prev, file]);
        // 滚动到底部，让用户看到新添加的参考图
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      } else {
        toast.error('加载图片失败，请稍后重试');
      }
    } catch (error) {
      console.error('引用图片失败:', error);
      toast.error('引用图片失败，请稍后重试');
    }
  };

  // 所有历史记录，按时间正序排列（旧在上，新在下，类似 Discord）
  const chatHistory = [...history].reverse();

  return (
    <>
      <header className="h-14 px-6 flex items-center bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30 justify-between">
        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          AI 创意工坊
        </h1>
        <div className="text-xs text-gray-400">Local Server</div>
      </header>

      <div
        className="flex-1 overflow-y-auto bg-[#fafafa] scroll-smooth"
        ref={scrollContainerRef}
      >
        <div className="max-w-3xl mx-auto px-4 py-8 pb-32 min-h-full flex flex-col justify-end">
          
          {/* 空状态提示 */}
          {history.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center text-gray-400 py-20 fade-in-up">
              <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <div className="w-8 h-8 bg-red-400/20 rounded-full blur-xl absolute"></div>
                <span className="text-3xl">🎨</span>
              </div>
              <h3 className="text-lg font-medium text-gray-700 mb-2">开始你的创作</h3>
              <p className="text-sm text-gray-400 text-center">
                在下方输入框描述画面，支持中英文提示词
              </p>
            </div>
          )}

          {/* 历史消息流 */}
          <div className="space-y-8">
          {chatHistory.map((item, index) => (
            <div
                key={item.id || `history-${index}`}
                className="flex flex-col w-full fade-in-up"
                style={{ animationDelay: `${index * 50}ms` }}
            >
                {/* 用户指令气泡 */}
                <div className="flex justify-end mb-3 px-2">
                    <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[80%]">
                        {item.original_prompt || item.prompt || '无提示词'}
                    </div>
                </div>

                {/* 生成结果卡片 */}
                <div className="flex flex-col items-start w-full pl-2">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-red-200">
                          AI
                      </div>
                      <span className="text-xs text-gray-400 font-medium">SIGMA</span>
                  </div>
                  <div className="w-full max-w-xl">
                    <ImageCard
                      item={item}
                      onImageClick={setLightboxImage}
                      onRefImageClick={setLightboxImage}
                      onRegenerate={handleRegenerate}
                      onUseAsReference={handleUseAsReference}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* 生成中状态 */}
            {isGenerating && generatingId && (
              <div className="flex flex-col w-full fade-in-up mt-8">
                 <div className="flex justify-end mb-3 px-2">
                    <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm opacity-50">
                        正在思考...
                    </div>
                </div>
                <div className="flex flex-col items-start w-full pl-2">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold animate-pulse">
                          AI
                      </div>
                      <span className="text-xs text-red-500 font-medium">正在生成中...</span>
                  </div>
                  <div className="w-full max-w-xl">
                    <PlaceholderCard key={generatingId} />
                  </div>
                </div>
              </div>
            )}
            
            {/* 滚动锚点 */}
            <div ref={bottomRef} className="h-4" />
          </div>
        </div>
      </div>

      <PromptBar
        onGenerate={handleGenerate}
        onGenerateStart={handleGenerateStart}
        onError={handleGenerateError}
        initialPrompt={selectedPrompt}
        initialFiles={selectedFiles}
        // [!code ++] 新增这一行：将父组件的 setter 传进去，保持同步
        onFilesChange={setSelectedFiles} 
        onPreviewImage={setLightboxImage}
        triggerGenerate={triggerGenerate}
        onTriggered={() => {
          setTriggerGenerate(false);
          setSelectedPrompt('');
          setSelectedFiles([]);
        }}
      />

      <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />
    </>
  );
}