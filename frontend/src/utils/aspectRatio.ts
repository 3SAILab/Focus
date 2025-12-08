// 通用宽高比匹配工具

// 支持的宽高比列表
export const ASPECT_RATIOS = [
  { label: '1:1', value: '1:1', ratio: 1 },
  { label: '16:9', value: '16:9', ratio: 16 / 9 },
  { label: '9:16', value: '9:16', ratio: 9 / 16 },
  { label: '4:3', value: '4:3', ratio: 4 / 3 },
  { label: '3:4', value: '3:4', ratio: 3 / 4 },
  { label: '3:2', value: '3:2', ratio: 3 / 2 },
  { label: '2:3', value: '2:3', ratio: 2 / 3 },
  { label: '21:9', value: '21:9', ratio: 21 / 9 },
];

/**
 * 根据图片宽高找到最接近的预设宽高比
 * @param width 图片宽度
 * @param height 图片高度
 * @returns 最接近的宽高比值（如 "16:9"）
 */
export function findClosestAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    return '1:1';
  }

  const imageRatio = width / height;
  let closestRatio = ASPECT_RATIOS[0];
  let minDiff = Math.abs(imageRatio - closestRatio.ratio);

  for (const ar of ASPECT_RATIOS) {
    const diff = Math.abs(imageRatio - ar.ratio);
    if (diff < minDiff) {
      minDiff = diff;
      closestRatio = ar;
    }
  }

  return closestRatio.value;
}

/**
 * 从图片文件获取宽高比
 * @param file 图片文件
 * @returns Promise<string> 最接近的宽高比值
 */
export function getImageAspectRatio(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(findClosestAspectRatio(img.width, img.height));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('1:1'); // 默认返回 1:1
    };

    img.src = url;
  });
}

/**
 * 从图片 URL 获取宽高比
 * @param url 图片 URL
 * @returns Promise<string> 最接近的宽高比值
 */
export function getImageAspectRatioFromUrl(url: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      resolve(findClosestAspectRatio(img.width, img.height));
    };

    img.onerror = () => {
      resolve('1:1');
    };

    img.src = url;
  });
}
