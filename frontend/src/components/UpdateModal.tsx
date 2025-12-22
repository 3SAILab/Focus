import { useState } from 'react';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import Modal from './common/Modal';
import type { RemoteVersionInfo } from '../types/electron';

interface UpdateModalProps {
  isOpen: boolean;
  remoteVersion: RemoteVersionInfo | null;
  downloadUrl: string;
  onDownload: () => void;
}

export default function UpdateModal({
  isOpen,
  remoteVersion,
  downloadUrl,
  onDownload,
}: UpdateModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      onDownload();
    } finally {
      // Keep loading state for a moment to show feedback
      setTimeout(() => setIsDownloading(false), 1000);
    }
  };

  // Format update content with line breaks
  const formatUpdateContent = (content: string) => {
    return content.split('\n').map((line, index) => (
      <p key={index} className="text-sm text-gray-600">
        {line}
      </p>
    ));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Empty function - modal cannot be closed
      title="发现新版本"
      icon={<RefreshCw className="w-5 h-5" />}
      iconBgColor="bg-blue-100"
      iconColor="text-blue-600"
      headerBgClass="bg-gradient-to-r from-blue-50 to-indigo-50"
      closable={false}
      closeOnBackdropClick={false}
      maxWidth="md"
      footer={
        <button
          onClick={handleDownload}
          disabled={isDownloading || !downloadUrl}
          className="w-full px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              正在打开下载链接...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              下载更新
            </>
          )}
        </button>
      }
    >
      <div className="space-y-4">
        {/* Version info */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <span className="text-sm text-gray-500">新版本</span>
          <span className="text-sm font-semibold text-gray-800">
            {remoteVersion?.versionName || '未知'}
          </span>
        </div>

        {/* Update content */}
        {remoteVersion?.updateContent && (
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <h4 className="text-sm font-semibold text-blue-800 mb-3">
              更新内容
            </h4>
            <div className="space-y-1">
              {formatUpdateContent(remoteVersion.updateContent)}
            </div>
          </div>
        )}

        {/* Notice */}
        <div className="text-xs text-gray-500 text-center">
          请下载并安装新版本后重新启动软件
        </div>
      </div>
    </Modal>
  );
}
