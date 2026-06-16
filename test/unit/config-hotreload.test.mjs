import { test } from "node:test";
import assert from "node:assert/strict";
import { handleConfigRequest, setRuntimeConfig } from "../../proxy-scripts/src/handlers/models.js";

test("handleConfigRequest applies POST body when hybrid passes buffered body", async () => {
  // 重置配置
  setRuntimeConfig({
    defaultModel: "",
    BYOK1_MODEL: "",
    BYOK2_MODEL: ""
  });

  let status = 0;
  let responseBody = "";

  const req = {
    method: "POST",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" }
  };

  const res = {
    writeHead(code) {
      status = code;
    },
    end(payload) {
      responseBody = payload;
    }
  };

  // 模拟 hybrid-server 传递的预缓冲请求体
  const bufferedBody = JSON.stringify({
    defaultModel: "claude-sonnet-4-6",
    BYOK1_MODEL: "claude-sonnet-4-6",
    BYOK2_MODEL: "claude-opus-4-8-thinking"
  });

  await handleConfigRequest(req, res, bufferedBody);

  assert.equal(status, 200, "应返回 200 状态码");

  const parsed = JSON.parse(responseBody);
  assert.equal(parsed.defaultModel, "claude-sonnet-4-6", "defaultModel 应被更新");
  assert.equal(parsed.byok1.model, "claude-sonnet-4-6", "BYOK1 模型应被更新");
  assert.equal(parsed.byok2.model, "claude-opus-4-8-thinking", "BYOK2 模型应被更新");
});

test("handleConfigRequest handles streaming body when no buffered body provided", async () => {
  setRuntimeConfig({
    defaultModel: "",
    BYOK1_MODEL: ""
  });

  let status = 0;
  let responseBody = "";

  // 模拟流式请求
  const chunks = [
    '{"defaultModel":',
    '"gpt-4o",',
    '"BYOK1_MODEL":"gpt-4o"}'
  ];

  let dataHandler = null;
  let endHandler = null;

  const req = {
    method: "POST",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    setEncoding: () => {},
    on: (event, handler) => {
      if (event === "data") dataHandler = handler;
      if (event === "end") endHandler = handler;
    }
  };

  const res = {
    writeHead(code) { status = code; },
    end(payload) { responseBody = payload; }
  };

  // 不传递 bufferedBody，触发流式处理
  await handleConfigRequest(req, res);

  // 模拟数据流
  chunks.forEach(chunk => dataHandler(chunk));
  endHandler();

  // 给异步处理一点时间
  await new Promise(resolve => setTimeout(resolve, 100));

  assert.equal(status, 200, "应返回 200 状态码");

  const parsed = JSON.parse(responseBody);
  assert.equal(parsed.defaultModel, "gpt-4o", "defaultModel 应通过流式读取更新");
});

test("handleConfigRequest rejects oversized POST body", async () => {
  let status = 0;
  let responseBody = "";

  const req = {
    method: "POST",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" }
  };

  const res = {
    writeHead(code) { status = code; },
    end(payload) { responseBody = payload; }
  };

  // 超过 16384 字节的请求体
  const oversizedBody = "x".repeat(20000);

  await handleConfigRequest(req, res, oversizedBody);

  assert.equal(status, 413, "应返回 413 Payload Too Large");

  const parsed = JSON.parse(responseBody);
  assert.match(parsed.error, /too large/i, "错误消息应提示请求体过大");
});
