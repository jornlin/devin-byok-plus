import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { parseGetChatMessageRequest } from './parse-request.js';
import { buildErrorChunk, buildTextDelta } from './build-response.js';
import { AnthropicStreamProcessor, parseSSEChunk } from './anthropic-stream.js';
import {
  ChatCompletionsStreamProcessor,
  OpenAIStreamProcessor,
  parseOpenAISSEChunk,
} from './openai-stream.js';
import { endOfStreamEnvelope, streamHeaders, wrapEnvelope } from '../connect.js';
import {
  buildAnthropicThinkingPayload,
  buildGeminiThinkingPayload,
  correctApiPathForProvider,
  detectModelProvider,
  getByokSlot,
  sanitizeGeminiThinkingEffort,
  thinkingEffortToAnthropicBudget,
  thinkingEffortToGeminiBudget,
  thinkingEffortToOpenAIReasoningEffort,
  usesGeminiThinkingLevel,
} from './byok-slots.js';
import {
  getProviderConfig,
  getRuntimeConfig,
  getSlotModel,
  getSlotProtocol,
  getSlotThinkingEffort,
  getSlotServiceTier,
  getSlotReasoningMode,
} from './models.js';
import {
  consumeInjectedMessages,
  emitChatEnd,
  emitChatStart,
  emitStreamStatus,
  getActiveMonitorTarget,
} from '../ws-bridge.js';
import {
  buildGatewayCapabilityKey,
  getGatewayCapability,
  markGatewayCapability,
} from './gateway-capability.js';
import {
  applyAnthropicPromptCache,
  getPromptCacheConfig,
  prepareToolsForPromptCache,
  shouldOptimizeOpenAIPrefix,
  shouldRetryWithoutPromptCache,
} from './prompt-cache.js';
import { formatUsageLog } from './usage-log.js';
import {
  isResponsesApiPath,
  shouldFallbackToChatCompletions,
  toChatCompletionsMessages,
  toChatCompletionsPath,
} from './openai-request.js';
import {
  calculateRetryDelay,
  isRetriableError,
  isTimeoutError,
  serviceCircuitBreakers,
} from '../retry-utils.js';

export {
  isResponsesApiPath,
  shouldFallbackToChatCompletions,
  toChatCompletionsMessages,
  toChatCompletionsPath,
} from './openai-request.js';
export {
  requiresConfiguredDefaultModel,
  synthesizeToolsFromMessages,
  collectToolUseNames,
  ensureNamedToolChoiceTool,
  toInjectedTailMessage,
};
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 30,
  maxFreeSockets: 5,
});
const PROXY_DEVICE_ID = process.env.PROXY_DEVICE_ID || '';
const PROXY_CLIENT_VERSION = process.env.PROXY_CLIENT_VERSION || '0.0.0';
function proxyHeaders(arg0, arg1) {
  const tmp2 = Date.now().toString();
  const tmp3 = crypto.randomBytes(16).toString('hex');
  return {
    'x-proxy-device-id': PROXY_DEVICE_ID,
    'x-proxy-client-version': PROXY_CLIENT_VERSION,
    'x-proxy-timestamp': tmp2,
    'x-proxy-nonce': tmp3,
    'x-proxy-requested-model': arg0 || '',
  };
}
const _ENV_DEFAULT_MODEL = process.env.DEFAULT_MODEL || '';
const _ENV_MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '32768', 10);
function getDefaultModel() {
  return getRuntimeConfig().defaultModel || _ENV_DEFAULT_MODEL;
}
function getMaxTokens() {
  return getRuntimeConfig().maxTokens || _ENV_MAX_TOKENS;
}
function resolveConfiguredModel(arg0) {
  const tmp1 = String(arg0 || '').trim();
  const tmp2 = getByokSlot(tmp1);
  if (tmp2) {
    const tmp02 = getSlotModel(tmp2);
    if (!tmp02) {
      return '';
    }
    return MODEL_MAP[tmp02] && MODEL_MAP[tmp02] !== '__DEFAULT__' ? MODEL_MAP[tmp02] : tmp02;
  }
  const tmp3 = tmp1 && !tmp1.startsWith('MODEL_') ? tmp1 : '';
  const tmp4 = MODEL_MAP[tmp1] || MODEL_MAP[tmp3];
  const tmp5 = getDefaultModel();
  if (tmp4 === '__DEFAULT__') {
    return tmp5 || ANTHROPIC_FALLBACK_MODEL;
  }
  const tmp6 = tmp4 || tmp5 || tmp3 || '';
  if (tmp6) {
    return MODEL_MAP[tmp6] || tmp6;
  }
  if (/CLAUDE|SWE/i.test(tmp1)) {
    if (/THINK/i.test(tmp1)) {
      return ANTHROPIC_FALLBACK_THINKING_MODEL;
    } else {
      return ANTHROPIC_FALLBACK_MODEL;
    }
  }
  return ANTHROPIC_FALLBACK_MODEL;
}
/**
 * 检测模型是否需要配置默认值
 * @param {string} modelName - 模型名称
 * @returns {boolean} - 是否缺少必需的配置
 */
