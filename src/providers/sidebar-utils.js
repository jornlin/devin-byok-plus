/**
 * Sidebar UI 工具函数
 * 处理 HTML 转义、格式化等
 */

'use strict';

/**
 * HTML 转义
 */
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 格式化运行时长
 */
function formatUptime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return seconds + 's';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes + 'm';
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours + 'h' + remainingMinutes + 'm';
}

/**
 * 生成 WebView nonce（用于 CSP）
 */
function getWebviewNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Shell 参数转义
 */
function shellQuote(arg) {
  if (process.platform === 'win32') {
    // Windows: 使用双引号并转义特殊字符
    return '"' + String(arg).replace(/"/g, '""') + '"';
  }
  // Unix/Linux/macOS: 使用单引号
  return "'" + String(arg).replace(/'/g, "'\\''") + "'";
}

/**
 * 脱敏敏感信息
 */
function redactSecret(str) {
  const s = String(str || '');
  if (!s) return '';
  if (s.length <= 8) return '***';
  return s.substring(0, 4) + '***' + s.substring(s.length - 4);
}

/**
 * 验证端口号
 */
function isValidPort(port) {
  const num = Number(port);
  return Number.isInteger(num) && num >= 1 && num <= 65535;
}

/**
 * 验证超时时间
 */
function isValidTimeout(timeout) {
  const num = Number(timeout);
  return Number.isInteger(num) && num >= 1000 && num <= 600000;
}

/**
 * 生成诊断报告的 JSON 块
 */
function jsonBlock(obj) {
  return '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
}

/**
 * 生成诊断报告的文本块
 */
function textBlock(text) {
  return '```\n' + String(text || '') + '\n```';
}

module.exports = {
  escapeHtml,
  formatUptime,
  getWebviewNonce,
  shellQuote,
  redactSecret,
  isValidPort,
  isValidTimeout,
  jsonBlock,
  textBlock,
};
