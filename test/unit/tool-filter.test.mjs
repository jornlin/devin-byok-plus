import { test } from "node:test";
import assert from "node:assert/strict";
import { filterForwardedTools } from "../../src/proxy/handlers/chat.js";

// 移植自上游 v2.6.0：转发工具过滤。
// allow 列表支持精确名与前缀通配（mcp1_*），deny 前缀（mcp3_）优先于 allow。
test("filterForwardedTools supports allow and deny filters", () => {
  const oldAllow = process.env.TOOL_ALLOWLIST;
  const oldDenyPrefixes = process.env.TOOL_DENY_PREFIXES;
  try {
    process.env.TOOL_ALLOWLIST = "read_file,edit,mcp1_*";
    process.env.TOOL_DENY_PREFIXES = "mcp3_";
    const tools = [
      { name: "read_file" },
      { name: "run_command" },
      { name: "mcp1_fetch-doc" },
      { name: "mcp3_get_script_source" },
    ];
    assert.deepEqual(
      filterForwardedTools(tools).map((tool) => tool.name),
      ["read_file", "mcp1_fetch-doc"]
    );
  } finally {
    if (oldAllow === undefined) {
      delete process.env.TOOL_ALLOWLIST;
    } else {
      process.env.TOOL_ALLOWLIST = oldAllow;
    }
    if (oldDenyPrefixes === undefined) {
      delete process.env.TOOL_DENY_PREFIXES;
    } else {
      process.env.TOOL_DENY_PREFIXES = oldDenyPrefixes;
    }
  }
});
