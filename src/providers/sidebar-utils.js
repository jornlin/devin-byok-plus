'use strict';

/**
 * Sidebar 纯工具函数
 *
 * 从 sidebarProvider.js 抽离的无状态辅助函数（不依赖 this / 实例状态）。
 * 实现与原 Provider 内方法逐字保持一致，保证行为不变。
 */

/**
 * 脱敏密钥：保留首尾片段并标注长度
 */
function redactSecret(value) {
  const s = String(value || '').trim();
  if (!s) {
    return '';
  }
  if (s.length <= 8) {
    return s.slice(0, 2) + '***(' + s.length + ')';
  }
  return s.slice(0, 4) + '...' + s.slice(-4) + '(' + s.length + ')';
}

/**
 * Unix shell 单引号转义
 */
function shellQuote(arg) {
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/**
 * 校验端口值（空值视为合法，交由默认值处理）
 */
function isValidPortValue(value) {
  if (!value) {
    return true;
  }
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 && n <= 65535;
}

/**
 * 校验完成超时（毫秒，2000~60000；空值视为合法）
 */
function isValidCompletionTimeoutValue(value) {
  if (!value) {
    return true;
  }
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 2000 && n <= 60000;
}

/**
 * 构造环境检查项
 */
function envCheckItem(id, name, status, detail, fixable) {
  return { id, name, status, detail, fixable };
}

/**
 * 诊断报告：JSON 代码块
 */
function jsonBlock(obj) {
  return '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
}

/**
 * 诊断报告：文本代码块
 */
function textBlock(text) {
  return '```text\n' + (text || '无') + '\n```';
}

module.exports = {
  redactSecret,
  shellQuote,
  isValidPortValue,
  isValidCompletionTimeoutValue,
  envCheckItem,
  jsonBlock,
  textBlock,
};
