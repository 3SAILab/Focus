// 错误处理工具

/**
 * 解析后的错误接口
 */
export interface ParsedError {
  message: string;
  isQuotaError: boolean;
  statusCode?: number;
  userAction: 'contact_sales' | 'reduce_images' | 'retry_later' | 'retry';
}

/**
 * 配额错误检测关键词
 * 包含英文和中文关键词以支持多语言错误消息
 */
const QUOTA_KEYWORDS = [
  'quota',
  'limit',
  'exceeded',
  'exhausted',
  'insufficient',
  'rate limit',
  '配额',
  '耗尽',
  'remainquota',
];

/**
 * 配额错误检测正则模式
 * 用于更精确的模式匹配
 */
const QUOTA_PATTERNS = [
  /token\s*quota\s*exhausted/i,
  /RemainQuota\s*=\s*0/i,
  /quota\s*exhausted/i,
  /insufficient\s*quota/i,
  /rate\s*limit/i,
];

/**
 * 过滤错误信息（后端已处理敏感词，这里做二次保护）
 */
function filterSensitiveInfo(message: string): string {
  // 后端已经过滤了敏感信息，这里只做基本检查
  if (!message || message.trim() === '') {
    return '服务请求失败，请稍后重试';
  }
  return message;
}

/**
 * 根据 HTTP 状态码获取用户友好的错误提示
 */
export function getErrorByStatusCode(statusCode: number): { message: string; userAction: ParsedError['userAction'] } {
  switch (statusCode) {
    case 400:
      return { message: '请求格式错误，请联系销售获取帮助', userAction: 'contact_sales' };
    case 401:
      return { message: 'API 密钥验证失败，请联系销售更换卡密', userAction: 'contact_sales' };
    case 403:
      return { message: '权限或余额不足，请联系销售获取帮助', userAction: 'contact_sales' };
    case 404:
      return { message: '服务暂时不可用，请联系销售获取帮助', userAction: 'contact_sales' };
    case 413:
      return { message: '发送的图片太多，请减少图片数量后重试', userAction: 'reduce_images' };
    case 429:
      return { message: '429服务器负载异常，不会消耗次数，请重试，多次出现请联系销售获取帮助', userAction: 'retry_later' };
    case 500:
      return { message: '500服务器负载异常，不会消耗次数，请重试，多次出现请联系销售获取帮助', userAction: 'retry' };
    case 503:
      return { message: '服务暂时不可用，请联系销售获取帮助', userAction: 'contact_sales' };
    default:
      return { message: '操作失败，请稍后重试', userAction: 'retry' };
  }
}

/**
 * 检查是否是 Token 配额耗尽错误
 * 匹配类似: "Token quota exhausted: [sk-xxx***xxx]" 的错误信息
 */
export function isQuotaExhaustedError(error: string): boolean {
  const lowerError = error.toLowerCase();
  
  // 先检查关键词
  const hasKeyword = QUOTA_KEYWORDS.some(keyword => 
    lowerError.includes(keyword.toLowerCase())
  );
  
  if (hasKeyword) {
    return true;
  }
  
  // 再检查正则模式
  return QUOTA_PATTERNS.some(pattern => pattern.test(error));
}

/**
 * 解析 API 错误信息
 * 支持多种嵌套错误格式：
 * - 字符串: "error message"
 * - Error 对象: new Error("message")
 * - 简单对象: { message: "..." } 或 { error: "..." }
 * - 嵌套对象: { error: { message: "..." } }
 * - 带状态码: { error: "...", status_code: 400 }
 * 
 * @param error 错误对象或字符串
 * @param httpStatusCode 可选的 HTTP 状态码（从响应中获取）
 * @returns ParsedError 包含格式化的错误信息和是否是配额错误
 */
export function parseApiError(error: unknown, httpStatusCode?: number): ParsedError {
  const defaultMessage = '操作失败';
  let message = defaultMessage;
  let statusCode = httpStatusCode;
  
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    
    // 提取状态码（如果存在）
    if (typeof errObj.status_code === 'number') {
      statusCode = errObj.status_code;
    }
    
    // 处理嵌套的 error 对象: { error: { message: "..." } }
    if (errObj.error) {
      if (typeof errObj.error === 'string') {
        message = errObj.error;
      } else if (typeof errObj.error === 'object' && errObj.error !== null) {
        const nested = errObj.error as Record<string, unknown>;
        message = String(nested.message || nested.msg || JSON.stringify(errObj.error));
      }
    } else {
      // 处理简单对象: { message: "..." } 或 { msg: "..." }
      message = String(errObj.message || errObj.msg || JSON.stringify(error));
    }
  }
  
  // Ensure we always return a non-empty message
  if (!message || message.trim() === '') {
    message = defaultMessage;
  }
  
  const isQuotaError = isQuotaExhaustedError(message);
  
  // 如果有状态码，根据状态码返回用户友好的提示
  if (statusCode && statusCode !== 200) {
    const { message: statusMessage, userAction } = getErrorByStatusCode(statusCode);
    return {
      message: statusMessage,
      isQuotaError: isQuotaError || statusCode === 401,
      statusCode,
      userAction,
    };
  }
  
  // 如果是配额错误
  if (isQuotaError) {
    return {
      message: 'API 配额已耗尽，请联系销售更换卡密',
      isQuotaError: true,
      statusCode,
      userAction: 'contact_sales',
    };
  }
  
  // 过滤敏感信息后返回
  return {
    message: filterSensitiveInfo(message),
    isQuotaError: false,
    statusCode,
    userAction: 'retry',
  };
}

/**
 * 获取用户友好的错误提示
 * @param error 错误对象或字符串
 * @param httpStatusCode 可选的 HTTP 状态码（从响应中获取）
 */
export function getErrorMessage(error: unknown, httpStatusCode?: number): ParsedError {
  const parsed = parseApiError(error, httpStatusCode);
  
  return {
    message: parsed.message || '生成失败，请稍后重试',
    isQuotaError: parsed.isQuotaError,
    statusCode: parsed.statusCode,
    userAction: parsed.userAction,
  };
}
