import { test } from "node:test";
import assert from "node:assert/strict";
import { bufferedResponseHeaders } from "../../src/proxy/connect.js";

// 移植自上游 v2.5.0：缓冲（非流式）响应头处理。
// bufferedResponseHeaders 应剥离逐跳头（transfer-encoding/connection 等）与
// 陈旧的 content-length（含大小写变体），再写入本次缓冲响应的真实字节长度。
test("bufferedResponseHeaders strips transfer encoding and stale content length", () => {
  const headers = bufferedResponseHeaders(
    {
      "content-type": "application/proto",
      "Content-Length": "999",
      "transfer-encoding": "chunked",
      connection: "keep-alive",
      "x-request-id": "req-1",
    },
    12
  );

  assert.equal(headers["transfer-encoding"], undefined);
  assert.equal(headers["Content-Length"], undefined);
  assert.equal(headers.connection, undefined);
  assert.equal(headers["content-length"], 12);
  assert.equal(headers["x-request-id"], "req-1");
});
