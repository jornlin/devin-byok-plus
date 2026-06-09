import _0x44b603 from "node:https";
import _0x522dd0 from "node:http";
import _0x50cd25 from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { parseGetChatMessageRequest } from "./parse-request.js";
import { buildErrorChunk } from "./build-response.js";
import { AnthropicStreamProcessor, parseSSEChunk } from "./anthropic-stream.js";
import { OpenAIStreamProcessor, parseOpenAISSEChunk } from "./openai-stream.js";
import { wrapEnvelope, endOfStreamEnvelope, streamHeaders } from "../connect.js";
import { getByokSlot, buildAnthropicThinkingPayload, buildGeminiThinkingPayload, thinkingEffortToAnthropicBudget, thinkingEffortToGeminiBudget, thinkingEffortToOpenAIReasoningEffort, detectModelProvider, usesGeminiThinkingLevel, sanitizeGeminiThinkingEffort } from "./byok-slots.js";
import { getProviderConfig, getRuntimeConfig, getSlotModel, getSlotThinkingEffort } from "./models.js";
import { buildTextDelta } from "./build-response.js";
import { emitChatStart, emitChatEnd, emitAIText, emitToolCall, emitStreamStatus, consumeInjectedMessages, getActiveMonitorTarget } from "../ws-bridge.js";
const keepAliveAgent = new _0x44b603.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5
});
const PROXY_DEVICE_ID = process.env.PROXY_DEVICE_ID || "";
const PROXY_CLIENT_VERSION = process.env.PROXY_CLIENT_VERSION || "0.0.0";
function proxyHeaders(_0x25bb08, _0x1487a3) {
  const _0xaca2e9 = Date.now().toString();
  const _0x2b7a6 = _0x50cd25.randomBytes(16).toString("hex");
  return {
    "x-proxy-device-id": PROXY_DEVICE_ID,
    "x-proxy-client-version": PROXY_CLIENT_VERSION,
    "x-proxy-timestamp": _0xaca2e9,
    "x-proxy-nonce": _0x2b7a6,
    "x-proxy-requested-model": _0x25bb08 || ""
  };
}
const _ENV_DEFAULT_MODEL = process.env.DEFAULT_MODEL || "";
const _ENV_MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "32768", 10);
function getDefaultModel() {
  return getRuntimeConfig().defaultModel || _ENV_DEFAULT_MODEL;
}
function getMaxTokens() {
  return getRuntimeConfig().maxTokens || _ENV_MAX_TOKENS;
}
function resolveConfiguredModel(_0x38c5dc) {
  const _0x131b00 = String(_0x38c5dc || "").trim();
  const _0x5e4f21 = getByokSlot(_0x131b00);
  if (_0x5e4f21) {
    const _0x4f8c12 = getSlotModel(_0x5e4f21);
    if (!_0x4f8c12) {
      return "";
    }
    return MODEL_MAP[_0x4f8c12] && MODEL_MAP[_0x4f8c12] !== "__DEFAULT__" ? MODEL_MAP[_0x4f8c12] : _0x4f8c12;
  }
  const _0x3871fc = _0x131b00 && !_0x131b00.startsWith("MODEL_") ? _0x131b00 : "";
  const _0x411ffb = MODEL_MAP[_0x131b00] || MODEL_MAP[_0x3871fc];
  const _0x1b37c8 = getDefaultModel();
  if (_0x411ffb === "__DEFAULT__") {
    return _0x1b37c8 || ANTHROPIC_FALLBACK_MODEL;
  }
  const _0x4979c6 = _0x411ffb || _0x1b37c8 || _0x3871fc || "";
  if (_0x4979c6) {
    return MODEL_MAP[_0x4979c6] || _0x4979c6;
  }
  if (/CLAUDE|SWE/i.test(_0x131b00)) {
    if (/THINK/i.test(_0x131b00)) {
      return ANTHROPIC_FALLBACK_THINKING_MODEL;
    } else {
      return ANTHROPIC_FALLBACK_MODEL;
    }
  }
  return ANTHROPIC_FALLBACK_MODEL;
}
function requiresConfiguredDefaultModel(_0x19adc2) {
  const _0x71f41c = String(_0x19adc2 || "").trim();
  const _0x5e4f21 = getByokSlot(_0x71f41c);
  if (_0x5e4f21) {
    return !getSlotModel(_0x5e4f21);
  }
  const _0x53292f = _0x71f41c && !_0x71f41c.startsWith("MODEL_") ? _0x71f41c : "";
  return (MODEL_MAP[_0x71f41c] || MODEL_MAP[_0x53292f]) === "__DEFAULT__";
}
function writeModelConfigError(_0x237854, _0x390b8d, _0x1b9b8f) {
  _0x237854.writeHead(200, streamHeaders());
  _0x237854.write(wrapEnvelope(buildErrorChunk(_0x390b8d, _0x1b9b8f)));
  _0x237854.write(endOfStreamEnvelope());
  _0x237854.end();
}
const OPENAI_REQUEST_TIMEOUT_MS = parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS || "300000", 10);
const OPENAI_SSE_IDLE_TIMEOUT_MS = parseInt(process.env.OPENAI_SSE_IDLE_TIMEOUT_MS || "120000", 10);
const ANTHROPIC_REQUEST_TIMEOUT_MS = parseInt(process.env.ANTHROPIC_REQUEST_TIMEOUT_MS || "300000", 10);
const ANTHROPIC_SSE_IDLE_TIMEOUT_MS = parseInt(process.env.ANTHROPIC_SSE_IDLE_TIMEOUT_MS || "120000", 10);
const OPENAI_REASONING_SUMMARY = process.env.OPENAI_REASONING_SUMMARY || "auto";
const OPENAI_ENABLE_REASONING = process.env.OPENAI_ENABLE_REASONING !== "false";
const EXPOSE_BACKEND_INFO = process.env.EXPOSE_BACKEND_INFO !== "false";
const ANTHROPIC_FALLBACK_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_FALLBACK_THINKING_MODEL = "claude-sonnet-4-20250514-thinking";
function createTimingTracker(_0x5438ba, _0x409673 = {}, _0x1f1d52 = null) {
  const _0x256796 = Date.now();
  const _0x5f574b = new Map();
  const _0x59e4ac = Object.entries(_0x409673).filter(([, _0x427632]) => _0x427632 !== undefined && _0x427632 !== null && _0x427632 !== "").map(([_0x3947a7, _0x39d14b]) => _0x3947a7 + "=" + _0x39d14b).join(" ");
  const _0x46dc13 = _0x59e4ac ? "  ⏱️  " + _0x5438ba + " " + _0x59e4ac : "  ⏱️  " + _0x5438ba;
  const _0x253fdb = (_0x1a04e2, _0x55890f = "") => {
    if (_0x5f574b.has(_0x1a04e2)) {
      return;
    }
    const _0x535d25 = Date.now() - _0x256796;
    _0x5f574b.set(_0x1a04e2, _0x535d25);
    console.log(_0x46dc13 + " " + _0x1a04e2 + ": " + _0x535d25 + "ms" + (_0x55890f ? " " + _0x55890f : ""));
    emitStreamStatus("timing", _0x5438ba + " " + _0x1a04e2 + ": " + _0x535d25 + "ms" + (_0x55890f ? " " + _0x55890f : ""), _0x1f1d52);
  };
  const _0x3d050a = (_0x5abae8, _0x15cb67 = "") => {
    const _0x1859f2 = Date.now() - _0x256796;
    console.log(_0x46dc13 + " " + _0x5abae8 + ": total=" + _0x1859f2 + "ms" + (_0x15cb67 ? " " + _0x15cb67 : ""));
    emitStreamStatus("timing", _0x5438ba + " " + _0x5abae8 + ": total=" + _0x1859f2 + "ms" + (_0x15cb67 ? " " + _0x15cb67 : ""), _0x1f1d52);
  };
  return {
    mark: _0x253fdb,
    summary: _0x3d050a,
    elapsed: () => Date.now() - _0x256796
  };
}
function logNoToolsCalled(_0x496b08, _0x16a21c, _0xa522d2) {
  const _0x17178c = Array.isArray(_0xa522d2) ? _0xa522d2.map(_0x36c8f2 => _0x36c8f2 && _0x36c8f2.name).filter(Boolean) : [];
  const _0xbced32 = _0x17178c.length ? "; enabled=" + _0x17178c.length + " [" + _0x17178c.join(", ") + "]" : "";
  console.log("  🔧 No tools called (" + _0x496b08 + " " + _0x16a21c + "; model output did not reach tool-call stage" + _0xbced32 + ")");
  emitStreamStatus("error", _0x496b08 + " " + _0x16a21c + "; no tool calls emitted");
  emitChatEnd("error", []);
}
function sanitizeLogBody(_0x153d0e) {
  return _0x153d0e.slice(0, 500).replace(/(?:sk-[a-zA-Z0-9_-]{10,}|Bearer\s+\S+)/g, "[REDACTED]").replace(/(?:key-[a-zA-Z0-9_-]{10,})/g, "[REDACTED]").replace(/(?:"(?:api[_-]?key|token|secret|password|authorization)":\s*"[^"]{6,}")/gi, "\"$1\":\"[REDACTED]\"");
}
function buildProviderErrorMessage(_0x12769b, _0x4eaaee, _0x31823b) {
  const _0xbee046 = String(_0x31823b || "").toLowerCase();
  if (_0x4eaaee === 401 && _0xbee046.includes("invalid") && _0xbee046.includes("key")) {
    return "[" + _0x12769b + " Error 401] Invalid API key. If using the cloud gateway, check the server-side upstream key; otherwise update the local " + _0x12769b + " key in the control panel.";
  }
  if (_0x4eaaee === 503 && (_0xbee046.includes("no available accounts") || _0xbee046.includes("overloaded") || _0xbee046.includes("unavailable"))) {
    return "[" + _0x12769b + " Error 503] 当前模型池暂无可用资源或上游过载，请切换到 Sonnet/默认模型后重试。";
  }
  if (_0x4eaaee === 403 && _0xbee046.includes("/v1/messages")) {
    return "[" + _0x12769b + " Error 403] 当前分组不允许 /v1/messages 通道，请切换 OpenAI 兼容模型或使用支持 Anthropic Messages 的分组。";
  }
  return "[" + _0x12769b + " Error " + _0x4eaaee + "]";
}
const OPENAI_PREFIXES = ["gpt-", "MODEL_GPT"];
const GEMINI_PREFIXES = ["gemini-", "MODEL_GOOGLE_GEMINI"];
const _0x3076a7 = {
  "gpt-5-4-low": "gpt-5.4",
  "gpt-5-4-high": "gpt-5.4",
  "gpt-5-4-xhigh": "gpt-5.4",
  "gpt-5-4-xhigh-priority": "gpt-5.4",
  MODEL_GPT_4O: "gpt-4o",
  MODEL_GPT_4O_MINI: "gpt-4o-mini",
  MODEL_CLAUDE_3_5_SONNET: ANTHROPIC_FALLBACK_MODEL,
  MODEL_CLAUDE_3_5_HAIKU: "claude-3-5-haiku-20241022",
  MODEL_CLAUDE_3_OPUS: "__DEFAULT__",
  MODEL_CLAUDE_4_OPUS: "__DEFAULT__",
  MODEL_CLAUDE_4_OPUS_BYOK: "__DEFAULT__",
  MODEL_CLAUDE_4_OPUS_THINKING_BYOK: "__DEFAULT__",
  MODEL_CLAUDE_OPUS_4: "__DEFAULT__",
  MODEL_CLAUDE_OPUS_4_1: "__DEFAULT__",
  MODEL_CLAUDE_SONNET_4: ANTHROPIC_FALLBACK_MODEL,
  MODEL_SWE_1: ANTHROPIC_FALLBACK_MODEL,
  MODEL_SWE_1_5: ANTHROPIC_FALLBACK_MODEL,
  MODEL_SWE_1_5_SLOW: ANTHROPIC_FALLBACK_MODEL,
  "claude-opus-4-6-thinking": "claude-opus-4-6-thinking",
  "claude-opus-4-7-thinking": "claude-opus-4-7-thinking",
  "claude-opus-4-8-thinking": "claude-opus-4-8-thinking",
  "claude-opus-4-6": "claude-opus-4-6",
  "claude-opus-4-7": "claude-opus-4-7",
  "claude-opus-4-8": "claude-opus-4-8",
  "claude-sonnet-4-6-thinking": ANTHROPIC_FALLBACK_THINKING_MODEL,
  MODEL_CHAT_11121: "__DEFAULT__",
  MODEL_GOOGLE_GEMINI_2_5_FLASH: "__DEFAULT__",
  MODEL_GOOGLE_GEMINI_2_5_PRO: "__DEFAULT__",
  MODEL_CHAT: "__DEFAULT__"
};
const MODEL_MAP = _0x3076a7;
function getServiceTier(_0x51180e) {
  if (!_0x51180e) {
    return undefined;
  }
  if (_0x51180e.endsWith("-priority")) {
    return "fast";
  }
  return undefined;
}
function isOpenAIModel(_0x4bff79) {
  if (!_0x4bff79) {
    return false;
  }
  const _0x2483dd = stripThinkingSuffix(_0x4bff79).toLowerCase();
  return OPENAI_PREFIXES.some(_0x237dac => _0x2483dd.startsWith(_0x237dac.toLowerCase())) || _0x2483dd.includes("claude-code");
}
function isGeminiModel(_0x4bff79) {
  if (!_0x4bff79) {
    return false;
  }
  const _0x2483dd = stripThinkingSuffix(_0x4bff79).toLowerCase();
  return GEMINI_PREFIXES.some(_0x237dac => _0x2483dd.startsWith(_0x237dac.toLowerCase())) || detectModelProvider(_0x4bff79) === "gemini";
}
function isOpenAICompatibleModel(_0x4bff79) {
  return isOpenAIModel(_0x4bff79) || isGeminiModel(_0x4bff79);
}
function isThinkingModel(_0x3c3bb4) {
  return String(_0x3c3bb4 || "").trim().toLowerCase().endsWith("-thinking");
}
function stripThinkingSuffix(_0x6cda65) {
  return String(_0x6cda65 || "").trim().replace(/-thinking$/i, "");
}
function isClaudeModel(_0x4bff79) {
  const _0x2483dd = stripThinkingSuffix(_0x4bff79).toLowerCase();
  return _0x2483dd.startsWith("claude-") || _0x2483dd.startsWith("model_claude");
}
function resolveSlotThinkingEffort(_0x5e4f21, _0x71369e) {
  if (_0x5e4f21 === 1 || _0x5e4f21 === 2) {
    return getSlotThinkingEffort(_0x5e4f21) || (_0x5e4f21 === 1 ? _0x71369e.openaiReasoningEffort || "" : "");
  }
  return _0x71369e.openaiReasoningEffort || "";
}
function buildThinkingOptions(_0x9a7c77, _0x27f3b9, _0x5e4f21 = null) {
  const _0x71369e = getRuntimeConfig();
  const _0x225a82 = isThinkingModel(_0x9a7c77);
  const _0x4c8e12 = resolveSlotThinkingEffort(_0x5e4f21, _0x71369e);
  const _0x1f9a44 = isClaudeModel(_0x9a7c77);
  const _0xgemini = isGeminiModel(_0x9a7c77);
  const _0xgpt = isOpenAIModel(_0x9a7c77);
  let _0x3870fc = false;
  let _0x416676 = "";
  if (_0x27f3b9 || _0xgpt) {
    _0x3870fc = _0x225a82 || _0x71369e.openaiThinkingEnabled === true || !!_0x4c8e12;
    _0x416676 = _0x3870fc ? _0x4c8e12 || _0x71369e.openaiReasoningEffort || "" : "";
  } else if (_0xgemini) {
    _0x3870fc = !!sanitizeGeminiThinkingEffort(_0x4c8e12) || _0x225a82 || _0x5e4f21 === 2;
    _0x416676 = sanitizeGeminiThinkingEffort(_0x4c8e12) || (_0x3870fc && (_0x5e4f21 === 2 || _0x225a82) ? "medium" : "");
  } else if (_0x1f9a44) {
    _0x3870fc = !!_0x4c8e12 || _0x225a82 || _0x5e4f21 === 2;
    _0x416676 = _0x3870fc ? _0x4c8e12 || (_0x5e4f21 === 2 || _0x225a82 ? "medium" : "") : "";
  } else {
    _0x3870fc = _0x225a82;
    _0x416676 = "";
  }
  const _0x3a90a0 = {
    thinkingEnabled: _0x3870fc,
    reasoningEffort: _0x416676,
    thinkingBudget: _0x3870fc ? (_0xgemini ? usesGeminiThinkingLevel(_0x9a7c77) ? 0 : thinkingEffortToGeminiBudget(_0x416676) : thinkingEffortToAnthropicBudget(_0x416676)) || (_0xgemini ? 8192 : 10000) : 0,
    provider: _0xgemini ? "gemini" : _0xgpt || _0x27f3b9 ? "gpt" : _0x1f9a44 ? "claude" : detectModelProvider(_0x9a7c77) || "claude"
  };
  return _0x3a90a0;
}
export function handleGetChatMessage(_0x46a644, _0x4af334, _0x4db7a1) {
  let {
    systemPrompt: _0x447b43,
    messages: _0x2132f5,
    tools: _0x1fd72c,
    toolChoice: _0x28f2d4,
    requestedModel: _0x3275c5,
    initiator: _0x38d79d
  } = parseGetChatMessageRequest(_0x4db7a1, _0x46a644.headers);
  const _0x482d16 = _0x50cd25.randomUUID();
  const _0x5e4f21 = getByokSlot(_0x3275c5);
  if (requiresConfiguredDefaultModel(_0x3275c5)) {
    const _0xd38e5c = _0x5e4f21 === 2 ? "未配置 BYOK #2（Thinking）。请在侧栏填写 API、加载并选择模型。" : _0x5e4f21 === 1 ? "未配置 BYOK #1（Opus 4 BYOK）。请在侧栏填写 API、加载并选择模型。" : "未选择默认模型。请先回到 Windsurf BYOK Bridge，点击“加载模型”并选择默认模型后再提问。";
    console.error("  ❌ Missing model config for requested model " + (_0x3275c5 || "unknown"));
    writeModelConfigError(_0x4af334, _0x482d16, _0xd38e5c);
    return;
  }
  let _0x310f46 = resolveConfiguredModel(_0x3275c5);
  const _0x66946d = isOpenAICompatibleModel(_0x310f46);
  const _0xa49040 = buildThinkingOptions(_0x310f46, isOpenAIModel(_0x310f46), _0x5e4f21);
  _0x310f46 = stripThinkingSuffix(_0x310f46);
  if (!_0x310f46) {
    const _0x5bf734 = "未解析到可用模型。请先在 Windsurf BYOK Bridge 中加载模型并选择默认模型。";
    console.error("  ❌ Empty resolved model for requested model " + (_0x3275c5 || "unknown"));
    writeModelConfigError(_0x4af334, _0x482d16, _0x5bf734);
    return;
  }
  const _0x3b53ef = getProviderConfig(_0x5e4f21);
  const _0xgeminiModel = isGeminiModel(_0x310f46);
  const requiredKey = _0x66946d ? (_0xgeminiModel ? _0x3b53ef.openai.apiKey || _0x3b53ef.anthropic.apiKey : _0x3b53ef.openai.apiKey) : _0x3b53ef.anthropic.apiKey;
  if (!requiredKey) {
    const _0x5afb0f = _0x66946d ? (_0xgeminiModel ? "Gemini/OpenAI" : "OpenAI") : "Anthropic";
    console.error("  ❌ No " + _0x5afb0f + " API key set — cannot forward " + _0x3275c5);
    const _0x943279 = _0x50cd25.randomUUID();
    _0x4af334.writeHead(200, streamHeaders());
    _0x4af334.write(wrapEnvelope(buildErrorChunk(_0x943279, "No " + _0x5afb0f + " API key configured")));
    _0x4af334.write(endOfStreamEnvelope());
    _0x4af334.end();
    return;
  }
  const _0x372407 = getServiceTier(_0x3275c5);
  const _0x59fc71 = _0xgeminiModel ? "Gemini" : _0x66946d ? "OpenAI" : "Anthropic";
  if (EXPOSE_BACKEND_INFO) {
    _0x447b43 += "\n\nCurrent backend: " + _0x310f46 + " (" + _0x59fc71 + ").";
  }
  const _0x57a0e5 = consumeInjectedMessages();
  if (_0x57a0e5.length > 0) {
    for (const _0xd69238 of _0x57a0e5) {
      const _0x110676 = {
        role: _0xd69238.role,
        content: _0xd69238.content
      };
      _0x2132f5.push(_0x110676);
    }
    console.log("  📨 Injected " + _0x57a0e5.length + " message(s) from App");
  }
  const _0xa886a1 = getActiveMonitorTarget();
  console.log("  � Monitor target: " + _0xa886a1);
  console.log("  �🧠 Model: " + _0x3275c5 + " → " + _0x310f46 + " (" + _0x59fc71 + ")" + (_0x372407 ? " [tier: " + _0x372407 + "]" : ""));
  console.log("  📝 System prompt: " + _0x447b43.length + " chars");
  console.log("  💬 Messages: " + _0x2132f5.length);
  if (_0x1fd72c) {
    console.log("  🔧 Tools: " + _0x1fd72c.length);
  }
  if (_0x28f2d4) {
    console.log("  🔧 ToolChoice: " + JSON.stringify(_0x28f2d4));
  }
  emitChatStart(_0x310f46, _0x2132f5.length, _0x1fd72c ? _0x1fd72c.length : 0, _0xa886a1);
  if (_0x2132f5.length > 0) {
    const _0x598e42 = _0x2132f5.map(_0x5151bb => _0x5151bb.role).join(",");
    console.log("  💬 Roles: " + _0x598e42);
    for (let _0x5e37a6 = 1; _0x5e37a6 < _0x2132f5.length; _0x5e37a6++) {
      if (_0x2132f5[_0x5e37a6].role === _0x2132f5[_0x5e37a6 - 1].role) {
        console.warn("  ⚠️  Consecutive " + _0x2132f5[_0x5e37a6].role + " at index " + (_0x5e37a6 - 1) + "," + _0x5e37a6 + " — merge failed?");
      }
    }
  }
  const _0x1e432e = {
    provider: _0x59fc71,
    model: _0x310f46,
    requested: _0x3275c5
  };
  const _0x5062ad = createTimingTracker("chat", _0x1e432e, _0xa886a1);
  _0x5062ad.mark("parsed", "messages=" + _0x2132f5.length + " tools=" + (_0x1fd72c ? _0x1fd72c.length : 0));
  if (_0x66946d) {
    const _0x20ae65 = {
      systemPrompt: _0x447b43,
      messages: _0x2132f5,
      tools: _0x1fd72c,
      toolChoice: _0x28f2d4,
      resolvedModel: _0x310f46,
      serviceTier: _0x372407,
      messageId: _0x482d16,
      initiator: _0x38d79d,
      timing: _0x5062ad,
      monitorTargetId: _0xa886a1,
      thinkingOptions: _0xa49040,
      byokSlot: _0x5e4f21
    };
    streamOpenAI(_0x46a644, _0x4af334, _0x20ae65);
  } else {
    const _0x33c6d4 = {
      systemPrompt: _0x447b43,
      messages: _0x2132f5,
      tools: _0x1fd72c,
      toolChoice: _0x28f2d4,
      resolvedModel: _0x310f46,
      messageId: _0x482d16,
      timing: _0x5062ad,
      monitorTargetId: _0xa886a1,
      thinkingOptions: _0xa49040,
      byokSlot: _0x5e4f21
    };
    streamAnthropic(_0x46a644, _0x4af334, _0x33c6d4);
  }
}
function describeNetworkError(_0x327502, _0x1a561f, _0x19f2a6) {
  const _0x559a75 = _0x327502?.code || "";
  const _0x49e6f5 = _0x327502?.message || String(_0x327502 || "unknown error");
  const _0x3c823d = /^198\.(18|19)\./.test(_0x1a561f || "");
  if (_0x559a75 === "ETIMEDOUT") {
    const _0x35363f = _0x3c823d ? "可能是 VPN/TUN/代理分流生成的假 IP 未正确回连，请检查分流规则或将目标域名设为直连。" : "请检查当前网络、系统代理或上游出口是否可达。";
    return _0x49e6f5 + " (" + _0x35363f + ")";
  }
  if (_0x559a75 === "ECONNRESET") {
    return _0x49e6f5 + " (上游连接被重置，常见于网络抖动、代理中途断链或对端主动关闭)";
  }
  return "" + _0x49e6f5 + (_0x1a561f ? " (" + _0x1a561f + ":" + _0x19f2a6 + ")" : "");
}
function createStreamLifecycle(_0x5351ce, _0x4551a2, _0x67a2b9, _0x1c83a9, _0x35a12b) {
  let _0x45e70d = false;
  let _0x4860ec = false;
  let _0x277a26 = null;
  let _0x17fcd6 = Date.now();
  const _0x1cdfc4 = 3000;
  const _0x3c45ca = () => {
    if (_0x277a26) {
      return;
    }
    _0x277a26 = setInterval(() => {
      if (_0x4860ec || _0x5351ce.writableEnded || _0x45e70d) {
        clearInterval(_0x277a26);
        _0x277a26 = null;
        return;
      }
      if (Date.now() - _0x17fcd6 >= _0x1cdfc4) {
        _0x5351ce.write(wrapEnvelope(buildTextDelta(_0x1c83a9, "", 0)));
      }
    }, _0x1cdfc4);
  };
  const _0x5d5a23 = () => {
    if (_0x277a26) {
      clearInterval(_0x277a26);
      _0x277a26 = null;
    }
  };
  const _0x5bf43f = _0x326cff => {
    if (!_0x5351ce.writableEnded && !_0x45e70d) {
      if (_0x35a12b) {
        _0x35a12b.mark("first_windsurf_write");
      }
      _0x5351ce.write(_0x326cff);
      _0x17fcd6 = Date.now();
    }
  };
  const _0x3d165a = _0x4f332a => {
    if (_0x4860ec || _0x5351ce.writableEnded || _0x45e70d) {
      return false;
    }
    _0x4860ec = true;
    _0x5d5a23();
    _0x5bf43f(endOfStreamEnvelope());
    _0x5351ce.end();
    if (_0x4f332a) {
      console.log(_0x4f332a);
    }
    if (_0x35a12b) {
      _0x35a12b.summary("finalized");
    }
    return true;
  };
  const _0x357def = (_0x5480e5, _0x2c2e54) => {
    if (_0x45e70d || _0x5351ce.writableEnded) {
      return false;
    }
    if (_0x5480e5) {
      _0x5bf43f(wrapEnvelope(buildErrorChunk(_0x1c83a9, _0x5480e5)));
    }
    return _0x3d165a(_0x2c2e54);
  };
  _0x5351ce.on("close", () => {
    if (_0x5351ce.writableEnded || _0x45e70d) {
      return;
    }
    _0x45e70d = true;
    _0x4860ec = true;
    _0x5d5a23();
    const _0x342f0e = _0x4551a2();
    if (_0x342f0e && !_0x342f0e.destroyed) {
      console.log("  ℹ️  Client disconnected, stopping " + _0x67a2b9 + " upstream stream");
      if (_0x35a12b) {
        _0x35a12b.summary("client_disconnected");
      }
      _0x342f0e.destroy();
    }
  });
  const _0xf6eb0f = {
    safeWrite: _0x5bf43f,
    finalize: _0x3d165a,
    fail: _0x357def,
    startHeartbeat: _0x3c45ca,
    wasClosedByClient: () => _0x45e70d
  };
  return _0xf6eb0f;
}
function shouldForwardOpenAITools(_0x17c1f2, _0x45c676) {
  if (!_0x45c676 || _0x45c676.length === 0) {
    return false;
  }
  return true;
}
function getForwardedToolChoice(_0x3fc0bf, _0x2c0bf5, _0x3658f4) {
  if (!_0x2c0bf5 || !_0x3fc0bf || _0x3fc0bf.length === 0) {
    return undefined;
  }
  if (_0x2c0bf5.type !== "tool") {
    return _0x2c0bf5;
  }
  if (_0x3fc0bf.some(_0x5c47fb => _0x5c47fb?.name === _0x2c0bf5.name)) {
    return _0x2c0bf5;
  }
  console.log("  ⚠️  Ignoring " + _0x3658f4 + " named tool_choice \"" + _0x2c0bf5.name + "\" because the tool definition is unavailable");
  return undefined;
}
function streamAnthropic(_0x3eac7f, _0x3dd70e, {
  systemPrompt: _0x3d6981,
  messages: _0x458020,
  tools: _0x5545ee,
  toolChoice: _0x389d01,
  resolvedModel: _0x7ec0a4,
  messageId: _0x3c2b1e,
  timing: _0x46bbb6,
  monitorTargetId: _0x5033ed,
  thinkingOptions: _0x7cee92,
  byokSlot: _0x5e4f21 = null
}) {
  const _0x29831c = getProviderConfig(_0x5e4f21).anthropic;
  const _0x3bd7af = getForwardedToolChoice(_0x5545ee, _0x389d01, "Anthropic");
  const _0x1adda5 = {
    model: _0x7ec0a4,
    system: _0x3d6981 || undefined,
    messages: _0x458020,
    stream: true,
    max_tokens: getMaxTokens()
  };
  if (_0x5545ee && _0x5545ee.length > 0) {
    _0x1adda5.tools = _0x5545ee;
    if (_0x3bd7af) {
      _0x1adda5.tool_choice = _0x3bd7af;
    }
  }
  if (_0x7cee92?.thinkingEnabled) {
    const _0x5f3a12 = buildAnthropicThinkingPayload(_0x7ec0a4, _0x7cee92.reasoningEffort, "medium");
    if (_0x5f3a12?.thinking) {
      _0x1adda5.thinking = _0x5f3a12.thinking;
      if (_0x5f3a12.output_config) {
        _0x1adda5.output_config = _0x5f3a12.output_config;
      }
      const _0x4a8f12 = _0x1adda5.thinking.budget_tokens || _0x7cee92.thinkingBudget || thinkingEffortToAnthropicBudget(_0x7cee92.reasoningEffort) || 0;
      if (_0x4a8f12 > 0 && _0x1adda5.max_tokens <= _0x4a8f12) {
        _0x1adda5.max_tokens = Math.min(getMaxTokens(), _0x4a8f12 + 8192);
      }
    }
  }
  const _0xthinkLog = _0x1adda5.thinking ? _0x1adda5.thinking.type === "adaptive" ? "adaptive effort=" + (_0x1adda5.output_config?.effort || _0x7cee92?.reasoningEffort || "medium") : "enabled budget=" + (_0x1adda5.thinking.budget_tokens || "?") + (_0x7cee92?.reasoningEffort ? " effort=" + _0x7cee92.reasoningEffort : "") : "off";
  console.log("  🧩 Anthropic/Sub2API thinking: " + _0xthinkLog);
  const _0xbfd0ee = JSON.stringify(_0x1adda5);
  _0x3dd70e.writeHead(200, streamHeaders());
  const processor = new AnthropicStreamProcessor(_0x3c2b1e, _0x7ec0a4, _0x5033ed);
  let _0x419708;
  const _0x265efd = createStreamLifecycle(_0x3dd70e, () => _0x419708, "Anthropic", _0x3c2b1e, _0x46bbb6);
  const _0x3044e0 = _0x29831c.useHttp ? _0x522dd0 : _0x44b603;
  const _0x207207 = _0x29831c.parsed.port !== 443 ? _0x29831c.parsed.port : _0x29831c.useHttp ? 80 : 443;
  console.log("  → Anthropic " + _0x29831c.host + _0x29831c.apiPath + " model=" + _0x7ec0a4 + " key=" + (_0x29831c.apiKey ? "set" : "empty"));
  if (_0x46bbb6) {
    _0x46bbb6.mark("upstream_request_start", "bytes=" + Buffer.byteLength(_0xbfd0ee));
  }
  _0x419708 = _0x3044e0.request({
    hostname: _0x29831c.parsed.hostname,
    port: _0x207207,
    path: _0x29831c.apiPath,
    method: "POST",
    agent: _0x29831c.useHttp ? undefined : keepAliveAgent,
    rejectUnauthorized: !_0x29831c.useHttp && _0x29831c.parsed.port === 443,
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      "anthropic-version": "2023-06-01",
      "x-api-key": _0x29831c.apiKey,
      "content-length": Buffer.byteLength(_0xbfd0ee),
      ...proxyHeaders(_0x7ec0a4, Buffer.byteLength(_0xbfd0ee))
    }
  }, _0x20c96d => {
    if (_0x46bbb6) {
      _0x46bbb6.mark("upstream_headers", "status=" + _0x20c96d.statusCode);
    }
    let sseBuffer = "";
    if (_0x20c96d.statusCode !== 200) {
      console.error("  ❌ Anthropic API returned " + _0x20c96d.statusCode);
      let _0x59e8d9 = "";
      _0x20c96d.setEncoding("utf8");
      _0x20c96d.on("data", _0x3fbcef => _0x59e8d9 += _0x3fbcef);
      _0x20c96d.on("end", () => {
        console.error("  ❌ Body: " + sanitizeLogBody(_0x59e8d9));
        const _0x4e317a = buildProviderErrorMessage("Anthropic", _0x20c96d.statusCode, _0x59e8d9);
        _0x265efd.fail(_0x4e317a);
      });
      return;
    }
    _0x20c96d.setEncoding("utf8");
    let _0x3b3902 = null;
    let _0x4aa0c5 = false;
    _0x265efd.startHeartbeat();
    const _0x4dc716 = () => {
      if (_0x3b3902) {
        clearTimeout(_0x3b3902);
        _0x3b3902 = null;
      }
    };
    const _0x3db9cd = () => {
      _0x4dc716();
      _0x3b3902 = setTimeout(() => {
        if (_0x4aa0c5 || _0x265efd.wasClosedByClient()) {
          return;
        }
        console.error("  ❌ Anthropic stream stalled after " + ANTHROPIC_SSE_IDLE_TIMEOUT_MS + "ms without data");
        _0x265efd.fail("[Anthropic Stream Timeout]");
        _0x20c96d.destroy();
      }, ANTHROPIC_SSE_IDLE_TIMEOUT_MS);
    };
    function processPart(_0xcda108) {
      const _0x4721b = parseSSEChunk(_0xcda108 + "\n\n");
      for (const _0x4d105e of _0x4721b) {
        const _0x180fc4 = processor.processEvent(_0x4d105e);
        for (const _0x87f2d3 of _0x180fc4) {
          _0x265efd.safeWrite(wrapEnvelope(_0x87f2d3));
        }
      }
      if (processor.isDone) {
        _0x4aa0c5 = true;
        _0x4dc716();
        _0x265efd.finalize("  ✅ Stream done (stop: " + processor.stopReason + ")");
      }
    }
    _0x3db9cd();
    _0x20c96d.on("data", _0x5d1cbb => {
      if (_0x46bbb6) {
        _0x46bbb6.mark("first_upstream_chunk", "bytes=" + Buffer.byteLength(_0x5d1cbb));
      }
      _0x3db9cd();
      sseBuffer += _0x5d1cbb;
      const _0x4d0470 = sseBuffer.split("\n\n");
      sseBuffer = _0x4d0470.pop();
      for (const _0x11c187 of _0x4d0470) {
        processPart(_0x11c187);
      }
    });
    _0x20c96d.on("end", () => {
      _0x4aa0c5 = true;
      _0x4dc716();
      if (sseBuffer.trim()) {
        processPart(sseBuffer);
      }
      if (!processor.isDone && !_0x3dd70e.writableEnded) {
        console.log("  ⚠️  Anthropic stream ended without message_stop — forcing stop");
        const _0x2b661c = processor.processEvent({
          event: "message_stop",
          data: {}
        });
        for (const _0xffd903 of _0x2b661c) {
          _0x265efd.safeWrite(wrapEnvelope(_0xffd903));
        }
      }
      _0x265efd.finalize("  ✅ Stream ended");
    });
    _0x20c96d.on("aborted", () => {
      _0x4aa0c5 = true;
      _0x4dc716();
      if (_0x265efd.wasClosedByClient()) {
        return;
      }
      console.error("  ❌ Anthropic stream aborted before completion");
      _0x265efd.fail("[Stream Aborted]");
    });
    _0x20c96d.on("error", _0x1955ec => {
      _0x4aa0c5 = true;
      _0x4dc716();
      if (_0x265efd.wasClosedByClient()) {
        return;
      }
      console.error("  ❌ Anthropic stream error: " + _0x1955ec.message);
      _0x265efd.fail("[Stream Error]");
    });
  });
  _0x419708.setTimeout(ANTHROPIC_REQUEST_TIMEOUT_MS, () => {
    if (_0x265efd.wasClosedByClient()) {
      return;
    }
    console.error("  ❌ Anthropic request timeout after " + ANTHROPIC_REQUEST_TIMEOUT_MS + "ms");
    _0x265efd.fail("[Anthropic Request Timeout]");
    _0x419708.destroy();
  });
  _0x419708.on("error", _0x464f76 => {
    if (_0x265efd.wasClosedByClient() && (_0x464f76.code === "ECONNRESET" || _0x464f76.code === "ECONNABORTED")) {
      return;
    }
    const _0x2226f6 = describeNetworkError(_0x464f76, _0x29831c.host, _0x29831c.parsed.port);
    console.error("  ❌ Anthropic request error: " + _0x2226f6);
    _0x265efd.fail("[Anthropic Connection Error] " + _0x2226f6);
  });
  _0x419708.end(_0xbfd0ee);
  if (_0x46bbb6) {
    _0x46bbb6.mark("upstream_request_sent");
  }
}
function streamOpenAI(_0x4b6c79, _0x28d0a9, {
  systemPrompt: _0x32d210,
  messages: _0x70f066,
  tools: _0xf4bdb7,
  toolChoice: _0xe8a1a3,
  resolvedModel: _0x146a61,
  serviceTier: _0x398334,
  messageId: _0x595371,
  initiator: _0x43e921,
  timing: _0x2266aa,
  monitorTargetId: _0xb98c57,
  thinkingOptions: _0x1deaf0,
  byokSlot: _0x5e4f21 = null
}) {
  const _0x173e0f = getProviderConfig(_0x5e4f21).openai;
  const _0x2b845b = toOpenAIMessages(_0x32d210, _0x70f066);
  const _0x479284 = shouldForwardOpenAITools(_0x43e921, _0xf4bdb7);
  const _0x197741 = _0x479284 ? getForwardedToolChoice(_0xf4bdb7, _0xe8a1a3, "OpenAI") : undefined;
  const _0x45aa5a = {
    model: _0x146a61,
    input: _0x2b845b,
    stream: true
  };
  const _0x3b6480 = _0x45aa5a;
  const _0x1f66e9 = getMaxTokens();
  if (_0x1f66e9 > 0) {
    _0x3b6480.max_output_tokens = _0x1f66e9;
  }
  const _0x9e7783 = _0x1deaf0?.thinkingEnabled === true;
  if (OPENAI_ENABLE_REASONING && _0x9e7783) {
    if (isGeminiModel(_0x146a61)) {
      const _0xgeminiThinking = buildGeminiThinkingPayload(_0x146a61, _0x1deaf0?.reasoningEffort);
      if (_0xgeminiThinking?.thinkingConfig) {
        const _0xcfg = {};
        if (_0xgeminiThinking.thinkingConfig.thinking_level) {
          _0xcfg.thinking_level = _0xgeminiThinking.thinkingConfig.thinking_level;
        } else if (_0xgeminiThinking.thinkingConfig.thinking_budget) {
          _0xcfg.thinking_budget = _0xgeminiThinking.thinkingConfig.thinking_budget;
        }
        _0x3b6480.thinking_config = _0xcfg;
        _0x3b6480.extra_body = {
          ...(_0x3b6480.extra_body || {}),
          thinking_config: _0xcfg
        };
      }
    } else {
      const _0x5c803a = {
        summary: OPENAI_REASONING_SUMMARY
      };
      _0x3b6480.reasoning = _0x5c803a;
      if (_0x1deaf0?.reasoningEffort) {
        _0x3b6480.reasoning.effort = thinkingEffortToOpenAIReasoningEffort(_0x1deaf0.reasoningEffort);
      }
    }
  }
  console.log("  🧩 OpenAI/Sub2API reasoning: " + (isGeminiModel(_0x146a61) ? _0x3b6480.thinking_config ? usesGeminiThinkingLevel(_0x146a61) ? "gemini level=" + (_0x3b6480.thinking_config.thinking_level || "?") : "gemini budget=" + (_0x3b6480.thinking_config.thinking_budget || "?") : "off" : _0x3b6480.reasoning ? _0x3b6480.reasoning.effort || "default" : "off"));
  if (_0x398334) {
    _0x3b6480.service_tier = _0x398334;
  }
  if (_0x479284) {
    _0x3b6480.tools = _0xf4bdb7.map(_0x2dd2d0 => ({
      type: "function",
      name: _0x2dd2d0.name,
      description: _0x2dd2d0.description || "",
      parameters: typeof _0x2dd2d0.input_schema === "string" ? JSON.parse(_0x2dd2d0.input_schema) : _0x2dd2d0.input_schema
    }));
    if (_0x197741) {
      if (_0x197741.type === "auto") {
        _0x3b6480.tool_choice = "auto";
      } else if (_0x197741.type === "any") {
        _0x3b6480.tool_choice = "required";
      } else if (_0x197741.type === "tool") {
        _0x3b6480.tool_choice = {
          type: "function",
          name: _0x197741.name
        };
      }
    }
    console.log("  🔧 OpenAI tools enabled: " + _0xf4bdb7.length + " (initiator=" + (_0x43e921 || "unknown") + ")\n    → [" + _0xf4bdb7.map(_0x475fdf => _0x475fdf.name).join(", ") + "]");
  } else if (_0xf4bdb7 && _0xf4bdb7.length > 0) {
    console.log("  🔧 OpenAI tools disabled for user-initiated turn: " + _0xf4bdb7.length + " available");
  }
  const _0x1a8455 = JSON.stringify(_0x3b6480);
  _0x28d0a9.writeHead(200, streamHeaders());
  const processor = new OpenAIStreamProcessor(_0x595371, _0x146a61, _0xb98c57);
  if (_0x479284 && _0xf4bdb7) {
    processor.setAllowedTools(_0xf4bdb7.map(_0x57be40 => _0x57be40.name));
  }
  let _0x1e1eae;
  const _0x3b678a = createStreamLifecycle(_0x28d0a9, () => _0x1e1eae, "OpenAI", _0x595371, _0x2266aa);
  let _0x4a0e98 = false;
  const _0x459ba0 = _0x3895cf => {
    if (_0x4a0e98) {
      return;
    }
    _0x4a0e98 = true;
    logNoToolsCalled("OpenAI", _0x3895cf, _0x479284 ? _0xf4bdb7 : []);
  };
  const _0x965601 = _0x173e0f.useHttp ? _0x522dd0 : _0x44b603;
  const _0x33509c = _0x173e0f.parsed.port !== 443 ? _0x173e0f.parsed.port : _0x173e0f.useHttp ? 80 : 443;
  const _0xb6491d = _0x173e0f.apiKey ? _0x173e0f.apiKey.slice(0, 6) + "..." + _0x173e0f.apiKey.slice(-4) : "empty";
  console.log("  → OpenAI " + (_0x173e0f.useHttp ? "http" : "https") + "://" + _0x173e0f.parsed.hostname + ":" + _0x33509c + _0x173e0f.apiPath + " model=" + _0x146a61 + " key=" + _0xb6491d);
  if (_0x2266aa) {
    _0x2266aa.mark("upstream_request_start", "bytes=" + Buffer.byteLength(_0x1a8455) + " tools=" + (_0x479284 && _0xf4bdb7 ? _0xf4bdb7.length : 0));
  }
  _0x1e1eae = _0x965601.request({
    hostname: _0x173e0f.parsed.hostname,
    port: _0x33509c,
    path: _0x173e0f.apiPath,
    method: "POST",
    agent: _0x173e0f.useHttp ? undefined : keepAliveAgent,
    rejectUnauthorized: !_0x173e0f.useHttp && _0x173e0f.parsed.port === 443,
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      authorization: "Bearer " + _0x173e0f.apiKey,
      "content-length": Buffer.byteLength(_0x1a8455),
      ...proxyHeaders(_0x146a61, Buffer.byteLength(_0x1a8455))
    }
  }, _0x34934c => {
    if (_0x2266aa) {
      _0x2266aa.mark("upstream_headers", "status=" + _0x34934c.statusCode);
    }
    let sseBuffer = "";
    if (_0x34934c.statusCode !== 200) {
      _0x459ba0("HTTP " + _0x34934c.statusCode + " before stream");
      console.error("  ❌ OpenAI API returned " + _0x34934c.statusCode);
      let _0x145a36 = "";
      _0x34934c.setEncoding("utf8");
      _0x34934c.on("data", _0x1ed6a3 => _0x145a36 += _0x1ed6a3);
      _0x34934c.on("end", () => {
        console.error("  ❌ Body: " + sanitizeLogBody(_0x145a36));
        const _0x5b9ff2 = buildProviderErrorMessage("OpenAI", _0x34934c.statusCode, _0x145a36);
        _0x3b678a.fail(_0x5b9ff2);
      });
      return;
    }
    _0x1e1eae.setTimeout(0);
    const _0x4a1cb7 = new StringDecoder("utf8");
    let _0x467492 = false;
    let _0x19c568 = null;
    _0x3b678a.startHeartbeat();
    const _0x2d3e00 = () => {
      if (_0x19c568) {
        clearTimeout(_0x19c568);
        _0x19c568 = null;
      }
    };
    const _0x54bdb7 = () => {
      _0x2d3e00();
      _0x19c568 = setTimeout(() => {
        if (_0x467492 || _0x3b678a.wasClosedByClient()) {
          return;
        }
        console.error("  ❌ OpenAI stream stalled after " + OPENAI_SSE_IDLE_TIMEOUT_MS + "ms without data");
        _0x459ba0("stream idle timeout " + OPENAI_SSE_IDLE_TIMEOUT_MS + "ms");
        _0x3b678a.fail("[OpenAI Stream Timeout]");
        _0x34934c.destroy();
      }, OPENAI_SSE_IDLE_TIMEOUT_MS);
    };
    function processPart(_0x3e5769) {
      const _0x2ef5bd = parseOpenAISSEChunk(_0x3e5769 + "\n");
      for (const _0x2543f1 of _0x2ef5bd) {
        const _0x43643d = processor.processEvent(_0x2543f1);
        for (const _0x5cd04f of _0x43643d) {
          _0x3b678a.safeWrite(wrapEnvelope(_0x5cd04f));
        }
      }
      if (processor.isDone) {
        _0x467492 = true;
        _0x2d3e00();
        _0x3b678a.finalize("  ✅ OpenAI stream done (stop: " + processor.stopReason + ")");
      }
    }
    _0x54bdb7();
    _0x34934c.on("data", _0x451818 => {
      if (_0x2266aa) {
        _0x2266aa.mark("first_upstream_chunk", "bytes=" + Buffer.byteLength(_0x451818));
      }
      _0x54bdb7();
      sseBuffer += _0x4a1cb7.write(_0x451818);
      const _0x5843ce = sseBuffer.split("\n\n");
      sseBuffer = _0x5843ce.pop();
      for (const _0x174a39 of _0x5843ce) {
        processPart(_0x174a39);
      }
    });
    _0x34934c.on("end", () => {
      _0x467492 = true;
      _0x2d3e00();
      sseBuffer += _0x4a1cb7.end();
      if (sseBuffer.trim()) {
        processPart(sseBuffer);
      }
      if (!processor.isDone && !_0x28d0a9.writableEnded) {
        console.log("  ⚠️  OpenAI stream ended without response.completed — forcing stop");
        const _0x594088 = processor.processEvent({
          done: true,
          type: "done",
          data: null
        });
        for (const _0x1d8784 of _0x594088) {
          _0x3b678a.safeWrite(wrapEnvelope(_0x1d8784));
        }
      }
      _0x3b678a.finalize("  ✅ OpenAI stream ended (stop: " + processor.stopReason + ")");
    });
    _0x34934c.on("aborted", () => {
      _0x467492 = true;
      _0x2d3e00();
      if (_0x3b678a.wasClosedByClient()) {
        return;
      }
      console.error("  ❌ OpenAI stream aborted before completion");
      _0x459ba0("stream aborted before completion");
      _0x3b678a.fail("[Stream Aborted]");
    });
    _0x34934c.on("error", _0x18d49d => {
      _0x467492 = true;
      _0x2d3e00();
      if (_0x3b678a.wasClosedByClient()) {
        return;
      }
      console.error("  ❌ OpenAI stream error: " + _0x18d49d.message);
      _0x459ba0("stream error: " + _0x18d49d.message);
      _0x3b678a.fail("[Stream Error]");
    });
  });
  _0x1e1eae.setTimeout(OPENAI_REQUEST_TIMEOUT_MS, () => {
    if (_0x3b678a.wasClosedByClient()) {
      return;
    }
    console.error("  ❌ OpenAI request timeout after " + OPENAI_REQUEST_TIMEOUT_MS + "ms");
    _0x459ba0("request timeout " + OPENAI_REQUEST_TIMEOUT_MS + "ms");
    _0x3b678a.fail("[OpenAI Request Timeout]");
    _0x1e1eae.destroy();
  });
  _0x1e1eae.on("error", _0x17c7a2 => {
    if (_0x3b678a.wasClosedByClient() && (_0x17c7a2.code === "ECONNRESET" || _0x17c7a2.code === "ECONNABORTED")) {
      return;
    }
    const _0x4c5cf2 = describeNetworkError(_0x17c7a2, _0x173e0f.host, _0x173e0f.parsed.port);
    console.error("  ❌ OpenAI request error: " + _0x4c5cf2);
    _0x459ba0("request error: " + (_0x17c7a2.message || _0x17c7a2.code || "unknown"));
    _0x3b678a.fail("[OpenAI Connection Error] " + _0x4c5cf2);
  });
  _0x1e1eae.end(_0x1a8455);
  if (_0x2266aa) {
    _0x2266aa.mark("upstream_request_sent");
  }
}
function toOpenAIMessages(_0x4cb0f2, _0xde9963) {
  const _0x2ba261 = [];
  if (_0x4cb0f2) {
    const _0x5ee5a9 = {
      role: "developer",
      content: _0x4cb0f2
    };
    _0x2ba261.push(_0x5ee5a9);
  }
  for (const _0x2af374 of _0xde9963) {
    if (typeof _0x2af374.content === "string") {
      const _0x12cf93 = {
        role: _0x2af374.role,
        content: _0x2af374.content
      };
      _0x2ba261.push(_0x12cf93);
      continue;
    }
    if (!Array.isArray(_0x2af374.content)) {
      _0x2ba261.push({
        role: _0x2af374.role,
        content: String(_0x2af374.content)
      });
      continue;
    }
    if (_0x2af374.role === "assistant") {
      let _0x25dca9 = "";
      for (const _0x186221 of _0x2af374.content) {
        if (_0x186221.type === "text") {
          _0x25dca9 += _0x186221.text;
        }
      }
      if (_0x25dca9) {
        const _0x29f7f1 = {
          role: "assistant",
          content: _0x25dca9
        };
        _0x2ba261.push(_0x29f7f1);
      }
      for (const _0xbc05cd of _0x2af374.content) {
        if (_0xbc05cd.type === "tool_use" && _0xbc05cd.name) {
          _0x2ba261.push({
            type: "function_call",
            call_id: _0xbc05cd.id,
            name: _0xbc05cd.name,
            arguments: typeof _0xbc05cd.input === "string" ? _0xbc05cd.input : JSON.stringify(_0xbc05cd.input)
          });
        }
      }
    } else if (_0x2af374.role === "user") {
      const _0x52c7b9 = [];
      for (const _0x5da162 of _0x2af374.content) {
        if (_0x5da162.type === "text") {
          _0x52c7b9.push(_0x5da162.text);
        } else if (_0x5da162.type === "image") {
          const _0x255995 = {
            type: "input_image",
            image_url: "data:" + (_0x5da162.source?.media_type || "image/png") + ";base64," + (_0x5da162.source?.data || "")
          };
          _0x52c7b9.push(_0x255995);
        } else if (_0x5da162.type === "tool_result") {
          _0x2ba261.push({
            type: "function_call_output",
            call_id: _0x5da162.tool_use_id,
            output: typeof _0x5da162.content === "string" ? _0x5da162.content : JSON.stringify(_0x5da162.content)
          });
        }
      }
      if (_0x52c7b9.length > 0) {
        const _0x35d740 = _0x52c7b9.some(_0x516488 => typeof _0x516488 !== "string");
        if (_0x35d740) {
          _0x2ba261.push({
            role: "user",
            content: _0x52c7b9.map(_0x10a380 => typeof _0x10a380 === "string" ? {
              type: "input_text",
              text: _0x10a380
            } : _0x10a380)
          });
        } else {
          _0x2ba261.push({
            role: "user",
            content: _0x52c7b9.join("\n")
          });
        }
      }
    }
  }
  return _0x2ba261;
}
