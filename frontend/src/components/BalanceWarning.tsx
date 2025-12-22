// src/components/BalanceWarning.tsx
// 余额不足警告组件
// Requirements: 5.1, 5.2 - 当余额低于阈值时在界面右下角显示红色警告

import { AlertTriangle } from 'lucide-react';

interface BalanceWarningProps {
  visible: boolean;
}

/**
 * 余额不足警告组件
 * 固定在左下角显示红色警告文字，避免遮挡右侧输入框和按钮
 */
export default function BalanceWarning({ visible }: BalanceWarningProps) {
  if (!visible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-fade-in">
      <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg shadow-lg">
        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <span className="text-red-600 text-sm font-medium">
          余额即将不足，请联系销售充值
        </span>
      </div>
    </div>
  );
}
