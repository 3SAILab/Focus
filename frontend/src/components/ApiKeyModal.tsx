// src/components/ApiKeyModal.tsx

import { useState, useEffect, useRef } from 'react';
import { Key, Loader2, Check, Eye, EyeOff, Copy, ClipboardPaste } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from './common/Modal';

interface ApiKeyModalProps {
  isOpen: boolean;
  canClose: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ApiKeyModal({
  isOpen,
  canClose,
  onClose,
  onSuccess,
}: ApiKeyModalProps) {
  const toast = useToast();
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'input' | 'display';
  } | null>(null);
  const keyDisplayRef = useRef<HTMLParagraphElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // 获取当前的 masked key
      api
        .checkConfig()
        .then((res) => res.json())
        .then((data) => {
          if (data.masked_key) {
            setMaskedKey(data.masked_key);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // 关闭右键菜单
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

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

  // 复制 API Key
  const handleCopy = async () => {
    if (!maskedKey) return;
    try {
      await navigator.clipboard.writeText(maskedKey);
      toast.success('已复制到剪贴板');
    } catch (error) {
      toast.error('复制失败');
    }
    setContextMenu(null);
  };

  // 粘贴到输入框
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setApiKey(text);
      toast.success('已粘贴');
    } catch (error) {
      toast.error('粘贴失败，请检查剪贴板权限');
    }
    setContextMenu(null);
  };

  // 显示区域右键菜单
  const handleDisplayContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (maskedKey) {
      setContextMenu({ x: e.clientX, y: e.clientY, type: 'display' });
    }
  };

  // 输入框右键菜单
  const handleInputContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: 'input' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closable={canClose}
      closeOnBackdropClick={false}
      maxWidth="md"
      headerBgClass="bg-white"
    >
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
            : '欢迎使用！请输入你的 API Key 以开始创作'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 显示当前 Key（如果有） */}
        {maskedKey && (
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">当前 Key</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="复制"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title={showKey ? '隐藏' : '显示'}
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <p
              ref={keyDisplayRef}
              onContextMenu={handleDisplayContextMenu}
              className="font-mono text-sm text-gray-700 mt-1 cursor-pointer select-all"
            >
              {showKey ? maskedKey : '••••••••••••'}
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
            API Key
          </label>
          <input
            ref={inputRef}
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onContextMenu={handleInputContextMenu}
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

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-[100]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'input' && (
            <button
              onClick={handlePaste}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <ClipboardPaste className="w-4 h-4" />
              粘贴
            </button>
          )}
          {contextMenu.type === 'display' && (
            <button
              onClick={handleCopy}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              复制
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}