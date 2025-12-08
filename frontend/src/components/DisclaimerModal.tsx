import { useState, useEffect } from 'react';
import { Shield, AlertTriangle } from 'lucide-react';
import Modal from './common/Modal';

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

  const handleAgree = () => {
    if (onAgree) {
      onAgree();
    }
    onClose();
  };

  const canClose = !requireAgree || hasAgreed;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="免责声明"
      icon={<Shield className="w-5 h-5" />}
      iconBgColor="bg-red-100"
      iconColor="text-red-600"
      headerBgClass="bg-gradient-to-r from-red-50 to-orange-50"
      closable={canClose}
      closeOnBackdropClick={false}
      maxWidth="lg"
      footer={
        requireAgree && !hasAgreed ? (
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
        )
      }
    >
      <div className="overflow-y-auto max-h-[50vh]">
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
    </Modal>
  );
}
