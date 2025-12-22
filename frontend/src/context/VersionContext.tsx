import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import type { VersionCheckResult, RemoteVersionInfo } from '../types/electron';
import UpdateModal from '../components/UpdateModal';
import NetworkErrorModal from '../components/NetworkErrorModal';

type VersionStatus = 'checking' | 'network_error' | 'fetch_error' | 'update_required' | 'up_to_date';

interface VersionContextType {
  status: VersionStatus;
  isVersionChecked: boolean;
  canUseApp: boolean;
  remoteVersion: RemoteVersionInfo | null;
  downloadUrl: string;
  errorMessage: string;
  checkVersion: () => Promise<void>;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

export function VersionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VersionStatus>('checking');
  const [isVersionChecked, setIsVersionChecked] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<RemoteVersionInfo | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Check if user can use the app (only when version is up to date)
  const canUseApp = status === 'up_to_date';

  const checkVersion = useCallback(async () => {
    // Check if running in Electron environment
    if (!window.electronAPI) {
      console.log('[VersionContext] Not in Electron environment, skipping version check');
      setStatus('up_to_date');
      setIsVersionChecked(true);
      return;
    }

    setStatus('checking');
    setErrorMessage('');

    try {
      console.log('[VersionContext] Starting version check...');
      const result: VersionCheckResult = await window.electronAPI.checkUpdate();
      console.log('[VersionContext] Version check result:', result);

      switch (result.status) {
        case 'network_error':
          setStatus('network_error');
          setErrorMessage(result.errorMessage || '网络连接失败，请检查网络后重试');
          break;

        case 'fetch_error':
          setStatus('fetch_error');
          setErrorMessage(result.errorMessage || '获取版本信息失败，请稍后重试');
          break;

        case 'update_required':
          setStatus('update_required');
          setRemoteVersion(result.remoteVersion || null);
          setDownloadUrl(result.downloadUrl || '');
          break;

        case 'up_to_date':
          setStatus('up_to_date');
          break;

        default:
          console.warn('[VersionContext] Unknown status:', result.status);
          setStatus('up_to_date');
      }
    } catch (error) {
      console.error('[VersionContext] Version check failed:', error);
      setStatus('network_error');
      setErrorMessage('版本检查失败，请检查网络后重试');
    } finally {
      setIsVersionChecked(true);
    }
  }, []);

  // Handle download button click
  const handleDownload = useCallback(async () => {
    if (!downloadUrl || !window.electronAPI) return;

    try {
      console.log('[VersionContext] Opening download URL:', downloadUrl);
      const result = await window.electronAPI.openDownloadUrl(downloadUrl);
      if (!result.success) {
        console.error('[VersionContext] Failed to open download URL:', result.error);
      }
    } catch (error) {
      console.error('[VersionContext] Error opening download URL:', error);
    }
  }, [downloadUrl]);

  // Check version on mount
  useEffect(() => {
    checkVersion();
  }, [checkVersion]);

  const contextValue = useMemo(() => ({
    status,
    isVersionChecked,
    canUseApp,
    remoteVersion,
    downloadUrl,
    errorMessage,
    checkVersion,
  }), [status, isVersionChecked, canUseApp, remoteVersion, downloadUrl, errorMessage, checkVersion]);

  return (
    <VersionContext.Provider value={contextValue}>
      {children}
      
      {/* Network Error Modal */}
      <NetworkErrorModal
        isOpen={status === 'network_error' || status === 'fetch_error'}
        errorMessage={errorMessage}
        onRetry={checkVersion}
      />

      {/* Update Required Modal */}
      <UpdateModal
        isOpen={status === 'update_required'}
        remoteVersion={remoteVersion}
        downloadUrl={downloadUrl}
        onDownload={handleDownload}
      />
    </VersionContext.Provider>
  );
}

export function useVersion() {
  const context = useContext(VersionContext);
  if (context === undefined) {
    throw new Error('useVersion must be used within a VersionProvider');
  }
  return context;
}
