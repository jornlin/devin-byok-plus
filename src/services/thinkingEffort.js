'use strict';

const THINKING_EFFORT_VALUES = ['', 'low', 'medium', 'high', 'xhigh', 'max'];
const GEMINI_THINKING_LEVELS = ['', 'minimal', 'low', 'medium', 'high'];

const PROVIDER_OPTIONS = {
  claude: [
    ['', '关闭 · 不启用思考'],
    ['low', '低 · budget 5k / adaptive'],
    ['medium', '中 · 推荐平衡'],
    ['high', '高 · 复杂分析/代码'],
    ['xhigh', '极高 · Opus 4.7/4.8'],
    ['max', 'Max · Claude 最深思考']
  ],
  gpt: [
    ['', '关闭 · 不启用 reasoning'],
    ['low', '低 · reasoning.effort=low'],
    ['medium', '中 · reasoning.effort=medium'],
    ['high', '高 · reasoning.effort=high'],
    ['xhigh', '极高 · reasoning.effort=xhigh']
  ],
  gpt56: [
    ['', '关闭 · 不启用 reasoning'],
    ['low', '低 · reasoning.effort=low'],
    ['medium', '中 · reasoning.effort=medium'],
    ['high', '高 · reasoning.effort=high'],
    ['xhigh', '极高 · reasoning.effort=xhigh'],
    ['max', 'Max · GPT-5.6 最深推理']
  ],
  gemini: [
    ['', '默认 · medium（API 默认，不覆盖）'],
    ['minimal', 'Minimal · 最低思考 / 最低延迟'],
    ['low', 'Low · 速度优先'],
    ['medium', 'Medium · 推荐平衡'],
    ['high', 'High · 最深推理']
  ]
};

function normalizeModelName(model) {
  return String(model || '').trim().toLowerCase().replace(/-thinking$/i, '');
}

function detectModelProvider(model) {
  const normalized = normalizeModelName(model);
  if (!normalized) {
    return null;
  }
  if (/^gemini-|^model_google_gemini|^models\/gemini-/.test(normalized)) {
    return 'gemini';
  }
  if (/^gpt-|^o[0-9][a-z0-9.-]*|^chatgpt-|^model_gpt/.test(normalized)) {
    return 'gpt';
  }
  if (/^claude-|^model_claude/.test(normalized)) {
    return 'claude';
  }
  return null;
}

function supportsThinkingIntensity(provider, model) {
  if (!provider) {
    return false;
  }
  const normalized = normalizeModelName(model);
  if (provider === 'claude' || provider === 'gpt') {
    return !!normalized;
  }
  if (provider === 'gemini') {
    return /gemini-/.test(normalized);
  }
  return false;
}

function isGpt56Model(model) {
  return /^gpt-5\.6(?:-|$)/.test(normalizeModelName(model));
}

function getThinkingEffortOptions(provider, model = '') {
  if (provider === 'gpt' && isGpt56Model(model)) {
    return PROVIDER_OPTIONS.gpt56;
  }
  return PROVIDER_OPTIONS[provider] || PROVIDER_OPTIONS.claude;
}

function sanitizeThinkingEffort(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return THINKING_EFFORT_VALUES.includes(normalized) ? normalized : '';
}

function sanitizeGeminiThinkingEffort(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  const legacyMap = {
    xhigh: 'high',
    max: 'high'
  };
  const mapped = legacyMap[normalized] || normalized;
  return GEMINI_THINKING_LEVELS.includes(mapped) ? mapped : '';
}

function sanitizeEffortForProvider(provider, value, model = '') {
  if (provider === 'gemini') {
    return sanitizeGeminiThinkingEffort(value);
  }
  const normalized = String(value ?? '').trim().toLowerCase();
  const legacyMap = provider === 'gpt' && !isGpt56Model(model) ? { max: 'xhigh' } : {};
  const mapped = legacyMap[normalized] || normalized;
  const allowed = new Set(getThinkingEffortOptions(provider, model).map(([v]) => v));
  return allowed.has(mapped) ? mapped : '';
}

function buildThinkingEffortOptionsHtml(model, current) {
  const provider = detectModelProvider(model);
  return buildThinkingEffortOptionsHtmlForProvider(provider, current, model);
}

function buildThinkingEffortOptionsHtmlForProvider(provider, current, model = '') {
  const effort = sanitizeEffortForProvider(provider, current, model);
  const options = provider ? getThinkingEffortOptions(provider, model) : [['', '请先选择模型']];
  return options.map(([value, label]) => {
    const selected = effort === value ? ' selected' : '';
    return `<option value="${value}"${selected}>${label}</option>`;
  }).join('');
}

// 将协议字符串（anthropic/openai/gemini）映射到 thinking-effort provider 键（claude/gpt/gemini）
function protocolToThinkingProvider(protocol) {
  const p = String(protocol || '').toLowerCase();
  if (p === 'anthropic') return 'claude';
  if (p === 'openai') return 'gpt';
  if (p === 'gemini') return 'gemini';
  return null;
}

function getThinkingIntensityHint(provider) {
  if (provider === 'gpt') {
    return 'GPT · reasoning.effort';
  }
  if (provider === 'gemini') {
    return 'Gemini 3.5 Flash · thinking_level';
  }
  if (provider === 'claude') {
    return 'Claude · adaptive / budget_tokens';
  }
  return '思考强度';
}

module.exports = {
  THINKING_EFFORT_VALUES,
  GEMINI_THINKING_LEVELS,
  detectModelProvider,
  supportsThinkingIntensity,
  getThinkingEffortOptions,
  isGpt56Model,
  sanitizeThinkingEffort,
  sanitizeGeminiThinkingEffort,
  sanitizeEffortForProvider,
  buildThinkingEffortOptionsHtml,
  buildThinkingEffortOptionsHtmlForProvider,
  protocolToThinkingProvider,
  getThinkingIntensityHint
};
