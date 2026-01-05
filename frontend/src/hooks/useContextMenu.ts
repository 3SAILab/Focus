/**
 * useContextMenu Hook
 * 封装右键菜单的状态和处理逻辑
 * 用于减少视图组件中的重复代码
 */

import { useState, useCallback } from 'react';

export interface ContextMenuState {
  x: number;
  y: number;
  url: string;
}

export interface UseContextMenuResult {
  contextMenu: ContextMenuState | null;
  handleContextMenu: (e: React.MouseEvent, url: string) => void;
  closeContextMenu: () => void;
}

/**
 * 右键菜单 Hook
 * 提供统一的右键菜单状态管理和事件处理
 */
export function useContextMenu(): UseContextMenuResult {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setContextMenu({
      x: rect.right + 8,
      y: Math.min(e.clientY, window.innerHeight - 120),
      url,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    handleContextMenu,
    closeContextMenu,
  };
}

export default useContextMenu;
