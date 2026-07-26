import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSseFrames, sanitizeLogBody } from "../../src/proxy/handlers/chat.js";

// 移植自上游 v2.6.0：SSE 帧拆分应同时支持 LF (\n\n) 与 CRLF (\r\n\r\n) 分隔，
// 并把最后一段不完整帧作为 remainder 保留到下次拼接。
test("splitSseFrames supports LF and CRLF separators", () => {
  assert.deepEqual(splitSseFrames("data: one\n\ndata: two\r\n\r\ndata: partial"), {
    frames: ["data: one", "data: two"],
    remainder: "data: partial",
  });
  assert.deepEqual(splitSseFrames("data: one\r\n\r\n"), {
    frames: ["data: one"],
    remainder: "",
  });
});

// 移植自上游 v2.6.0：日志脱敏应对结构化 secret（api_key/token/password 等）
// 与裸 token（sk-*/Bearer *）做遮蔽，避免密钥进入日志。
test("sanitizeLogBody redacts structured secrets", () => {
  const body = JSON.stringify({
    api_key: "sk-1234567890abcdef",
    token: "Bearer abcdefghijklmnop",
    nested: {
      password: "secret-value",
    },
    detail: "ok",
  });
  const sanitized = sanitizeLogBody(body);
  assert.match(sanitized, /"api_key":"\[REDACTED\]"/);
  assert.match(sanitized, /"token":"\[REDACTED\]"/);
  assert.match(sanitized, /"password":"\[REDACTED\]"/);
  assert.doesNotMatch(sanitized, /1234567890abcdef|abcdefghijklmnop|secret-value/);
});
