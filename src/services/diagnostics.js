'use strict';

/**
 * 诊断原语：探测响应分类器 + 诊断模型路由解析
 *
 * 从 sidebarProvider.js 抽离的纯函数（字符串分析 + 常量查表，无 this/无 I/O）。
 * 重 I/O 的诊断编排（probeConfiguredModelStream / checkManagedEnvironment /
 * createDiagnosticReport 等）仍保留在 Provider，按需调用本模块。
 * 实现逐字保留，保证行为不变。
 */

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
  const serviceTier = req.endsWith('-priority') ? 'fast' : undefined;
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
};


