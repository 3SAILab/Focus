// src/components/ApiKeyModal.tsx

import { useState, useEffect } from 'react';
import { Key, X, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';

interface ApiKeyModalProps {
  isOpen: boolean;
  canClose: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ApiKeyModal({ isOpen, canClose, onClose, onSuccess }: ApiKeyModalProps) {
  const toast = useToast();
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 获取当前的 masked key
      api.checkConfig().then(res => res.json()).then(data => {
        if (data.masked_key) {
          setMaskedKey(data.masked_key);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.setApiKey(apiKey.trim());
      if (res.ok) {
        toast.success('API Key 设置成功');
        onSuccess();
        setApiKey(''); // 清空输入框
      } else {
        throw new Error('设置失败');
      }
    } catch (error) {
      toast.error('设置 API Key 失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative">
        
        {/* 只有在允许关闭的情况下（即已有Key修改时）才显示关闭按钮 */}
        {canClose && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <Key className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">
            {canClose ? '更新 API Key' : '配置 API Key'}
          </h2>
          <p className="text-sm text-gray-500 mt-2 text-center">
            {canClose 
              ? '更换后的 Key 将用于后续的图片生成任务' 
              : '欢迎使用！请输入你的 Google Gemini API Key 以开始创作'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 显示当前 Key（如果有） */}
          {maskedKey && (
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">当前 Key</span>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="font-mono text-sm text-gray-700 mt-1">
                {showKey ? maskedKey : '••••••••••••'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={maskedKey ? '输入新的 API Key...' : 'AIzaSy...'}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all font-mono text-sm"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={!apiKey.trim() || isSubmitting}
            className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-medium shadow-lg shadow-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在保存...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                确认保存
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}