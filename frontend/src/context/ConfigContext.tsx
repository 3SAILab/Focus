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
      console.log('[ConfigContext] 开始检查配置...');
      const res = await api.checkConfig();
      console.log('[ConfigContext] 配置检查响应状态:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[ConfigContext] 配置数据:', data);
        console.log('[ConfigContext] has_api_key:', data.has_api_key);
        console.log('[ConfigContext] disclaimer_agreed:', data.disclaimer_agreed);
        
        setHasApiKey(data.has_api_key);
        setHasAgreedDisclaimer(data.disclaimer_agreed);
        
        // 启动流程：先免责声明，再 API Key
        if (!data.disclaimer_agreed) {
          console.log('[ConfigContext] 免责声明未同意，显示免责声明弹窗');
          setShowDisclaimerModal(true);
        } else if (!data.has_api_key) {
          console.log('[ConfigContext] API Key 未设置，显示 API Key 弹窗');
          setShowApiKeyModal(true);
        } else {
          console.log('[ConfigContext] 配置完整，无需显示弹窗');
        }
      } else {
        console.error('[ConfigContext] 配置检查失败，状态码:', res.status);
      }
    } catch (e) {
      console.error('[ConfigContext] 检查配置失败', e);
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
  };

  const handleDisclaimerAgree = async () => {
    try {
      await api.setDisclaimerAgreed(true);
      setHasAgreedDisclaimer(true);
      setShowDisclaimerModal(false);
      // 免责声明同意后，如果还没有 API Key，显示 API Key 输入框
      if (!hasApiKey) {
        setShowApiKeyModal(true);
      }
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
      {/* 免责声明 Modal - 首次使用时强制同意，优先显示 */}
      {!isChecking && (
        <DisclaimerModal
          isOpen={showDisclaimerModal}
          onClose={() => setShowDisclaimerModal(false)}
          onAgree={handleDisclaimerAgree}
          hasAgreed={hasAgreedDisclaimer}
          requireAgree={!hasAgreedDisclaimer}
        />
      )}
      {/* API Key Modal - 免责声明关闭后才显示 */}
      {!isChecking && !showDisclaimerModal && (
        <ApiKeyModal 
          isOpen={showApiKeyModal} 
          canClose={hasApiKey} 
          onClose={() => setShowApiKeyModal(false)}
          onSuccess={handleApiKeySuccess}
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
