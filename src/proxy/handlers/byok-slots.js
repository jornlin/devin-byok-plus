export const BYOK_SLOT_BY_REQUEST = {
  MODEL_CLAUDE_4_OPUS_BYOK: 1,
  MODEL_CLAUDE_4_OPUS_THINKING_BYOK: 2,
  MODEL_CLAUDE_4_SONNET_BYOK: 3,
  MODEL_CLAUDE_4_SONNET_THINKING_BYOK: 4
};

export function getByokSlot(requestedModel) {
  const id = String(requestedModel || "").trim();
  return BYOK_SLOT_BY_REQUEST[id] || null;
}

export function slotEnvPrefix(slot) {
  return "BYOK" + slot + "_";
}

export function slotField(slot, name) {
  return slotEnvPrefix(slot) + name;
}

export const SLOT_CONFIG_FIELDS = [
  "ANTHROPIC_API_HOST",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_API_PATH",
  "OPENAI_API_HOST",
  "OPENAI_API_KEY",
  "OPENAI_API_PATH",
  "OPENAI_SERVICE_TIER",
  "MODEL",
  "THINKING_EFFORT",
  "PROTOCOL"
];

const PROTOCOL_VALUES = ["", "anthropic", "openai", "gemini"];

export function sanitizeSlotProtocol(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return PROTOCOL_VALUES.includes(normalized) ? normalized : "";
}

export const THINKING_EFFORT_LEVELS = ["", "low", "medium", "high", "xhigh", "max"];
export const GEMINI_THINKING_LEVELS = ["", "minimal", "low", "medium", "high"];

export function sanitizeThinkingEffort(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return THINKING_EFFORT_LEVELS.includes(normalized) ? normalized : "";
}

export function sanitizeGeminiThinkingEffort(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const legacyMap = {
    xhigh: "high",
    max: "high"
  };
  const mapped = legacyMap[normalized] || normalized;
  return GEMINI_THINKING_LEVELS.includes(mapped) ? mapped : "";
}

function normalizeModelName(model) {
  return String(model || "").trim().toLowerCase().replace(/-thinking$/i, "");
}

export function detectModelProvider(model) {
  const normalized = normalizeModelName(model);
  if (!normalized) {
    return null;
  }
  if (/^gemini-|^model_google_gemini|^models\/gemini-/.test(normalized)) {
    return "gemini";
  }
  if (/^gpt-|^o[0-9][a-z0-9.-]*|^chatgpt-|^model_gpt/.test(normalized)) {
    return "gpt";
  }
  if (/^claude-|^model_claude/.test(normalized)) {
    return "claude";
  }
  return null;
}

export function supportsThinkingIntensity(provider, model) {
  if (!provider) {
    return false;
  }
  const normalized = normalizeModelName(model);
  if (provider === "claude" || provider === "gpt") {
    return !!normalized;
  }
  if (provider === "gemini") {
    return /gemini-/.test(normalized);
  }
  return false;
}

export function usesGeminiThinkingLevel(model) {
  const normalized = normalizeModelName(model);
  return /gemini-3[.]?5|^gemini-3(-|\.|$)|^gemini-3\.1|^gemini-3-flash/.test(normalized);
}

export function thinkingEffortToAnthropicBudget(effort) {
  const map = {
    low: 5000,
    medium: 10000,
    high: 20000,
    xhigh: 32000,
    max: 64000
  };
  return map[sanitizeThinkingEffort(effort)] || 0;
}

export function thinkingEffortToOpenAIReasoningEffort(effort) {
  const normalized = sanitizeThinkingEffort(effort);
  if (!normalized) {
    return "";
  }
  return normalized === "max" ? "xhigh" : normalized;
}

export function thinkingEffortToGeminiLevel(effort) {
  return sanitizeGeminiThinkingEffort(effort);
}

export function thinkingEffortToGeminiBudget(effort) {
  const level = sanitizeGeminiThinkingEffort(effort);
  const map = {
    minimal: 1024,
    low: 4096,
    medium: 8192,
    high: 24576
  };
  return map[level] || 0;
}

