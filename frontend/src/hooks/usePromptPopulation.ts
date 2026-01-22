/**
 * usePromptPopulation Hook
 * 从 Create.tsx 提取的提示词填充逻辑
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { useState, useCallback } from 'react';
import type { GenerationHistory } from '../type';
import type { BatchResult } from '../type/generation';
import { loadReferenceFiles } from '../utils/referenceImages';

/**
 * Toast 上下文类型（简化版，仅包含需要的方法）
 */
interface ToastContext {
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
}

/**
 * 填充提示词栏的参数接口
 * Requirements: 4.3
 */
export interface PopulatePromptParams {
  prompt: string;
  refImages?: string | string[];
  imageCount?: number;
  autoTrigger: boolean;
}

/**
 * usePromptPopulation Hook 返回值接口
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export interface UsePromptPopulationResult {
  // States
  selectedPrompt: string;
  selectedFiles: File[];
  selectedImageCount: 1 | 2 | 3 | 4;
  promptUpdateKey: number;
  triggerGenerate: boolean;
  
  // Setters
  setSelectedPrompt: (prompt: string) => void;
  setSelectedFiles: (files: File[]) => void;
  setSelectedImageCount: (count: 1 | 2 | 3 | 4) => void;
  setTriggerGenerate: (trigger: boolean) => void;
  
  // Actions
  populatePromptBar: (params: PopulatePromptParams) => Promise<void>;
  handleRegenerate: (item: GenerationHistory) => Promise<void>;
  handleEditPrompt: (item: GenerationHistory) => Promise<void>;
  handleRegenerateBatchWithRef: (batch: BatchResult) => Promise<void>;
  handleEditBatchPromptWithRef: (batch: BatchResult) => Promise<void>;
  
  // Reset
  resetPromptState: () => void;
}

/**
 * 提示词填充 Hook
 * 管理提示词、参考图、图片数量等状态，并提供重新生成和编辑提示词的功能
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * 
 * @param toast - Toast 上下文，用于显示提示消息
 * @param scrollToBottom - 可选的滚动到底部函数
 * @returns UsePromptPopulationResult - 状态和操作函数
 */