function requiresConfiguredDefaultModel(arg0) {
  const tmp1 = String(arg0 || '').trim();
  const tmp2 = getByokSlot(tmp1);

  // BYOK 槽位模型检查
  if (tmp2) {
    return !getSlotModel(tmp2);
  }

  // 实际模型名（非 MODEL_* 常量）
  const tmp3 = tmp1 && !tmp1.startsWith('MODEL_') ? tmp1 : '';

  // 检查是否映射到 __DEFAULT__
  const tmp4 = MODEL_MAP[tmp1] || MODEL_MAP[tmp3];
  return tmp4 === '__DEFAULT__' && !getDefaultModel();
}
function writeModelConfigError(arg0, arg1, arg2) {
  arg0.writeHead(200, streamHeaders());
  arg0.write(wrapEnvelope(buildErrorChunk(arg1, arg2)));
  arg0.write(endOfStreamEnvelope());
  arg0.end();
}
const OPENAI_REQUEST_TIMEOUT_MS = parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS || '300000', 10);
const OPENAI_SSE_IDLE_TIMEOUT_MS = parseInt(process.env.OPENAI_SSE_IDLE_TIMEOUT_MS || '180000', 10);
const ANTHROPIC_REQUEST_TIMEOUT_MS = parseInt(
  process.env.ANTHROPIC_REQUEST_TIMEOUT_MS || '300000',
  10
);
const ANTHROPIC_SSE_IDLE_TIMEOUT_MS = parseInt(
  process.env.ANTHROPIC_SSE_IDLE_TIMEOUT_MS || '180000',
  10
);
const OPENAI_REASONING_SUMMARY = process.env.OPENAI_REASONING_SUMMARY || 'auto';
const OPENAI_ENABLE_REASONING = process.env.OPENAI_ENABLE_REASONING !== 'false';
// 默认关闭：system prompt 末尾的动态 backend 行会破坏 OpenAI 前缀 cache（上游 2.3.0 行为）
const EXPOSE_BACKEND_INFO = process.env.EXPOSE_BACKEND_INFO === 'true';
const ANTHROPIC_FALLBACK_MODEL = 'claude-sonnet-4-20250514';
const ANTHROPIC_FALLBACK_THINKING_MODEL = 'claude-sonnet-4-20250514-thinking';
function createTimingTracker(arg0, tmp1 = {}, tmp2 = null) {
  const tmp3 = Date.now();
  const tmp4 = new Map();
  const tmp5 = Object.entries(tmp1)
    .filter(([, tmp02]) => tmp02 !== undefined && tmp02 !== null && tmp02 !== '')
    .map(([tmp02, tmp12]) => tmp02 + '=' + tmp12)
    .join(' ');
  const tmp6 = tmp5 ? '  ⏱️  ' + arg0 + ' ' + tmp5 : '  ⏱️  ' + arg0;
  const tmp7 = (arg02, tmp12 = '') => {
    if (tmp4.has(arg02)) {
      return;
    }
    const tmp22 = Date.now() - tmp3;
    tmp4.set(arg02, tmp22);
    console.log(tmp6 + ' ' + arg02 + ': ' + tmp22 + 'ms' + (tmp12 ? ' ' + tmp12 : ''));
    emitStreamStatus(
      'timing',
      arg0 + ' ' + arg02 + ': ' + tmp22 + 'ms' + (tmp12 ? ' ' + tmp12 : ''),
      tmp2
    );
  };
  const tmp8 = (arg02, tmp12 = '') => {
    const tmp22 = Date.now() - tmp3;
    console.log(tmp6 + ' ' + arg02 + ': total=' + tmp22 + 'ms' + (tmp12 ? ' ' + tmp12 : ''));
    emitStreamStatus(
      'timing',
      arg0 + ' ' + arg02 + ': total=' + tmp22 + 'ms' + (tmp12 ? ' ' + tmp12 : ''),
      tmp2
    );
  };
  return {
    mark: tmp7,
    summary: tmp8,
    elapsed: () => Date.now() - tmp3,
  };
}
function logNoToolsCalled(arg0, arg1, arg2) {
  const tmp3 = Array.isArray(arg2) ? arg2.map((arg02) => arg02 && arg02.name).filter(Boolean) : [];
  const tmp4 = tmp3.length ? '; enabled=' + tmp3.length + ' ' + formatToolNameList(tmp3) : '';
  console.log(
    '  🔧 No tools called (' +
      arg0 +
      ' ' +
      arg1 +
      '; model output did not reach tool-call stage' +
      tmp4 +
      ')'
  );
  emitStreamStatus('error', arg0 + ' ' + arg1 + '; no tool calls emitted');
  emitChatEnd('error', []);
}
export function sanitizeLogBody(arg0) {
  return String(arg0 || '')
    .slice(0, 500)
    .replace(
      /"((?:api[_-]?key|token|secret|password|authorization))"\s*:\s*"[^"]{6,}"/gi,
      '"$1":"[REDACTED]"'
    )
    .replace(/(?:sk-[a-zA-Z0-9_-]{10,}|Bearer\s+[^\s",}]+)/g, '[REDACTED]')
    .replace(/(?:key-[a-zA-Z0-9_-]{10,})/g, '[REDACTED]');
}
function buildProviderErrorMessage(arg0, arg1, arg2) {
  const tmp3 = String(arg2 || '').toLowerCase();
  if (
    /convert_request_failed|not implemented|not_implemented|new_api_error|responses api|invalid.*responses/.test(
      tmp3
    )
  ) {
    return (
      '[' +
      arg0 +
      ' Error ' +
      arg1 +
      '] 当前网关不支持 OpenAI Responses API，代理会尝试回退到 /v1/chat/completions；若仍失败，请在高级路由中将 OpenAI API Path 设置为 /v1/chat/completions。'
    );
  }
  if (
    /signature.*field required|field required.*signature|validationexception/.test(tmp3) &&
    tmp3.includes('signature')
  ) {
    return (
      '[' +
      arg0 +
      ' Error ' +
      arg1 +
      '] Bedrock/Anthropic thinking 历史缺少 signature。请开启新对话，或关闭 BYOK #2 思考强度；代理默认会剔除无 signature 的 thinking 块。'
    );
  }
  if (
    /thinking.*enabled.*not supported|enabled.*not supported.*adaptive|output_config\.effort/.test(
      tmp3
    )
  ) {
    return (
      '[' +
      arg0 +
      ' Error ' +
      arg1 +
      '] 当前 Claude/Bedrock 模型要求 adaptive thinking。请升级插件或确认模型名是 Claude 4 系列；代理会对 Claude 4 使用 thinking.adaptive + output_config.effort。'
    );
  }
  if (
    /thinking_config|unknown.*thinking|invalid.*thinking|extra_body|unrecognized.*field/.test(tmp3)
  ) {
    return (
      '[' +
      arg0 +
      ' Error ' +
      arg1 +
      '] 当前网关不支持 Gemini/OpenAI 兼容 thinking 扩展字段，代理会尝试不带 thinking 的 Chat Completions 回退。'
    );
  }
  if (arg1 === 401 && tmp3.includes('invalid') && tmp3.includes('key')) {
    return (
      '[' +
      arg0 +
      ' Error 401] Invalid API key. If using the cloud gateway, check the server-side upstream key; otherwise update the local ' +
      arg0 +
      ' key in the control panel.'
    );
  }
  if (
    arg1 === 503 &&
    (tmp3.includes('no available accounts') ||
      tmp3.includes('overloaded') ||
      tmp3.includes('unavailable'))
  ) {
    return (
      '[' + arg0 + ' Error 503] 当前模型池暂无可用资源或上游过载，请切换到 Sonnet/默认模型后重试。'
    );
  }
  if (arg1 === 403 && tmp3.includes('/v1/messages')) {
    return (
      '[' +
      arg0 +
      ' Error 403] 当前分组不允许 /v1/messages 通道，请切换 OpenAI 兼容模型或使用支持 Anthropic Messages 的分组。'
    );
  }
  return '[' + arg0 + ' Error ' + arg1 + ']';
}
const OPENAI_PREFIXES = ['gpt-', 'MODEL_GPT'];
const GEMINI_PREFIXES = ['gemini-', 'MODEL_GOOGLE_GEMINI'];
const tmp0 = {
  'gpt-5-4-low': 'gpt-5.4',
  'gpt-5-4-high': 'gpt-5.4',
  'gpt-5-4-xhigh': 'gpt-5.4',
  'gpt-5-4-xhigh-priority': 'gpt-5.4',
  MODEL_GPT_4O: 'gpt-4o',
  MODEL_GPT_4O_MINI: 'gpt-4o-mini',
  MODEL_CLAUDE_3_5_SONNET: ANTHROPIC_FALLBACK_MODEL,
  MODEL_CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-20241022',
  MODEL_CLAUDE_3_OPUS: '__DEFAULT__',
  MODEL_CLAUDE_4_OPUS: '__DEFAULT__',
  MODEL_CLAUDE_4_OPUS_BYOK: '__DEFAULT__',
  MODEL_CLAUDE_4_OPUS_THINKING_BYOK: '__DEFAULT__',
  MODEL_CLAUDE_4_SONNET_BYOK: '__DEFAULT__',
  MODEL_CLAUDE_4_SONNET_THINKING_BYOK: '__DEFAULT__',
  MODEL_CLAUDE_OPUS_4: '__DEFAULT__',
  MODEL_CLAUDE_OPUS_4_1: '__DEFAULT__',
  MODEL_CLAUDE_SONNET_4: ANTHROPIC_FALLBACK_MODEL,
  MODEL_SWE_1: ANTHROPIC_FALLBACK_MODEL,
  MODEL_SWE_1_5: ANTHROPIC_FALLBACK_MODEL,
  MODEL_SWE_1_5_SLOW: ANTHROPIC_FALLBACK_MODEL,
  'claude-opus-4-6-thinking': 'claude-opus-4-6-thinking',
  'claude-opus-4-7-thinking': 'claude-opus-4-7-thinking',
  'claude-opus-4-8-thinking': 'claude-opus-4-8-thinking',
  'claude-opus-4-6': 'claude-opus-4-6',
  'claude-opus-4-7': 'claude-opus-4-7',
  'claude-opus-4-8': 'claude-opus-4-8',
  'claude-sonnet-4-6-thinking': ANTHROPIC_FALLBACK_THINKING_MODEL,
  MODEL_CHAT_11121: '__DEFAULT__',
  MODEL_GOOGLE_GEMINI_2_5_FLASH: '__DEFAULT__',
  MODEL_GOOGLE_GEMINI_2_5_PRO: '__DEFAULT__',
  MODEL_CHAT: '__DEFAULT__',
};
const MODEL_MAP = tmp0;
function getServiceTier(arg0, arg1 = '', arg2 = null) {
  const tmp1 = String(arg0 || '').trim();
  const tmp2 = String(arg1 || '').trim();
  if (tmp1.endsWith('-priority') || tmp2.endsWith('-priority')) {
    return 'fast';
  }
  const tmp3 = arg2 || getByokSlot(tmp1);
  if (tmp3 === 1 || tmp3 === 2 || tmp3 === 3 || tmp3 === 4) {
    const tmp4 = getSlotServiceTier(tmp3);
    if (tmp4) {
      return tmp4;
    }
    const tmp5 = getSlotModel(tmp3);
    if (tmp5.endsWith('-priority')) {
      return 'fast';
    }
  }
  return getRuntimeConfig().openaiServiceTier || undefined;
}
function isOpenAIModel(arg0) {
  if (!arg0) {
    return false;
  }
  const tmp1 = stripThinkingSuffix(arg0).toLowerCase();
  return (
    OPENAI_PREFIXES.some((arg02) => tmp1.startsWith(arg02.toLowerCase())) ||
    tmp1.includes('claude-code')
  );
}
function isGeminiModel(arg0) {
  if (!arg0) {
    return false;
  }
  const tmp1 = stripThinkingSuffix(arg0).toLowerCase();
  return (
    GEMINI_PREFIXES.some((arg02) => tmp1.startsWith(arg02.toLowerCase())) ||
    detectModelProvider(arg0) === 'gemini'
  );
}
function isOpenAICompatibleModel(arg0) {
  return isOpenAIModel(arg0) || isGeminiModel(arg0);
}
function isThinkingModel(arg0) {
  return String(arg0 || '')
    .trim()
    .toLowerCase()
    .endsWith('-thinking');
}
function stripThinkingSuffix(arg0) {
  return String(arg0 || '')
    .trim()
    .replace(/-thinking$/i, '');
}
function isClaudeModel(arg0) {
  const tmp1 = stripThinkingSuffix(arg0).toLowerCase();
  return tmp1.startsWith('claude-') || tmp1.startsWith('model_claude');
}
// 解析槽位有效协议：手动 BYOKn_PROTOCOL 优先，否则回退到模型名自动检测
function resolveEffectiveProvider(model, slot, gptForced = false) {
  const manual = slot ? getSlotProtocol(slot) : '';
  if (manual === 'gemini') return 'gemini';
  if (manual === 'openai') return 'gpt';
  if (manual === 'anthropic') return 'claude';
  if (isGeminiModel(model)) return 'gemini';
  if (isOpenAIModel(model) || gptForced) return 'gpt';
  if (isClaudeModel(model)) return 'claude';
  const detected = detectModelProvider(model);
  if (detected) return detected;
  // 无法从模型名/槽位协议推断时，默认走 OpenAI 协议：其 /chat/completions
  // 兼容范围最广（DeepSeek/Kimi/Qwen/GLM 等第三方网关多以 OpenAI 兼容为主）。
  // 需要 Anthropic 协议的用户应显式设置 BYOKn_PROTOCOL=anthropic 或使用 claude-* 模型名。
  return 'gpt';
}
function resolveSlotThinkingEffort(arg0, arg1) {
  if (arg0 === 1 || arg0 === 2 || arg0 === 3 || arg0 === 4) {
    return getSlotThinkingEffort(arg0) || (arg0 === 1 ? arg1.openaiReasoningEffort || '' : '');
  }
  return arg1.openaiReasoningEffort || '';
}
function buildThinkingOptions(arg0, arg1, tmp2 = null) {
  const tmp3 = getRuntimeConfig();
  const tmp4 = isThinkingModel(arg0);
  const tmp5 = resolveSlotThinkingEffort(tmp2, tmp3);
  const provider = resolveEffectiveProvider(arg0, tmp2, arg1);
  const tmp6 = provider === 'claude';
  const tmp7 = provider === 'gemini';
  const tmp8 = provider === 'gpt';
  const tmp12 =
    tmp2 === 1 || tmp2 === 2 || tmp2 === 3 || tmp2 === 4
      ? getSlotReasoningMode(tmp2)
      : tmp3.openaiReasoningMode || '';
  let tmp9 = false;
  let tmp10 = '';
  if (tmp8) {
    tmp9 = tmp4 || tmp3.openaiThinkingEnabled === true || !!tmp5 || !!tmp12;
    tmp10 = tmp9 ? tmp5 || tmp3.openaiReasoningEffort || '' : '';
  } else if (tmp7) {
    tmp9 = !!sanitizeGeminiThinkingEffort(tmp5) || tmp4 || tmp2 === 2;
    tmp10 = sanitizeGeminiThinkingEffort(tmp5) || (tmp9 && (tmp2 === 2 || tmp4) ? 'medium' : '');
  } else if (tmp6) {
    tmp9 = !!tmp5 || tmp4 || tmp2 === 2;
    tmp10 = tmp9 ? tmp5 || (tmp2 === 2 || tmp4 ? 'medium' : '') : '';
  } else {
    tmp9 = tmp4;
    tmp10 = '';
  }
  const tmp11 = {
    thinkingEnabled: tmp9,
    reasoningEffort: tmp10,
    reasoningMode: tmp12,
    thinkingBudget: tmp9
      ? (tmp7
          ? usesGeminiThinkingLevel(arg0)
            ? 0
            : thinkingEffortToGeminiBudget(tmp10)
          : thinkingEffortToAnthropicBudget(tmp10)) || (tmp7 ? 8192 : 10000)
      : 0,
    provider,
  };
  return tmp11;
}
export function handleGetChatMessage(arg0, arg1, arg2) {
  let {
    systemPrompt: tmp3,
    messages: tmp4,
    tools: tmp5,
    toolChoice: tmp6,
    requestedModel: tmp7,
    initiator: tmp8,
  } = parseGetChatMessageRequest(arg2, arg0.headers);
  const tmp9 = crypto.randomUUID();
  const tmp10 = getByokSlot(tmp7);

  // ✅ 提前验证模型配置
  if (requiresConfiguredDefaultModel(tmp7)) {
    let tmp02 = 'Default model not configured. Please set DEFAULT_MODEL or BYOK1_MODEL in .env.';
    if (tmp10 === 2) {
      tmp02 =
        'BYOK #2 model not configured. Please set BYOK2_MODEL in .env or configure via sidebar.';
    } else if (tmp10 === 3) {
      tmp02 =
        'BYOK #3 model not configured. Please set BYOK3_MODEL in .env or configure via sidebar.';
    } else if (tmp10 === 4) {
      tmp02 =
        'BYOK #4 model not configured. Please set BYOK4_MODEL in .env or configure via sidebar.';
    } else if (tmp10 === 1) {
      tmp02 = 'BYOK #1 model not configured. Please set BYOK1_MODEL or DEFAULT_MODEL in .env.';
    }

    console.error('  ❌ Model validation failed: ' + (tmp7 || 'unknown') + ' - ' + tmp02);
    writeModelConfigError(arg1, tmp9, tmp02);
    return;
  }
  let tmp11 = resolveConfiguredModel(tmp7);
  const tmp13 = buildThinkingOptions(tmp11, isOpenAIModel(tmp11), tmp10);
  // 使用 thinkingOptions.provider（尊重 BYOKn_PROTOCOL 手动覆盖）决定上游路由
  const tmp12 = tmp13.provider === 'gpt' || tmp13.provider === 'gemini';
  tmp11 = stripThinkingSuffix(tmp11);
  if (!tmp11) {
    const tmp02 = '未解析到可用模型。请先在 Devin BYOK Bridge 中加载模型并选择默认模型。';
    console.error('  ❌ Empty resolved model for requested model ' + (tmp7 || 'unknown'));
    writeModelConfigError(arg1, tmp9, tmp02);
    return;
  }
  const tmp14 = getProviderConfig(tmp10);
  const tmp15 = tmp13.provider === 'gemini';
  const requiredKey = tmp12
    ? tmp15
      ? tmp14.openai.apiKey || tmp14.anthropic.apiKey
      : tmp14.openai.apiKey
    : tmp14.anthropic.apiKey;
  if (!requiredKey) {
    const tmp02 = tmp12 ? (tmp15 ? 'Gemini/OpenAI' : 'OpenAI') : 'Anthropic';
    console.error('  ❌ No ' + tmp02 + ' API key set — cannot forward ' + tmp7);
    const tmp1 = crypto.randomUUID();
    arg1.writeHead(200, streamHeaders());
    arg1.write(wrapEnvelope(buildErrorChunk(tmp1, 'No ' + tmp02 + ' API key configured')));
    arg1.write(endOfStreamEnvelope());
    arg1.end();
    return;
  }
  const tmp16 = getServiceTier(tmp7, tmp11, tmp10);
  const tmp17 = tmp15 ? 'Gemini' : tmp12 ? 'OpenAI' : 'Anthropic';
  if (EXPOSE_BACKEND_INFO) {
    tmp3 += '\n\nCurrent backend: ' + tmp11 + ' (' + tmp17 + ').';
  }
  const tmp18 = consumeInjectedMessages();
  if (tmp18.length > 0) {
    for (const tmp02 of tmp18) {
      // 标记为易变尾部消息：prompt cache 的断点会放在这些消息之前
      tmp4.push(toInjectedTailMessage(tmp02));
    }
    console.log('  📨 Injected ' + tmp18.length + ' message(s) from App');
  }
  const tmp19 = getActiveMonitorTarget();
  console.log('  � Monitor target: ' + tmp19);
  console.log(
    '  �🧠 Model: ' +
      tmp7 +
      ' → ' +
      tmp11 +
      ' (' +
      tmp17 +
      ')' +
      (tmp16 ? ' [tier: ' + tmp16 + ']' : '')
  );
  console.log('  📝 System prompt: ' + tmp3.length + ' chars');
  console.log('  💬 Messages: ' + tmp4.length);
  if (tmp5) {
    console.log('  🔧 Tools: ' + tmp5.length);
  }
  if (tmp6) {
    console.log('  🔧 ToolChoice: ' + JSON.stringify(tmp6));
  }
  emitChatStart(tmp11, tmp4.length, tmp5 ? tmp5.length : 0, tmp19);
  if (tmp4.length > 0) {
    const tmp02 = tmp4.map((arg02) => arg02.role).join(',');
    console.log('  💬 Roles: ' + tmp02);
    for (let tmp03 = 1; tmp03 < tmp4.length; tmp03++) {
      if (tmp4[tmp03].role === tmp4[tmp03 - 1].role) {
        console.warn(
          '  ⚠️  Consecutive ' +
            tmp4[tmp03].role +
            ' at index ' +
            (tmp03 - 1) +
            ',' +
            tmp03 +
            ' — merge failed?'
        );
      }
    }
  }
  const tmp20 = {
    provider: tmp17,
    model: tmp11,
    requested: tmp7,
  };
  const tmp21 = createTimingTracker('chat', tmp20, tmp19);
  tmp21.mark('parsed', 'messages=' + tmp4.length + ' tools=' + (tmp5 ? tmp5.length : 0));
  if (tmp5?.length) {
    // 按 name 稳定排序 tools，稳定 JSON 前缀以提升 prompt cache 命中率
    tmp5 = prepareToolsForPromptCache(tmp5, tmp17, {
      config: getPromptCacheConfig(),
    });
  }
  if (tmp12) {
    const tmp02 = {
      systemPrompt: tmp3,
      messages: tmp4,
      tools: tmp5,
      toolChoice: tmp6,
      resolvedModel: tmp11,
      serviceTier: tmp16,
      messageId: tmp9,
      initiator: tmp8,
      timing: tmp21,
      monitorTargetId: tmp19,
      thinkingOptions: tmp13,
      byokSlot: tmp10,
    };
    streamOpenAI(arg0, arg1, tmp02);
  } else {
    const tmp02 = {
      systemPrompt: tmp3,
      messages: tmp4,
      tools: tmp5,
      toolChoice: tmp6,
      resolvedModel: tmp11,
      messageId: tmp9,
      timing: tmp21,
      monitorTargetId: tmp19,
      thinkingOptions: tmp13,
      byokSlot: tmp10,
    };
    streamAnthropic(arg0, arg1, tmp02);
  }
}
function describeNetworkError(arg0, arg1, arg2) {
  const tmp3 = arg0?.code || '';
  const tmp4 = arg0?.message || String(arg0 || 'unknown error');
  const tmp5 = /^198\.(18|19)\./.test(arg1 || '');
  if (tmp3 === 'ETIMEDOUT') {
    const tmp02 = tmp5
      ? '可能是 VPN/TUN/代理分流生成的假 IP 未正确回连，请检查分流规则或将目标域名设为直连。'
      : '请检查当前网络、系统代理或上游出口是否可达。';
    return tmp4 + ' (' + tmp02 + ')';
  }
  if (tmp3 === 'ECONNRESET') {
    return tmp4 + ' (上游连接被重置，常见于网络抖动、代理中途断链或对端主动关闭)';
  }
  return '' + tmp4 + (arg1 ? ' (' + arg1 + ':' + arg2 + ')' : '');
}
function createStreamLifecycle(arg0, fn, arg2, arg3, arg4) {
  let tmp5 = false;
  let tmp6 = false;
  let tmp7 = null;
  let tmp8 = Date.now();
  const tmp9 = 3000;
  const tmp10 = () => {
    if (tmp7) {
      return;
    }
    tmp7 = setInterval(() => {
      if (tmp6 || arg0.writableEnded || tmp5) {
        clearInterval(tmp7);
        tmp7 = null;
        return;
      }
      if (Date.now() - tmp8 >= tmp9) {
        arg0.write(wrapEnvelope(buildTextDelta(arg3, '', 0)));
      }
    }, tmp9);
  };
  const fn2 = () => {
    if (tmp7) {
      clearInterval(tmp7);
      tmp7 = null;
    }
  };
  const fn3 = (arg02) => {
    if (!arg0.writableEnded && !tmp5) {
      if (arg4) {
        arg4.mark('first_windsurf_write');
      }
      arg0.write(arg02);
      tmp8 = Date.now();
    }
  };
  const fn4 = (arg02) => {
    if (tmp6 || arg0.writableEnded || tmp5) {
      return false;
    }
    tmp6 = true;
    fn2();
    fn3(endOfStreamEnvelope());
    arg0.end();
    if (arg02) {
      console.log(arg02);
    }
    if (arg4) {
      arg4.summary('finalized');
    }
    return true;
  };
  const tmp14 = (arg02, arg1) => {
    if (tmp5 || arg0.writableEnded) {
      return false;
    }
    if (arg02) {
      fn3(wrapEnvelope(buildErrorChunk(arg3, arg02)));
    }
    return fn4(arg1);
  };
  arg0.on('close', () => {
    if (arg0.writableEnded || tmp5) {
      return;
    }
    tmp5 = true;
    tmp6 = true;
    fn2();
    const tmp02 = fn();
    if (tmp02 && !tmp02.destroyed) {
      console.log('  ℹ️  Client disconnected, stopping ' + arg2 + ' upstream stream');
      if (arg4) {
        arg4.summary('client_disconnected');
      }
      tmp02.destroy();
    }
  });
  const tmp15 = {
    safeWrite: fn3,
    finalize: fn4,
    fail: tmp14,
    startHeartbeat: tmp10,
    wasClosedByClient: () => tmp5,
  };
  return tmp15;
}
function shouldForwardOpenAITools(arg0, arg1) {
  if (!arg1 || arg1.length === 0) {
    return false;
  }
  return true;
}
function splitToolFilterEnv(...names) {
  const values = [];
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) {
      continue;
    }
    values.push(
      ...String(raw)
        .split(/[,\s;]+/)
        .map((arg0) => arg0.trim())
        .filter(Boolean)
    );
  }
  return values;
}
function matchesToolPattern(name, patterns, prefixMode = false) {
  const normalized = String(name || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }
  for (const pattern of patterns) {
    const candidate = String(pattern || '')
      .trim()
      .toLowerCase();
    if (!candidate) {
      continue;
    }
    if (prefixMode || candidate.endsWith('*')) {
      const prefix = candidate.replace(/\*+$/g, '');
      if (prefix && normalized.startsWith(prefix)) {
        return true;
      }
      continue;
    }
    if (normalized === candidate) {
      return true;
    }
  }
  return false;
}
function getToolFilterConfig() {
  const allow = splitToolFilterEnv('BYOK_TOOL_ALLOWLIST', 'TOOL_ALLOWLIST');
  const deny = splitToolFilterEnv('BYOK_TOOL_DENYLIST', 'TOOL_DENYLIST');
  const allowPrefixes = splitToolFilterEnv('BYOK_TOOL_ALLOW_PREFIXES', 'TOOL_ALLOW_PREFIXES');
  const denyPrefixes = splitToolFilterEnv('BYOK_TOOL_DENY_PREFIXES', 'TOOL_DENY_PREFIXES');
  return {
    allow,
    deny,
    allowPrefixes,
    denyPrefixes,
    active:
      allow.length > 0 ||
      deny.length > 0 ||
      allowPrefixes.length > 0 ||
      denyPrefixes.length > 0,
  };
}
export function filterForwardedTools(tools = []) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return [];
  }
  const config = getToolFilterConfig();
  if (!config.active) {
    return tools;
  }
  const hasAllowRules = config.allow.length > 0 || config.allowPrefixes.length > 0;
  return tools.filter((tool) => {
    const name = tool?.name || '';
    const allowed =
      !hasAllowRules ||
      matchesToolPattern(name, config.allow) ||
      matchesToolPattern(name, config.allowPrefixes, true);
    const denied =
      matchesToolPattern(name, config.deny) ||
      matchesToolPattern(name, config.denyPrefixes, true);
    return allowed && !denied;
  });
}
function formatToolNameList(toolsOrNames = [], limit = 12) {
  const names = toolsOrNames
    .map((arg0) => (typeof arg0 === 'string' ? arg0 : arg0?.name))
    .filter(Boolean);
  if (names.length === 0) {
    return '[]';
  }
  const shown = names.slice(0, limit);
  const suffix = names.length > limit ? ', ... +' + (names.length - limit) + ' more' : '';
  return '[' + shown.join(', ') + suffix + ']';
}
function describeToolFilter(originalTools = [], forwardedTools = []) {
  const originalCount = Array.isArray(originalTools) ? originalTools.length : 0;
  const forwardedCount = Array.isArray(forwardedTools) ? forwardedTools.length : 0;
  return originalCount !== forwardedCount ? ' filtered=' + originalCount + '→' + forwardedCount : '';
}
function getForwardedToolChoice(arg0, arg1, arg2) {
  if (!arg1 || !arg0 || arg0.length === 0) {
    return undefined;
  }
  if (arg1.type !== 'tool') {
    return arg1;
  }
  if (arg0.some((arg02) => arg02?.name === arg1.name)) {
    return arg1;
  }
  console.log(
    '  ⚠️  Ignoring ' +
      arg2 +
      ' named tool_choice "' +
      arg1.name +
      '" because the tool definition is unavailable'
  );
  return undefined;
}
function shouldRetryWithoutGeminiThinking(arg0, arg1) {
  if (![400, 422, 500, 501, 502].includes(arg0)) {
    return false;
  }
  const tmp1 = String(arg1 || '').toLowerCase();
  return /thinking_config|thinking.*unsupported|extra_body|unknown.*thinking|invalid.*thinking|unsupported.*field|unrecognized.*field|additional properties/.test(
    tmp1
  );
}
// 将 ws-bridge 运行时注入的消息标记为易变尾部（不参与 prompt cache 稳定前缀）
function toInjectedTailMessage(arg0) {
  return {
    role: arg0.role,
    content: arg0.content,
    _volatileTail: true,
  };
}
// 统计尾部连续的注入消息数，用于 prompt cache 断点前移
function countInjectedTailMessages(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 0;
  }
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?._volatileTail !== true) {
      break;
    }
    count += 1;
  }
  return count;
}
// 发送上游前剥除内部元数据字段（如 _volatileTail）
function stripInternalMessageMetadata(messages = []) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return messages;
  }
  let changed = false;
  const next = messages.map((message) => {
    if (!message || typeof message !== 'object' || message._volatileTail !== true) {
      return message;
    }
    changed = true;
    const { _volatileTail, ...rest } = message;
    return rest;
  });
  return changed ? next : messages;
}
// 根据 usage 与元信息推断本次请求的 cache 状态标签
function toUsageCacheStatus(provider, usage, meta = {}) {
  const normalizedProvider = String(provider || '')
    .trim()
    .toLowerCase();
  if (normalizedProvider === 'anthropic') {
    if (meta.promptCacheRejected) {
      return 'unsupported';
    }
    if (meta.promptCacheEnabled === false) {
      return 'off';
    }
    if (usage?.cache_read_input_tokens || usage?.cache_creation_input_tokens) {
      return 'hit';
    }
    if (meta.promptCacheEnabled) {
      return 'eligible';
    }
    return 'off';
  }
  if (usage?.cached_tokens || usage?.cache_read_input_tokens) {
    return 'hit';
  }
  if (meta.cacheStatus === 'unsupported' || meta.cacheStatus === 'off') {
    return meta.cacheStatus;
  }
  if (meta.openaiCacheMode === 'off') {
    return 'off';
  }
  return meta.openaiCacheMode === 'auto' ? 'eligible' : 'observe';
}
// 流结束时输出统一的 📊 用量日志
function logUpstreamUsage(processor, provider, meta = {}) {
  if (!processor?.getUsage) {
    return;
  }
  const usage = processor.getUsage();
  if (!usage) {
    return;
  }
  console.log(
    '  ' +
      formatUsageLog(usage, provider, {
        ...meta,
        cacheStatus: toUsageCacheStatus(provider, usage, meta),
      })
  );
}
export function splitSseFrames(buffer) {
  const parts = String(buffer || '').split(/\r?\n\r?\n/);
  return {
    frames: parts.slice(0, -1),
    remainder: parts[parts.length - 1] || '',
  };
}
function mapChatCompletionsToolChoice(arg0) {
  if (!arg0) {
    return undefined;
  }
  if (arg0.type === 'auto') {
    return 'auto';
  }
  if (arg0.type === 'any') {
    return 'required';
  }
  if (arg0.type === 'tool') {
    return {
      type: 'function',
      function: {
        name: arg0.name,
      },
    };
  }
  return undefined;
}
export function buildOpenAIResponsesBody({
  systemPrompt: tmp2,
  messages: tmp3,
  tools: tmp4,
  toolChoice: tmp5,
  resolvedModel: tmp6,
  serviceTier: tmp7,
  thinkingOptions: tmp12,
  initiator: tmp9,
  forwardTools: tmp16,
}) {
  const tmp15 = toOpenAIMessages(tmp2, tmp3);
  const tmp17 = tmp16 ? getForwardedToolChoice(tmp4, tmp5, 'OpenAI') : undefined;
  const tmp19 = {
    model: tmp6,
    input: tmp15,
    stream: true,
  };
  const tmp20 = getMaxTokens();
  if (tmp20 > 0) {
    tmp19.max_output_tokens = tmp20;
  }
  const tmp21 = tmp12?.thinkingEnabled === true;
  const isGeminiRoute = tmp12?.provider === 'gemini' || (tmp12?.provider == null && isGeminiModel(tmp6));
  if (OPENAI_ENABLE_REASONING && tmp21) {
    if (isGeminiRoute) {
      const tmp02 = buildGeminiThinkingPayload(tmp6, tmp12?.reasoningEffort);
      if (tmp02?.thinkingConfig) {
        const tmp03 = {};
        if (tmp02.thinkingConfig.thinking_level) {
          tmp03.thinking_level = tmp02.thinkingConfig.thinking_level;
        } else if (tmp02.thinkingConfig.thinking_budget) {
          tmp03.thinking_budget = tmp02.thinkingConfig.thinking_budget;
        }
        tmp19.thinking_config = tmp03;
        tmp19.extra_body = {
          ...(tmp19.extra_body || {}),
          thinking_config: tmp03,
        };
      }
    } else {
      const tmp02 = {
        summary: OPENAI_REASONING_SUMMARY,
      };
      tmp19.reasoning = tmp02;
      if (tmp12?.reasoningEffort) {
        tmp19.reasoning.effort = thinkingEffortToOpenAIReasoningEffort(tmp12.reasoningEffort, tmp6);
      }
      if (/^gpt-5\.6(?:-|$)/i.test(tmp6) && tmp12?.reasoningMode) {
        tmp19.reasoning.mode = tmp12.reasoningMode;
      }
    }
  }
  if (tmp7) {
    tmp19.service_tier = tmp7;
  }
  if (tmp16 && tmp4 && tmp4.length > 0) {
    tmp19.tools = tmp4.map((arg02) => ({
      type: 'function',
      name: arg02.name,
      description: arg02.description || '',
      parameters:
        typeof arg02.input_schema === 'string'
          ? JSON.parse(arg02.input_schema)
          : arg02.input_schema,
    }));
    if (tmp17) {
      if (tmp17.type === 'auto') {
        tmp19.tool_choice = 'auto';
      } else if (tmp17.type === 'any') {
        tmp19.tool_choice = 'required';
      } else if (tmp17.type === 'tool') {
        tmp19.tool_choice = {
          type: 'function',
          name: tmp17.name,
        };
      }
    }
  }
  return tmp19;
}
export function buildOpenAIChatCompletionsBody({
  systemPrompt: tmp2,
  messages: tmp3,
  tools: tmp4,
  toolChoice: tmp5,
  resolvedModel: tmp6,
  thinkingOptions: tmp12,
  forwardTools: tmp16,
  omitGeminiThinking: tmp18 = false,
}) {
  const tmp17 = tmp16 ? getForwardedToolChoice(tmp4, tmp5, 'OpenAI') : undefined;
  const tmp19 = {
    model: tmp6,
    messages: toChatCompletionsMessages(tmp2, tmp3),
    stream: true,
  };
  const tmp20 = getMaxTokens();
  if (tmp20 > 0) {
    tmp19.max_tokens = tmp20;
  }
  const tmp21 = tmp12?.thinkingEnabled === true;
  const isGeminiRoute = tmp12?.provider === 'gemini' || (tmp12?.provider == null && isGeminiModel(tmp6));
  if (OPENAI_ENABLE_REASONING && tmp21) {
    if (isGeminiRoute) {
      if (!tmp18) {
        const tmp02 = buildGeminiThinkingPayload(tmp6, tmp12?.reasoningEffort);
        if (tmp02?.thinkingConfig) {
          const tmp03 = {};
          if (tmp02.thinkingConfig.thinking_level) {
            tmp03.thinking_level = tmp02.thinkingConfig.thinking_level;
          } else if (tmp02.thinkingConfig.thinking_budget) {
            tmp03.thinking_budget = tmp02.thinkingConfig.thinking_budget;
          }
          tmp19.thinking_config = tmp03;
          tmp19.extra_body = {
            ...(tmp19.extra_body || {}),
            thinking_config: tmp03,
          };
        }
      }
    } else {
      const tmp02 = thinkingEffortToOpenAIReasoningEffort(tmp12?.reasoningEffort, tmp6);
      if (tmp02) {
        tmp19.reasoning_effort = tmp02;
      }
    }
  }
  if (tmp16 && tmp4 && tmp4.length > 0) {
    tmp19.tools = tmp4.map((arg02) => ({
      type: 'function',
      function: {
        name: arg02.name,
        description: arg02.description || '',
        parameters:
          typeof arg02.input_schema === 'string'
            ? JSON.parse(arg02.input_schema)
            : arg02.input_schema,
      },
    }));
    const tmp03 = mapChatCompletionsToolChoice(tmp17);
    if (tmp03) {
      tmp19.tool_choice = tmp03;
    }
  }
  return tmp19;
}
// 判断是否应该重试 OpenAI 请求
function shouldRetryOpenAIRequest(statusCode, error, retryCount) {
  const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);

  // 超过最大重试次数
  if (retryCount >= MAX_RETRIES) {
    return false;
  }

  // 使用通用的重试判断逻辑
  return isRetriableError(error, statusCode);
}

