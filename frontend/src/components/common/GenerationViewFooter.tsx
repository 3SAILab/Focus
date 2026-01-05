/**
 * GenerationViewFooter Component
 * 封装电商视图底部的通用组件组合：Lightbox + QuotaErrorHandler + ImageContextMenu
 * 用于减少 WhiteBackground, ClothingChange, ProductScene, LightShadow 视图中的重复代码
 */

import Lightbox from '../Lightbox';
import ImageContextMenu from '../ImageContextMenu';
import { QuotaErrorHandler } from '../feedback';

export interface ContextMenuState {
  x: number;
  y: number;
  url: string;
}

export interface GenerationViewFooterProps {
  // Lightbox
  lightboxImage: string | null;
  onLightboxClose: () => void;
  
  // QuotaErrorHandler
  showQuotaError: boolean;
  showContact: boolean;
  onQuotaErrorClose: () => void;
  onContactClose: () => void;
  onContactSales: () => void;
  
  // ImageContextMenu
  contextMenu: ContextMenuState | null;
  onContextMenuClose: () => void;
  showReferenceOption?: boolean;
}

/**
 * 电商视图底部组件组合
 * 包含：图片预览、配额错误处理、右键菜单
 */
export function GenerationViewFooter({
  lightboxImage,
  onLightboxClose,
  showQuotaError,
  showContact,
  onQuotaErrorClose,
  onContactClose,
  onContactSales,
  contextMenu,
  onContextMenuClose,
  showReferenceOption = false,
}: GenerationViewFooterProps) {
  return (
    <>
      {/* Image lightbox */}
      <Lightbox imageUrl={lightboxImage} onClose={onLightboxClose} />
      
      {/* Quota error handler */}
      <QuotaErrorHandler
        showQuotaError={showQuotaError}
        showContact={showContact}
        onQuotaErrorClose={onQuotaErrorClose}
        onContactClose={onContactClose}
        onContactSales={onContactSales}
      />

      {/* Context menu */}
      <ImageContextMenu
        imageUrl={contextMenu?.url || ''}
        position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
        onClose={onContextMenuClose}
        showReferenceOption={showReferenceOption}
      />
    </>
  );
}

export default GenerationViewFooter;
