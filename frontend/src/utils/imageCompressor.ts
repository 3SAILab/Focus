/**
 * 图片压缩模块
 * 
 * 提供图片压缩、验证等功能，用于优化图片上传体验
 */

/**
 * 图片压缩配置
 */
export interface CompressOptions {
  quality: number;        // 压缩质量，固定 0.92
  maxTotalSize: number;   // 最大总大小，25MB
  maxCount: number;       // 最大图片数量，5张
}

/**
 * 压缩结果
 */
export interface CompressResult {
  success: boolean;
  files: File[];
  totalSize: number;
  error?: string;
}

/**
 * 压缩配置常量
 */
export const COMPRESS_CONFIG = {
  QUALITY: 0.92,                      // 压缩质量（视觉无损）
  MAX_TOTAL_SIZE: 25 * 1024 * 1024,   // 25MB
  MAX_COUNT: 5,                       // 最大图片数量
  MAX_DIMENSION: 4096,                // 最大边长（超过此值会缩小）
} as const;

/**
 * 将 File 加载为 HTMLImageElement
 * @param file 图片文件
 * @returns Promise<HTMLImageElement>
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * 将 Canvas 转换为 Blob
 * @param canvas HTMLCanvasElement
 * @param mimeType 输出的 MIME 类型
 * @param quality 压缩质量（仅对 JPEG 有效）
 * @returns Promise<Blob>
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * 判断文件是否为 JPEG 格式
 * @param file 文件
 * @returns boolean
 */
function isJpeg(file: File): boolean {
  return file.type === 'image/jpeg' || file.type === 'image/jpg';
}

/**
 * 判断文件是否为 PNG 格式
 * @param file 文件
 * @returns boolean
 */
function isPng(file: File): boolean {
  return file.type === 'image/png';
}

/**
 * 格式化文件大小为可读字符串
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 压缩单张图片
 * 
 * - 超大图片（边长超过 4096px）会先缩小尺寸
 * - JPEG 图片使用 Canvas API 以 0.92 质量压缩
 * - PNG 图片保持原格式（使用 image/png）
 * - 如果压缩后文件更大，返回原文件
 * 
 * @param file 原始文件
 * @returns 压缩后的文件（如果压缩后更大则返回原文件）
 * 
 * @example
 * const compressedFile = await compressImage(originalFile);
 * 
 * Validates: Requirements 1.2, 1.3, 1.4
 */
export async function compressImage(file: File): Promise<File> {
  const originalSize = file.size;
  console.log(`[imageCompressor] 开始压缩: ${file.name}, 原始大小: ${formatFileSize(originalSize)}`);
  
  // 如果不是图片文件，直接返回原文件
  if (!file.type.startsWith('image/')) {
    console.log(`[imageCompressor] ${file.name} 不是图片文件，跳过压缩`);
    return file;
  }

  // 如果既不是 JPEG 也不是 PNG，直接返回原文件
  if (!isJpeg(file) && !isPng(file)) {
    console.log(`[imageCompressor] ${file.name} 不是 JPEG/PNG，跳过压缩`);
    return file;
  }

  try {
    // 加载图片
    const img = await loadImage(file);
    console.log(`[imageCompressor] ${file.name} 原始尺寸: ${img.naturalWidth}x${img.naturalHeight}`);
    
    // 计算目标尺寸（如果超过最大边长则缩小）
    let targetWidth = img.naturalWidth;
    let targetHeight = img.naturalHeight;
    const maxDim = COMPRESS_CONFIG.MAX_DIMENSION;
    
    if (targetWidth > maxDim || targetHeight > maxDim) {
      const ratio = Math.min(maxDim / targetWidth, maxDim / targetHeight);
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
      console.log(`[imageCompressor] ${file.name} 尺寸过大，缩小到 ${targetWidth}x${targetHeight}`);
    }
    
    // 创建 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // 绘制图片到 Canvas（可能会缩放）
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.log(`[imageCompressor] ${file.name} 无法获取 Canvas 上下文，跳过压缩`);
      return file;
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    
    // 根据文件类型选择压缩策略
    let outputMimeType: string;
    let quality: number | undefined;
    
    if (isJpeg(file)) {
      // JPEG: 使用 0.92 质量压缩
      outputMimeType = 'image/jpeg';
      quality = COMPRESS_CONFIG.QUALITY;
    } else {
      // PNG: 保持原格式，不使用质量参数
      outputMimeType = 'image/png';
      quality = undefined;
    }
    
    // 转换为 Blob
    const blob = await canvasToBlob(canvas, outputMimeType, quality);
    
    // 如果压缩后更大且没有缩放，返回原文件
    if (blob.size >= file.size && targetWidth === img.naturalWidth && targetHeight === img.naturalHeight) {
      console.log(`[imageCompressor] ${file.name} 压缩后更大，保留原文件: ${formatFileSize(originalSize)}`);
      return file;
    }
    
    // 创建新的 File 对象
    const compressedFile = new File([blob], file.name, {
      type: outputMimeType,
      lastModified: file.lastModified,
    });
    
    const savedSize = originalSize - compressedFile.size;
    const savedPercent = ((savedSize / originalSize) * 100).toFixed(1);
    console.log(`[imageCompressor] ${file.name} 压缩完成: ${formatFileSize(originalSize)} → ${formatFileSize(compressedFile.size)} (节省 ${formatFileSize(savedSize)}, ${savedPercent}%)`);
    
    return compressedFile;
  } catch (error) {
    // 压缩失败时返回原文件
    console.warn(`[imageCompressor] ${file.name} 压缩失败，返回原文件:`, error);
    return file;
  }
}

