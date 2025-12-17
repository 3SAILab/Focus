import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, ImagePlus } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface ImageContextMenuProps {
  imageUrl: string;
  position: { x: number; y: number } | null;
  imageRect?: DOMRect | null; // 图片的位置信息
  onClose: () => void;
  onUseAsReference?: (url: string) => void;
  showReferenceOption?: boolean;
}

export default function ImageContextMenu({
  imageUrl,
  position,
  imageRect,
  onClose,
  onUseAsReference,
  showReferenceOption = false,
}: ImageContextMenuProps) {
  const toast = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  // 计算菜单位置 - 固定在图片右侧，空间不足时显示在图片内部
  const getAdjustedPosition = () => {
    if (!position) return null;
    
    const menuWidth = 160;
    const menuHeight = showReferenceOption ? 140 : 100;
    const gap = 8;
    
    let x: number;
    let y: number;
    
    if (imageRect) {
      // 使用图片的 rect 信息计算位置
      const rightSpace = window.innerWidth - imageRect.right;
      
      if (rightSpace >= menuWidth + gap) {
        // 右侧有足够空间，显示在图片右侧外部
        x = imageRect.right + gap;
      } else {
        // 右侧空间不足，显示在图片内部右侧
        x = imageRect.right - menuWidth - gap;
        // 确保不超出图片左边缘
        x = Math.max(imageRect.left + gap, x);
      }
      
      // 垂直位置：图片垂直居中
      y = imageRect.top + imageRect.height / 2 - menuHeight / 2;
    } else {
      // 没有 imageRect，使用传入的 position
      x = position.x + gap;
      y = position.y - menuHeight / 2;
    }
    
    // 最终边界检查
    x = Math.min(x, window.innerWidth - menuWidth - gap);
    x = Math.max(gap, x);
    y = Math.max(gap, Math.min(y, window.innerHeight - menuHeight - gap));

    return { x, y };
  };

  const adjustedPosition = getAdjustedPosition();

  useEffect(() => {
    if (!position) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleScroll = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, position]);

  if (!position) return null;

  // 复制图片到剪贴板
  const handleCopy = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      toast.success('图片已复制到剪贴板');
    } catch (error) {
      console.error('复制图片失败:', error);
      toast.error('复制失败，请稍后重试');
    }
    onClose();
  };

  // 下载图片
  const handleDownload = async () => {
    try {
      const defaultFileName = `image_${Date.now()}.png`;
      
      // 检查是否在 Electron 环境中
      if (window.electronAPI?.saveImage) {
        // 使用 Electron 的保存对话框
        const result = await window.electronAPI.saveImage(imageUrl, defaultFileName);
        
        if (result.canceled) {
          // 用户取消了保存，不显示任何提示
          onClose();
          return;
        }
        
        if (result.success) {
          toast.success('图片保存成功');
        } else {
          toast.error(result.error || '保存失败，请稍后重试');
        }
      } else {
        // 浏览器环境，使用传统下载方式
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('图片保存成功');
      }
    } catch (error) {
      console.error('下载图片失败:', error);
      toast.error('保存失败，请稍后重试');
    }
    onClose();
  };

  // 引用为参考图
  const handleUseAsReference = () => {
    onUseAsReference?.(imageUrl);
    onClose();
  };

  // 使用 Portal 将菜单渲染到 body，避免父容器的 transform 影响 fixed 定位
  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedPosition?.x ?? 0,
        top: adjustedPosition?.y ?? 0,
        zIndex: 10000,
      }}
      className="bg-white rounded-xl shadow-xl border border-gray-100 py-2 min-w-[160px] animate-in fade-in zoom-in-95 duration-150"
    >
      <button
        onClick={handleCopy}
        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
      >
        <Copy className="w-4 h-4 text-gray-400" />
        复制图片
      </button>
      <button
        onClick={handleDownload}
        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
      >
        <Download className="w-4 h-4 text-gray-400" />
        下载图片
      </button>
      {showReferenceOption && onUseAsReference && (
        <>
          <div className="h-px bg-gray-100 my-1" />
          <button
            onClick={handleUseAsReference}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <ImagePlus className="w-4 h-4 text-gray-400" />
            引用为参考图
          </button>
        </>
      )}
    </div>,
    document.body
  );
}