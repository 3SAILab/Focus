// src/components/ApiKeyModal.tsx

import { useState, useEffect, useRef } from 'react';
import { Key, Loader2, Check, Eye, EyeOff, Copy, ClipboardPaste, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from './common/Modal';

interface ApiKeyModalProps {
  isOpen: boolean;
  canClose: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ValidationResult {
  valid: boolean;
  name?: string;
  remain?: number;
  used?: number;
  error?: string;
}

export default function ApiKeyModal({
  isOpen,
  canClose,
  onClose,
  onSuccess,
}: ApiKeyModalProps) {
  const toast = useToast();
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [maskedKey, setMaskedKey] = useState('');
  const [rawKey, setRawKey] = useState(''); // 完整 key，用于复制和显示
  const [currentRemain, setCurrentRemain] = useState<number | null>(null);
  const [currentUsed, setCurrentUsed] = useState<number | null>(null);
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
      // 获取当前的 masked key 和余额信息
      api
        .checkConfig()
        .then((res) => res.json())
        .then((data) => {
          if (data.masked_key) {
            setMaskedKey(data.masked_key);
          }
          if (data.raw_key) {
            setRawKey(data.raw_key);
          }
          if (data.remain !== undefined) {
            setCurrentRemain(data.remain);
          }
          if (data.used !== undefined) {
            setCurrentUsed(data.used);
          }
        })
        .catch(() => {});
      
      // 重置验证状态
      setValidationResult(null);
      setApiKey('');
      setShowKey(false);
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

  // 当 API Key 改变时，重置验证结果
  useEffect(() => {
    setValidationResult(null);
  }, [apiKey]);

  // 验证 API Key
  const handleValidate = async () => {
    if (!apiKey.trim()) {
      toast.warning('请输入 API Key');
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const res = await api.validateApiKey(apiKey.trim());
      const data = await res.json();

      if (res.ok && data.valid) {
        setValidationResult({
          valid: true,
          name: data.name,
          remain: data.remain,
          used: data.used,
        });
        toast.success('API Key 验证成功');
      } else {
        setValidationResult({
          valid: false,
          error: data.error || '无效的 API Key',
        });
        toast.error(data.error || '无效的 API Key');
      }
    } catch {
      setValidationResult({
        valid: false,
        error: '验证失败，请检查网络连接',
      });
      toast.error('验证失败，请检查网络连接');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    // 如果还没有验证过，先验证
    if (!validationResult?.valid) {
      toast.warning('请先验证 API Key');
      return;
    }

    setIsSubmitting(true);
    try {
      // 已经验证过了，跳过后端再次验证
      const res = await api.setApiKey(apiKey.trim(), true);
      if (res.ok) {
        toast.success('API Key 设置成功');
        
        // 刷新当前 Key 信息而不关闭 Modal
        const configRes = await api.checkConfig();
        const configData = await configRes.json();
        if (configData.masked_key) {
          setMaskedKey(configData.masked_key);
        }
        if (configData.raw_key) {
          setRawKey(configData.raw_key);
        }
        if (configData.remain !== undefined) {
          setCurrentRemain(configData.remain);
        }
        if (configData.used !== undefined) {
          setCurrentUsed(configData.used);
        }
        
        // 清空输入和验证状态
        setApiKey('');
        setValidationResult(null);
        
        // 通知父组件成功（用于刷新余额显示等）
        onSuccess();
      } else {
        const data = await res.json();
        throw new Error(data.error || '设置失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '设置 API Key 失败，请重试';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 复制 API Key（复制完整的原始 key）
  const handleCopy = async () => {
    if (!rawKey) return;
    try {
      await navigator.clipboard.writeText(rawKey);
      toast.success('已复制到剪贴板');
    } catch {
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
    } catch {
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
              className="font-mono text-sm text-gray-700 mt-1 cursor-pointer select-all break-all"
            >
              {showKey ? (rawKey || maskedKey) : maskedKey}
            </p>
            {/* 显示当前余额信息 */}
            {currentRemain !== null && (
              <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600 space-y-0.5">
                <p>剩余额度: <span className="font-medium text-green-600">{currentRemain.toLocaleString()}</span> 点</p>
                {currentUsed !== null && <p>已用额度: {currentUsed.toLocaleString()} 点</p>}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">
            API Key
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onContextMenu={handleInputContextMenu}
              placeholder={maskedKey ? '输入新的 API Key...' : 'sk-...'}
              className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all font-mono text-sm"
              autoFocus
            />
            <button
              type="button"
              onClick={handleValidate}
              disabled={!apiKey.trim() || isValidating}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 whitespace-nowrap"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  验证中
                </>
              ) : (
                '验证'
              )}
            </button>
          </div>
        </div>

        {/* 验证结果显示 */}
        {validationResult && (
          <div className={`p-3 rounded-xl border ${
            validationResult.valid 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start gap-2">
              {validationResult.valid ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                {validationResult.valid ? (
                  <>
                    <p className="text-sm font-medium text-green-800">
                      验证成功
                    </p>
                    <div className="mt-1 text-xs text-green-700 space-y-0.5">
                      <p>剩余额度: {validationResult.remain?.toLocaleString() || 0} 点</p>
                      <p>已用额度: {validationResult.used?.toLocaleString() || 0} 点</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-red-800">
                    {validationResult.error}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!apiKey.trim() || isSubmitting || !validationResult?.valid}
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
        
        {!validationResult?.valid && apiKey.trim() && (
          <p className="text-xs text-center text-gray-500">
            请先点击"验证"按钮验证 API Key 有效性
          </p>
        )}
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