import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildGatewayCapabilityKey,
  markGatewayCapability,
  getGatewayCapability,
  _setGatewayCapabilityCachePathForTests,
  _resetGatewayCapabilityMemoryForTests,
} from "../../src/proxy/handlers/gateway-capability.js";

// 移植自上游 v2.6.0：网关能力缓存磁盘持久化。
// 设置缓存路径后写入应落盘；清空内存缓存后仍能从磁盘读回原条目。
test("gateway capability cache can persist to disk", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "byok-gateway-cache-"));
  const cachePath = path.join(dir, "capabilities.json");
  const key = buildGatewayCapabilityKey({
    protocol: "http",
    host: "127.0.0.1",
    port: 8787,
    apiPath: "/v1/responses",
    providerKind: "openai",
    slot: "default",
  });
  try {
    _setGatewayCapabilityCachePathForTests(cachePath);
    markGatewayCapability(key, {
      preferChatCompletions: true,
      reason: "responses rejected: HTTP 400",
    });
    assert.equal(fs.existsSync(cachePath), true);

    _resetGatewayCapabilityMemoryForTests();
    assert.equal(getGatewayCapability(key).preferChatCompletions, true);
    assert.equal(getGatewayCapability(key).reason, "responses rejected: HTTP 400");
  } finally {
    _setGatewayCapabilityCachePathForTests("");
    fs.rmSync(dir, {
      recursive: true,
      force: true,
    });
  }
});