/**
 * 批量压缩图片
 * 
 * 遍历所有文件调用 compressImage 进行压缩，
 * 计算压缩后的总大小，返回压缩结果。
 * 
 * @param files 原始文件数组
 * @returns 压缩结果，包含 success、files、totalSize
 * 
 * @example
 * const result = await compressImages(fileList);
 * if (result.success) {
 *   console.log('压缩后总大小:', result.totalSize);
 * }
 * 
 * Validates: Requirements 1.2, 1.3, 1.4
 */
export async function compressImages(files: File[]): Promise<CompressResult> {
  console.log(`[imageCompressor] ========== 开始批量压缩 ${files.length} 张图片 ==========`);
  
  // 计算原始总大小
  const originalTotalSize = files.reduce((sum, file) => sum + file.size, 0);
  console.log(`[imageCompressor] 原始总大小: ${formatFileSize(originalTotalSize)}`);
  
  try {
    // 遍历所有文件调用 compressImage
    const compressedFiles = await Promise.all(
      files.map(file => compressImage(file))
    );
    
    // 计算压缩后总大小
    const totalSize = compressedFiles.reduce(
      (sum, file) => sum + file.size,
      0
    );
    
    // 打印总结
    const savedSize = originalTotalSize - totalSize;
    const savedPercent = originalTotalSize > 0 ? ((savedSize / originalTotalSize) * 100).toFixed(1) : '0';
    console.log(`[imageCompressor] ========== 压缩完成 ==========`);
    console.log(`[imageCompressor] 原始总大小: ${formatFileSize(originalTotalSize)}`);
    console.log(`[imageCompressor] 压缩后总大小: ${formatFileSize(totalSize)}`);
    console.log(`[imageCompressor] 节省空间: ${formatFileSize(savedSize)} (${savedPercent}%)`);
    console.log(`[imageCompressor] ================================`);
    
    // 返回 CompressResult
    return {
      success: true,
      files: compressedFiles,
      totalSize,
    };
  } catch (error) {
    // 压缩过程中发生错误
    const errorMessage = error instanceof Error ? error.message : '图片压缩失败';
    console.error(`[imageCompressor] 批量压缩失败:`, error);
    return {
      success: false,
      files: [],
      totalSize: 0,
      error: errorMessage,
    };
  }
}


/**
 * 验证图片数量
 * 
 * 检查图片数量是否在允许范围内（最多 5 张）
 * 
 * @param count 图片数量
 * @returns 是否有效（true 表示数量有效，false 表示超出限制）
 * 
 * @example
 * if (!validateImageCount(files.length)) {
 *   showError('最多支持上传 5 张参考图');
 * }
 * 
 * Validates: Requirements 1.1
 */
export function validateImageCount(count: number): boolean {
  return count <= COMPRESS_CONFIG.MAX_COUNT;
}

/**
 * 验证总大小
 * 
 * 检查图片总大小是否在允许范围内（最大 25MB）
 * 
 * @param totalSize 总大小（字节）
 * @returns 是否有效（true 表示大小有效，false 表示超出限制）
 * 
 * @example
 * const totalSize = files.reduce((sum, f) => sum + f.size, 0);
 * if (!validateTotalSize(totalSize)) {
 *   showError('图片总大小过大，请减少图片数量或选择较小的图片');
 * }
 * 
 * Validates: Requirements 1.5
 */
export function validateTotalSize(totalSize: number): boolean {
  return totalSize <= COMPRESS_CONFIG.MAX_TOTAL_SIZE;
}
