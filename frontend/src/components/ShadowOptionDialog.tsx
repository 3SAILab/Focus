import { X, Sun, SunDim } from 'lucide-react';
import { useState } from 'react';

interface ShadowOptionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (removeShadow: boolean) => void;
}

export default function ShadowOptionDialog({
  isOpen,
  onClose,
  onConfirm,
}: ShadowOptionDialogProps) {
  const [removeShadow, setRemoveShadow] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(removeShadow);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">生成选项</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-6">
          <p className="text-sm text-gray-500 mb-4">
            请选择是否去除产品表面的光影反射效果
          </p>

          <div className="space-y-3">
            {/* 保留光影选项 */}
            <label
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                !removeShadow
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="shadowOption"
                checked={!removeShadow}
                onChange={() => setRemoveShadow(false)}
                className="sr-only"
              />
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  !removeShadow ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                <Sun className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">保留光影</div>
                <div className="text-xs text-gray-500">保持产品原有的光影效果</div>
              </div>
              {!removeShadow && (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </label>

            {/* 去除光影选项 */}
            <label
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                removeShadow
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="shadowOption"
                checked={removeShadow}
                onChange={() => setRemoveShadow(true)}
                className="sr-only"
              />
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  removeShadow ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                <SunDim className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">去除光影</div>
                <div className="text-xs text-gray-500">移除产品表面所有光影反射</div>
              </div>
              {removeShadow && (
                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </label>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-100 transition-all"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-all shadow-lg shadow-red-200"
          >
            开始生成
          </button>
        </div>
      </div>
    </div>
  );
}

// 提示词构造函数
export function buildWhiteBackgroundPrompt(removeShadow: boolean): string {
  const basePrompt = '不要修改图中的产品和位置，生成产品的白底图';
  if (removeShadow) {
    return `${basePrompt}，去掉产品表面所有光影反射`;
  }
  return basePrompt;
}