function attachOpenAISseStream(
  arg02,
  {
    processor: tmp13,
    lifecycle: tmp24,
    timing: tmp10,
    clientResponse: tmp11,
    onStreamEnd: fn,
    onDataReceived: onDataReceived = null,
    onSuccess: onSuccess = null,
    usageMeta: usageMeta = {},
  }
) {
  const tmp1 = new StringDecoder('utf8');
  let sseBuffer = '';
  let tmp26 = false;
  let tmp32 = null;
  tmp24.startHeartbeat();
  const fn2 = () => {
    if (tmp32) {
      clearTimeout(tmp32);
      tmp32 = null;
    }
  };
  const fn3 = () => {
    fn2();
    tmp32 = setTimeout(() => {
      if (tmp26 || tmp24.wasClosedByClient()) {
        return;
      }
      console.error(
        '  ❌ OpenAI stream stalled after ' + OPENAI_SSE_IDLE_TIMEOUT_MS + 'ms without data'
      );
      fn('stream idle timeout ' + OPENAI_SSE_IDLE_TIMEOUT_MS + 'ms');
      tmp24.fail('[OpenAI Stream Timeout]');
      arg02.destroy();
    }, OPENAI_SSE_IDLE_TIMEOUT_MS);
  };
  // 幂等收尾：避免 processPart(isDone) 与 'end' 双重 finalize/双重用量日志
  let streamFinished = false;
  const finishStream = (message) => {
    if (streamFinished) {
      return;
    }
    streamFinished = true;
    tmp26 = true;
    fn2();
    logUpstreamUsage(tmp13, 'OpenAI', usageMeta);
    tmp24.finalize(message);
  };
  function processPart(arg03) {
    const tmp110 = parseOpenAISSEChunk(arg03 + '\n');
    for (const tmp02 of tmp110) {
      const tmp03 = tmp13.processEvent(tmp02);
      for (const tmp04 of tmp03) {
        tmp24.safeWrite(wrapEnvelope(tmp04));
      }
    }
    if (tmp13.isDone) {
      finishStream('  ✅ OpenAI stream done (stop: ' + tmp13.stopReason + ')');
    }
  }
  fn3();
  arg02.on('data', (arg03) => {
    if (onDataReceived) {
      onDataReceived();
    }
    if (tmp10) {
      tmp10.mark('first_upstream_chunk', 'bytes=' + Buffer.byteLength(arg03));
    }
    fn3();
    sseBuffer += tmp1.write(arg03);
    const tmp110 = splitSseFrames(sseBuffer);
    sseBuffer = tmp110.remainder;
    for (const tmp02 of tmp110.frames) {
      processPart(tmp02);
    }
  });
  arg02.on('end', () => {
    tmp26 = true;
    fn2();
    sseBuffer += tmp1.end();
    if (sseBuffer.trim()) {
      processPart(sseBuffer);
    }
    if (!tmp13.isDone && tmp11 && !tmp11.writableEnded) {
      console.log('  ⚠️  OpenAI stream ended without terminal event — forcing stop');
      const tmp02 = tmp13.processEvent({
        done: true,
        type: 'done',
        data: null,
      });
      for (const tmp03 of tmp02) {
        tmp24.safeWrite(wrapEnvelope(tmp03));
      }
    }
    if (onSuccess && tmp13.isDone) {
      onSuccess();
    }
    finishStream('  ✅ OpenAI stream ended (stop: ' + tmp13.stopReason + ')');
  });
  arg02.on('aborted', () => {
    tmp26 = true;
    fn2();
    if (tmp24.wasClosedByClient()) {
      return;
    }
    console.error('  ❌ OpenAI stream aborted before completion');
    fn('stream aborted before completion');
    tmp24.fail('[Stream Aborted]');
  });
  arg02.on('error', (arg03) => {
    tmp26 = true;
    fn2();
    if (tmp24.wasClosedByClient()) {
      return;
    }
    console.error('  ❌ OpenAI stream error: ' + arg03.message);
    fn('stream error: ' + arg03.message);
    tmp24.fail('[Stream Error]');
  });
}
// 从历史消息中收集所有 tool_use 名称，用于在缺失工具定义时补齐 Bedrock 所需的 toolConfig
function collectToolUseNames(messages) {
  const names = new Set();
  let hasToolBlock = false;
  for (const msg of messages || []) {
    if (!msg || !Array.isArray(msg.content)) {
      continue;
    }
    for (const block of msg.content) {
      if (!block || typeof block !== 'object') {
        continue;
      }
      if (block.type === 'tool_use') {
        hasToolBlock = true;
        if (block.name) {
          names.add(String(block.name));
        }
      } else if (block.type === 'tool_result') {
        hasToolBlock = true;
      }
    }
  }
  return { names: [...names], hasToolBlock };
}

