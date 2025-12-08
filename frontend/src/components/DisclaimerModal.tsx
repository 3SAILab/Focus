import { useState, useEffect } from 'react';
import { X, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

interface DisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree?: () => void;
  hasAgreed?: boolean;
  requireAgree?: boolean; // 是否需要同意才能关闭
}

export default function DisclaimerModal({ 
  isOpen, 
  onClose, 
  onAgree,
  hasAgreed = false,
  requireAgree = false
}: DisclaimerModalProps) {
  const [countdown, setCountdown] = useState(5);
  const [canAgree, setCanAgree] = useState(false);

  useEffect(() => {
    if (isOpen && requireAgree && !hasAgreed) {
      setCountdown(5);
      setCanAgree(false);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanAgree(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen, requireAgree, hasAgreed]);

  if (!isOpen) return null;

  const handleAgree = () => {
    if (onAgree) {
      onAgree();
    }
    onClose();
  };

  const canClose = !requireAgree || hasAgreed;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 - 不可点击关闭 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* 对话框 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">免责声明</h3>
              {hasAgreed && (
                <span className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  已同意
                </span>
              )}
            </div>
          </div>
          {canClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/50 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 内容 */}
        <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
          {/* 软件使用说明 */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              软件使用说明
            </h4>
            <div className="text-sm text-gray-600 space-y-2 pl-4">
              <p>1. 本软件仅供个人学习和商业使用，请遵守相关法律法规。</p>
              <p>2. 用户应对使用本软件生成的内容负责，确保不侵犯他人权益。</p>
              <p>3. 本软件不保证生成结果的准确性和完整性。</p>
              <p>4. 使用本软件即表示您同意本免责声明的所有条款。</p>
              <p>5. 本软件保留随时修改服务条款的权利。</p>
            </div>
          </div>

          {/* AI 生图内容免责 */}
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
            <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              AI 生图内容免责说明
            </h4>
            <div className="text-sm text-amber-700 space-y-2">
              <p>1. AI 生成的图片可能存在版权风险，请用户自行判断和承担。</p>
              <p>2. 禁止使用本软件生成违法、违规、侵权或不当内容。</p>
              <p>3. 生成的图片仅供参考，不代表本软件的立场或观点。</p>
              <p>4. 用户应确保上传的图片拥有合法使用权。</p>
              <p>5. 对于因使用生成内容而产生的任何纠纷，本软件不承担责任。</p>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          {requireAgree && !hasAgreed ? (
            <button
              onClick={handleAgree}
              disabled={!canAgree}
              className="w-full px-4 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canAgree ? '我已阅读并同意' : `请仔细阅读 (${countdown}s)`}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-4 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-all shadow-lg shadow-red-200"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
