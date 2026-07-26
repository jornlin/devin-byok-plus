'use strict';

/**
 * 诊断原语：探测响应分类器 + 诊断模型路由解析 + 无状态分析/文本处理
 *
 * 从 sidebarProvider.js 抽离的纯函数（字符串分析 + 常量查表 + 文件读取，无 this 实例状态）。
 * 重 I/O 编排（checkManagedEnvironment / createDiagnosticReport 等）仍保留在 Provider。
 * 实现逐字保留，保证行为不变。
 */

const fs = require('fs');
const { envCheckItem, redactSecret } = require('../providers/sidebar-utils');

const DIAGNOSTIC_OPENAI_PREFIXES = ['gpt-', 'MODEL_GPT'];

const DIAGNOSTIC_MODEL_MAP = {
  'gpt-5-4-low': 'gpt-5.4',
  'gpt-5-4-high': 'gpt-5.4',
  'gpt-5-4-xhigh': 'gpt-5.4',
  'gpt-5-4-xhigh-priority': 'gpt-5.4',
  MODEL_GPT_4O: 'gpt-4o',
  MODEL_GPT_4O_MINI: 'gpt-4o-mini',
  MODEL_CLAUDE_3_5_SONNET: 'claude-sonnet-4-20250514',
  MODEL_CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-20241022',
  MODEL_CLAUDE_3_OPUS: '__DEFAULT__',
  MODEL_CLAUDE_4_OPUS: '__DEFAULT__',
  MODEL_CLAUDE_4_OPUS_BYOK: '__DEFAULT__',
  MODEL_CLAUDE_4_OPUS_THINKING_BYOK: '__DEFAULT__',
  MODEL_CLAUDE_4_SONNET_BYOK: '__DEFAULT__',
  MODEL_CLAUDE_4_SONNET_THINKING_BYOK: '__DEFAULT__',
  MODEL_CLAUDE_OPUS_4: '__DEFAULT__',
  MODEL_CLAUDE_OPUS_4_1: '__DEFAULT__',
  MODEL_CLAUDE_SONNET_4: 'claude-sonnet-4-20250514',
  MODEL_SWE_1: 'claude-sonnet-4-20250514',
  MODEL_SWE_1_5: 'claude-sonnet-4-20250514',
  MODEL_SWE_1_5_SLOW: 'claude-sonnet-4-20250514',
  MODEL_CHAT_11121: '__DEFAULT__',
  'claude-opus-4-6-thinking': 'claude-opus-4-6-thinking',
  'claude-opus-4-7-thinking': 'claude-opus-4-7-thinking',
  'claude-opus-4-8-thinking': 'claude-opus-4-8-thinking',
  'claude-opus-4-6': 'claude-opus-4-6',
  'claude-opus-4-7': 'claude-opus-4-7',
  'claude-opus-4-8': 'claude-opus-4-8',
  'claude-sonnet-4-6-thinking': 'claude-sonnet-4-20250514-thinking',
  MODEL_GOOGLE_GEMINI_2_5_FLASH: '__DEFAULT__',
  MODEL_GOOGLE_GEMINI_2_5_PRO: '__DEFAULT__',
  MODEL_CHAT: '__DEFAULT__',
};

/**
 * 解析探测响应体，提取错误类型/消息摘要
 */
function classifyProbeBody(body) {
  const s = String(body || '').trim();
  if (!s) {
    return '无响应体';
  }
  const dataLine = s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith('data:') && !/^data:\s*\[DONE\]/i.test(l));
  const payload = (dataLine ? dataLine.replace(/^data:\s*/i, '') : s).trim();
  try {
    const obj = JSON.parse(payload);
    const err = obj?.error || obj;
    const code = err?.type || err?.code || obj?.code || '';
    const msg = err?.message || obj?.message || obj?.error_description || '';
    const combined = [code, msg].filter(Boolean).join('：');
    if (combined) {
      return combined.slice(0, 360);
    }
  } catch {}
  return s.replace(/\s+/g, ' ').slice(0, 360);
}

/**
 * 将 HTTP 状态码归类为诊断说明
 */
function classifyProbeHttpStatus(status, body) {
  const code = status || 0;
  const detail = classifyProbeBody(body);
  if (code === 400) {
    return 'HTTP 400 请求格式/模型参数错误：' + detail;
  }
  if (code === 401) {
    return 'HTTP 401 鉴权失败，API Key 无效或已过期：' + detail;
  }
  if (code === 403 || code === 404) {
    return 'HTTP ' + code + ' 模型无权限、不可用或不存在：' + detail;
  }
  if (code === 408 || code === 504) {
    return 'HTTP ' + code + ' 上游超时：' + detail;
  }
  if (code === 429) {
    return 'HTTP 429 额度/限流/并发限制：' + detail;
  }
  if (code >= 500) {
    return 'HTTP ' + code + ' 上游服务错误：' + detail;
  }
  return 'HTTP ' + code + ': ' + detail;
}

/**
 * 识别 HTTP 200 下的 SSE 错误事件
 */
