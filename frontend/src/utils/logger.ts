// src/utils/logger.ts
// 生产环境日志控制

// 检测是否为生产环境
const isProduction = import.meta.env.PROD;

// 开发环境日志函数
export const devLog = (...args: unknown[]) => {
  if (!isProduction) {
    console.log(...args);
  }
};

export const devWarn = (...args: unknown[]) => {
  if (!isProduction) {
    console.warn(...args);
  }
};

export const devError = (...args: unknown[]) => {
  if (!isProduction) {
    console.error(...args);
  }
};

// 导出生产环境检测
export const isProd = isProduction;
