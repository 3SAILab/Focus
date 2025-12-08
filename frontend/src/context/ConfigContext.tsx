// src/context/ConfigContext.tsx

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../api';
import ApiKeyModal from '../components/ApiKeyModal';
import DisclaimerModal from '../components/DisclaimerModal';

interface ConfigContextType {
  hasApiKey: boolean;
  hasAgreedDisclaimer: boolean;
  showModal: boolean;
  openSettings: () => void;
  checkConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [hasApiKey, setHasApiKey] = useState(true); // 默认 true 防止闪烁
  const [hasAgreedDisclaimer, setHasAgreedDisclaimer] = useState(true); // 默认 true 防止闪烁
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkConfig = async () => {
    try {
      const res = await api.checkConfig();
      if (res.ok) {
        const data = await res.json();
        setHasApiKey(data.has_api_key);
        setHasAgreedDisclaimer(data.disclaimer_agreed);
        
        // 启动流程：先 API Key，再免责声明
        if (!data.has_api_key) {
          setShowApiKeyModal(true);
        } else if (!data.disclaimer_agreed) {
          setShowDisclaimerModal(true);
        }
      }
    } catch (e) {
      console.error('检查配置失败', e);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConfig();
  }, []);

  const openSettings = () => {
    setShowApiKeyModal(true);
  };

  const handleApiKeySuccess = () => {
    setHasApiKey(true);
    setShowApiKeyModal(false);
    // API Key 设置成功后，如果还没同意免责声明，显示免责声明
    if (!hasAgreedDisclaimer) {
      setShowDisclaimerModal(true);
    }
  };

  const handleDisclaimerAgree = async () => {
    try {
      await api.setDisclaimerAgreed(true);
      setHasAgreedDisclaimer(true);
      setShowDisclaimerModal(false);
    } catch (e) {
      console.error('保存免责声明状态失败', e);
    }
  };

  return (
    <ConfigContext.Provider value={{ 
      hasApiKey, 
      hasAgreedDisclaimer,
      showModal: showApiKeyModal, 
      openSettings, 
      checkConfig 
    }}>
      {children}
      {/* API Key Modal */}
      {!isChecking && (
        <ApiKeyModal 
          isOpen={showApiKeyModal} 
          canClose={hasApiKey} 
          onClose={() => setShowApiKeyModal(false)}
          onSuccess={handleApiKeySuccess}
        />
      )}
      {/* 免责声明 Modal - 首次使用时强制同意 */}
      {!isChecking && !showApiKeyModal && (
        <DisclaimerModal
          isOpen={showDisclaimerModal}
          onClose={() => setShowDisclaimerModal(false)}
          onAgree={handleDisclaimerAgree}
          hasAgreed={hasAgreedDisclaimer}
          requireAgree={!hasAgreedDisclaimer}
        />
      )}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}
