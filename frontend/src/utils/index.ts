// 工具函数

/**
 * 转义 URL 中的单引号，用于 onclick 等场景
 */
export function escapeUrl(url: string): string {
  return url.replace(/'/g, "\\'");
}

/**
 * 转义 HTML 特殊字符
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 格式化时间
 */
export function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * 格式化日期（用于显示）
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dateStr = date.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    if (dateStr === todayStr) {
      return '今天';
    } else if (dateStr === yesterdayStr) {
      return '昨天';
    } else {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    }
  } catch {
    return dateString;
  }
}

/**
 * 下载图片
 * @returns Promise<boolean> 返回 true 表示保存成功，false 表示用户取消
 */
export async function downloadImage(url: string): Promise<boolean> {
  try {
    // 从 URL 提取文件名，如果没有则使用默认的 jpg 格式
    let fileName = url.split('/').pop() || `image_${Date.now()}.jpg`;
    // 如果文件名是 png 格式，改为 jpg
    if (fileName.endsWith('.png')) {
      fileName = fileName.replace('.png', '.jpg');
    }
    
    // 检查是否在 Electron 环境中
    if (window.electronAPI?.saveImage) {
      // 使用 Electron 的保存对话框
      const result = await window.electronAPI.saveImage(url, fileName);
      
      if (result.canceled) {
        // 用户取消了保存
        return false;
      }
      
      if (!result.success) {
        throw new Error(result.error || '保存失败');
      }
      
      return true;
    } else {
      // 浏览器环境，使用传统下载方式
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(blobUrl);
      return true;
    }
  } catch (error) {
    console.error('下载失败:', error);
    throw new Error('保存失败，请稍后重试');
  }
}

/**
 * 从 URL 加载图片为 File 对象
 * 支持 HTTP/HTTPS URL 和 base64 data URL
 */
export async function loadImageAsFile(url: string): Promise<File | null> {
  try {
    // 处理 base64 data URL
    if (url.startsWith('data:')) {
      console.log('[loadImageAsFile] 检测到 base64 图片');
      // 从 data URL 中提取 MIME 类型和 base64 数据
      const matches = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        console.error('[loadImageAsFile] 无效的 base64 格式');
        return null;
      }
      
      const mimeType = matches[1];
      const base64Data = matches[2];
      
      // 将 base64 转换为 Blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      // 根据 MIME 类型生成文件名
      const extension = mimeType.split('/')[1] || 'jpg';
      const fileName = `ref_${Date.now()}.${extension}`;
      
      console.log('[loadImageAsFile] base64 图片转换成功:', fileName, blob.size, 'bytes');
      return new File([blob], fileName, { type: mimeType });
    }
    
    // 处理普通 HTTP/HTTPS URL
    console.log('[loadImageAsFile] 加载 HTTP 图片:', url);
    const response = await fetch(url);
    const blob = await response.blob();
    const fileName = url.split('/').pop() || 'ref_image.jpg';
    console.log('[loadImageAsFile] HTTP 图片加载成功:', fileName, blob.size, 'bytes');
    return new File([blob], fileName, { type: blob.type });
  } catch (error) {
    console.error('[loadImageAsFile] 加载图片失败:', error);
    return null;
  }
}

