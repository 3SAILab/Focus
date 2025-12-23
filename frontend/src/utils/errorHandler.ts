// 错误处理工具

/**
 * 统一错误消息
 * 只有两种错误提示：
 * 1. 服务器过载 - 可重试
 * 2. 余额不足 - 需要充值
 */
const ERROR_MESSAGES = {
  SERVER_OVERLOAD: '服务器过载请重试，多次失败请联系销售',
  QUOTA_EXHAUSTED: '余额不足请联系销售充值',
};

/**
 * 解析后的错误接口
 */
export interface ParsedError {
  message: string;
  isQuotaError: boolean;
  statusCode?: number;
  userAction: 'contact_sales' | 'retry';
}

/**
 * 配额/余额不足错误检测关键词
 * 注意：不要添加 'exceeded' 单独作为关键词，因为超时错误也包含这个词
 */
const QUOTA_KEYWORDS = [
  'quota',
  'limit',
  'exhausted',
  'insufficient',
  'balance',
  '配额',
  '余额',
  '耗尽',
  '不足',
  'remainquota',
];

/**
 * 配额错误检测正则模式
 * 这些模式更精确，避免误判超时等其他错误
 */
const QUOTA_PATTERNS = [
  /token\s*quota/i,
  /quota\s*(is\s*)?(not\s*enough|exhausted|exceeded)/i,
  /RemainQuota\s*=\s*0/i,
  /insufficient\s*(quota|balance)/i,
  /balance\s*(is\s*)?(not\s*enough|insufficient)/i,
  /limit\s*(is\s*)?(exceeded|reached)/i,
  /rate\s*limit/i,
];

/**
 * 检查是否是余额/配额不足错误
 */
export function isQuotaExhaustedError(error: string): boolean {
  const lowerError = error.toLowerCase();
  
  // 检查关键词
  const hasKeyword = QUOTA_KEYWORDS.some(keyword => 
    lowerError.includes(keyword.toLowerCase())
  );
  
  if (hasKeyword) {
    return true;
  }
  
  // 检查正则模式
  return QUOTA_PATTERNS.some(pattern => pattern.test(error));
}

/**
 * 解析 API 错误信息
 * 统一返回两种错误消息之一：
 * 1. 余额不足 - 需要充值
 * 2. 服务器过载 - 可重试
 */
export function parseApiError(error: unknown, httpStatusCode?: number): ParsedError {
  let rawMessage = '';
  let statusCode = httpStatusCode;
  
  // 提取原始错误消息
  if (typeof error === 'string') {
    rawMessage = error;
  } else if (error instanceof Error) {
    rawMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>;
    
    if (typeof errObj.status_code === 'number') {
      statusCode = errObj.status_code;
    }
    
    if (errObj.error) {
      if (typeof errObj.error === 'string') {
        rawMessage = errObj.error;
      } else if (typeof errObj.error === 'object' && errObj.error !== null) {
        const nested = errObj.error as Record<string, unknown>;
        rawMessage = String(nested.message || nested.msg || '');
      }
    } else {
      rawMessage = String(errObj.message || errObj.msg || '');
    }
  }
  
  // 检查是否是余额不足错误
  const isQuotaError = isQuotaExhaustedError(rawMessage) || statusCode === 401 || statusCode === 403;
  
  if (isQuotaError) {
    return {
      message: ERROR_MESSAGES.QUOTA_EXHAUSTED,
      isQuotaError: true,
      statusCode,
      userAction: 'contact_sales',
    };
  }
  
  // 其他所有错误都显示服务器过载
  return {
    message: ERROR_MESSAGES.SERVER_OVERLOAD,
    isQuotaError: false,
    statusCode,
    userAction: 'retry',
  };
}

/**
 * 获取用户友好的错误提示
 */
export function getErrorMessage(error: unknown, httpStatusCode?: number): ParsedError {
  return parseApiError(error, httpStatusCode);
}