export function usePromptPopulation(
  toast: ToastContext,
  scrollToBottom?: () => void
): UsePromptPopulationResult {
  // States - Requirements: 4.2
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedImageCount, setSelectedImageCount] = useState<1 | 2 | 3 | 4>(1);
  const [promptUpdateKey, setPromptUpdateKey] = useState(0);
  const [triggerGenerate, setTriggerGenerate] = useState(false);

  /**
   * 统一的提示词填充函数
   * 用于重新生成和编辑提示词场景
   * Requirements: 4.3
   */
  const populatePromptBar = useCallback(async (params: PopulatePromptParams): Promise<void> => {
    const { prompt, refImages, imageCount = 1, autoTrigger } = params;
    
    console.log('[usePromptPopulation] populatePromptBar 被调用:', { prompt, refImages, imageCount, autoTrigger });
    
    try {
      // 1. 加载参考图
      const refFiles = await loadReferenceFiles(refImages);
      console.log('[usePromptPopulation] 参考图加载完成:', refFiles.length, '个文件');
      
      // 2. 设置提示词、参考图、图片数量
      setPromptUpdateKey(prev => {
        const newKey = prev + 1;
        console.log('[usePromptPopulation] 更新 promptUpdateKey:', prev, '->', newKey);
        return newKey;
      });
      console.log('[usePromptPopulation] 设置 selectedPrompt:', prompt);
      setSelectedPrompt(prompt);
      console.log('[usePromptPopulation] 设置 selectedFiles:', refFiles.length, '个文件');
      setSelectedFiles(refFiles);
      const count = Math.min(Math.max(1, imageCount), 4) as 1 | 2 | 3 | 4;
      console.log('[usePromptPopulation] 设置 selectedImageCount:', count);
      setSelectedImageCount(count);
      
      // 3. 根据 autoTrigger 决定是否触发生成
      if (autoTrigger) {
        console.log('[usePromptPopulation] autoTrigger=true，200ms 后触发生成');
        setTimeout(() => {
          console.log('[usePromptPopulation] 设置 triggerGenerate=true');
          setTriggerGenerate(true);
        }, 200);
      } else {
        if (scrollToBottom) {
          setTimeout(scrollToBottom, 100);
        }
        toast.success(refFiles.length > 0 ? '已填充提示词和参考图，可编辑后发送' : '已填充提示词，可编辑后发送');
      }
    } catch (error) {
      console.error('[usePromptPopulation]', autoTrigger ? '重新生成失败:' : '编辑提示词失败:', error);
      
      if (autoTrigger) {
        // 即使参考图加载失败，也继续生成
        console.log('[usePromptPopulation] 参考图加载失败，但继续生成');
        setPromptUpdateKey(prev => prev + 1);
        setSelectedPrompt(prompt);
        const count = Math.min(Math.max(1, imageCount), 4) as 1 | 2 | 3 | 4;
        setSelectedImageCount(count);
        setTimeout(() => setTriggerGenerate(true), 200);
      } else {
        toast.error('加载失败，请稍后重试');
      }
    }
  }, [toast, scrollToBottom]);

  /**
   * 重新生成：使用历史记录的提示词和参考图
   * Requirements: 4.4
   */
  const handleRegenerate = useCallback(async (item: GenerationHistory) => {
    console.log('[usePromptPopulation] handleRegenerate 被调用，item:', item);
    await populatePromptBar({
      prompt: item.prompt || '',
      refImages: item.ref_images,
      imageCount: item.batch_total || 1,
      autoTrigger: true,
    });
  }, [populatePromptBar]);

  /**
   * 编辑提示词：填充提示词和参考图，但不自动发送
   * Requirements: 4.4
   */
  const handleEditPrompt = useCallback(async (item: GenerationHistory) => {
    console.log('[usePromptPopulation] handleEditPrompt 被调用，item:', item);
    await populatePromptBar({
      prompt: item.prompt || '',
      refImages: item.ref_images,
      imageCount: item.batch_total || 1,
      autoTrigger: false,
    });
  }, [populatePromptBar]);

  /**
   * 重新生成批次（带参考图）：使用相同的提示词和参考图重新生成
   * Requirements: 4.4
   */
  const handleRegenerateBatchWithRef = useCallback(async (batch: BatchResult) => {
    await populatePromptBar({
      prompt: batch.prompt,
      refImages: batch.refImages,
      imageCount: batch.imageCount || 1,
      autoTrigger: true,
    });
  }, [populatePromptBar]);

  /**
   * 编辑批次提示词（带参考图）：填充提示词和参考图到输入框，但不自动发送
   * Requirements: 4.4
   */
  const handleEditBatchPromptWithRef = useCallback(async (batch: BatchResult) => {
    await populatePromptBar({
      prompt: batch.prompt,
      refImages: batch.refImages,
      imageCount: batch.imageCount || 1,
      autoTrigger: false,
    });
  }, [populatePromptBar]);

  /**
   * 重置提示词状态
   * 用于生成完成后清空状态
   */
  const resetPromptState = useCallback(() => {
    setSelectedPrompt('');
    setSelectedFiles([]);
    setSelectedImageCount(1);
    setTriggerGenerate(false);
  }, []);

  return {
    // States
    selectedPrompt,
    selectedFiles,
    selectedImageCount,
    promptUpdateKey,
    triggerGenerate,
    
    // Setters
    setSelectedPrompt,
    setSelectedFiles,
    setSelectedImageCount,
    setTriggerGenerate,
    
    // Actions
    populatePromptBar,
    handleRegenerate,
    handleEditPrompt,
    handleRegenerateBatchWithRef,
    handleEditBatchPromptWithRef,
    
    // Reset
    resetPromptState,
  };
}
