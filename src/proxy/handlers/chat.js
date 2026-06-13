import https from "node:https";
import http from "node:http";
import crypto from "node:crypto";
import { StringDecoder } from "node:string_decoder";
import { parseGetChatMessageRequest } from "./parse-request.js";
import { buildErrorChunk } from "./build-response.js";
import { AnthropicStreamProcessor, parseSSEChunk } from "./anthropic-stream.js";
import { OpenAIStreamProcessor, ChatCompletionsStreamProcessor, parseOpenAISSEChunk } from "./openai-stream.js";
import { wrapEnvelope, endOfStreamEnvelope, streamHeaders } from "../connect.js";
import { getByokSlot, buildAnthropicThinkingPayload, buildGeminiThinkingPayload, thinkingEffortToAnthropicBudget, thinkingEffortToGeminiBudget, thinkingEffortToOpenAIReasoningEffort, detectModelProvider, usesGeminiThinkingLevel, sanitizeGeminiThinkingEffort } from "./byok-slots.js";
import { getProviderConfig, getRuntimeConfig, getSlotModel, getSlotThinkingEffort } from "./models.js";
import { buildTextDelta } from "./build-response.js";
import { emitChatStart, emitChatEnd, emitAIText, emitToolCall, emitStreamStatus, consumeInjectedMessages, getActiveMonitorTarget } from "../ws-bridge.js";
import { buildGatewayCapabilityKey, getGatewayCapability, markGatewayCapability } from "./gateway-capability.js";
import { isResponsesApiPath, shouldFallbackToChatCompletions, toChatCompletionsMessages, toChatCompletionsPath } from "./openai-request.js";
import { isRetriableError, calculateRetryDelay, isTimeoutError, serviceCircuitBreakers } from "../retry-utils.js";
export { isResponsesApiPath, shouldFallbackToChatCompletions, toChatCompletionsMessages, toChatCompletionsPath } from "./openai-request.js";
const keepAliveAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  maxSockets: 10,
  maxFreeSockets: 5
});
const PROXY_DEVICE_ID = process.env.PROXY_DEVICE_ID || "";
const PROXY_CLIENT_VERSION = process.env.PROXY_CLIENT_VERSION || "0.0.0";
function proxyHeaders(arg0, arg1) {
  const tmp2 = Date.now().toString();
  const tmp3 = crypto.randomBytes(16).toString("hex");
  return {
    "x-proxy-device-id": PROXY_DEVICE_ID,
    "x-proxy-client-version": PROXY_CLIENT_VERSION,
    "x-proxy-timestamp": tmp2,
    "x-proxy-nonce": tmp3,
    "x-proxy-requested-model": arg0 || ""
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
function resolveConfiguredModel(arg0) {
  const tmp1 = String(arg0 || "").trim();
  const tmp2 = getByokSlot(tmp1);
  if (tmp2) {
    const tmp02 = getSlotModel(tmp2);
    if (!tmp02) {
      return "";
    }
    return MODEL_MAP[tmp02] && MODEL_MAP[tmp02] !== "__DEFAULT__" ? MODEL_MAP[tmp02] : tmp02;
  }
  const tmp3 = tmp1 && !tmp1.startsWith("MODEL_") ? tmp1 : "";
  const tmp4 = MODEL_MAP[tmp1] || MODEL_MAP[tmp3];
  const tmp5 = getDefaultModel();
  if (tmp4 === "__DEFAULT__") {
    return tmp5 || ANTHROPIC_FALLBACK_MODEL;
  }
  const tmp6 = tmp4 || tmp5 || tmp3 || "";
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
function requiresConfiguredDefaultModel(arg0) {
  const tmp1 = String(arg0 || "").trim();
  const tmp2 = getByokSlot(tmp1);
  if (tmp2) {
    return !getSlotModel(tmp2);
  }
  const tmp3 = tmp1 && !tmp1.startsWith("MODEL_") ? tmp1 : "";
  const tmp4 = MODEL_MAP[tmp1] || MODEL_MAP[tmp3];
  if (tmp4 === "__DEFAULT__") {
    return !getDefaultModel();
  }
  return false;
}
function writeModelConfigError(arg0, arg1, arg2) {
  arg0.writeHead(200, streamHeaders());
  arg0.write(wrapEnvelope(buildErrorChunk(arg1, arg2)));
  arg0.write(endOfStreamEnvelope());
  arg0.end();
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
function createTimingTracker(arg0, tmp1 = {}, tmp2 = null) {
  const tmp3 = Date.now();
  const tmp4 = new Map();
  const tmp5 = Object.entries(tmp1).filter(([, tmp02]) => tmp02 !== undefined && tmp02 !== null && tmp02 !== "").map(([tmp02, tmp12]) => tmp02 + "=" + tmp12).join(" ");
  const tmp6 = tmp5 ? "  ⏱️  " + arg0 + " " + tmp5 : "  ⏱️  " + arg0;
  const tmp7 = (arg02, tmp12 = "") => {
    if (tmp4.has(arg02)) {
      return;
    }
    const tmp22 = Date.now() - tmp3;
    tmp4.set(arg02, tmp22);
    console.log(tmp6 + " " + arg02 + ": " + tmp22 + "ms" + (tmp12 ? " " + tmp12 : ""));
    emitStreamStatus("timing", arg0 + " " + arg02 + ": " + tmp22 + "ms" + (tmp12 ? " " + tmp12 : ""), tmp2);
  };
  const tmp8 = (arg02, tmp12 = "") => {
    const tmp22 = Date.now() - tmp3;
    console.log(tmp6 + " " + arg02 + ": total=" + tmp22 + "ms" + (tmp12 ? " " + tmp12 : ""));
    emitStreamStatus("timing", arg0 + " " + arg02 + ": total=" + tmp22 + "ms" + (tmp12 ? " " + tmp12 : ""), tmp2);
  };
  return {
    mark: tmp7,
    summary: tmp8,
    elapsed: () => Date.now() - tmp3
  };
}
function logNoToolsCalled(arg0, arg1, arg2) {
  const tmp3 = Array.isArray(arg2) ? arg2.map(arg02 => arg02 && arg02.name).filter(Boolean) : [];
  const tmp4 = tmp3.length ? "; enabled=" + tmp3.length + " [" + tmp3.join(", ") + "]" : "";
  console.log("  🔧 No tools called (" + arg0 + " " + arg1 + "; model output did not reach tool-call stage" + tmp4 + ")");
  emitStreamStatus("error", arg0 + " " + arg1 + "; no tool calls emitted");
  emitChatEnd("error", []);
}
function sanitizeLogBody(arg0) {
  return arg0.slice(0, 500).replace(/(?:sk-[a-zA-Z0-9_-]{10,}|Bearer\s+\S+)/g, "[REDACTED]").replace(/(?:key-[a-zA-Z0-9_-]{10,})/g, "[REDACTED]").replace(/(?:"(?:api[_-]?key|token|secret|password|authorization)":\s*"[^"]{6,}")/gi, "\"$1\":\"[REDACTED]\"");
}
function buildProviderErrorMessage(arg0, arg1, arg2) {
  const tmp3 = String(arg2 || "").toLowerCase();
  if (/convert_request_failed|not implemented|not_implemented|new_api_error|responses api|invalid.*responses/.test(tmp3)) {
    return "[" + arg0 + " Error " + arg1 + "] 当前网关不支持 OpenAI Responses API，代理会尝试回退到 /v1/chat/completions；若仍失败，请在高级路由中将 OpenAI API Path 设置为 /v1/chat/completions。";
  }
  if (/signature.*field required|field required.*signature|validationexception/.test(tmp3) && tmp3.includes("signature")) {
    return "[" + arg0 + " Error " + arg1 + "] Bedrock/Anthropic thinking 历史缺少 signature。请开启新对话，或关闭 BYOK #2 思考强度；代理默认会剔除无 signature 的 thinking 块。";
  }
  if (/thinking.*enabled.*not supported|enabled.*not supported.*adaptive|output_config\.effort/.test(tmp3)) {
    return "[" + arg0 + " Error " + arg1 + "] 当前 Claude/Bedrock 模型要求 adaptive thinking。请升级插件或确认模型名是 Claude 4 系列；代理会对 Claude 4 使用 thinking.adaptive + output_config.effort。";
  }
  if (/thinking_config|unknown.*thinking|invalid.*thinking|extra_body|unrecognized.*field/.test(tmp3)) {
    return "[" + arg0 + " Error " + arg1 + "] 当前网关不支持 Gemini/OpenAI 兼容 thinking 扩展字段，代理会尝试不带 thinking 的 Chat Completions 回退。";
  }
  if (arg1 === 401 && tmp3.includes("invalid") && tmp3.includes("key")) {
    return "[" + arg0 + " Error 401] Invalid API key. If using the cloud gateway, check the server-side upstream key; otherwise update the local " + arg0 + " key in the control panel.";
  }
  if (arg1 === 503 && (tmp3.includes("no available accounts") || tmp3.includes("overloaded") || tmp3.includes("unavailable"))) {
    return "[" + arg0 + " Error 503] 当前模型池暂无可用资源或上游过载，请切换到 Sonnet/默认模型后重试。";
  }
  if (arg1 === 403 && tmp3.includes("/v1/messages")) {
    return "[" + arg0 + " Error 403] 当前分组不允许 /v1/messages 通道，请切换 OpenAI 兼容模型或使用支持 Anthropic Messages 的分组。";
  }
  return "[" + arg0 + " Error " + arg1 + "]";
}
const OPENAI_PREFIXES = ["gpt-", "MODEL_GPT"];
const GEMINI_PREFIXES = ["gemini-", "MODEL_GOOGLE_GEMINI"];
const tmp0 = {
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
const MODEL_MAP = tmp0;
function getServiceTier(arg0) {
  if (!arg0) {
    return undefined;
  }
  if (arg0.endsWith("-priority")) {
    return "fast";
  }
  return undefined;
}
function isOpenAIModel(arg0) {
  if (!arg0) {
    return false;
  }
  const tmp1 = stripThinkingSuffix(arg0).toLowerCase();
  return OPENAI_PREFIXES.some(arg02 => tmp1.startsWith(arg02.toLowerCase())) || tmp1.includes("claude-code");
}
function isGeminiModel(arg0) {
  if (!arg0) {
    return false;
  }
  const tmp1 = stripThinkingSuffix(arg0).toLowerCase();
  return GEMINI_PREFIXES.some(arg02 => tmp1.startsWith(arg02.toLowerCase())) || detectModelProvider(arg0) === "gemini";
}
function isOpenAICompatibleModel(arg0) {
  return isOpenAIModel(arg0) || isGeminiModel(arg0);
}
function isThinkingModel(arg0) {
  return String(arg0 || "").trim().toLowerCase().endsWith("-thinking");
}
function stripThinkingSuffix(arg0) {
  return String(arg0 || "").trim().replace(/-thinking$/i, "");
}
function isClaudeModel(arg0) {
  const tmp1 = stripThinkingSuffix(arg0).toLowerCase();
  return tmp1.startsWith("claude-") || tmp1.startsWith("model_claude");
}
function resolveSlotThinkingEffort(arg0, arg1) {
  if (arg0 === 1 || arg0 === 2) {
    return getSlotThinkingEffort(arg0) || (arg0 === 1 ? arg1.openaiReasoningEffort || "" : "");
  }
  return arg1.openaiReasoningEffort || "";
}
function buildThinkingOptions(arg0, arg1, tmp2 = null) {
  const tmp3 = getRuntimeConfig();
  const tmp4 = isThinkingModel(arg0);
  const tmp5 = resolveSlotThinkingEffort(tmp2, tmp3);
  const tmp6 = isClaudeModel(arg0);
  const tmp7 = isGeminiModel(arg0);
  const tmp8 = isOpenAIModel(arg0);
  let tmp9 = false;
  let tmp10 = "";
  if (arg1 || tmp8) {
    tmp9 = tmp4 || tmp3.openaiThinkingEnabled === true || !!tmp5;
    tmp10 = tmp9 ? tmp5 || tmp3.openaiReasoningEffort || "" : "";
  } else if (tmp7) {
    tmp9 = !!sanitizeGeminiThinkingEffort(tmp5) || tmp4 || tmp2 === 2;
    tmp10 = sanitizeGeminiThinkingEffort(tmp5) || (tmp9 && (tmp2 === 2 || tmp4) ? "medium" : "");
  } else if (tmp6) {
    tmp9 = !!tmp5 || tmp4 || tmp2 === 2;
    tmp10 = tmp9 ? tmp5 || (tmp2 === 2 || tmp4 ? "medium" : "") : "";
  } else {
    tmp9 = tmp4;
    tmp10 = "";
  }
  const tmp11 = {
    thinkingEnabled: tmp9,
    reasoningEffort: tmp10,
    thinkingBudget: tmp9 ? (tmp7 ? usesGeminiThinkingLevel(arg0) ? 0 : thinkingEffortToGeminiBudget(tmp10) : thinkingEffortToAnthropicBudget(tmp10)) || (tmp7 ? 8192 : 10000) : 0,
    provider: tmp7 ? "gemini" : tmp8 || arg1 ? "gpt" : tmp6 ? "claude" : detectModelProvider(arg0) || "claude"
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
    initiator: tmp8
  } = parseGetChatMessageRequest(arg2, arg0.headers);
  const tmp9 = crypto.randomUUID();
  const tmp10 = getByokSlot(tmp7);
  if (requiresConfiguredDefaultModel(tmp7)) {
    const tmp02 = tmp10 === 2 ? "未配置 BYOK #2（Thinking）。请在侧栏填写 API、加载并选择模型。" : tmp10 === 1 ? "未配置 BYOK #1（Opus 4 BYOK）。请在侧栏填写 API、加载并选择模型。" : "未选择默认模型。请先回到 Devin BYOK Bridge，点击“加载模型”并选择默认模型后再提问。";
    console.error("  ❌ Missing model config for requested model " + (tmp7 || "unknown"));
    writeModelConfigError(arg1, tmp9, tmp02);
    return;
  }
  let tmp11 = resolveConfiguredModel(tmp7);
  const tmp12 = isOpenAICompatibleModel(tmp11);
  const tmp13 = buildThinkingOptions(tmp11, isOpenAIModel(tmp11), tmp10);
  tmp11 = stripThinkingSuffix(tmp11);
  if (!tmp11) {
    const tmp02 = "未解析到可用模型。请先在 Devin BYOK Bridge 中加载模型并选择默认模型。";
    console.error("  ❌ Empty resolved model for requested model " + (tmp7 || "unknown"));
    writeModelConfigError(arg1, tmp9, tmp02);
    return;
  }
  const tmp14 = getProviderConfig(tmp10);
  const tmp15 = isGeminiModel(tmp11);
  const requiredKey = tmp12 ? tmp15 ? tmp14.openai.apiKey || tmp14.anthropic.apiKey : tmp14.openai.apiKey : tmp14.anthropic.apiKey;
  if (!requiredKey) {
    const tmp02 = tmp12 ? tmp15 ? "Gemini/OpenAI" : "OpenAI" : "Anthropic";
    console.error("  ❌ No " + tmp02 + " API key set — cannot forward " + tmp7);
    const tmp1 = crypto.randomUUID();
    arg1.writeHead(200, streamHeaders());
    arg1.write(wrapEnvelope(buildErrorChunk(tmp1, "No " + tmp02 + " API key configured")));
    arg1.write(endOfStreamEnvelope());
    arg1.end();
    return;
  }
  const tmp16 = getServiceTier(tmp7);
  const tmp17 = tmp15 ? "Gemini" : tmp12 ? "OpenAI" : "Anthropic";
  if (EXPOSE_BACKEND_INFO) {
    tmp3 += "\n\nCurrent backend: " + tmp11 + " (" + tmp17 + ").";
  }
  const tmp18 = consumeInjectedMessages();
  if (tmp18.length > 0) {
    for (const tmp02 of tmp18) {
      const tmp03 = {
        role: tmp02.role,
        content: tmp02.content
      };
      tmp4.push(tmp03);
    }
    console.log("  📨 Injected " + tmp18.length + " message(s) from App");
  }
  const tmp19 = getActiveMonitorTarget();
  console.log("  � Monitor target: " + tmp19);
  console.log("  �🧠 Model: " + tmp7 + " → " + tmp11 + " (" + tmp17 + ")" + (tmp16 ? " [tier: " + tmp16 + "]" : ""));
  console.log("  📝 System prompt: " + tmp3.length + " chars");
  console.log("  💬 Messages: " + tmp4.length);
  if (tmp5) {
    console.log("  🔧 Tools: " + tmp5.length);
  }
  if (tmp6) {
    console.log("  🔧 ToolChoice: " + JSON.stringify(tmp6));
  }
  emitChatStart(tmp11, tmp4.length, tmp5 ? tmp5.length : 0, tmp19);
  if (tmp4.length > 0) {
    const tmp02 = tmp4.map(arg02 => arg02.role).join(",");
    console.log("  💬 Roles: " + tmp02);
    for (let tmp03 = 1; tmp03 < tmp4.length; tmp03++) {
      if (tmp4[tmp03].role === tmp4[tmp03 - 1].role) {
        console.warn("  ⚠️  Consecutive " + tmp4[tmp03].role + " at index " + (tmp03 - 1) + "," + tmp03 + " — merge failed?");
      }
    }
  }
  const tmp20 = {
    provider: tmp17,
    model: tmp11,
    requested: tmp7
  };
  const tmp21 = createTimingTracker("chat", tmp20, tmp19);
  tmp21.mark("parsed", "messages=" + tmp4.length + " tools=" + (tmp5 ? tmp5.length : 0));
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
      byokSlot: tmp10
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
      byokSlot: tmp10
    };
    streamAnthropic(arg0, arg1, tmp02);
  }
}
function describeNetworkError(arg0, arg1, arg2) {
  const tmp3 = arg0?.code || "";
  const tmp4 = arg0?.message || String(arg0 || "unknown error");
  const tmp5 = /^198\.(18|19)\./.test(arg1 || "");
  if (tmp3 === "ETIMEDOUT") {
    const tmp02 = tmp5 ? "可能是 VPN/TUN/代理分流生成的假 IP 未正确回连，请检查分流规则或将目标域名设为直连。" : "请检查当前网络、系统代理或上游出口是否可达。";
    return tmp4 + " (" + tmp02 + ")";
  }
  if (tmp3 === "ECONNRESET") {
    return tmp4 + " (上游连接被重置，常见于网络抖动、代理中途断链或对端主动关闭)";
  }
  return "" + tmp4 + (arg1 ? " (" + arg1 + ":" + arg2 + ")" : "");
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
        arg0.write(wrapEnvelope(buildTextDelta(arg3, "", 0)));
      }
    }, tmp9);
  };
  const fn2 = () => {
    if (tmp7) {
      clearInterval(tmp7);
      tmp7 = null;
    }
  };
  const fn3 = arg02 => {
    if (!arg0.writableEnded && !tmp5) {
      if (arg4) {
        arg4.mark("first_windsurf_write");
      }
      arg0.write(arg02);
      tmp8 = Date.now();
    }
  };
  const fn4 = arg02 => {
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
      arg4.summary("finalized");
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
  arg0.on("close", () => {
    if (arg0.writableEnded || tmp5) {
      return;
    }
    tmp5 = true;
    tmp6 = true;
    fn2();
    const tmp02 = fn();
    if (tmp02 && !tmp02.destroyed) {
      console.log("  ℹ️  Client disconnected, stopping " + arg2 + " upstream stream");
      if (arg4) {
        arg4.summary("client_disconnected");
      }
      tmp02.destroy();
    }
  });
  const tmp15 = {
    safeWrite: fn3,
    finalize: fn4,
    fail: tmp14,
    startHeartbeat: tmp10,
    wasClosedByClient: () => tmp5
  };
  return tmp15;
}
function shouldForwardOpenAITools(arg0, arg1) {
  if (!arg1 || arg1.length === 0) {
    return false;
  }
  return true;
}
function getForwardedToolChoice(arg0, arg1, arg2) {
  if (!arg1 || !arg0 || arg0.length === 0) {
    return undefined;
  }
  if (arg1.type !== "tool") {
    return arg1;
  }
  if (arg0.some(arg02 => arg02?.name === arg1.name)) {
    return arg1;
  }
  console.log("  ⚠️  Ignoring " + arg2 + " named tool_choice \"" + arg1.name + "\" because the tool definition is unavailable");
  return undefined;
}
function shouldRetryWithoutGeminiThinking(arg0, arg1) {
  if (![400, 422, 500, 501, 502].includes(arg0)) {
    return false;
  }
  const tmp1 = String(arg1 || "").toLowerCase();
  return /thinking_config|thinking.*unsupported|extra_body|unknown.*thinking|invalid.*thinking|unsupported.*field|unrecognized.*field|additional properties/.test(tmp1);
}
function mapChatCompletionsToolChoice(arg0) {
  if (!arg0) {
    return undefined;
  }
  if (arg0.type === "auto") {
    return "auto";
  }
  if (arg0.type === "any") {
    return "required";
  }
  if (arg0.type === "tool") {
    return {
      type: "function",
      function: {
        name: arg0.name
      }
    };
  }
  return undefined;
}
function buildOpenAIResponsesBody({
  systemPrompt: tmp2,
  messages: tmp3,
  tools: tmp4,
  toolChoice: tmp5,
  resolvedModel: tmp6,
  serviceTier: tmp7,
  thinkingOptions: tmp12,
  initiator: tmp9,
  forwardTools: tmp16
}) {
  const tmp15 = toOpenAIMessages(tmp2, tmp3);
  const tmp17 = tmp16 ? getForwardedToolChoice(tmp4, tmp5, "OpenAI") : undefined;
  const tmp19 = {
    model: tmp6,
    input: tmp15,
    stream: true
  };
  const tmp20 = getMaxTokens();
  if (tmp20 > 0) {
    tmp19.max_output_tokens = tmp20;
  }
  const tmp21 = tmp12?.thinkingEnabled === true;
  if (OPENAI_ENABLE_REASONING && tmp21) {
    if (isGeminiModel(tmp6)) {
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
          thinking_config: tmp03
        };
      }
    } else {
      const tmp02 = {
        summary: OPENAI_REASONING_SUMMARY
      };
      tmp19.reasoning = tmp02;
      if (tmp12?.reasoningEffort) {
        tmp19.reasoning.effort = thinkingEffortToOpenAIReasoningEffort(tmp12.reasoningEffort);
      }
    }
  }
  if (tmp7) {
    tmp19.service_tier = tmp7;
  }
  if (tmp16 && tmp4 && tmp4.length > 0) {
    tmp19.tools = tmp4.map(arg02 => ({
      type: "function",
      name: arg02.name,
      description: arg02.description || "",
      parameters: typeof arg02.input_schema === "string" ? JSON.parse(arg02.input_schema) : arg02.input_schema
    }));
    if (tmp17) {
      if (tmp17.type === "auto") {
        tmp19.tool_choice = "auto";
      } else if (tmp17.type === "any") {
        tmp19.tool_choice = "required";
      } else if (tmp17.type === "tool") {
        tmp19.tool_choice = {
          type: "function",
          name: tmp17.name
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
  omitGeminiThinking: tmp18 = false
}) {
  const tmp17 = tmp16 ? getForwardedToolChoice(tmp4, tmp5, "OpenAI") : undefined;
  const tmp19 = {
    model: tmp6,
    messages: toChatCompletionsMessages(tmp2, tmp3),
    stream: true
  };
  const tmp20 = getMaxTokens();
  if (tmp20 > 0) {
    tmp19.max_tokens = tmp20;
  }
  const tmp21 = tmp12?.thinkingEnabled === true;
  if (OPENAI_ENABLE_REASONING && tmp21) {
    if (isGeminiModel(tmp6)) {
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
            thinking_config: tmp03
          };
        }
      }
    } else {
      const tmp02 = thinkingEffortToOpenAIReasoningEffort(tmp12?.reasoningEffort);
      if (tmp02) {
        tmp19.reasoning_effort = tmp02;
      }
    }
  }
  if (tmp16 && tmp4 && tmp4.length > 0) {
    tmp19.tools = tmp4.map(arg02 => ({
      type: "function",
      function: {
        name: arg02.name,
        description: arg02.description || "",
        parameters: typeof arg02.input_schema === "string" ? JSON.parse(arg02.input_schema) : arg02.input_schema
      }
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
  const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || "3", 10);

  // 超过最大重试次数
  if (retryCount >= MAX_RETRIES) {
    return false;
  }

  // 使用通用的重试判断逻辑
  return isRetriableError(error, statusCode);
}

function attachOpenAISseStream(arg02, {
  processor: tmp13,
  lifecycle: tmp24,
  timing: tmp10,
  clientResponse: tmp11,
  onStreamEnd: fn,
  onDataReceived: onDataReceived = null,
  onSuccess: onSuccess = null
}) {
  const tmp1 = new StringDecoder("utf8");
  let sseBuffer = "";
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
      console.error("  ❌ OpenAI stream stalled after " + OPENAI_SSE_IDLE_TIMEOUT_MS + "ms without data");
      fn("stream idle timeout " + OPENAI_SSE_IDLE_TIMEOUT_MS + "ms");
      tmp24.fail("[OpenAI Stream Timeout]");
      arg02.destroy();
    }, OPENAI_SSE_IDLE_TIMEOUT_MS);
  };
  function processPart(arg03) {
    const tmp110 = parseOpenAISSEChunk(arg03 + "\n");
    for (const tmp02 of tmp110) {
      const tmp03 = tmp13.processEvent(tmp02);
      for (const tmp04 of tmp03) {
        tmp24.safeWrite(wrapEnvelope(tmp04));
      }
    }
    if (tmp13.isDone) {
      tmp26 = true;
      fn2();
      tmp24.finalize("  ✅ OpenAI stream done (stop: " + tmp13.stopReason + ")");
    }
  }
  fn3();
  arg02.on("data", arg03 => {
    if (onDataReceived) {
      onDataReceived();
    }
    if (tmp10) {
      tmp10.mark("first_upstream_chunk", "bytes=" + Buffer.byteLength(arg03));
    }
    fn3();
    sseBuffer += tmp1.write(arg03);
    const tmp110 = sseBuffer.split("\n\n");
    sseBuffer = tmp110.pop();
    for (const tmp02 of tmp110) {
      processPart(tmp02);
    }
  });
  arg02.on("end", () => {
    tmp26 = true;
    fn2();
    sseBuffer += tmp1.end();
    if (sseBuffer.trim()) {
      processPart(sseBuffer);
    }
    if (!tmp13.isDone && tmp11 && !tmp11.writableEnded) {
      console.log("  ⚠️  OpenAI stream ended without terminal event — forcing stop");
      const tmp02 = tmp13.processEvent({
        done: true,
        type: "done",
        data: null
      });
      for (const tmp03 of tmp02) {
        tmp24.safeWrite(wrapEnvelope(tmp03));
      }
    }
    if (onSuccess && tmp13.isDone) {
      onSuccess();
    }
    tmp24.finalize("  ✅ OpenAI stream ended (stop: " + tmp13.stopReason + ")");
  });
  arg02.on("aborted", () => {
    tmp26 = true;
    fn2();
    if (tmp24.wasClosedByClient()) {
      return;
    }
    console.error("  ❌ OpenAI stream aborted before completion");
    fn("stream aborted before completion");
    tmp24.fail("[Stream Aborted]");
  });
  arg02.on("error", arg03 => {
    tmp26 = true;
    fn2();
    if (tmp24.wasClosedByClient()) {
      return;
    }
    console.error("  ❌ OpenAI stream error: " + arg03.message);
    fn("stream error: " + arg03.message);
    tmp24.fail("[Stream Error]");
  });
}
function streamAnthropic(arg0, arg1, {
  systemPrompt: tmp2,
  messages: tmp3,
  tools: tmp4,
  toolChoice: tmp5,
  resolvedModel: tmp6,
  messageId: tmp7,
  timing: tmp8,
  monitorTargetId: tmp9,
  thinkingOptions: tmp10,
  byokSlot: tmp11 = null
}, retryCount = 0) {
  const tmp12 = getProviderConfig(tmp11).anthropic;
  const tmp13 = getForwardedToolChoice(tmp4, tmp5, "Anthropic");
  const tmp14 = {
    model: tmp6,
    system: tmp2 || undefined,
    messages: tmp3,
    stream: true,
    max_tokens: getMaxTokens()
  };
  if (tmp4 && tmp4.length > 0) {
    tmp14.tools = tmp4;
    if (tmp13) {
      tmp14.tool_choice = tmp13;
    }
  }
  if (tmp10?.thinkingEnabled) {
    const tmp02 = buildAnthropicThinkingPayload(tmp6, tmp10.reasoningEffort, "medium");
    if (tmp02?.thinking) {
      tmp14.thinking = tmp02.thinking;
      if (tmp02.output_config) {
        tmp14.output_config = tmp02.output_config;
      }
      const tmp03 = tmp14.thinking.budget_tokens || tmp10.thinkingBudget || thinkingEffortToAnthropicBudget(tmp10.reasoningEffort) || 0;
      if (tmp03 > 0 && tmp14.max_tokens <= tmp03) {
        tmp14.max_tokens = Math.min(getMaxTokens(), tmp03 + 8192);
      }
    }
  }
  const tmp15 = tmp14.thinking ? tmp14.thinking.type === "adaptive" ? "adaptive effort=" + (tmp14.output_config?.effort || tmp10?.reasoningEffort || "medium") : "enabled budget=" + (tmp14.thinking.budget_tokens || "?") + (tmp10?.reasoningEffort ? " effort=" + tmp10.reasoningEffort : "") : "off";
  console.log("  🧩 Anthropic/Sub2API thinking: " + tmp15);
  const tmp16 = JSON.stringify(tmp14);
  if (retryCount === 0) {
    arg1.writeHead(200, streamHeaders());
  }
  const processor = new AnthropicStreamProcessor(tmp7, tmp6, tmp9);
  let tmp17;
  const tmp18 = createStreamLifecycle(arg1, () => tmp17, "Anthropic", tmp7, tmp8);
  const tmp19 = tmp12.useHttp ? http : https;
  const tmp20 = tmp12.parsed.port !== 443 ? tmp12.parsed.port : tmp12.useHttp ? 80 : 443;
  const retryPrefix = retryCount > 0 ? `[Retry ${retryCount}] ` : "";
  console.log("  → " + retryPrefix + "Anthropic " + tmp12.host + tmp12.apiPath + " model=" + tmp6 + " key=" + (tmp12.apiKey ? "set" : "empty"));
  if (tmp8) {
    tmp8.mark(retryCount === 0 ? "upstream_request_start" : `upstream_retry_${retryCount}`, "bytes=" + Buffer.byteLength(tmp16));
  }

  // 检查熔断器状态
  const circuitBreaker = serviceCircuitBreakers.anthropic;
  if (!circuitBreaker.allowRequest()) {
    console.error("  🔒 Anthropic circuit breaker is OPEN - request blocked");
    tmp18.fail("[Circuit Breaker Open] Too many consecutive failures, please try again later");
    return;
  }

  let hasReceivedData = false; // 标记是否接收到任何数据

  tmp17 = tmp19.request({
    hostname: tmp12.parsed.hostname,
    port: tmp20,
    path: tmp12.apiPath,
    method: "POST",
    agent: tmp12.useHttp ? undefined : keepAliveAgent,
    rejectUnauthorized: !tmp12.useHttp && tmp12.parsed.port === 443,
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      "anthropic-version": "2023-06-01",
      "x-api-key": tmp12.apiKey,
      "content-length": Buffer.byteLength(tmp16),
      ...proxyHeaders(tmp6, Buffer.byteLength(tmp16))
    }
  }, arg02 => {
    if (tmp8) {
      tmp8.mark("upstream_headers", "status=" + arg02.statusCode);
    }
    let sseBuffer = "";
    if (arg02.statusCode !== 200) {
      console.error("  ❌ Anthropic API returned " + arg02.statusCode);
      let tmp02 = "";
      arg02.setEncoding("utf8");
      arg02.on("data", arg03 => tmp02 += arg03);
      arg02.on("end", () => {
        console.error("  ❌ Body: " + sanitizeLogBody(tmp02));
        const tmp03 = buildProviderErrorMessage("Anthropic", arg02.statusCode, tmp02);

        // 判断是否应该重试
        if (shouldRetryAnthropicRequest(arg02.statusCode, null, retryCount, hasReceivedData)) {
          retryAnthropicRequest(arg0, arg1, {
            systemPrompt: tmp2, messages: tmp3, tools: tmp4, toolChoice: tmp5,
            resolvedModel: tmp6, messageId: tmp7, timing: tmp8, monitorTargetId: tmp9,
            thinkingOptions: tmp10, byokSlot: tmp11
          }, retryCount, arg02.statusCode, null);
        } else {
          circuitBreaker.recordFailure();
          tmp18.fail(tmp03);
        }
      });
      return;
    }
    arg02.setEncoding("utf8");
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
        console.error("  ❌ Anthropic stream stalled after " + ANTHROPIC_SSE_IDLE_TIMEOUT_MS + "ms without data");
        tmp18.fail("[Anthropic Stream Timeout]");
        arg02.destroy();
      }, ANTHROPIC_SSE_IDLE_TIMEOUT_MS);
    };
    function processPart(arg03) {
      const tmp110 = parseSSEChunk(arg03 + "\n\n");
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
    arg02.on("data", arg03 => {
      hasReceivedData = true; // 标记已接收到数据
      if (tmp8 && isFirstChunk) {
        tmp8.mark("first_upstream_chunk", "bytes=" + Buffer.byteLength(arg03));
        isFirstChunk = false;
      }
      fn2();
      sseBuffer += arg03;
      const tmp110 = sseBuffer.split("\n\n");
      sseBuffer = tmp110.pop();
      for (const tmp02 of tmp110) {
        if (tmp02.trim()) {
          processPart(tmp02);
        }
      }
    });
    arg02.on("end", () => {
      tmp22 = true;
      fn();
      if (sseBuffer.trim()) {
        processPart(sseBuffer);
        sseBuffer = "";
      }
      if (!processor.isDone && !arg1.writableEnded) {
        console.log("  ⚠️  Anthropic stream ended without message_stop — forcing stop");
        const tmp02 = processor.processEvent({
          event: "message_stop",
          data: {}
        });
        for (const tmp03 of tmp02) {
          tmp18.safeWrite(wrapEnvelope(tmp03));
        }
        tmp18.finalize("  ✅ Stream ended (forced stop)");
      } else if (processor.isDone) {
        circuitBreaker.recordSuccess(); // 成功请求，重置熔断器
        tmp18.finalize("  ✅ Stream ended normally");
      }
    });
    arg02.on("aborted", () => {
      tmp22 = true;
      fn();
      if (tmp18.wasClosedByClient()) {
        return;
      }
      console.error("  ❌ Anthropic stream aborted before completion");
      tmp18.fail("[Stream Aborted]");
    });
    arg02.on("error", arg03 => {
      tmp22 = true;
      fn();
      if (tmp18.wasClosedByClient()) {
        return;
      }
      console.error("  ❌ Anthropic stream error: " + arg03.message);
      tmp18.fail("[Stream Error]");
    });
  });
  tmp17.setTimeout(ANTHROPIC_REQUEST_TIMEOUT_MS, () => {
    if (tmp18.wasClosedByClient()) {
      return;
    }
    console.error("  ❌ Anthropic request timeout after " + ANTHROPIC_REQUEST_TIMEOUT_MS + "ms");

    // 超时错误：判断是否应该重试
    const timeoutError = { code: "ETIMEDOUT", timeout: true };
    if (shouldRetryAnthropicRequest(0, timeoutError, retryCount, hasReceivedData)) {
      tmp17.destroy();
      retryAnthropicRequest(arg0, arg1, {
        systemPrompt: tmp2, messages: tmp3, tools: tmp4, toolChoice: tmp5,
        resolvedModel: tmp6, messageId: tmp7, timing: tmp8, monitorTargetId: tmp9,
        thinkingOptions: tmp10, byokSlot: tmp11
      }, retryCount, 0, timeoutError);
    } else {
      circuitBreaker.recordFailure();
      tmp18.fail("[Anthropic Request Timeout]");
      tmp17.destroy();
    }
  });
  tmp17.on("error", arg02 => {
    if (tmp18.wasClosedByClient() && (arg02.code === "ECONNRESET" || arg02.code === "ECONNABORTED")) {
      return;
    }
    const tmp1 = describeNetworkError(arg02, tmp12.host, tmp12.parsed.port);
    console.error("  ❌ Anthropic request error: " + tmp1);

    // 网络错误：判断是否应该重试
    if (shouldRetryAnthropicRequest(0, arg02, retryCount, hasReceivedData)) {
      retryAnthropicRequest(arg0, arg1, {
        systemPrompt: tmp2, messages: tmp3, tools: tmp4, toolChoice: tmp5,
        resolvedModel: tmp6, messageId: tmp7, timing: tmp8, monitorTargetId: tmp9,
        thinkingOptions: tmp10, byokSlot: tmp11
      }, retryCount, 0, arg02);
    } else {
      circuitBreaker.recordFailure();
      tmp18.fail("[Anthropic Connection Error] " + tmp1);
    }
  });
  tmp17.end(tmp16);
  if (tmp8) {
    tmp8.mark("upstream_request_sent");
  }
}

