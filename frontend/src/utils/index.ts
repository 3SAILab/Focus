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
  } catch (e) {
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
  } catch (e) {
    return dateString;
  }
}

/**
 * 下载图片
 */
export async function downloadImage(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    const fileName = url.split('/').pop() || 'ai_image.png';
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('下载失败:', error);
    throw new Error('下载失败，请稍后重试');
  }
}

/**
 * 从 URL 加载图片为 File 对象
 */
export async function loadImageAsFile(url: string): Promise<File | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const fileName = url.split('/').pop() || 'ref_image.png';
    return new File([blob], fileName, { type: blob.type });
  } catch (error) {
    console.error('加载图片失败:', error);
    return null;
  }
}

