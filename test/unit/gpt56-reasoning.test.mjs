import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenAIResponsesBody,
  buildOpenAIChatCompletionsBody,
} from "../../src/proxy/handlers/chat.js";
import { thinkingEffortToOpenAIReasoningEffort } from "../../src/proxy/handlers/byok-slots.js";
import {
  setRuntimeConfig,
  getSlotReasoningMode,
  getSlotServiceTier,
} from "../../src/proxy/handlers/models.js";

// 移植自上游 v2.6.1：GPT-5.6 推理全链路。
// Responses body 对 gpt-5.6 保留 max effort 且写入 reasoning.mode；service_tier 支持 priority。
test("GPT-5.6 Responses body supports max effort and pro mode", () => {
  const responses = buildOpenAIResponsesBody({
    systemPrompt: "",
    messages: [{ role: "user", content: "hello" }],
    resolvedModel: "gpt-5.6-terra",
    serviceTier: "priority",
    thinkingOptions: {
      thinkingEnabled: true,
      reasoningEffort: "max",
      reasoningMode: "pro",
    },
    forwardTools: false,
  });

  assert.equal(responses.model, "gpt-5.6-terra");
  assert.equal(responses.reasoning.effort, "max");
  assert.equal(responses.reasoning.mode, "pro");
  assert.equal(responses.service_tier, "priority");
  assert.equal(thinkingEffortToOpenAIReasoningEffort("max", "gpt-5.6-luna"), "max");
  assert.equal(thinkingEffortToOpenAIReasoningEffort("max", "gpt-5.4"), "xhigh");
});

// Chat Completions 回退不写 reasoning.mode（该字段仅 Responses API 支持），但保留 reasoning_effort。
test("GPT-5.6 mode is omitted from Chat Completions fallback", () => {
  const chat = buildOpenAIChatCompletionsBody({
    systemPrompt: "",
    messages: [{ role: "user", content: "hello" }],
    resolvedModel: "gpt-5.6-sol",
    thinkingOptions: {
      thinkingEnabled: true,
      reasoningEffort: "max",
      reasoningMode: "pro",
    },
    forwardTools: false,
  });

  assert.equal(chat.reasoning_effort, "max");
  assert.equal(chat.reasoning, undefined);
});

// 运行时 reasoning.mode 净化 + 槽位感知：非法值归空，slot#1 回退全局，priority 生效。
test("runtime GPT-5.6 reasoning mode is sanitized and slot-aware", () => {
  const current = setRuntimeConfig({
    OPENAI_REASONING_MODE: "PRO",
    BYOK1_OPENAI_REASONING_MODE: "standard",
    BYOK2_OPENAI_REASONING_MODE: "invalid",
    BYOK1_OPENAI_SERVICE_TIER: "priority",
  });

  assert.equal(current.openaiReasoningMode, "pro");
  assert.equal(getSlotReasoningMode(1), "standard");
  assert.equal(getSlotReasoningMode(2), "");
  assert.equal(getSlotServiceTier(1), "priority");

  setRuntimeConfig({
    OPENAI_REASONING_MODE: "",
    BYOK1_OPENAI_REASONING_MODE: "",
    BYOK2_OPENAI_REASONING_MODE: "",
    BYOK1_OPENAI_SERVICE_TIER: "",
  });
});