export function buildGeminiThinkingPayload(model, effort, fallbackEffort = "medium") {
  if (!supportsThinkingIntensity("gemini", model)) {
    return null;
  }
  const resolvedEffort = sanitizeGeminiThinkingEffort(effort) || sanitizeGeminiThinkingEffort(fallbackEffort);
  if (!resolvedEffort) {
    return null;
  }
  if (usesGeminiThinkingLevel(model)) {
    return {
      thinkingConfig: {
        thinkingLevel: resolvedEffort,
        thinking_level: resolvedEffort
      }
    };
  }
  const budget = thinkingEffortToGeminiBudget(resolvedEffort);
  if (!budget) {
    return null;
  }
  return {
    thinkingConfig: {
      thinkingBudget: budget,
      thinking_budget: budget
    }
  };
}

export function supportsAdaptiveClaudeThinking(model) {
  const normalized = String(model || "").trim().toLowerCase().replace(/-thinking$/i, "");
  return /claude-(?:[a-z0-9]+[-._])*(opus|sonnet)-4(?:[-._:]|$)|claude-mythos/.test(normalized);
}

export function buildAnthropicThinkingPayload(model, effort, fallbackEffort = "medium") {
  const resolvedEffort = sanitizeThinkingEffort(effort) || sanitizeThinkingEffort(fallbackEffort);
  if (!resolvedEffort) {
    return null;
  }
  if (supportsAdaptiveClaudeThinking(model)) {
    return {
      thinking: {
        type: "adaptive"
      },
      output_config: {
        effort: resolvedEffort
      }
    };
  }
  const budget = thinkingEffortToAnthropicBudget(resolvedEffort) || 10000;
  return {
    thinking: {
      type: "enabled",
      budget_tokens: budget
    }
  };
}

// 使用非标准 Anthropic 路径（/anthropic 而非 /v1/messages）的提供商
const ANTHROPIC_NONSTANDARD_PATH_HOSTS = [
  { test: (host) => host.includes('deepseek') || host.includes('deepseek.com'), path: '/anthropic' },
  { test: (host) => host.includes('moonshot') || host.includes('moonshot.ai') || host.includes('moonshot.cn'), path: '/anthropic' },
];

// 不支持 OpenAI Responses API（/v1/responses）的 OpenAI 兼容提供商
const OPENAI_NO_RESPONSES_HOSTS = [
  { test: (host) => host.includes('deepseek') || host.includes('deepseek.com') },
  { test: (host) => host.includes('moonshot') || host.includes('moonshot.ai') || host.includes('moonshot.cn') },
  { test: (host) => host.includes('siliconflow') || host.includes('siliconflow.cn') },
];

/**
 * 根据提供商 hostname 和协议类型自动修正 API 路径。
 * 仅在用户使用默认路径（或未设置路径）时才自动修正；
 * 用户手动通过高级路由设置的路径会被保留。
 *
 * @param {'anthropic'|'openai'} protocolKind - 协议类型
 * @param {string} hostname - 去掉协议头后的 host（如 api.deepseek.com）
 * @param {string} currentPath - 当前配置的 API 路径
 * @returns {string} 修正后的路径
 */
export function correctApiPathForProvider(protocolKind, hostname, currentPath) {
  const lowerHost = String(hostname || '').toLowerCase();
  const normalizedPath = String(currentPath || '').trim();

  if (protocolKind === 'anthropic') {
    for (const entry of ANTHROPIC_NONSTANDARD_PATH_HOSTS) {
      if (entry.test(lowerHost)) {
        // 仅在用户未手动修改路径（仍是默认值 /v1/messages）时自动修正
        if (!normalizedPath || normalizedPath === '/v1/messages') {
          return entry.path;
        }
        // 用户已手动设置路径，尊重用户选择
        return normalizedPath;
      }
    }
  }

  if (protocolKind === 'openai') {
    for (const entry of OPENAI_NO_RESPONSES_HOSTS) {
      if (entry.test(lowerHost)) {
        // 仅在路径为默认 /v1/responses 或 /v1/chat/completions 时自动修正
        if (!normalizedPath || normalizedPath === '/v1/responses' || normalizedPath === '/v1/chat/completions') {
          return '/v1/chat/completions';
        }
        return normalizedPath;
      }
    }
  }

  return normalizedPath || currentPath;
}
