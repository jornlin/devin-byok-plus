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

/* ──────────────────────────────────────────────────────────────
 * 上下文窗口（CONTEXT_WINDOW）—— 与上面的输出上限是两件事
 *
 * 它只影响 Devin 界面：写入 ClientModelConfig.max_tokens(field 18)。
 * 注意该字段名叫 max_tokens，但 Devin 的语义是**上下文窗口**：
 *   - 模型卡片渲染为 `${format(maxTokens)} context`
 *   - 对话框上下文进度条把它当 contextLimit（用量百分比的分母）
 * 真正的输出上限在 ModelInfo.max_output_tokens(f13)，与
 * ModelInfo.max_tokens(f4，同为上下文) 并列 —— 同名不同义，极易取错。
 *
 * 所以：MAX_TOKENS 发往上游 API 控制生成长度；CONTEXT_WINDOW 仅供 Devin 显示额度。
 * ────────────────────────────────────────────────────────────── */

/** 默认上下文窗口：取当前主流模型的常见值 */
const DEFAULT_CONTEXT_WINDOW = 200000;

/** 上下文窗口上限：给足以容纳未来模型 */
const MAX_CONTEXT_WINDOW = 10000000;

/** 上下文窗口预设档位（十进制口径，与厂商宣传口径一致） */
const CONTEXT_WINDOW_PRESETS = [
  { value: 128000, label: '128K · 128000' },
  { value: 200000, label: '200K · 200000（推荐）' },
  { value: 256000, label: '256K · 256000' },
  { value: 512000, label: '512K · 512000' },
  { value: 1000000, label: '1M · 1000000' },
];

/**
 * 清洗为合法的上下文窗口整数。
 * @param {*} value
 * @param {number} [fallback]
 * @returns {number}
 */
function sanitizeContextWindow(value, fallback = DEFAULT_CONTEXT_WINDOW) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(n) || n < MIN_MAX_TOKENS) {
    return fallback;
  }
  return Math.min(n, MAX_CONTEXT_WINDOW);
}

/**
 * 判断某值是否命中上下文窗口预设档位。
 * @param {*} value
 * @returns {boolean}
 */
function isPresetContextWindow(value) {
  const n = sanitizeContextWindow(value, -1);
  return CONTEXT_WINDOW_PRESETS.some((p) => p.value === n);
}

/**
 * 上下文窗口的显示格式化 —— 固定用十进制口径。
 * 厂商宣传的「200K 上下文」指 200000，用 1024 制会显示成 195K，与用户认知不符；
 * 而输出上限（max_tokens）是 2 的幂（32768→32K），故两者用不同的格式化函数。
 *   128000  → 128K
 *   200000  → 200K
 *   1000000 → 1M
 *   1048576 → 1M（1024 制的整数也归到 1M）
 * @param {*} value
 * @returns {string}
 */
function formatContextWindow(value) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(n) || n <= 0) {
    return '';
  }
  const trim = (x) => String(Number(x.toFixed(1))).replace(/\.0$/, '');
  if (n >= 1000000) {
    return trim(n / 1000000) + 'M';
  }
  if (n >= 1000) {
    return trim(n / 1000) + 'K';
  }
  return String(n);
}

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
  // 上下文窗口（仅影响 Devin 界面显示的额度）
  DEFAULT_CONTEXT_WINDOW,
  MAX_CONTEXT_WINDOW,
  CONTEXT_WINDOW_PRESETS,
  sanitizeContextWindow,
  isPresetContextWindow,
  formatContextWindow,
};
