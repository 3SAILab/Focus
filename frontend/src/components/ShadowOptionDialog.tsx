import { Sun, SunDim } from 'lucide-react';
import { useState } from 'react';
import Modal from './common/Modal';

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

  const handleConfirm = () => {
    onConfirm(removeShadow);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="生成选项"
      headerBgClass="bg-white"
      maxWidth="md"
      footer={
        <div className="flex gap-3">
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
      }
    >
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
    </Modal>
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
