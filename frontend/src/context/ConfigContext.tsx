// src/context/ConfigContext.tsx

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api';
import ApiKeyModal from '../components/ApiKeyModal';

interface ConfigContextType {
  hasApiKey: boolean;
  showModal: boolean;
  openSettings: () => void;
  checkConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [hasApiKey, setHasApiKey] = useState(true); // 默认 true 防止闪烁，加载完变 false
  const [showModal, setShowModal] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const checkConfig = async () => {
    try {
      const res = await api.checkConfig();
      if (res.ok) {
        const data = await res.json();
        setHasApiKey(data.has_api_key);
        // 如果没有 Key，强制显示 Modal
        if (!data.has_api_key) {
          setShowModal(true);
        }
      }
    } catch (e) {
      console.error('检查配置失败', e);
      // 如果连接失败，暂不强制阻塞，但在 Sidebar 可以手动点开
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConfig();
  }, []);

  const openSettings = () => {
    setShowModal(true);
  };

  const handleSuccess = () => {
    setHasApiKey(true);
    setShowModal(false);
  };

  return (
    <ConfigContext.Provider value={{ hasApiKey, showModal, openSettings, checkConfig }}>
      {children}
      {/* 只有在检查完成后才决定是否渲染 Modal，避免闪烁 */}
      {!isChecking && (
        <ApiKeyModal 
          isOpen={showModal} 
          // 如果没有 Key，禁止关闭（强制输入）；如果有 Key，则允许关闭（仅修改）
          canClose={hasApiKey} 
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
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