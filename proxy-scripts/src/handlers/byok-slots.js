export const BYOK_SLOT_BY_REQUEST = {
  MODEL_CLAUDE_4_OPUS_BYOK: 1,
  MODEL_CLAUDE_4_OPUS_THINKING_BYOK: 2
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
  "MODEL",
  "THINKING_EFFORT"
];

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
  return /claude-(opus-4-[6-8]|sonnet-4-6|mythos)/.test(normalized);
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
