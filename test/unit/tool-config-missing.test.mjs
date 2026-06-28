import { test } from "node:test";
import assert from "node:assert/strict";
import { synthesizeToolsFromMessages, collectToolUseNames } from "../../src/proxy/handlers/chat.js";

// 复现 AmazonQ/Bedrock 报错：toolConfig field must be defined when using toolUse and toolResult content blocks
// 根因：历史消息含 tool_use/tool_result，但本次请求未携带 tools 定义

test("collectToolUseNames detects tool_use and tool_result blocks", () => {
  const messages = [
    { role: "user", content: "hi" },
    {
      role: "assistant",
      content: [
        { type: "text", text: "let me read" },
        { type: "tool_use", id: "t1", name: "read_file", input: {} }
      ]
    },
    {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content: "ok" }]
    }
  ];
  const { names, hasToolBlock } = collectToolUseNames(messages);
  assert.equal(hasToolBlock, true);
  assert.deepEqual(names, ["read_file"]);
});

test("synthesizeToolsFromMessages backfills tools when history has tool blocks but request omits tools", () => {
  const messages = [
    {
      role: "assistant",
      content: [{ type: "tool_use", id: "t1", name: "run_command", input: {} }]
    },
    {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content: "done" }]
    }
  ];
  const result = synthesizeToolsFromMessages(messages, undefined);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "run_command");
  assert.equal(result[0].input_schema.type, "object");
});

test("synthesizeToolsFromMessages keeps existing tools untouched", () => {
  const existing = [{ name: "read_file", description: "", input_schema: { type: "object", properties: {} } }];
  const messages = [
    { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "read_file", input: {} }] }
  ];
  const result = synthesizeToolsFromMessages(messages, existing);
  assert.strictEqual(result, existing);
});

test("synthesizeToolsFromMessages returns input unchanged when no tool blocks present", () => {
  const messages = [
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi there" }
  ];
  assert.strictEqual(synthesizeToolsFromMessages(messages, undefined), undefined);
});

test("synthesizeToolsFromMessages handles tool_result-only history (orphaned tool result)", () => {
  // 即使只有 tool_result（无对应 tool_use 名称），仍需触发 tools 字段以满足 Bedrock
  const messages = [
    { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "r" }] }
  ];
  const result = synthesizeToolsFromMessages(messages, undefined);
  // 没有可提取的工具名时，无法合成具体定义，回退为原值（由上游 KNOWN_TOOL 过滤兜底）
  assert.strictEqual(result, undefined);
});