// 当请求未携带工具定义、但历史消息含 tool_use/tool_result 时，
// 依据历史中出现的工具名合成最小工具定义，避免 Bedrock 报 TOOL_CONFIG_MISSING
function synthesizeToolsFromMessages(messages, existingTools) {
  if (existingTools && existingTools.length > 0) {
    return existingTools;
  }
  const { names, hasToolBlock } = collectToolUseNames(messages);
  if (!hasToolBlock) {
    return existingTools;
  }
  // 历史中存在 tool_use/tool_result，但当前请求无工具定义 → 合成占位工具定义
  const synthesized = names.map((name) => ({
    name,
    description: '',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: true,
    },
  }));
  if (synthesized.length === 0) {
    return existingTools;
  }
  console.warn(
    '  ⚠️  Synthesized ' +
      synthesized.length +
      ' tool definition(s) from history for Bedrock toolConfig compatibility: [' +
      names.join(', ') +
      ']'
  );
  return synthesized;
}

// 当 tool_choice 强制调用一个命名工具、但该工具不在 tools 列表中时，
// 补一个占位工具定义，使模型能真正调用它（常见于 Devin 收尾用的 "finish" 工具未随本轮重发）。
// 返回 { tools, allowToolChoice }：tools 为补齐后的列表，allowToolChoice 表示该命名 tool_choice 是否可安全转发。
function ensureNamedToolChoiceTool(tools, toolChoice) {
  if (!toolChoice || toolChoice.type !== 'tool' || !toolChoice.name) {
    return { tools, allowToolChoice: false };
  }
  const list = Array.isArray(tools) ? tools : [];
  if (list.some((t) => t?.name === toolChoice.name)) {
    return { tools: list, allowToolChoice: true };
  }
  const synthesized = {
    name: toolChoice.name,
    description: '',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: true,
    },
  };
  console.warn(
    '  ⚠️  Synthesized tool definition for forced tool_choice "' +
      toolChoice.name +
      '" (not in request/history) so the model can call it'
  );
  return { tools: [...list, synthesized], allowToolChoice: true };
}