function classifyProbeSseError(text) {
  if (!/event:\s*error|data:\s*\{[^\n]*(error|message)/i.test(text)) {
    return undefined;
  }
  const detail = classifyProbeBody(text);
  if (/auth|api.?key|unauthor|invalid.?key/i.test(detail)) {
    return 'HTTP 200 SSE 错误：鉴权失败：' + detail;
  }
  if (/permission|not.?found|model|access/i.test(detail)) {
    return 'HTTP 200 SSE 错误：模型权限/模型不存在：' + detail;
  }
  if (/rate|quota|credit|limit|insufficient/i.test(detail)) {
    return 'HTTP 200 SSE 错误：额度/限流：' + detail;
  }
  return 'HTTP 200 SSE 错误：' + detail;
}

/**
 * 归类网络层错误
 */
function classifyProbeNetworkError(err) {
  const code = String(err.code || '').toUpperCase();
  const msg = err.message || String(err);
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) {
    return 'DNS 解析失败：' + msg;
  }
  if (['ECONNREFUSED', 'ECONNRESET', 'EPIPE'].includes(code)) {
    return '连接失败/被重置：' + msg;
  }
  if (['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(code)) {
    return '网络连接超时：' + msg;
  }
  if (/certificate|tls|ssl|self signed|unable to verify/i.test(msg)) {
    return 'TLS/证书错误：' + msg;
  }
  if (code) {
    return code + ': ' + msg;
  }
  return msg;
}

/**
 * 去除模型名的 -thinking 后缀
 */
function stripDiagnosticThinkingSuffix(model) {
  return String(model || '')
    .trim()
    .replace(/-thinking$/i, '');
}

/**
 * 判断是否为诊断用 OpenAI 模型
 */
function isDiagnosticOpenAIModel(model) {
  const base = stripDiagnosticThinkingSuffix(model);
  return DIAGNOSTIC_OPENAI_PREFIXES.some((p) => base.startsWith(p));
}

/**
 * 解析诊断模型路由：将请求模型映射到上游模型与 provider
 */
function resolveDiagnosticModelRoute(requested, config) {
  const req = String(requested || '').trim();
  const defaultModel = String(config.DEFAULT_MODEL || '').trim();
  const mapped = DIAGNOSTIC_MODEL_MAP[req];
  const resolved =
    mapped === '__DEFAULT__'
      ? defaultModel
      : mapped || defaultModel || (req && !req.startsWith('MODEL_') ? req : '');
  const upstream = stripDiagnosticThinkingSuffix(resolved);
  const provider = upstream ? (isDiagnosticOpenAIModel(upstream) ? 'OpenAI' : 'Anthropic') : '未解析';
  
  // serviceTier 逻辑：模型后缀 -priority 或从配置读取
  let serviceTier = undefined;
  if (req.endsWith('-priority') || resolved.endsWith('-priority')) {
    serviceTier = 'fast';
  } else if (req === 'MODEL_CLAUDE_4_OPUS_THINKING_BYOK') {
    serviceTier = config.BYOK2_OPENAI_SERVICE_TIER;
  } else if (req === 'MODEL_CLAUDE_4_OPUS_BYOK') {
    serviceTier = config.BYOK1_OPENAI_SERVICE_TIER || config.OPENAI_SERVICE_TIER;
  } else if (req === 'MODEL_CLAUDE_4_SONNET_THINKING_BYOK') {
    serviceTier = config.BYOK4_OPENAI_SERVICE_TIER;
  } else if (req === 'MODEL_CLAUDE_4_SONNET_BYOK' || req === 'MODEL_CLAUDE_SONNET_4') {
    serviceTier = config.BYOK3_OPENAI_SERVICE_TIER;
  } else if (isDiagnosticOpenAIModel(upstream)) {
    serviceTier = config.OPENAI_SERVICE_TIER;
  }
  
  // 白名单过滤：接受 fast / priority（对齐上游 v2.6.1）
  serviceTier = ['fast', 'priority'].includes(String(serviceTier || '').trim().toLowerCase())
    ? String(serviceTier).trim().toLowerCase()
    : undefined;
  
  return {
    requested: req,
    resolved,
    upstream,
    provider,
    serviceTier,
    usesDefault: mapped === '__DEFAULT__' || (!mapped && !!defaultModel),
    thinking: /-thinking$/i.test(resolved),
  };
}

/**
 * 检查模型最终路由（展示多个代表模型的解析结果）
 */
function checkModelRoutingDiagnostic(config) {
  const defaultModel = String(config.DEFAULT_MODEL || '').trim();
  const candidates = Array.from(
    new Set(
      [
        defaultModel,
        'MODEL_CLAUDE_3_OPUS',
        'MODEL_CLAUDE_4_OPUS_BYOK',
        'MODEL_CLAUDE_4_OPUS_THINKING_BYOK',
        'claude-opus-4-8',
        'MODEL_SWE_1_5',
        'MODEL_CHAT',
        'MODEL_CLAUDE_SONNET_4',
        'MODEL_GPT_4O',
        'gpt-5-4-xhigh-priority',
      ].filter(Boolean)
    )
  );
  const routes = candidates.map((m) => resolveDiagnosticModelRoute(m, config));
  const summary = routes
    .map((r) => {
      const tags = [
        r.provider,
        r.serviceTier,
        r.thinking ? 'thinking' : '',
        r.usesDefault ? 'default' : '',
      ]
        .filter(Boolean)
        .join(', ');
      return r.requested + ' → ' + (r.upstream || '未解析') + (tags ? ' (' + tags + ')' : '');
    })
    .join('；');
  return envCheckItem(
    'model-routing',
    '模型最终路由',
    defaultModel ? 'ok' : 'warning',
    defaultModel ? 'DEFAULT_MODEL=' + defaultModel + '；' + summary : '未设置 DEFAULT_MODEL；' + summary,
    false
  );
}

// PLACEHOLDER_ANALYSIS2

/**
 * 评估 Inline/Fast 首包超时风险
 */
function checkInlineFastTimeoutRisk(config) {
  const model = String(config.DEFAULT_MODEL || '').trim();
  const base = model.replace(/-thinking$/i, '');
  const isOpenAI = /^(gpt-)/i.test(base) || /^MODEL_GPT/i.test(model);
  const effort = String(config.BYOK1_THINKING_EFFORT || config.OPENAI_REASONING_EFFORT || '').trim();
  const maxTokens = Number.parseInt(String(config.MAX_TOKENS || '0'), 10);
  const risks = [];
  if (/opus/i.test(model)) {
    risks.push('Opus 首包通常更慢');
  }
  if (/-thinking$/i.test(model) || (isOpenAI && config.OPENAI_THINKING_ENABLED === 'true')) {
    risks.push('thinking 会增加首包等待');
  }
  if (isOpenAI && (effort === 'high' || effort === 'xhigh' || effort === 'max')) {
    risks.push('推理强度 ' + effort);
  }
  if (Number.isFinite(maxTokens) && maxTokens > 8192) {
    risks.push('MAX_TOKENS=' + maxTokens);
  }
  const timeout = Number.parseInt(String(config.COMPLETION_TIMEOUT_MS || '12000'), 10);
  if (Number.isFinite(timeout) && timeout < 10000) {
    risks.push('补全超时 ' + timeout + 'ms 偏短');
  }
  if (!model) {
    risks.push('未设置默认模型');
  }
  const hasFastTier =
    isOpenAI &&
    ['fast', 'priority'].includes(
      String(config.BYOK1_OPENAI_SERVICE_TIER || config.OPENAI_SERVICE_TIER || '')
        .trim()
        .toLowerCase()
    );
  const detail =
    risks.length > 0
      ? 'Inline/Fast 首包窗口较紧（当前补全超时约 ' +
        (Number.isFinite(timeout) ? timeout : 12000) +
        'ms）；风险：' +
        risks.join('、') +
        '。如频繁空返回，优先降低模型/Token' +
        (isOpenAI ? '/推理强度' : '') +
        ' 或改用普通 Chat。' +
        (hasFastTier ? '当前已启用 service_tier=fast。' : '')
      : '当前默认模型未命中明显慢首包风险；' +
        (hasFastTier ? '已启用 service_tier=fast；' : '') +
        'Inline/Fast 仍受上游首包延迟影响。';
  return envCheckItem(
    'inline-fast-timeout',
    'Inline/Fast 超时风险',
    risks.length > 0 ? 'warning' : 'ok',
    detail,
    false
  );
}

/**
 * 脱敏诊断文本中的密钥/令牌
 */
function sanitizeDiagnosticText(text) {
  return String(text || '')
    .replace(
      /((?:api[_-]?key|authorization|bearer|token|password|secret)[^\r\n:=]*[:=\s]+)([^\s"'&]+)/gi,
      '$1***'
    )
    .replace(/(sk-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/g, '$1***');
}

/**
 * 脱敏环境配置对象（按键名识别敏感字段）
 */
function sanitizeEnvConfig(config) {
  const out = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = /KEY|TOKEN|SECRET|PASSWORD/i.test(k) ? redactSecret(v) : v;
  }
  return out;
}

/**
 * 安全读取 JSON 对象文件（失败/非对象返回 undefined）
 */
function readJsonObject(filePath) {
  if (!fs.existsSync(filePath)) {
    return undefined;
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : undefined;
  } catch {
    return undefined;
  }
}

module.exports = {
  DIAGNOSTIC_OPENAI_PREFIXES,
  DIAGNOSTIC_MODEL_MAP,
  classifyProbeBody,
  classifyProbeHttpStatus,
  classifyProbeSseError,
  classifyProbeNetworkError,
  stripDiagnosticThinkingSuffix,
  isDiagnosticOpenAIModel,
  resolveDiagnosticModelRoute,
  checkModelRoutingDiagnostic,
  checkInlineFastTimeoutRisk,
  sanitizeDiagnosticText,
  sanitizeEnvConfig,
  readJsonObject,
};


