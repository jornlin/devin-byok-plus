import _0x1fee6b from "node:http2";
import _0x5d1b1d from "node:https";
import { handleGetChatMessage } from "./handlers/chat.js";
import { handleGetCompletions } from "./handlers/completions.js";
import { getProviderConfig, getRuntimeConfig, setRuntimeConfig } from "./handlers/models.js";
import { getLoopbackListenHosts, loopbackApiUrl } from "./net-utils.js";
function parsePortEnv(_0x31579a, _0x304fc2) {
  const _0x315d6c = process.env[_0x31579a];
  const _0x55f16c = parseInt(String(_0x315d6c ?? ""), 10);
  if (Number.isInteger(_0x55f16c) && _0x55f16c > 0 && _0x55f16c <= 65535) {
    return _0x55f16c;
  } else {
    return _0x304fc2;
  }
}
const PORT = parsePortEnv("INFERENCE_PORT", 3001);
const BIND_HOST = process.env.BIND_HOST || "127.0.0.1";
const UPSTREAM = "inference.codeium.com";
const INTERCEPT_PATHS = new Set(["/exa.api_server_pb.ApiServerService/GetChatMessage", "/exa.api_server_pb.ApiServerService/GetCompletions"]);
let reqCount = 0;
const HOP_BY_HOP_RESPONSE_HEADERS = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);
function now() {
  return new Date().toISOString().slice(11, 23);
}
function toHttp2ResponseHeaders(_0x2633ed, _0x4d9dde = {}) {
  const _0x52ec5e = {
    ":status": _0x2633ed
  };
  const _0x1eabb4 = _0x52ec5e;
  for (const [_0x4989ff, _0x416bbd] of Object.entries(_0x4d9dde)) {
    const _0x18b9d3 = _0x4989ff.toLowerCase();
    if (HOP_BY_HOP_RESPONSE_HEADERS.has(_0x18b9d3) || _0x18b9d3.startsWith(":")) {
      continue;
    }
    _0x1eabb4[_0x18b9d3] = _0x416bbd;
  }
  return _0x1eabb4;
}
function respondJson(_0x4b70f7, _0x12e3a1, _0x599ef0) {
  if (_0x4b70f7.destroyed) {
    return;
  }
  const _0x6bbdac = JSON.stringify(_0x599ef0, null, 2);
  try {
    _0x4b70f7.respond({
      ":status": _0x12e3a1,
      "content-type": "application/json",
      "content-length": Buffer.byteLength(_0x6bbdac)
    });
    _0x4b70f7.end(_0x6bbdac);
  } catch {}
}
function handleRuntimeConfigStream(_0x4f8937, _0x153b95) {
  const _0x12beac = _0x153b95[":method"] || "GET";
  if (_0x12beac === "GET") {
    const _0x4ce375 = getProviderConfig();
    const _0x47165d = {
      host: _0x4ce375.anthropic.host,
      hasKey: !!_0x4ce375.anthropic.apiKey
    };
    const _0x3d8967 = {
      host: _0x4ce375.openai.host,
      hasKey: !!_0x4ce375.openai.apiKey
    };
    const _0x5cb7cb = {
      anthropic: _0x47165d,
      openai: _0x3d8967
    };
    respondJson(_0x4f8937, 200, {
      ...getRuntimeConfig(),
      providers: _0x5cb7cb
    });
    return;
  }
  if (_0x12beac !== "POST") {
    respondJson(_0x4f8937, 405, {
      error: "Method not allowed"
    });
    return;
  }
  const _0x5848a3 = [];
  let _0x5bd1be = 0;
  let _0x3fc593 = false;
  const _0x70b417 = 16384;
  _0x4f8937.on("data", _0x39381a => {
    if (_0x3fc593) {
      return;
    }
    _0x5bd1be += _0x39381a.length;
    if (_0x5bd1be > _0x70b417) {
      _0x3fc593 = true;
      const _0x1db470 = {
        error: "Body too large (max " + _0x70b417 + " bytes)"
      };
      respondJson(_0x4f8937, 413, _0x1db470);
      _0x4f8937.close();
      return;
    }
    _0x5848a3.push(_0x39381a);
  });
  _0x4f8937.on("end", () => {
    if (_0x3fc593) {
      return;
    }
    try {
      const _0x41fe3f = JSON.parse(Buffer.concat(_0x5848a3).toString("utf8") || "{}");
      const _0x2bdc0a = setRuntimeConfig(_0x41fe3f);
      console.log("[" + now() + "] inference config updated: model=" + _0x2bdc0a.defaultModel + ", maxTokens=" + _0x2bdc0a.maxTokens);
      respondJson(_0x4f8937, 200, _0x2bdc0a);
    } catch (_0x254b41) {
      const _0x1ffb08 = {
        error: "Invalid JSON: " + _0x254b41.message
      };
      respondJson(_0x4f8937, 400, _0x1ffb08);
    }
  });
  _0x4f8937.on("error", _0x3eb1fe => {
    if (_0x3eb1fe.code === "ERR_HTTP2_STREAM_ERROR") {
      return;
    }
    console.error("[" + now() + "] config stream error: " + _0x3eb1fe.message);
  });
}
function forwardToCodeium(_0xf2b9cc, _0x3a7a4, _0x6fa480, _0x45e7ee, _0x63ea35) {
  const _0x1fb791 = {};
  for (const [_0x25727e, _0xba3517] of Object.entries(_0x6fa480)) {
    if (_0x25727e.startsWith(":") || _0x25727e === "host") {
      continue;
    }
    _0x1fb791[_0x25727e] = _0xba3517;
  }
  _0x1fb791.host = UPSTREAM;
  _0x1fb791["content-length"] = _0xf2b9cc.length;
  let _0x2d249d = false;
  const _0x168289 = {
    hostname: UPSTREAM,
    port: 443,
    path: _0x45e7ee,
    method: "POST",
    headers: _0x1fb791
  };
  const _0x9b3c40 = _0x5d1b1d.request(_0x168289, _0x5344e3 => {
    const _0x4840b4 = {
      ":status": _0x5344e3.statusCode
    };
    const _0x22bb22 = _0x4840b4;
    for (const [_0x3fcf97, _0x5a1776] of Object.entries(_0x5344e3.headers)) {
      const _0x39604c = _0x3fcf97.toLowerCase();
      if (HOP_BY_HOP_RESPONSE_HEADERS.has(_0x39604c) || _0x39604c.startsWith(":")) {
        continue;
      }
      _0x22bb22[_0x39604c] = _0x5a1776;
    }
    if (!_0x3a7a4.destroyed) {
      try {
        _0x3a7a4.respond(_0x22bb22);
        _0x2d249d = true;
      } catch {}
    }
    _0x5344e3.on("data", _0x5329d0 => {
      if (!_0x3a7a4.destroyed) {
        _0x3a7a4.write(_0x5329d0);
      }
    });
    _0x5344e3.on("end", () => {
      if (!_0x3a7a4.destroyed) {
        _0x3a7a4.end();
      }
      console.log("  [#" + _0x63ea35 + "] ✅ forwarded");
    });
    _0x5344e3.on("error", _0x2a010b => {
      console.error("  [#" + _0x63ea35 + "] ❌ fwd error: " + _0x2a010b.message);
      if (!_0x3a7a4.destroyed) {
        _0x3a7a4.end();
      }
    });
  });
  _0x9b3c40.on("error", _0x1a46dd => {
    console.error("  [#" + _0x63ea35 + "] ❌ upstream error: " + _0x1a46dd.message);
    if (!_0x3a7a4.destroyed) {
      if (!_0x2d249d) {
        try {
          _0x3a7a4.respond({
            ":status": 502
          });
        } catch {}
      }
      _0x3a7a4.end();
    }
  });
  _0x9b3c40.end(_0xf2b9cc);
}
function buildFakeReqRes(_0xfa8007, _0x3a1777) {
  const _0x56a92e = {
    ..._0x3a1777
  };
  const _0x1a3c1d = {
    headers: _0x56a92e,
    url: _0x3a1777[":path"] || "/",
    method: _0x3a1777[":method"] || "POST"
  };
  const _0x5cb954 = _0x1a3c1d;
  let _0x4025f3 = false;
  const _0x5302b3 = {
    headersSent: false,
    writableEnded: false,
    writeHead(_0x6596c3, _0x411d66 = {}) {
      if (_0x4025f3) {
        return;
      }
      _0x4025f3 = true;
      this.headersSent = true;
      const _0xef1951 = toHttp2ResponseHeaders(_0x6596c3, _0x411d66);
      try {
        _0xfa8007.respond(_0xef1951);
      } catch {}
    },
    write(_0x20e82d) {
      if (!_0x4025f3) {
        this.writeHead(200);
      }
      if (!_0xfa8007.destroyed) {
        try {
          _0xfa8007.write(_0x20e82d);
        } catch {}
      }
    },
    end(_0x29dc32) {
      if (!_0x4025f3) {
        this.writeHead(200);
      }
      this.writableEnded = true;
      if (!_0xfa8007.destroyed) {
        try {
          _0xfa8007.end(_0x29dc32);
        } catch {}
      }
    },
    on(_0x5c8463, _0x3e456f) {
      if (_0x5c8463 === "close") {
        _0xfa8007.on("close", _0x3e456f);
      }
    }
  };
  const _0x1ac8e3 = {
    fakeReq: _0x5cb954,
    fakeRes: _0x5302b3
  };
  return _0x1ac8e3;
}
function adaptStreamForHandler(_0x4fd9b3, _0x4ebf18, _0x29c9d3, _0x15fd31) {
  const {
    fakeReq: _0x55c200,
    fakeRes: _0x2337da
  } = buildFakeReqRes(_0x4ebf18, _0x29c9d3);
  if (_0x15fd31 === "completions") {
    handleGetCompletions(_0x55c200, _0x2337da, _0x4fd9b3);
  } else {
    handleGetChatMessage(_0x55c200, _0x2337da, _0x4fd9b3);
  }
}
const server = _0x1fee6b.createServer();
function attachInferenceStreamHandler(_0xsrv) {
  _0xsrv.on("stream", (_0x423917, _0x22665d) => {
  const _0x5c4e20 = ++reqCount;
  const _0x250004 = _0x22665d[":method"] || "GET";
  const _0xb18fb2 = _0x22665d[":path"] || "/";
  const _0x122f07 = _0x22665d["content-type"] || "";
  const _0xd373c7 = _0xb18fb2.split("/").pop();
  if (_0xb18fb2 === "/api/config") {
    handleRuntimeConfigStream(_0x423917, _0x22665d);
    return;
  }
  if (_0x250004 !== "POST" || !_0x122f07.includes("connect+proto")) {
    _0x423917.respond({
      ":status": 404
    });
    _0x423917.end();
    return;
  }
  const _0x2184c9 = [];
  _0x423917.on("data", _0x260ec1 => _0x2184c9.push(_0x260ec1));
  _0x423917.on("end", () => {
    const _0x1d8579 = Buffer.concat(_0x2184c9);
    console.log("[" + now() + "] #" + _0x5c4e20 + " " + _0xd373c7 + " (" + _0x1d8579.length + "b)");
    if (INTERCEPT_PATHS.has(_0xb18fb2)) {
      const _0x339af7 = _0xd373c7 === "GetCompletions" ? "completions" : "chat";
      console.log("  ⚡ → API (" + _0x339af7 + ")");
      try {
        adaptStreamForHandler(_0x1d8579, _0x423917, _0x22665d, _0x339af7);
      } catch (_0x379754) {
        console.error("  ❌ Handler error: " + _0x379754.message);
        if (!_0x423917.destroyed) {
          _0x423917.respond({
            ":status": 500,
            "content-type": "application/json"
          });
          const _0xc0ab35 = {
            code: "internal",
            message: _0x379754.message
          };
          _0x423917.end(JSON.stringify(_0xc0ab35));
        }
      }
    } else {
      console.log("  → " + UPSTREAM + _0xb18fb2);
      forwardToCodeium(_0x1d8579, _0x423917, _0x22665d, _0xb18fb2, _0x5c4e20);
    }
  });
  _0x423917.on("error", _0x2fbb51 => {
    if (_0x2fbb51.code === "ERR_HTTP2_STREAM_ERROR") {
      return;
    }
    console.error("[" + now() + "] #" + _0x5c4e20 + " stream error: " + _0x2fbb51.message);
  });
  });
}
attachInferenceStreamHandler(server);
function onInferenceError(_0x514df6) {
  if (_0x514df6.code === "EADDRINUSE") {
    console.error("Port " + PORT + " in use. Kill existing: lsof -ti:" + PORT + " | xargs kill");
  } else {
    console.error("Server error:", _0x514df6);
  }
  process.exit(1);
}
function printInferenceReady() {
  const _0xbindHosts = getLoopbackListenHosts(BIND_HOST);
  console.log("\n⚡ Devin BYOK Bridge inference on " + loopbackApiUrl(PORT));
  console.log("   Bind hosts: " + _0xbindHosts.join(", "));
  console.log("\n   GetChatMessage  → Anthropic API (inline AI edit)");
  console.log("   GetCompletions → Anthropic API (code completion)");
  console.log("   Everything else         → " + UPSTREAM + "\n");
}
const _0xbindHosts = getLoopbackListenHosts(BIND_HOST);
if (_0xbindHosts.length === 1) {
  server.listen(PORT, _0xbindHosts[0], printInferenceReady);
  server.on("error", onInferenceError);
} else {
  server.listen(PORT, _0xbindHosts[0], () => {});
  server.on("error", onInferenceError);
  const serverV6 = _0x1fee6b.createServer();
  attachInferenceStreamHandler(serverV6);
  serverV6.listen(PORT, _0xbindHosts[1], printInferenceReady);
  serverV6.on("error", onInferenceError);
}
