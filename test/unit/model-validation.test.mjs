import { test } from "node:test";
import assert from "node:assert/strict";
import { requiresConfiguredDefaultModel } from "../../proxy-scripts/src/handlers/chat.js";
import { setRuntimeConfig } from "../../proxy-scripts/src/handlers/models.js";

test("requiresConfiguredDefaultModel blocks __DEFAULT__ models when not configured", () => {
  setRuntimeConfig({
    defaultModel: "",
    DEFAULT_MODEL: "",
    BYOK1_MODEL: ""
  });

  assert.equal(
    requiresConfiguredDefaultModel("MODEL_GOOGLE_GEMINI_2_5_FLASH"),
    true,
    "应拦截未配置的 Gemini __DEFAULT__ 模型"
  );

  assert.equal(
    requiresConfiguredDefaultModel("MODEL_CHAT"),
    true,
    "应拦截未配置的 MODEL_CHAT"
  );

  assert.equal(
    requiresConfiguredDefaultModel("MODEL_CLAUDE_4_OPUS"),
    true,
    "应拦截未配置的 Claude __DEFAULT__ 模型"
  );
});

test("requiresConfiguredDefaultModel allows __DEFAULT__ when configured", () => {
  setRuntimeConfig({
    defaultModel: "gpt-5.5",
    BYOK1_MODEL: "gpt-5.5"
  });

  assert.equal(
    requiresConfiguredDefaultModel("MODEL_GOOGLE_GEMINI_2_5_FLASH"),
    false,
    "配置后应允许 Gemini __DEFAULT__ 模型"
  );

  assert.equal(
    requiresConfiguredDefaultModel("MODEL_CHAT"),
    false,
    "配置后应允许 MODEL_CHAT"
  );
});

test("requiresConfiguredDefaultModel checks BYOK slots independently", () => {
  setRuntimeConfig({
    defaultModel: "gpt-5.5",
    BYOK1_MODEL: "gpt-5.5",
    BYOK2_MODEL: ""  // BYOK #2 未配置
  });

  assert.equal(
    requiresConfiguredDefaultModel("MODEL_CLAUDE_4_OPUS_BYOK"),
    false,
    "BYOK #1 配置后应允许"
  );

  assert.equal(
    requiresConfiguredDefaultModel("MODEL_CLAUDE_4_OPUS_THINKING_BYOK"),
    true,
    "BYOK #2 未配置时应拦截"
  );
});

test("requiresConfiguredDefaultModel allows explicit model names", () => {
  setRuntimeConfig({
    defaultModel: "",
    BYOK1_MODEL: ""
  });

  assert.equal(
    requiresConfiguredDefaultModel("claude-opus-4-8"),
    false,
    "显式模型名不需要默认配置"
  );

  assert.equal(
    requiresConfiguredDefaultModel("gpt-5.4"),
    false,
    "显式 GPT 模型名不需要默认配置"
  );
});