function streamAnthropic(
  arg0,
  arg1,
  {
    systemPrompt: tmp2,
    messages: tmp3,
    tools: tmp4,
    toolChoice: tmp5,
    resolvedModel: tmp6,
    messageId: tmp7,
    timing: tmp8,
    monitorTargetId: tmp9,
    thinkingOptions: tmp10,
    byokSlot: tmp11 = null,
  },
  retryCount = 0
) {
  const tmp12 = getProviderConfig(tmp11).anthropic;
  // 根据 hostname 自动修正非标准 Anthropic 路径（如 DeepSeek/Kimi 的 /anthropic）
  const correctedAnthropicPath = correctApiPathForProvider('anthropic', tmp12.host, tmp12.apiPath);
  if (correctedAnthropicPath !== tmp12.apiPath) {
    console.log('  🔄 Auto-corrected Anthropic API path: ' + tmp12.apiPath + ' → ' + correctedAnthropicPath);
    tmp12.apiPath = correctedAnthropicPath;
  }
  // prompt cache 配置与网关能力检查（网关不支持 cache_control 时自动降级）
  const promptCacheConfig = getPromptCacheConfig();
  const promptCacheKey = buildGatewayCapabilityKey({
    protocol: tmp12.useHttp ? 'http' : 'https',
    host: tmp12.parsed.hostname,
    port: tmp12.parsed.port !== 443 ? tmp12.parsed.port : tmp12.useHttp ? 80 : 443,
    apiPath: tmp12.apiPath,
    providerKind: 'anthropic',
    slot: tmp11 || 'default',
  });
  const promptCacheCapability = getGatewayCapability(promptCacheKey);
  const promptCacheEnabled =
    promptCacheConfig.anthropic && !promptCacheCapability?.promptCacheUnsupported;
  const promptCacheRejected = !!(
    promptCacheConfig.anthropic && promptCacheCapability?.promptCacheUnsupported
  );
  // 依据 allow/deny 环境变量过滤转发给上游的工具（不影响历史合成的占位工具）
  const forwardedTools = filterForwardedTools(tmp4);
  // 补齐工具定义：历史含 tool_use/tool_result 但本次未带 tools 时，合成占位定义以满足 Bedrock toolConfig 要求
  let effectiveTools = synthesizeToolsFromMessages(tmp3, forwardedTools);
  // 若 tool_choice 强制调用某命名工具但其定义缺失，补齐该工具定义并允许转发 tool_choice
  const { tools: ensuredTools, allowToolChoice } = ensureNamedToolChoiceTool(effectiveTools, tmp5);
  // 合成/补齐的占位工具也参与稳定排序，避免逐轮顺序变化破坏 tools 块缓存前缀
  effectiveTools = prepareToolsForPromptCache(ensuredTools, 'anthropic', {
    config: promptCacheConfig,
  });
  const tmp13 = getForwardedToolChoice(effectiveTools, tmp5, 'Anthropic');
  const tmp14 = {
    model: tmp6,
    system: tmp2 || undefined,
    messages: stripInternalMessageMetadata(tmp3),
    stream: true,
    max_tokens: getMaxTokens(),
  };
  if (effectiveTools && effectiveTools.length > 0) {
    tmp14.tools = effectiveTools;
    // 转发 tool_choice 的条件：本次请求真正携带工具，或我们为命名 tool_choice 补齐了其工具定义。
    // 仅对“纯历史合成占位工具”不强制 tool_choice（那只是为满足 Bedrock toolConfig）。
    if (tmp13 && ((tmp4 && tmp4.length > 0) || allowToolChoice)) {
      tmp14.tool_choice = tmp13;
    }
  }
  if (tmp10?.thinkingEnabled) {
    const tmp02 = buildAnthropicThinkingPayload(tmp6, tmp10.reasoningEffort, 'medium');
    if (tmp02?.thinking) {
      tmp14.thinking = tmp02.thinking;
      if (tmp02.output_config) {
        tmp14.output_config = tmp02.output_config;
      }
      const tmp03 =
        tmp14.thinking.budget_tokens ||
        tmp10.thinkingBudget ||
        thinkingEffortToAnthropicBudget(tmp10.reasoningEffort) ||
        0;
      if (tmp03 > 0 && tmp14.max_tokens <= tmp03) {
        tmp14.max_tokens = Math.min(getMaxTokens(), tmp03 + 8192);
      }
    }
  }
  const tmp15 = tmp14.thinking
    ? tmp14.thinking.type === 'adaptive'
      ? 'adaptive effort=' + (tmp14.output_config?.effort || tmp10?.reasoningEffort || 'medium')
      : 'enabled budget=' +
        (tmp14.thinking.budget_tokens || '?') +
        (tmp10?.reasoningEffort ? ' effort=' + tmp10.reasoningEffort : '')
    : 'off';
  console.log('  🧩 Anthropic/Sub2API thinking: ' + tmp15);
  if (tmp4 && tmp4.length > 0) {
    console.log(
      '  🔧 Anthropic tools enabled: ' +
        forwardedTools.length +
        describeToolFilter(tmp4, forwardedTools) +
        ' ' +
        formatToolNameList(forwardedTools)
    );
  }
  // 启用时对 system/tools/messages 稳定前缀打 cache_control（注入消息作为易变尾部排除）
  const outboundPayload = promptCacheEnabled
    ? applyAnthropicPromptCache(tmp14, {
        ...promptCacheConfig,
        additionalTailMessages: countInjectedTailMessages(tmp3),
      })
    : tmp14;
  const tmp16 = JSON.stringify(outboundPayload);
  if (!arg1.headersSent) {
    arg1.writeHead(200, streamHeaders());
  }
  const processor = new AnthropicStreamProcessor(tmp7, tmp6, tmp9);
  let tmp17;
  const tmp18 = createStreamLifecycle(arg1, () => tmp17, 'Anthropic', tmp7, tmp8);
  const logAnthropicUsage = () => {
    logUpstreamUsage(processor, 'Anthropic', {
      mode: 'messages',
      route: tmp12.apiPath,
      requestBytes: Buffer.byteLength(tmp16),
      promptCacheEnabled,
      promptCacheRejected,
      fallback: promptCacheRejected ? 'no-cache-retry' : '',
    });
  };
  const tmp19 = tmp12.useHttp ? http : https;
  const tmp20 = tmp12.parsed.port !== 443 ? tmp12.parsed.port : tmp12.useHttp ? 80 : 443;
  const retryPrefix = retryCount > 0 ? `[Retry ${retryCount}] ` : '';
  console.log(
    '  → ' +
      retryPrefix +
      'Anthropic ' +
      tmp12.host +
      tmp12.apiPath +
      ' model=' +
      tmp6 +
      ' key=' +
      (tmp12.apiKey ? 'set' : 'empty') +
      (promptCacheEnabled ? ' cache=on' : ' cache=off')
  );
  if (tmp8) {
    tmp8.mark(
      retryCount === 0 ? 'upstream_request_start' : `upstream_retry_${retryCount}`,
      'bytes=' + Buffer.byteLength(tmp16)
    );
  }

  // 检查熔断器状态
  const circuitBreaker = serviceCircuitBreakers.anthropic;
  if (!circuitBreaker.allowRequest()) {
    console.error('  🔒 Anthropic circuit breaker is OPEN - request blocked');
    tmp18.fail('[Circuit Breaker Open] Too many consecutive failures, please try again later');
    return;
  }

  let hasReceivedData = false; // 标记是否接收到任何数据

  tmp17 = tmp19.request(
    {
      hostname: tmp12.parsed.hostname,
      port: tmp20,
      path: tmp12.apiPath,
      method: 'POST',
      agent: tmp12.useHttp ? undefined : keepAliveAgent,
      rejectUnauthorized: !tmp12.useHttp && tmp12.parsed.port === 443,
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'anthropic-version': '2023-06-01',
        ...(promptCacheEnabled ? { 'anthropic-beta': 'prompt-caching-2024-07-31' } : {}),
        'x-api-key': tmp12.apiKey,
        'content-length': Buffer.byteLength(tmp16),
        ...proxyHeaders(tmp6, Buffer.byteLength(tmp16)),
      },
    },
    (arg02) => {
      if (tmp8) {
        tmp8.mark('upstream_headers', 'status=' + arg02.statusCode);
      }
      let sseBuffer = '';
      if (arg02.statusCode !== 200) {
        console.error('  ❌ Anthropic API returned ' + arg02.statusCode);
        let tmp02 = '';
        arg02.setEncoding('utf8');
        arg02.on('data', (arg03) => (tmp02 += arg03));
        arg02.on('end', () => {
          console.error('  ❌ Body: ' + sanitizeLogBody(tmp02));
          const tmp03 = buildProviderErrorMessage('Anthropic', arg02.statusCode, tmp02);

          // 网关不支持 cache_control：标记能力后立即无缓存重试（不计入重试次数/熔断）
          if (promptCacheEnabled && shouldRetryWithoutPromptCache(arg02.statusCode, tmp02)) {
            markGatewayCapability(promptCacheKey, {
              promptCacheUnsupported: true,
              reason: 'prompt cache rejected: HTTP ' + arg02.statusCode,
            });
            console.log(
              '  ↩️  Anthropic prompt cache unsupported — retrying without cache_control'
            );
            emitStreamStatus(
              'retry',
              'Anthropic prompt cache unsupported — retrying without cache_control'
            );
            streamAnthropic(
              arg0,
              arg1,
              {
                systemPrompt: tmp2,
                messages: tmp3,
                tools: tmp4,
                toolChoice: tmp5,
                resolvedModel: tmp6,
                messageId: tmp7,
                timing: tmp8,
                monitorTargetId: tmp9,
                thinkingOptions: tmp10,
                byokSlot: tmp11,
              },
              retryCount
            );
            return;
          }

          // 判断是否应该重试
          if (shouldRetryAnthropicRequest(arg02.statusCode, null, retryCount, hasReceivedData)) {
            retryAnthropicRequest(
              arg0,
              arg1,
              {
                systemPrompt: tmp2,
                messages: tmp3,
                tools: tmp4,
                toolChoice: tmp5,
                resolvedModel: tmp6,
                messageId: tmp7,
                timing: tmp8,
                monitorTargetId: tmp9,
                thinkingOptions: tmp10,
                byokSlot: tmp11,
              },
              retryCount,
              arg02.statusCode,
              null
            );
          } else {
            circuitBreaker.recordFailure();
            tmp18.fail(tmp03);
          }
        });
        return;
      }
      arg02.setEncoding('utf8');
      let tmp1 = null;
      let tmp22 = false;
      let isFirstChunk = true;
      tmp18.startHeartbeat();
      const fn = () => {
        if (tmp1) {
          clearTimeout(tmp1);
          tmp1 = null;
        }
      };
      const fn2 = () => {
        fn();
        tmp1 = setTimeout(() => {
          if (tmp22 || tmp18.wasClosedByClient()) {
            return;
          }
          console.error(
            '  ❌ Anthropic stream stalled after ' +
              ANTHROPIC_SSE_IDLE_TIMEOUT_MS +
              'ms without data'
          );
          tmp18.fail('[Anthropic Stream Timeout]');
          arg02.destroy();
        }, ANTHROPIC_SSE_IDLE_TIMEOUT_MS);
      };
      function processPart(arg03) {
        const tmp110 = parseSSEChunk(arg03 + '\n\n');
        for (const tmp02 of tmp110) {
          const tmp03 = processor.processEvent(tmp02);
          for (const tmp04 of tmp03) {
            tmp18.safeWrite(wrapEnvelope(tmp04));
          }
        }
        if (processor.isDone && !tmp22) {
          tmp22 = true;
          fn();
        }
      }
      fn2();
      arg02.on('data', (arg03) => {
        hasReceivedData = true; // 标记已接收到数据
        if (tmp8 && isFirstChunk) {
          tmp8.mark('first_upstream_chunk', 'bytes=' + Buffer.byteLength(arg03));
          isFirstChunk = false;
        }
        fn2();
        sseBuffer += arg03;
        const tmp110 = splitSseFrames(sseBuffer);
        sseBuffer = tmp110.remainder;
        for (const tmp02 of tmp110.frames) {
          if (tmp02.trim()) {
            processPart(tmp02);
          }
        }
      });
      arg02.on('end', () => {
        tmp22 = true;
        fn();
        if (sseBuffer.trim()) {
          processPart(sseBuffer);
          sseBuffer = '';
        }
        if (!processor.isDone && !arg1.writableEnded) {
          console.log('  ⚠️  Anthropic stream ended without message_stop — forcing stop');
          const tmp02 = processor.processEvent({
            event: 'message_stop',
            data: {},
          });
          for (const tmp03 of tmp02) {
            tmp18.safeWrite(wrapEnvelope(tmp03));
          }
          logAnthropicUsage();
          tmp18.finalize('  ✅ Stream ended (forced stop)');
        } else if (processor.isDone) {
          circuitBreaker.recordSuccess(); // 成功请求，重置熔断器
          logAnthropicUsage();
          tmp18.finalize('  ✅ Stream ended normally');
        }
      });
      arg02.on('aborted', () => {
        tmp22 = true;
        fn();
        if (tmp18.wasClosedByClient()) {
          return;
        }
        console.error('  ❌ Anthropic stream aborted before completion');
        tmp18.fail('[Stream Aborted]');
      });
      arg02.on('error', (arg03) => {
        tmp22 = true;
        fn();
        if (tmp18.wasClosedByClient()) {
          return;
        }
        console.error('  ❌ Anthropic stream error: ' + arg03.message);
        tmp18.fail('[Stream Error]');
      });
    }
  );
  tmp17.setTimeout(ANTHROPIC_REQUEST_TIMEOUT_MS, () => {
    if (tmp18.wasClosedByClient()) {
      return;
    }
    console.error('  ❌ Anthropic request timeout after ' + ANTHROPIC_REQUEST_TIMEOUT_MS + 'ms');

    // 超时错误：判断是否应该重试
    const timeoutError = { code: 'ETIMEDOUT', timeout: true };
    if (shouldRetryAnthropicRequest(0, timeoutError, retryCount, hasReceivedData)) {
      tmp17.destroy();
      retryAnthropicRequest(
        arg0,
        arg1,
        {
          systemPrompt: tmp2,
          messages: tmp3,
          tools: tmp4,
          toolChoice: tmp5,
          resolvedModel: tmp6,
          messageId: tmp7,
          timing: tmp8,
          monitorTargetId: tmp9,
          thinkingOptions: tmp10,
          byokSlot: tmp11,
        },
        retryCount,
        0,
        timeoutError
      );
    } else {
      circuitBreaker.recordFailure();
      tmp18.fail('[Anthropic Request Timeout]');
      tmp17.destroy();
    }
  });
  tmp17.on('error', (arg02) => {
    if (
      tmp18.wasClosedByClient() &&
      (arg02.code === 'ECONNRESET' || arg02.code === 'ECONNABORTED')
    ) {
      return;
    }
    const tmp1 = describeNetworkError(arg02, tmp12.host, tmp12.parsed.port);
    console.error('  ❌ Anthropic request error: ' + tmp1);

    // 网络错误：判断是否应该重试
    if (shouldRetryAnthropicRequest(0, arg02, retryCount, hasReceivedData)) {
      retryAnthropicRequest(
        arg0,
        arg1,
        {
          systemPrompt: tmp2,
          messages: tmp3,
          tools: tmp4,
          toolChoice: tmp5,
          resolvedModel: tmp6,
          messageId: tmp7,
          timing: tmp8,
          monitorTargetId: tmp9,
          thinkingOptions: tmp10,
          byokSlot: tmp11,
        },
        retryCount,
        0,
        arg02
      );
    } else {
      circuitBreaker.recordFailure();
      tmp18.fail('[Anthropic Connection Error] ' + tmp1);
    }
  });
  tmp17.end(tmp16);
  if (tmp8) {
    tmp8.mark('upstream_request_sent');
  }
}

