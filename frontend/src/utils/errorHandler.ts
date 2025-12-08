// 错误处理工具

/**
 * 检查是否是 Token 配额耗尽错误
 * 匹配类似: "Token quota exhausted: [sk-xxx***xxx]" 的错误信息
 */
export function isQuotaExhaustedError(error: string): boolean {
  // 匹配 "Token quota exhausted" 或 "token.RemainQuota = 0" 等关键词
  const quotaPatterns = [
    /token\s*quota\s*exhausted/i,
    /RemainQuota\s*=\s*0/i,
    /quota\s*exhausted/i,
    /insufficient\s*quota/i,
    /rate\s*limit/i,
  ];
  
  return quotaPatterns.some(pattern => pattern.test(error));
}

/**
 * 解析 API 错误信息
 * @param error 错误对象或字符串
 * @returns 格式化的错误信息和是否是配额错误
 */
export function parseApiError(error: unknown): { message: string; isQuotaError: boolean } {
  let errorMessage = '';
  
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    // 尝试从对象中提取错误信息
    const errObj = error as Record<string, unknown>;
    if (errObj.error && typeof errObj.error === 'object') {
      const innerError = errObj.error as Record<string, unknown>;
      errorMessage = String(innerError.message || innerError.msg || JSON.stringify(innerError));
    } else {
      errorMessage = String(errObj.message || errObj.error || errObj.msg || JSON.stringify(error));
    }
  }
  
  const isQuotaError = isQuotaExhaustedError(errorMessage);
  
  return {
    message: errorMessage,
    isQuotaError,
  };
}

/**
 * 获取用户友好的错误提示
 */
export function getErrorMessage(error: unknown): { message: string; isQuotaError: boolean } {
  const { message, isQuotaError } = parseApiError(error);
  
  if (isQuotaError) {
    return {
      message: 'API 配额已耗尽，请联系销售更换卡密',
      isQuotaError: true,
    };
  }
  
  return {
    message: message || '生成失败，请稍后重试',
    isQuotaError: false,
  };
}
