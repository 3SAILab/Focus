// 错误处理工具

/**
 * 统一错误消息
 * 错误提示类型：
 * 1. 网络错误 - 可重试
 * 2. 图片数量超限 - 减少图片
 * 3. 图片大小超限 - 减少图片或选择较小图片
 * 4. AI 无图片 - 修改提示词
 * 5. 余额不足 - 需要充值
 * 6. 服务器过载 - 可重试（兜底）
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络出了点小差，请稍后重试',
  IMAGE_COUNT_EXCEEDED: '最多支持上传 5 张参考图',
  IMAGE_SIZE_EXCEEDED: '图片总大小过大，请减少图片数量或选择较小的图片',
  NO_IMAGE_RETURNED: '未能生成图片，请尝试修改提示词后重试',
  QUOTA_EXHAUSTED: '余额不足请联系销售充值',
  SERVER_OVERLOAD: '网络出了点小差，请稍后重试',  // 兜底错误也用网络提示
};

/**
 * 用户操作建议
 */
export type UserAction = 
  | 'retry'           // 重试
  | 'edit_prompt'     // 修改提示词
  | 'reduce_images'   // 减少图片
  | 'contact_sales';  // 联系销售

/**
 * 解析后的错误接口（扩展）
 */
export interface ParsedError {
  message: string;
  isQuotaError: boolean;
  isNoImageError: boolean;
  statusCode?: number;
  userAction: UserAction;
  suggestEdit?: boolean;  // 是否建议修改提示词
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
  '用尽',      // 新增：该令牌额度已用尽
  '额度',      // 新增：该令牌额度已用尽
  'remainquota',
  'invalid token',   // 新增：You have used invalid tokens / Invalid token
  '无效令牌',   // 新增：您多次使用无效令牌
  '无效的令牌', // 新增：API 返回 message_zh: "无效的令牌"
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
  /invalid\s+token/i,
];

/**
 * 网络超时/连接错误检测关键词
 */
const NETWORK_ERROR_KEYWORDS = [
  'timeout',
  'timed out',
  'network',
  'econnrefused',
  'econnreset',
  'enotfound',
  'etimedout',
  'socket hang up',
  'connection refused',
  'connection reset',
  'network error',
  '网络',
  '超时',
  '连接失败',
  '连接超时',
  '请求超时',
];

/**
 * 检查是否是网络超时/连接错误
 */
export function isNetworkError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return NETWORK_ERROR_KEYWORDS.some(keyword => 
    lowerError.includes(keyword.toLowerCase())
  );
}

/**
 * 检查是否是"未返回图片"错误
 */
export function isNoImageError(error: string): boolean {
  return error.includes('请求成功但未返回图片') || 
         error.includes('未找到图片数据') ||
         error.includes('未能生成图片');
}

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
 * 错误检测顺序：
 * 1. 余额不足 - 需要充值 (userAction: 'contact_sales')
 * 2. 未返回图片 - 修改提示词 (userAction: 'edit_prompt', suggestEdit: true)
 * 3. 网络超时/连接错误 - 可重试 (userAction: 'retry')
 * 4. 服务器过载 - 可重试（兜底）(userAction: 'retry')
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
  const quotaError = isQuotaExhaustedError(rawMessage) || statusCode === 401 || statusCode === 403;
  
  if (quotaError) {
    return {
      message: ERROR_MESSAGES.QUOTA_EXHAUSTED,
      isQuotaError: true,
      isNoImageError: false,
      statusCode,
      userAction: 'contact_sales',
      suggestEdit: false,
    };
  }
  
  // 检查是否是"未返回图片"错误
  const noImageErr = isNoImageError(rawMessage);
  if (noImageErr) {
    return {
      message: ERROR_MESSAGES.NO_IMAGE_RETURNED,
      isQuotaError: false,
      isNoImageError: true,
      statusCode,
      userAction: 'edit_prompt',
      suggestEdit: true,  // AI 未返回图片时建议修改提示词
    };
  }
  
  // 检查是否是网络超时/连接错误
  const networkErr = isNetworkError(rawMessage);
  if (networkErr) {
    return {
      message: ERROR_MESSAGES.NETWORK_ERROR,
      isQuotaError: false,
      isNoImageError: false,
      statusCode,
      userAction: 'retry',
      suggestEdit: false,
    };
  }
  
  // 其他所有错误都显示服务器过载
  return {
    message: ERROR_MESSAGES.SERVER_OVERLOAD,
    isQuotaError: false,
    isNoImageError: false,
    statusCode,
    userAction: 'retry',
    suggestEdit: false,
  };
}

/**
 * 获取用户友好的错误提示
 */
export function getErrorMessage(error: unknown, httpStatusCode?: number): ParsedError {
  return parseApiError(error, httpStatusCode);
}