// 判断是否应该重试 Anthropic 请求
function shouldRetryAnthropicRequest(statusCode, error, retryCount, hasReceivedData) {
  const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3', 10);

  // 超过最大重试次数
  if (retryCount >= MAX_RETRIES) {
    return false;
  }

  // 如果已经接收到数据（流已经开始），则不重试（避免重复数据）
  if (hasReceivedData) {
    return false;
  }

  // 使用通用的重试判断逻辑
  return isRetriableError(error, statusCode);
}

// 重试 Anthropic 请求
function retryAnthropicRequest(arg0, arg1, options, currentRetryCount, statusCode, error) {
  const nextRetryCount = currentRetryCount + 1;
  const isTimeout = isTimeoutError(error);
  const delay = calculateRetryDelay(currentRetryCount, statusCode, {}, isTimeout);

  const errorDesc = error?.code || error?.message || `HTTP ${statusCode}`;
  console.log(
    `  ↩️  [Anthropic] Retry ${nextRetryCount}/${process.env.MAX_RETRIES || 3} after ${delay}ms (${errorDesc})`
  );
  emitStreamStatus('retry', `Anthropic retry ${nextRetryCount} after ${delay}ms (${errorDesc})`);

  setTimeout(() => {
    streamAnthropic(arg0, arg1, options, nextRetryCount);
  }, delay);
}
function streamOpenAI(
  arg0,
  arg1,
  {
    systemPrompt: tmp2,
    messages: tmp3,
    tools: tmp4,
    toolChoice: tmp5,
    resolvedModel: tmp6,
    serviceTier: tmp7,
    messageId: tmp8,
    initiator: tmp9,
    timing: tmp10,
    monitorTargetId: tmp11,
    thinkingOptions: tmp12,
    byokSlot: tmp13 = null,
  }
) {
  const tmp14 = getProviderConfig(tmp13).openai;
  // 根据 hostname 自动修正 OpenAI 路径（不支持 /v1/responses 的提供商直接使用 /v1/chat/completions）
  const correctedOpenaiPath = correctApiPathForProvider('openai', tmp14.host, tmp14.apiPath);
  if (correctedOpenaiPath !== tmp14.apiPath) {
    console.log('  🔄 Auto-corrected OpenAI API path: ' + tmp14.apiPath + ' → ' + correctedOpenaiPath);
    tmp14.apiPath = correctedOpenaiPath;
  }
  // 依据 allow/deny 环境变量过滤转发给上游的工具
  const forwardedTools = filterForwardedTools(tmp4);
  const tmp16 = shouldForwardOpenAITools(tmp9, forwardedTools);
  const tmp30 = {
    systemPrompt: tmp2,
    messages: tmp3,
    tools: forwardedTools,
    toolChoice: tmp5,
    resolvedModel: tmp6,
    serviceTier: tmp7,
    thinkingOptions: tmp12,
    initiator: tmp9,
    forwardTools: tmp16,
  };
  const tmp31 = buildOpenAIResponsesBody(tmp30);
  const tmp32 = buildOpenAIChatCompletionsBody(tmp30);
  const isGeminiRoute = tmp12?.provider === 'gemini' || (tmp12?.provider == null && isGeminiModel(tmp6));
  const tmp36 =
    isGeminiRoute && tmp12?.thinkingEnabled === true
      ? buildOpenAIChatCompletionsBody({
          ...tmp30,
          omitGeminiThinking: true,
        })
      : null;
  console.log(
    '  🧩 OpenAI/Sub2API reasoning: ' +
      (isGeminiRoute
        ? tmp31.thinking_config
          ? usesGeminiThinkingLevel(tmp6)
            ? 'gemini level=' + (tmp31.thinking_config.thinking_level || '?')
            : 'gemini budget=' + (tmp31.thinking_config.thinking_budget || '?')
          : 'off'
        : tmp31.reasoning
          ? tmp31.reasoning.effort || 'default'
          : tmp32.reasoning_effort || 'off')
  );
  if (tmp16 && forwardedTools && forwardedTools.length > 0) {
    console.log(
      '  🔧 OpenAI tools enabled: ' +
        forwardedTools.length +
        describeToolFilter(tmp4, forwardedTools) +
        ' (initiator=' +
        (tmp9 || 'unknown') +
        ') ' +
        formatToolNameList(forwardedTools)
    );
  } else if (tmp4 && tmp4.length > 0) {
    console.log(
      '  🔧 OpenAI tools disabled: ' + tmp4.length + describeToolFilter(tmp4, forwardedTools) + ' available'
    );
  }
  const tmp33 = [];
  const tmp37 = tmp14.useHttp ? 'http' : 'https';
  const tmp38 = tmp14.parsed.port !== 443 ? tmp14.parsed.port : tmp14.useHttp ? 80 : 443;
  const tmp39 = buildGatewayCapabilityKey({
    protocol: tmp37,
    host: tmp14.parsed.hostname,
    port: tmp38,
    apiPath: tmp14.apiPath || '/v1/responses',
    providerKind: isGeminiRoute ? 'gemini' : 'openai',
    slot: tmp13 || 'default',
  });
  const tmp40 = getGatewayCapability(tmp39);
  // OpenAI 路径 prompt cache 元信息（observe/auto/off），随每个 attempt 传递到用量日志
  const promptCacheConfig = getPromptCacheConfig();
  const openaiPrefixOptimized = shouldOptimizeOpenAIPrefix({ config: promptCacheConfig });
  const openaiCacheMode = promptCacheConfig.openaiMode;
  const buildOpenAIUsageMeta = (mode, route, fallback = '') => ({
    mode,
    route,
    openaiCacheMode,
    cacheStatus: openaiPrefixOptimized ? openaiCacheMode : 'off',
    ...(fallback ? { fallback } : {}),
  });
  if (isResponsesApiPath(tmp14.apiPath) && tmp40?.preferChatCompletions) {
    console.log(
      '  ↩️  using cached chat-completions for ' +
        tmp14.parsed.hostname +
        ' (' +
        (tmp40.reason || 'responses unsupported') +
        ')'
    );
    tmp33.push({
      path: toChatCompletionsPath(tmp14.apiPath),
      body: tmp32,
      mode: 'chat',
      cacheKey: tmp39,
      usageMeta: buildOpenAIUsageMeta(
        'chat',
        toChatCompletionsPath(tmp14.apiPath),
        'responses-already-disabled'
      ),
    });
    if (tmp36) {
      tmp33.push({
        path: toChatCompletionsPath(tmp14.apiPath),
        body: tmp36,
        mode: 'chat',
        withoutGeminiThinking: true,
        cacheKey: tmp39,
        usageMeta: buildOpenAIUsageMeta(
          'chat',
          toChatCompletionsPath(tmp14.apiPath),
          'omit-gemini-thinking'
        ),
      });
    }
  } else if (isResponsesApiPath(tmp14.apiPath)) {
    tmp33.push({
      path: tmp14.apiPath,
      body: tmp31,
      mode: 'responses',
      cacheKey: tmp39,
      usageMeta: buildOpenAIUsageMeta('responses', tmp14.apiPath),
    });
    tmp33.push({
      path: toChatCompletionsPath(tmp14.apiPath),
      body: tmp32,
      mode: 'chat',
      cacheKey: tmp39,
      usageMeta: buildOpenAIUsageMeta(
        'chat',
        toChatCompletionsPath(tmp14.apiPath),
        'responses-to-chat'
      ),
    });
    if (tmp36) {
      tmp33.push({
        path: toChatCompletionsPath(tmp14.apiPath),
        body: tmp36,
        mode: 'chat',
        withoutGeminiThinking: true,
        cacheKey: tmp39,
        usageMeta: buildOpenAIUsageMeta(
          'chat',
          toChatCompletionsPath(tmp14.apiPath),
          'omit-gemini-thinking'
        ),
      });
    }
  } else {
    markGatewayCapability(tmp39, {
      preferChatCompletions: true,
      reason: 'configured chat-completions path',
    });
    tmp33.push({
      path: tmp14.apiPath || '/v1/chat/completions',
      body: tmp32,
      mode: 'chat',
      cacheKey: tmp39,
      usageMeta: buildOpenAIUsageMeta('chat', tmp14.apiPath || '/v1/chat/completions'),
    });
    if (tmp36) {
      tmp33.push({
        path: tmp14.apiPath || '/v1/chat/completions',
        body: tmp36,
        mode: 'chat',
        withoutGeminiThinking: true,
        cacheKey: tmp39,
        usageMeta: buildOpenAIUsageMeta(
          'chat',
          tmp14.apiPath || '/v1/chat/completions',
          'omit-gemini-thinking'
        ),
      });
    }
  }
  arg1.writeHead(200, streamHeaders());
  let tmp23;
  let processor;
  const tmp24 = createStreamLifecycle(arg1, () => tmp23, 'OpenAI', tmp8, tmp10);
  let tmp25 = false;
  let tmp34 = 0;
  let tmp35 = '';
  const fn = (arg02) => {
    if (tmp25) {
      return;
    }
    tmp25 = true;
    logNoToolsCalled('OpenAI', arg02, tmp16 ? forwardedTools : []);
  };
  const tmp27 = tmp14.useHttp ? http : https;
  const tmp28 = tmp38;
  const tmp29 = tmp14.apiKey ? tmp14.apiKey.slice(0, 6) + '...' + tmp14.apiKey.slice(-4) : 'empty';
  const fn2 = (retryCount = 0, lastError = null) => {
    const tmp02 = tmp33[tmp34++];
    if (!tmp02) {
      // 所有路径都尝试完毕，判断是否应该网络层重试
      if (lastError && shouldRetryOpenAIRequest(0, lastError, retryCount)) {
        const isTimeout = isTimeoutError(lastError);
        const delay = calculateRetryDelay(retryCount, 0, {}, isTimeout);
        const errorDesc = lastError.code || lastError.message || 'unknown';
        console.log(
          `  ↩️  [OpenAI] Retry ${retryCount + 1}/${process.env.MAX_RETRIES || 3} after ${delay}ms (${errorDesc})`
        );
        emitStreamStatus('retry', `OpenAI retry ${retryCount + 1} after ${delay}ms (${errorDesc})`);

        setTimeout(() => {
          tmp34 = 0; // 重置路径索引
          fn2(retryCount + 1, null);
        }, delay);
        return;
      }

      tmp24.fail(tmp35 || '[OpenAI Error]');
      return;
    }
    if (tmp02.mode === 'chat' && tmp33.length > 1 && tmp34 > 1) {
      console.log(
        '  ↩️  OpenAI gateway rejected /v1/responses — falling back to /v1/chat/completions'
      );
    }
    processor =
      tmp02.mode === 'chat'
        ? new ChatCompletionsStreamProcessor(tmp8, tmp6, tmp11)
        : new OpenAIStreamProcessor(tmp8, tmp6, tmp11);
    if (tmp16 && forwardedTools) {
      processor.setAllowedTools(forwardedTools.map((arg02) => arg02.name));
    }
    const tmp03 = JSON.stringify(tmp02.body);
    const attemptUsageMeta = tmp02.usageMeta || buildOpenAIUsageMeta(tmp02.mode, tmp02.path);
    const retryPrefix = retryCount > 0 ? `[Retry ${retryCount}] ` : '';
    console.log(
      '  → ' +
        retryPrefix +
        'OpenAI ' +
        (tmp14.useHttp ? 'http' : 'https') +
        '://' +
        tmp14.parsed.hostname +
        ':' +
        tmp28 +
        tmp02.path +
        ' model=' +
        tmp6 +
        ' key=' +
        tmp29 +
        ' cache=' +
        attemptUsageMeta.cacheStatus +
        ' mode=' +
        attemptUsageMeta.mode
    );
    if (tmp10) {
      const markName =
        retryCount > 0
          ? `upstream_retry_${retryCount}`
          : tmp34 === 1
            ? 'upstream_request_start'
            : 'upstream_fallback_start';
      tmp10.mark(
        markName,
        'bytes=' +
          Buffer.byteLength(tmp03) +
          ' tools=' +
          (tmp16 && forwardedTools ? forwardedTools.length : 0) +
          ' cache=' +
          attemptUsageMeta.cacheStatus +
          ' mode=' +
          attemptUsageMeta.mode
      );
    }

    // 检查熔断器状态
    const circuitBreaker = serviceCircuitBreakers.openai;
    if (!circuitBreaker.allowRequest()) {
      console.error('  🔒 OpenAI circuit breaker is OPEN - request blocked');
      tmp24.fail('[Circuit Breaker Open] Too many consecutive failures, please try again later');
      return;
    }

    let hasReceivedData = false; // 标记是否接收到任何数据

    tmp23 = tmp27.request(
      {
        hostname: tmp14.parsed.hostname,
        port: tmp28,
        path: tmp02.path,
        method: 'POST',
        agent: tmp14.useHttp ? undefined : keepAliveAgent,
        rejectUnauthorized: !tmp14.useHttp && tmp14.parsed.port === 443,
        headers: {
          'content-type': 'application/json',
          accept: 'text/event-stream',
          authorization: 'Bearer ' + tmp14.apiKey,
          'content-length': Buffer.byteLength(tmp03),
          ...proxyHeaders(tmp6, Buffer.byteLength(tmp03)),
        },
      },
      (arg02) => {
        if (tmp10) {
          tmp10.mark(
            tmp34 === 1 ? 'upstream_headers' : 'upstream_fallback_headers',
            'status=' + arg02.statusCode + ' path=' + tmp02.path
          );
        }
        if (arg02.statusCode !== 200) {
          fn('HTTP ' + arg02.statusCode + ' before stream');
          console.error('  ❌ OpenAI API returned ' + arg02.statusCode + ' (' + tmp02.path + ')');
          let tmp12 = '';
          arg02.setEncoding('utf8');
          arg02.on('data', (arg03) => (tmp12 += arg03));
          arg02.on('end', () => {
            console.error('  ❌ Body: ' + sanitizeLogBody(tmp12));
            tmp35 = buildProviderErrorMessage('OpenAI', arg02.statusCode, tmp12);
            if (shouldFallbackToChatCompletions(arg02.statusCode, tmp12) && tmp34 < tmp33.length) {
              markGatewayCapability(tmp02.cacheKey, {
                preferChatCompletions: true,
                reason: 'responses rejected: HTTP ' + arg02.statusCode,
              });
              fn2(retryCount);
              return;
            }
            if (
              tmp02.mode === 'chat' &&
              !tmp02.withoutGeminiThinking &&
              tmp36 &&
              shouldRetryWithoutGeminiThinking(arg02.statusCode, tmp12) &&
              tmp34 < tmp33.length
            ) {
              console.log(
                '  ↩️  OpenAI-compatible gateway rejected Gemini thinking fields — retrying chat/completions without thinking_config'
              );
              fn2(retryCount);
              return;
            }

            // 判断是否应该重试（在所有路径尝试完之后）
            if (
              tmp34 >= tmp33.length &&
              shouldRetryOpenAIRequest(arg02.statusCode, null, retryCount)
            ) {
              const isTimeout = false;
              const delay = calculateRetryDelay(retryCount, arg02.statusCode, {}, isTimeout);
              console.log(
                `  ↩️  [OpenAI] Retry ${retryCount + 1}/${process.env.MAX_RETRIES || 3} after ${delay}ms (HTTP ${arg02.statusCode})`
              );
              emitStreamStatus(
                'retry',
                `OpenAI retry ${retryCount + 1} after ${delay}ms (HTTP ${arg02.statusCode})`
              );

              setTimeout(() => {
                tmp34 = 0; // 重置路径索引
                fn2(retryCount + 1, null);
              }, delay);
              return;
            }

            circuitBreaker.recordFailure();
            tmp24.fail(tmp35);
          });
          return;
        }
        tmp23.setTimeout(0);
        attachOpenAISseStream(arg02, {
          processor,
          lifecycle: tmp24,
          timing: tmp10,
          clientResponse: arg1,
          onStreamEnd: fn,
          onDataReceived: () => {
            hasReceivedData = true;
          },
          onSuccess: () => {
            circuitBreaker.recordSuccess();
          },
          usageMeta: {
            ...attemptUsageMeta,
            requestBytes: Buffer.byteLength(tmp03),
          },
        });
      }
    );
    tmp23.setTimeout(OPENAI_REQUEST_TIMEOUT_MS, () => {
      if (tmp24.wasClosedByClient()) {
        return;
      }
      console.error('  ❌ OpenAI request timeout after ' + OPENAI_REQUEST_TIMEOUT_MS + 'ms');
      fn('request timeout ' + OPENAI_REQUEST_TIMEOUT_MS + 'ms');

      // 超时错误：判断是否应该重试
      const timeoutError = { code: 'ETIMEDOUT', timeout: true };
      if (!hasReceivedData && shouldRetryOpenAIRequest(0, timeoutError, retryCount)) {
        tmp23.destroy();
        const isTimeout = true;
        const delay = calculateRetryDelay(retryCount, 0, {}, isTimeout);
        console.log(
          `  ↩️  [OpenAI] Retry ${retryCount + 1}/${process.env.MAX_RETRIES || 3} after ${delay}ms (timeout)`
        );
        emitStreamStatus('retry', `OpenAI retry ${retryCount + 1} after ${delay}ms (timeout)`);

        setTimeout(() => {
          tmp34 = 0; // 重置路径索引
          fn2(retryCount + 1, null);
        }, delay);
        return;
      }

      circuitBreaker.recordFailure();
      tmp24.fail('[OpenAI Request Timeout]');
      tmp23.destroy();
    });
    tmp23.on('error', (arg03) => {
      if (
        tmp24.wasClosedByClient() &&
        (arg03.code === 'ECONNRESET' || arg03.code === 'ECONNABORTED')
      ) {
        return;
      }
      const tmp12 = describeNetworkError(arg03, tmp14.host, tmp14.parsed.port);
      console.error('  ❌ OpenAI request error: ' + tmp12);
      fn('request error: ' + (arg03.message || arg03.code || 'unknown'));

      // 网络错误：判断是否应该重试
      if (!hasReceivedData && shouldRetryOpenAIRequest(0, arg03, retryCount)) {
        const isTimeout = isTimeoutError(arg03);
        const delay = calculateRetryDelay(retryCount, 0, {}, isTimeout);
        const errorDesc = arg03.code || arg03.message || 'unknown';
        console.log(
          `  ↩️  [OpenAI] Retry ${retryCount + 1}/${process.env.MAX_RETRIES || 3} after ${delay}ms (${errorDesc})`
        );
        emitStreamStatus('retry', `OpenAI retry ${retryCount + 1} after ${delay}ms (${errorDesc})`);

        setTimeout(() => {
          tmp34 = 0; // 重置路径索引
          fn2(retryCount + 1, arg03);
        }, delay);
        return;
      }

      circuitBreaker.recordFailure();
      tmp24.fail('[OpenAI Connection Error] ' + tmp12);
    });
    tmp23.end(tmp03);
    if (tmp10 && tmp34 === 1) {
      tmp10.mark('upstream_request_sent');
    }
  };
  fn2();
}
function toOpenAIMessages(arg0, arg1) {
  const tmp2 = [];
  if (arg0) {
    const tmp02 = {
      role: 'developer',
      content: arg0,
    };
    tmp2.push(tmp02);
  }
  for (const tmp02 of arg1) {
    if (typeof tmp02.content === 'string') {
      const tmp03 = {
        role: tmp02.role,
        content: tmp02.content,
      };
      tmp2.push(tmp03);
      continue;
    }
    if (!Array.isArray(tmp02.content)) {
      tmp2.push({
        role: tmp02.role,
        content: String(tmp02.content),
      });
      continue;
    }
    if (tmp02.role === 'assistant') {
      let tmp03 = '';
      for (const tmp04 of tmp02.content) {
        if (tmp04.type === 'text') {
          tmp03 += tmp04.text;
        }
      }
      if (tmp03) {
        const tmp04 = {
          role: 'assistant',
          content: tmp03,
        };
        tmp2.push(tmp04);
      }
      for (const tmp04 of tmp02.content) {
        if (tmp04.type === 'tool_use' && tmp04.name) {
          tmp2.push({
            type: 'function_call',
            call_id: tmp04.id,
            name: tmp04.name,
            arguments: typeof tmp04.input === 'string' ? tmp04.input : JSON.stringify(tmp04.input),
          });
        }
      }
    } else if (tmp02.role === 'user') {
      const tmp03 = [];
      for (const tmp04 of tmp02.content) {
        if (tmp04.type === 'text') {
          tmp03.push(tmp04.text);
        } else if (tmp04.type === 'image') {
          const tmp05 = {
            type: 'input_image',
            image_url:
              'data:' +
              (tmp04.source?.media_type || 'image/png') +
              ';base64,' +
              (tmp04.source?.data || ''),
          };
          tmp03.push(tmp05);
        } else if (tmp04.type === 'tool_result') {
          tmp2.push({
            type: 'function_call_output',
            call_id: tmp04.tool_use_id,
            output:
              typeof tmp04.content === 'string' ? tmp04.content : JSON.stringify(tmp04.content),
          });
        }
      }
      if (tmp03.length > 0) {
        const tmp04 = tmp03.some((arg02) => typeof arg02 !== 'string');
        if (tmp04) {
          tmp2.push({
            role: 'user',
            content: tmp03.map((arg02) =>
              typeof arg02 === 'string'
                ? {
                    type: 'input_text',
                    text: arg02,
                  }
                : arg02
            ),
          });
        } else {
          tmp2.push({
            role: 'user',
            content: tmp03.join('\n'),
          });
        }
      }
    }
  }
  return tmp2;
}
