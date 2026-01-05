/**
 * 参考图加载工具函数
 * 从 Create.tsx 提取，用于统一处理参考图的解析和加载
 * Requirements: 1.1, 1.4, 1.5
 */

import { loadImageAsFile } from './index';

/**
 * 解析参考图输入为 URL 数组（纯函数，用于测试）
 * Requirements: 1.2
 * 
 * @param refImages - 参考图 URL 数组或 JSON 字符串
 * @returns string[] - URL 数组
 */
export const parseReferenceUrls = (
  refImages: string | string[] | undefined
): string[] => {
  if (!refImages) {
    return [];
  }

  if (Array.isArray(refImages)) {
    return refImages;
  }

  if (typeof refImages === 'string') {
    try {
      const parsed = JSON.parse(refImages);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // 如果不是有效的 JSON，可能是单个 URL
      if (refImages.startsWith('http') || refImages.startsWith('/')) {
        return [refImages];
      }
    }
  }

  return [];
};

/**
 * 统一的参考图加载函数
 * 接收参考图 URL 数组或 JSON 字符串，返回 File 对象数组
 * Requirements: 1.1, 1.2, 1.3
 * 
 * @param refImages - 参考图 URL 数组或 JSON 字符串
 * @returns Promise<File[]> - 加载成功的 File 对象数组
 */
export const loadReferenceFiles = async (
  refImages: string | string[] | undefined
): Promise<File[]> => {
  // 1. 解析输入参数，统一转换为 URL 数组
  const urls = parseReferenceUrls(refImages);

  // 2. 处理空输入
  if (urls.length === 0) {
    return [];
  }

  // 3. 遍历 URL 列表，调用 loadImageAsFile
  const files: File[] = [];
  for (const url of urls) {
    try {
      const file = await loadImageAsFile(url);
      if (file) {
        files.push(file);
      }
    } catch (error) {
      // 4. 错误处理：跳过失败的图片，继续处理其他图片
      console.warn('加载参考图失败，跳过:', url, error);
    }
  }

  return files;
};
