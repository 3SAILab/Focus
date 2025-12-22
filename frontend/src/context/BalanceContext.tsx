// src/context/BalanceContext.tsx
// 全局余额状态管理，确保余额警告在页面切换和刷新时持久化
// Requirements: 5.1, 5.3 - 余额警告持续显示直到余额恢复

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { api } from '../api';
import BalanceWarning from '../components/BalanceWarning';

interface BalanceContextType {
  showLowBalanceWarning: boolean;
  checkBalance: () => Promise<void>;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

// localStorage key for persisting balance warning state
const BALANCE_WARNING_KEY = 'focus_low_balance_warning';

// 余额检查间隔：1分钟
const BALANCE_CHECK_INTERVAL = 60 * 1000;

export function BalanceProvider({ children }: { children: ReactNode }) {
  // 从 localStorage 读取初始状态
  const [showLowBalanceWarning, setShowLowBalanceWarning] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(BALANCE_WARNING_KEY);
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const intervalRef = useRef<number | null>(null);

  // 检查余额状态
  const checkBalance = useCallback(async () => {
    try {
      const result = await api.checkBalance();
      setShowLowBalanceWarning(result.lowBalance);
      // 持久化到 localStorage
      try {
        localStorage.setItem(BALANCE_WARNING_KEY, result.lowBalance ? 'true' : 'false');
      } catch {
        // 忽略 localStorage 错误
      }
    } catch (error) {
      // 静默处理，不影响应用流程
      console.warn('[BalanceContext] 余额检查失败:', error);
    }
  }, []);

  // 应用启动时立即检查一次，然后每分钟检查一次
  useEffect(() => {
    // 立即检查一次
    checkBalance();

    // 设置定时器，每分钟检查一次
    intervalRef.current = window.setInterval(() => {
      checkBalance();
    }, BALANCE_CHECK_INTERVAL);

    // 清理定时器
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkBalance]);

  return (
    <BalanceContext.Provider value={{ showLowBalanceWarning, checkBalance }}>
      {children}
      {/* 全局余额警告组件 */}
      <BalanceWarning visible={showLowBalanceWarning} />
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
}
