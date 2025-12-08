// src/views/Create.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import Lightbox from '../components/Lightbox';
import ImageCard from '../components/ImageCard';
import PlaceholderCard from '../components/PlaceholderCard';
import PromptBar from '../components/PromptBar';
import { PageHeader, QuotaErrorHandler } from '../components/common';
import type { GenerationHistory, GenerationTask } from '../type';
import { GenerationType } from '../type';
import { api } from '../api';
import { loadImageAsFile } from '../utils';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/errorHandler';
import { useTaskRecovery } from '../hooks/useTaskRecovery';

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
  const [counterRefresh, setCounterRefresh] = useState(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showQuotaError, setShowQuotaError] = useState(false);
  const [showContact, setShowContact] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(true); // 标记是否为首次加载

  const scrollToBottom = () => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.getHistory();
      if (response.ok) {
        const data: GenerationHistory[] = await response.json();
        // 过滤掉白底图和换装的历史记录，只显示创作空间的
        const filteredData = data.filter(
          (item) => !item.type || item.type === GenerationType.CREATE
        );
        setHistory(filteredData);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  }, []);

  // Task recovery callbacks
  const handleTaskComplete = useCallback((task: GenerationTask) => {
    console.log('[Create] Task completed:', task.task_id);
    // Reload history to show the completed task
    loadHistory();
    // Refresh generation counter
    setCounterRefresh(prev => prev + 1);
    toast.success('图片生成完成');
  }, [loadHistory, toast]);

  const handleTaskFailed = useCallback((task: GenerationTask) => {
    console.log('[Create] Task failed:', task.task_id, task.error_msg);
    const { message, isQuotaError } = getErrorMessage(task.error_msg);
    if (isQuotaError) {
      setShowQuotaError(true);
    } else {
      toast.error('生成失败: ' + message);
    }
  }, [toast]);

  // Use task recovery hook to restore in-progress tasks after page refresh
  // Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4
  const { processingTasks, isRecovering } = useTaskRecovery({
    type: GenerationType.CREATE,
    onTaskComplete: handleTaskComplete,
    onTaskFailed: handleTaskFailed,
  });

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

  const handleGenerate = async () => {
    setIsGenerating(false);
    setGeneratingId(null);
    await loadHistory();
    
    // 刷新生成计数器
    setCounterRefresh(prev => prev + 1);
    
    // 修复点：生成成功后，清空父组件选中的文件，防止下次引用时带入旧图
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
    
    const { message, isQuotaError } = getErrorMessage(error);
    if (isQuotaError) {
      setShowQuotaError(true);
    } else {
      toast.error('生成失败: ' + message);
    }
  };

  // 监听滚动，显示/隐藏回到底部按钮
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // 距离底部超过 200px 时显示按钮
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollButton(distanceFromBottom > 200);
    };

    // 初始检查一次
    handleScroll();

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [history.length]); // 当历史记录变化时重新绑定

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
      <PageHeader
        title="AI 创意工坊"
        statusColor="green"
        showCounter
        counterRefresh={counterRefresh}
      />

      <div
        className="flex-1 overflow-y-auto bg-[#fafafa] scroll-smooth"
        ref={scrollContainerRef}
      >
        <div className="max-w-3xl mx-auto px-4 py-8 pb-32 min-h-full flex flex-col justify-end">
          
          {/* 空状态提示 - 考虑恢复中状态和处理中任务 */}
          {history.length === 0 && !isGenerating && !isRecovering && processingTasks.length === 0 && (
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
          
          {/* 恢复中状态提示 */}
          {isRecovering && (
            <div className="flex flex-col items-center justify-center text-gray-400 py-20 fade-in-up">
              <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-gray-500">正在恢复任务状态...</p>
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
                        {item.type === GenerationType.WHITE_BACKGROUND
                          ? '白底图创作'
                          : item.type === GenerationType.CLOTHING_CHANGE
                          ? '一键换装'
                          : item.original_prompt || item.prompt || '无提示词'}
                    </div>
                </div>

                {/* 生成结果卡片 */}
                <div className="flex flex-col items-start w-full pl-2">
                  <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-red-200">
                          AI
                      </div>
                      <span className="text-xs text-gray-400 font-medium">Focus</span>
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

            {/* 恢复的处理中任务 - Requirements: 1.4, 2.1 */}
            {processingTasks.map((task) => (
              <div key={task.task_id} className="flex flex-col w-full fade-in-up mt-8">
                <div className="flex justify-end mb-3 px-2">
                  <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-2xl rounded-tr-sm text-sm opacity-50">
                    {task.prompt || '正在思考...'}
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
                    <PlaceholderCard key={task.task_id} />
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

      {/* 回到底部按钮 - 放在右上角，header 下方 */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="fixed top-20 right-6 w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-500 hover:text-red-600 hover:shadow-xl transition-all z-50 border border-gray-200 hover:scale-105"
          title="回到底部"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      <Lightbox imageUrl={lightboxImage} onClose={() => setLightboxImage(null)} />
      
      {/* 配额错误处理 */}
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
    </>
  );
}