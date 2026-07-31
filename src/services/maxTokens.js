/**
 * 最大 Token（max_tokens）预设与显示格式化
 *
 * 注意：MAX_TOKENS 对应 API 请求体的 `max_tokens`，即**单次输出上限**，
 * 不是上下文窗口。主流模型的输出上限在 8K–64K 量级（Claude 4 系列约 32K–64K，
 * GPT-5 系列约 64K–128K），远小于其 200K–1M 的上下文窗口。
 *
 * 这个区分很关键：若 max_tokens 超过模型经中转网关的实际输出上限，
 * 生成会被**确定性截断**——表现为 SSE 在 input_json_delta 累积到某固定字节数
 * 后断流、工具参数 JSON 不完整、重试同一请求无效。历史上 commit 0d9cc4a
 * 把默认值从 32768 误改为 64000 就触发过此问题（claude-opus 经 Bedrock/Sub2API
 * 中转的输出上限约 32K）。故 32K 标为推荐值，更高档位附带提示。
 */

'use strict';

/** 绝对边界：低于 1 无意义；上限给足以容纳未来模型，但不鼓励 */
const MIN_MAX_TOKENS = 1;
const MAX_MAX_TOKENS = 1048576;

/** 默认值：与 proxy 侧 models.js / chat.js 的兜底保持一致 */
const DEFAULT_MAX_TOKENS = 32768;

/**
 * 预设档位。value 为实际写入的数字，label 为下拉显示文本。
 * 仅覆盖真实可用的输出上限区间；超出常见范围的走「自定义」。
 */
const MAX_TOKENS_PRESETS = [
  { value: 4096, label: '4K · 4096' },
  { value: 8192, label: '8K · 8192' },
  { value: 16384, label: '16K · 16384' },
  { value: 32768, label: '32K · 32768（推荐）' },
  { value: 65536, label: '64K · 65536' },
  { value: 131072, label: '128K · 131072' },
];

/** 超过此值时提示可能超出模型输出上限 */
const SAFE_MAX_TOKENS_HINT_THRESHOLD = 65536;

/**
 * 把 token 数格式化成紧凑可读的形式，用于列表/摘要等空间受限处。
 *   32768   → 32K
 *   65536   → 64K
 *   100000  → 100K
 *   1048576 → 1M
 *   1500000 → 1.5M
 *   999     → 999
 * 非整数或非正数返回空串（调用方据此决定是否显示）。
 * @param {*} value
 * @returns {string}
 */
function formatTokens(value) {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    return '';
  }
  // 优先按 1024 进制（32768→32K）；若不整除但按 1000 进制是整数（100000→100K），
  // 则用后者 —— 用户手填的整数通常是十进制口径，显示成 97.7K 反而难认
  const pick = (base, unit) => {
    const b = n / base;
    if (Number.isInteger(b)) {
      return String(b) + unit;
    }
    const d = n / (base === 1048576 ? 1000000 : 1000);
    if (Number.isInteger(d)) {
      return String(d) + unit;
    }
    return b.toFixed(1).replace(/\.0$/, '') + unit;
  };
  if (n >= 1000000) {
    return pick(1048576, 'M');
  }
  if (n >= 1000) {
    return pick(1024, 'K');
  }
  return String(n);
}

/**
 * 清洗为合法的 max_tokens 整数；非法值回落到 fallback。
 * @param {*} value
 * @param {number} [fallback]
 * @returns {number}
 */
function sanitizeMaxTokens(value, fallback = DEFAULT_MAX_TOKENS) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(n) || n < MIN_MAX_TOKENS) {
    return fallback;
  }
  return Math.min(n, MAX_MAX_TOKENS);
}

/**
 * 判断某值是否命中预设档位（决定下拉选中项还是「自定义」）。
 * @param {*} value
 * @returns {boolean}
 */
function isPresetMaxTokens(value) {
  const n = sanitizeMaxTokens(value, -1);
  return MAX_TOKENS_PRESETS.some((p) => p.value === n);
}

module.exports = {
  MIN_MAX_TOKENS,
  MAX_MAX_TOKENS,
  DEFAULT_MAX_TOKENS,
  MAX_TOKENS_PRESETS,
  SAFE_MAX_TOKENS_HINT_THRESHOLD,
  formatTokens,
  sanitizeMaxTokens,
  isPresetMaxTokens,
};