// 判断是否应该重试 Anthropic 请求
function shouldRetryAnthropicRequest(statusCode, error, retryCount, hasReceivedData) {
  const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || "3", 10);

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
  console.log(`  ↩️  [Anthropic] Retry ${nextRetryCount}/${process.env.MAX_RETRIES || 3} after ${delay}ms (${errorDesc})`);
  emitStreamStatus("retry", `Anthropic retry ${nextRetryCount} after ${delay}ms (${errorDesc})`);

  setTimeout(() => {
    streamAnthropic(arg0, arg1, options, nextRetryCount);
  }, delay);
}
function streamOpenAI(arg0, arg1, {
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
  byokSlot: tmp13 = null
}) {
  const tmp14 = getProviderConfig(tmp13).openai;
  const tmp16 = shouldForwardOpenAITools(tmp9, tmp4);
  const tmp30 = {
    systemPrompt: tmp2,
    messages: tmp3,
    tools: tmp4,
    toolChoice: tmp5,
    resolvedModel: tmp6,
    serviceTier: tmp7,
    thinkingOptions: tmp12,
    initiator: tmp9,
    forwardTools: tmp16
  };
  const tmp31 = buildOpenAIResponsesBody(tmp30);
  const tmp32 = buildOpenAIChatCompletionsBody(tmp30);
  const tmp36 = isGeminiModel(tmp6) && tmp12?.thinkingEnabled === true ? buildOpenAIChatCompletionsBody({
    ...tmp30,
    omitGeminiThinking: true
  }) : null;
  console.log("  🧩 OpenAI/Sub2API reasoning: " + (isGeminiModel(tmp6) ? tmp31.thinking_config ? usesGeminiThinkingLevel(tmp6) ? "gemini level=" + (tmp31.thinking_config.thinking_level || "?") : "gemini budget=" + (tmp31.thinking_config.thinking_budget || "?") : "off" : tmp31.reasoning ? tmp31.reasoning.effort || "default" : tmp32.reasoning_effort || "off"));
  if (tmp16 && tmp4 && tmp4.length > 0) {
    console.log("  🔧 OpenAI tools enabled: " + tmp4.length + " (initiator=" + (tmp9 || "unknown") + ")\n    → [" + tmp4.map(arg02 => arg02.name).join(", ") + "]");
  } else if (tmp4 && tmp4.length > 0) {
    console.log("  🔧 OpenAI tools disabled for user-initiated turn: " + tmp4.length + " available");
  }
  const tmp33 = [];
  const tmp37 = tmp14.useHttp ? "http" : "https";
  const tmp38 = tmp14.parsed.port !== 443 ? tmp14.parsed.port : tmp14.useHttp ? 80 : 443;
  const tmp39 = buildGatewayCapabilityKey({
    protocol: tmp37,
    host: tmp14.parsed.hostname,
    port: tmp38,
    apiPath: tmp14.apiPath || "/v1/responses",
    providerKind: isGeminiModel(tmp6) ? "gemini" : "openai",
    slot: tmp13 || "default"
  });
  const tmp40 = getGatewayCapability(tmp39);
  if (isResponsesApiPath(tmp14.apiPath) && tmp40?.preferChatCompletions) {
    console.log("  ↩️  using cached chat-completions for " + tmp14.parsed.hostname + " (" + (tmp40.reason || "responses unsupported") + ")");
    tmp33.push({
      path: toChatCompletionsPath(tmp14.apiPath),
      body: tmp32,
      mode: "chat",
      cacheKey: tmp39
    });
    if (tmp36) {
      tmp33.push({
        path: toChatCompletionsPath(tmp14.apiPath),
        body: tmp36,
        mode: "chat",
        withoutGeminiThinking: true,
        cacheKey: tmp39
      });
    }
  } else if (isResponsesApiPath(tmp14.apiPath)) {
    tmp33.push({
      path: tmp14.apiPath,
      body: tmp31,
      mode: "responses",
      cacheKey: tmp39
    });
    tmp33.push({
      path: toChatCompletionsPath(tmp14.apiPath),
      body: tmp32,
      mode: "chat",
      cacheKey: tmp39
    });
    if (tmp36) {
      tmp33.push({
        path: toChatCompletionsPath(tmp14.apiPath),
        body: tmp36,
        mode: "chat",
        withoutGeminiThinking: true,
        cacheKey: tmp39
      });
    }
  } else {
    markGatewayCapability(tmp39, {
      preferChatCompletions: true,
      reason: "configured chat-completions path"
    });
    tmp33.push({
      path: tmp14.apiPath || "/v1/chat/completions",
      body: tmp32,
      mode: "chat",
      cacheKey: tmp39
    });
    if (tmp36) {
      tmp33.push({
        path: tmp14.apiPath || "/v1/chat/completions",
        body: tmp36,
        mode: "chat",
        withoutGeminiThinking: true,
        cacheKey: tmp39
      });
    }
  }
  arg1.writeHead(200, streamHeaders());
  let tmp23;
  let processor;
  const tmp24 = createStreamLifecycle(arg1, () => tmp23, "OpenAI", tmp8, tmp10);
  let tmp25 = false;
  let tmp34 = 0;
  let tmp35 = "";
  const fn = arg02 => {
    if (tmp25) {
      return;
    }
    tmp25 = true;
    logNoToolsCalled("OpenAI", arg02, tmp16 ? tmp4 : []);
  };
  const tmp27 = tmp14.useHttp ? http : https;
  const tmp28 = tmp38;
  const tmp29 = tmp14.apiKey ? tmp14.apiKey.slice(0, 6) + "..." + tmp14.apiKey.slice(-4) : "empty";
  const fn2 = (retryCount = 0, lastError = null) => {
    const tmp02 = tmp33[tmp34++];
    if (!tmp02) {
      // 所有路径都尝试完毕，判断是否应该网络层重试
      if (lastError && shouldRetryOpenAIRequest(0, lastError, retryCount)) {
        const isTimeout = isTimeoutError(lastError);
        const delay = calculateRetryDelay(retryCount, 0, {}, isTimeout);
        const errorDesc = lastError.code || lastError.message || "unknown";
        console.log(`  ↩️  [OpenAI] Retry ${retryCount + 1}/${process.env.MAX_RETRIES || 3} after ${delay}ms (${errorDesc})`);
        emitStreamStatus("retry", `OpenAI retry ${retryCount + 1} after ${delay}ms (${errorDesc})`);

        setTimeout(() => {
          tmp34 = 0; // 重置路径索引
          fn2(retryCount + 1, null);
        }, delay);
        return;
      }

      tmp24.fail(tmp35 || "[OpenAI Error]");
      return;
    }
    if (tmp02.mode === "chat" && tmp33.length > 1 && tmp34 > 1) {
      console.log("  ↩️  OpenAI gateway rejected /v1/responses — falling back to /v1/chat/completions");
    }
    processor = tmp02.mode === "chat" ? new ChatCompletionsStreamProcessor(tmp8, tmp6, tmp11) : new OpenAIStreamProcessor(tmp8, tmp6, tmp11);
    if (tmp16 && tmp4) {
      processor.setAllowedTools(tmp4.map(arg02 => arg02.name));
    }
    const tmp03 = JSON.stringify(tmp02.body);
    const retryPrefix = retryCount > 0 ? `[Retry ${retryCount}] ` : "";
    console.log("  → " + retryPrefix + "OpenAI " + (tmp14.useHttp ? "http" : "https") + "://" + tmp14.parsed.hostname + ":" + tmp28 + tmp02.path + " model=" + tmp6 + " key=" + tmp29);
    if (tmp10) {
      const markName = retryCount > 0 ? `upstream_retry_${retryCount}` : (tmp34 === 1 ? "upstream_request_start" : "upstream_fallback_start");
      tmp10.mark(markName, "bytes=" + Buffer.byteLength(tmp03) + " tools=" + (tmp16 && tmp4 ? tmp4.length : 0));
    }

    // 检查熔断器状态
    const circuitBreaker = serviceCircuitBreakers.openai;
    if (!circuitBreaker.allowRequest()) {
      console.error("  🔒 OpenAI circuit breaker is OPEN - request blocked");
      tmp24.fail("[Circuit Breaker Open] Too many consecutive failures, please try again later");
      return;
    }

    let hasReceivedData = false; // 标记是否接收到任何数据

    tmp23 = tmp27.request({
      hostname: tmp14.parsed.hostname,
      port: tmp28,
      path: tmp02.path,
      method: "POST",
      agent: tmp14.useHttp ? undefined : keepAliveAgent,
      rejectUnauthorized: !tmp14.useHttp && tmp14.parsed.port === 443,
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        authorization: "Bearer " + tmp14.apiKey,
        "content-length": Buffer.byteLength(tmp03),
        ...proxyHeaders(tmp6, Buffer.byteLength(tmp03))
      }
    }, arg02 => {
      if (tmp10) {
        tmp10.mark(tmp34 === 1 ? "upstream_headers" : "upstream_fallback_headers", "status=" + arg02.statusCode + " path=" + tmp02.path);
      }
      if (arg02.statusCode !== 200) {
        fn("HTTP " + arg02.statusCode + " before stream");
        console.error("  ❌ OpenAI API returned " + arg02.statusCode + " (" + tmp02.path + ")");
        let tmp12 = "";
        arg02.setEncoding("utf8");
        arg02.on("data", arg03 => tmp12 += arg03);
        arg02.on("end", () => {
          console.error("  ❌ Body: " + sanitizeLogBody(tmp12));
          tmp35 = buildProviderErrorMessage("OpenAI", arg02.statusCode, tmp12);
          if (shouldFallbackToChatCompletions(arg02.statusCode, tmp12) && tmp34 < tmp33.length) {
            markGatewayCapability(tmp02.cacheKey, {
              preferChatCompletions: true,
              reason: "responses rejected: HTTP " + arg02.statusCode
            });
            fn2(retryCount);
            return;
          }
          if (tmp02.mode === "chat" && !tmp02.withoutGeminiThinking && tmp36 && shouldRetryWithoutGeminiThinking(arg02.statusCode, tmp12) && tmp34 < tmp33.length) {
            console.log("  ↩️  OpenAI-compatible gateway rejected Gemini thinking fields — retrying chat/completions without thinking_config");
            fn2(retryCount);
            return;
          }

          // 判断是否应该重试（在所有路径尝试完之后）
          if (tmp34 >= tmp33.length && shouldRetryOpenAIRequest(arg02.statusCode, null, retryCount)) {
            const isTimeout = false;
            const delay = calculateRetryDelay(retryCount, arg02.statusCode, {}, isTimeout);
            console.log(`  ↩️  [OpenAI] Retry ${retryCount + 1}/${process.env.MAX_RETRIES || 3} after ${delay}ms (HTTP ${arg02.statusCode})`);
            emitStreamStatus("retry", `OpenAI retry ${retryCount + 1} after ${delay}ms (HTTP ${arg02.statusCode})`);

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
        onDataReceived: () => { hasReceivedData = true; },
        onSuccess: () => { circuitBreaker.recordSuccess(); }
      });
    });
    tmp23.setTimeout(OPENAI_REQUEST_TIMEOUT_MS, () => {
      if (tmp24.wasClosedByClient()) {
        return;
      }
      console.error("  ❌ OpenAI request timeout after " + OPENAI_REQUEST_TIMEOUT_MS + "ms");
      fn("request timeout " + OPENAI_REQUEST_TIMEOUT_MS + "ms");

      // 超时错误：判断是否应该重试
      const timeoutError = { code: "ETIMEDOUT", timeout: true };
      if (!hasReceivedData && shouldRetryOpenAIRequest(0, timeoutError, retryCount)) {
        tmp23.destroy();
        const isTimeout = true;
        const delay = calculateRetryDelay(retryCount, 0, {}, isTimeout);
        console.log(`  ↩️  [OpenAI] Retry ${retryCount + 1}/${process.env.MAX_RETRIES || 3} after ${delay}ms (timeout)`);
        emitStreamStatus("retry", `OpenAI retry ${retryCount + 1} after ${delay}ms (timeout)`);

        setTimeout(() => {
          tmp34 = 0; // 重置路径索引
          fn2(retryCount + 1, null);
        }, delay);
        return;
      }

      circuitBreaker.recordFailure();
      tmp24.fail("[OpenAI Request Timeout]");
      tmp23.destroy();
    });
    tmp23.on("error", arg03 => {
      if (tmp24.wasClosedByClient() && (arg03.code === "ECONNRESET" || arg03.code === "ECONNABORTED")) {
        return;
      }
      const tmp12 = describeNetworkError(arg03, tmp14.host, tmp14.parsed.port);
      console.error("  ❌ OpenAI request error: " + tmp12);
      fn("request error: " + (arg03.message || arg03.code || "unknown"));

      // 网络错误：判断是否应该重试
      if (!hasReceivedData && shouldRetryOpenAIRequest(0, arg03, retryCount)) {
        const isTimeout = isTimeoutError(arg03);
        const delay = calculateRetryDelay(retryCount, 0, {}, isTimeout);
        const errorDesc = arg03.code || arg03.message || "unknown";
        console.log(`  ↩️  [OpenAI] Retry ${retryCount + 1}/${process.env.MAX_RETRIES || 3} after ${delay}ms (${errorDesc})`);
        emitStreamStatus("retry", `OpenAI retry ${retryCount + 1} after ${delay}ms (${errorDesc})`);

        setTimeout(() => {
          tmp34 = 0; // 重置路径索引
          fn2(retryCount + 1, arg03);
        }, delay);
        return;
      }

      circuitBreaker.recordFailure();
      tmp24.fail("[OpenAI Connection Error] " + tmp12);
    });
    tmp23.end(tmp03);
    if (tmp10 && tmp34 === 1) {
      tmp10.mark("upstream_request_sent");
    }
  };
  fn2();
}
function toOpenAIMessages(arg0, arg1) {
  const tmp2 = [];
  if (arg0) {
    const tmp02 = {
      role: "developer",
      content: arg0
    };
    tmp2.push(tmp02);
  }
  for (const tmp02 of arg1) {
    if (typeof tmp02.content === "string") {
      const tmp03 = {
        role: tmp02.role,
        content: tmp02.content
      };
      tmp2.push(tmp03);
      continue;
    }
    if (!Array.isArray(tmp02.content)) {
      tmp2.push({
        role: tmp02.role,
        content: String(tmp02.content)
      });
      continue;
    }
    if (tmp02.role === "assistant") {
      let tmp03 = "";
      for (const tmp04 of tmp02.content) {
        if (tmp04.type === "text") {
          tmp03 += tmp04.text;
        }
      }
      if (tmp03) {
        const tmp04 = {
          role: "assistant",
          content: tmp03
        };
        tmp2.push(tmp04);
      }
      for (const tmp04 of tmp02.content) {
        if (tmp04.type === "tool_use" && tmp04.name) {
          tmp2.push({
            type: "function_call",
            call_id: tmp04.id,
            name: tmp04.name,
            arguments: typeof tmp04.input === "string" ? tmp04.input : JSON.stringify(tmp04.input)
          });
        }
      }
    } else if (tmp02.role === "user") {
      const tmp03 = [];
      for (const tmp04 of tmp02.content) {
        if (tmp04.type === "text") {
          tmp03.push(tmp04.text);
        } else if (tmp04.type === "image") {
          const tmp05 = {
            type: "input_image",
            image_url: "data:" + (tmp04.source?.media_type || "image/png") + ";base64," + (tmp04.source?.data || "")
          };
          tmp03.push(tmp05);
        } else if (tmp04.type === "tool_result") {
          tmp2.push({
            type: "function_call_output",
            call_id: tmp04.tool_use_id,
            output: typeof tmp04.content === "string" ? tmp04.content : JSON.stringify(tmp04.content)
          });
        }
      }
      if (tmp03.length > 0) {
        const tmp04 = tmp03.some(arg02 => typeof arg02 !== "string");
        if (tmp04) {
          tmp2.push({
            role: "user",
            content: tmp03.map(arg02 => typeof arg02 === "string" ? {
              type: "input_text",
              text: arg02
            } : arg02)
          });
        } else {
          tmp2.push({
            role: "user",
            content: tmp03.join("\n")
          });
        }
      }
    }
  }
  return tmp2;
}
