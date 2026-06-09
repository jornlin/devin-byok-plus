import _0x504c8a from "node:http";
import _0x3e4768 from "node:https";
import _0x1355ff from "node:net";
import _0xa5766a from "node:tls";
import _0xee55df from "node:fs";
import { handleGetChatMessage } from "./handlers/chat.js";
import { handleGetWebSearchResults, handleGetWebSearchRedirect } from "./handlers/web-search.js";
import { handleGetEmbeddings } from "./handlers/embeddings.js";
import { handleModelsRequest, handleConfigRequest } from "./handlers/models.js";
import { parseFields, writeStringField, writeBytesField, writeVarintField, writeFixed64Field, writeFixed32Field } from "./proto.js";
import { tryGunzip } from "./connect.js";
import _0x164b02 from "node:crypto";
import { startWSBridge, getChatQueue, ackChatQueue, pushChatQueue, setActiveMonitorTarget } from "./ws-bridge.js";
import { getLoopbackListenHosts, loopbackApiUrl } from "./net-utils.js";
const _DEVICE_ID = process.env.PROXY_DEVICE_ID || "";
const _SESSION_SECRET = process.env.PROXY_SESSION_SECRET || "";
function signUpstreamRequest(_0x1a7be8, _0x17ef50, _0x5d79bc) {
  if (!_SESSION_SECRET) {
    return {};
  }
  const _0x2cd3fb = Math.floor(Date.now() / 1000).toString();
  const _0x46adb4 = _0x164b02.randomBytes(16).toString("hex");
  const _0x4349c5 = _0x164b02.createHash("sha256").update(_0x5d79bc || "").digest("hex");
  const _0x45c164 = [_0x2cd3fb, _0x46adb4, _0x1a7be8.toUpperCase(), _0x17ef50, _0x4349c5].join("|");
  const _0x49b341 = _0x164b02.createHmac("sha256", _SESSION_SECRET).update(_0x45c164).digest("hex");
  const _0x55605d = {
    "x-device-id": _DEVICE_ID,
    "x-timestamp": _0x2cd3fb,
    "x-nonce": _0x46adb4,
    "x-body-hash": _0x4349c5,
    "x-signature": _0x49b341
  };
  return _0x55605d;
}
function parsePortEnv(_0xcdd7c5, _0x18d832) {
  const _0x5c5228 = process.env[_0xcdd7c5];
  const _0x5b560f = parseInt(String(_0x5c5228 ?? ""), 10);
  if (Number.isInteger(_0x5b560f) && _0x5b560f > 0 && _0x5b560f <= 65535) {
    return _0x5b560f;
  } else {
    return _0x18d832;
  }
}
const PORT = parsePortEnv("HYBRID_PORT", 3006);
const BIND_HOST = process.env.BIND_HOST || "127.0.0.1";
const REAL_API_HOST = "server.self-serve.windsurf.com";
const REAL_WEBSITE = "windsurf.com";
const REAL_REGISTER_HOST = "register.windsurf.com";
const REAL_UNLEASH_HOST = "unleash.codeium.com";
const CERTS_DIR = new URL("../certs/", import.meta.url);
const CERT_HOST = process.env.MITM_CERT_HOST || REAL_API_HOST;
let MITM_CERT;
let MITM_KEY;
try {
  MITM_CERT = _0xee55df.readFileSync(new URL(CERT_HOST + ".pem", CERTS_DIR));
  MITM_KEY = _0xee55df.readFileSync(new URL(CERT_HOST + "-key.pem", CERTS_DIR));
} catch {
  console.log("⚠️  No MITM certs found for " + CERT_HOST + " — CONNECT MITM disabled (OK if behind nginx)");
}
let requestCounter = 0;
function getRpcMethod(_0x203349) {
  const _0x571cb8 = _0x203349.split("/");
  return _0x571cb8[_0x571cb8.length - 1] || "";
}
function getUpstreamHost(_0x537d9b) {
  if (_0x537d9b.includes("unleash") || _0x537d9b.includes("experiment_config")) {
    return REAL_UNLEASH_HOST;
  }
  return REAL_API_HOST;
}
function stripRoutePrefix(_0x8ae631) {
  return _0x8ae631.replace(/^\/_route\/api_server/, "");
}
function now() {
  return new Date().toISOString().slice(11, 23);
}
function safeHandle(_0x1e9ec8, _0x37fc33, _0x147997, _0x298e3b, _0x14c4c1) {
  try {
    const _0x3df9b6 = _0x1e9ec8();
    if (_0x3df9b6 && typeof _0x3df9b6.catch === "function") {
      _0x3df9b6.catch(_0x1f364b => {
        console.error("[" + now() + "] #" + _0x298e3b + " " + _0x14c4c1 + " error: " + _0x1f364b.message);
        if (!_0x147997.headersSent) {
          _0x147997.writeHead(500);
        }
        if (!_0x147997.writableEnded) {
          _0x147997.end();
        }
      });
    }
  } catch (_0x350b34) {
    console.error("[" + now() + "] #" + _0x298e3b + " " + _0x14c4c1 + " error: " + _0x350b34.message);
    if (!_0x147997.headersSent) {
      _0x147997.writeHead(500);
    }
    if (!_0x147997.writableEnded) {
      _0x147997.end();
    }
  }
}
function rewriteRegisterUser(_0x909e1a) {
  try {
    const _0x454ebc = parseFields(_0x909e1a);
    const _0x46c307 = [];
    for (const _0x57381c of _0x454ebc) {
      if (_0x57381c.field === 3 && _0x57381c.wireType === 2) {
        const _0x2976e7 = _0x57381c.value.toString("utf8");
        console.log("  🔄 RegisterUser: " + _0x2976e7 + " → " + loopbackApiUrl(PORT));
        _0x46c307.push(writeStringField(3, loopbackApiUrl(PORT)));
      } else if (_0x57381c.wireType === 0) {
        _0x46c307.push(writeVarintField(_0x57381c.field, _0x57381c.value));
      } else if (_0x57381c.wireType === 2) {
        _0x46c307.push(writeBytesField(_0x57381c.field, _0x57381c.value));
      } else if (_0x57381c.wireType === 1) {
        _0x46c307.push(writeFixed64Field(_0x57381c.field, _0x57381c.value));
      } else if (_0x57381c.wireType === 5) {
        _0x46c307.push(writeFixed32Field(_0x57381c.field, _0x57381c.value));
      }
    }
    return Buffer.concat(_0x46c307);
  } catch (_0x503c67) {
    console.error("  ❌ RegisterUser rewrite failed: " + _0x503c67.message);
    return _0x909e1a;
  }
}
const STREAMING_METHODS = new Set(["GetStreamingCompletions", "GetStreamingExternalChatCompletions"]);
function proxyToCodeium(_0xdb1512, _0x4b58dd, _0x2e0a6c, _0x5b8743, _0x3398ba = {}) {
  const _0x5de15f = getRpcMethod(_0xdb1512.url);
  const _0x334e7c = getUpstreamHost(_0xdb1512.url);
  const _0x3fab0a = stripRoutePrefix(_0xdb1512.url);
  const _0x490e83 = STREAMING_METHODS.has(_0x5de15f);
  const _0x5ae6c4 = {
    ..._0xdb1512.headers
  };
  const _0x38fd07 = _0x5ae6c4;
  delete _0x38fd07.host;
  delete _0x38fd07.connection;
  _0x38fd07.host = _0x334e7c;
  const _0x3ce629 = signUpstreamRequest(_0xdb1512.method, _0x3fab0a, _0x2e0a6c);
  Object.assign(_0x38fd07, _0x3ce629);
  const _0x4dc42c = {
    hostname: _0x334e7c,
    port: 443,
    path: _0x3fab0a,
    method: _0xdb1512.method,
    headers: _0x38fd07
  };
  const _0x54485a = _0x3e4768.request(_0x4dc42c, _0x430df7 => {
    if (_0x490e83) {
      console.log("  [#" + _0x5b8743 + "] ← " + _0x430df7.statusCode + " (streaming " + _0x5de15f + ")");
      _0x4b58dd.writeHead(_0x430df7.statusCode, {
        ..._0x430df7.headers
      });
      _0x430df7.pipe(_0x4b58dd);
      _0x430df7.on("error", () => {
        if (!_0x4b58dd.writableEnded) {
          _0x4b58dd.end();
        }
      });
    } else {
      const _0x28edb1 = [];
      _0x430df7.on("data", _0x4bf1ea => _0x28edb1.push(_0x4bf1ea));
      _0x430df7.on("end", () => {
        let _0x4ca4cd = Buffer.concat(_0x28edb1);
        console.log("  [#" + _0x5b8743 + "] ← " + _0x430df7.statusCode + " (" + _0x4ca4cd.length + "b)");
        if (!_0x3398ba.skipRewrite && _0x5de15f === "RegisterUser" && _0x430df7.statusCode === 200 && _0x4ca4cd.length > 5) {
          try {
            const _0x3a7c05 = _0x4ca4cd[0];
            const _0x2d9f2a = _0x4ca4cd.readUInt32BE(1);
            if (_0x2d9f2a === _0x4ca4cd.length - 5 && _0x3a7c05 <= 1) {
              let _0x5d0f52 = _0x4ca4cd.subarray(5);
              if (_0x3a7c05 === 1) {
                const _0x13a177 = tryGunzip(_0x5d0f52);
                if (_0x13a177) {
                  _0x5d0f52 = _0x13a177;
                }
              }
              const _0x14137e = rewriteRegisterUser(_0x5d0f52);
              const _0x2aefeb = Buffer.alloc(5 + _0x14137e.length);
              _0x2aefeb[0] = 0;
              _0x2aefeb.writeUInt32BE(_0x14137e.length, 1);
              _0x14137e.copy(_0x2aefeb, 5);
              _0x4ca4cd = _0x2aefeb;
              console.log("  [#" + _0x5b8743 + "] 🔄 RegisterUser rewritten");
            }
          } catch (_0x60060c) {
            console.error("  [#" + _0x5b8743 + "] RegisterUser rewrite error: " + _0x60060c.message);
          }
        }
        const _0x4dbba4 = {
          ..._0x430df7.headers
        };
        const _0x1c49a7 = _0x4dbba4;
        delete _0x1c49a7["content-length"];
        _0x1c49a7["content-length"] = _0x4ca4cd.length;
        _0x4b58dd.writeHead(_0x430df7.statusCode, _0x1c49a7);
        _0x4b58dd.end(_0x4ca4cd);
      });
      _0x430df7.on("error", _0x4f3c9c => {
        console.error("  [#" + _0x5b8743 + "] ← error: " + _0x4f3c9c.message);
        if (!_0x4b58dd.headersSent) {
          _0x4b58dd.writeHead(502);
        }
        if (!_0x4b58dd.writableEnded) {
          _0x4b58dd.end();
        }
      });
    }
  });
  _0x54485a.on("error", _0x1b6ccf => {
    console.error("  [#" + _0x5b8743 + "] ✗ upstream: " + _0x1b6ccf.message);
    if (!_0x4b58dd.headersSent) {
      _0x4b58dd.writeHead(502);
    }
    if (!_0x4b58dd.writableEnded) {
      _0x4b58dd.end("Upstream error: " + _0x1b6ccf.message);
    }
  });
  _0x54485a.end(_0x2e0a6c);
}
function routeRequest(_0x2b6c62, _0x45cf88, _0x5a90b1, _0x5bff7f, _0x36e511 = "") {
  const _0x24f1e1 = getRpcMethod(_0x2b6c62.url);
  if (_0x24f1e1 === "GetChatMessage") {
    console.log("[" + now() + "] #" + _0x5bff7f + " ⚡ " + _0x36e511 + "GetChatMessage → API (" + _0x5a90b1.length + "b)");
    safeHandle(() => handleGetChatMessage(_0x2b6c62, _0x45cf88, _0x5a90b1), _0x2b6c62, _0x45cf88, _0x5bff7f, "Chat");
    return true;
  }
  if (_0x24f1e1 === "GetWebSearchResults") {
    console.log("[" + now() + "] #" + _0x5bff7f + " 🔍 " + _0x36e511 + "GetWebSearchResults (" + _0x5a90b1.length + "b)");
    safeHandle(() => handleGetWebSearchResults(_0x2b6c62, _0x45cf88, _0x5a90b1), _0x2b6c62, _0x45cf88, _0x5bff7f, "WebSearch");
    return true;
  }
  if (_0x24f1e1 === "GetWebSearchRedirect") {
    console.log("[" + now() + "] #" + _0x5bff7f + " 🔍 " + _0x36e511 + "GetWebSearchRedirect (" + _0x5a90b1.length + "b)");
    safeHandle(() => handleGetWebSearchRedirect(_0x2b6c62, _0x45cf88, _0x5a90b1), _0x2b6c62, _0x45cf88, _0x5bff7f, "WebRedirect");
    return true;
  }
  if (_0x24f1e1 === "GetEmbeddings") {
    console.log("[" + now() + "] #" + _0x5bff7f + " 🧮 " + _0x36e511 + "GetEmbeddings (" + _0x5a90b1.length + "b)");
    safeHandle(() => handleGetEmbeddings(_0x2b6c62, _0x45cf88, _0x5a90b1), _0x2b6c62, _0x45cf88, _0x5bff7f, "Embeddings");
    return true;
  }
  return false;
}
function handleRequest(_0x5ed9cc, _0x517d28) {
  const _0x1d868e = ++requestCounter;
  const _0x5ba90d = getRpcMethod(_0x5ed9cc.url);
  const _0x79e0b7 = [];
  _0x5ed9cc.on("error", _0x47b77d => {
    console.error("[" + now() + "] #" + _0x1d868e + " REQ ERROR: " + _0x47b77d.message);
    if (!_0x517d28.headersSent) {
      _0x517d28.writeHead(500);
    }
    if (!_0x517d28.writableEnded) {
      _0x517d28.end();
    }
  });
  _0x5ed9cc.on("data", _0x1ff8fa => _0x79e0b7.push(_0x1ff8fa));
  _0x5ed9cc.on("end", () => {
    const _0x37ca10 = Buffer.concat(_0x79e0b7);
    if (_0x5ed9cc.url.startsWith("/profile") || _0x5ed9cc.url.startsWith("/login") || _0x5ed9cc.url.startsWith("/signup") || _0x5ed9cc.url.startsWith("/redirect/") || _0x5ed9cc.url.startsWith("/changelog") || _0x5ed9cc.url === "/favicon.ico") {
      console.log("[" + now() + "] #" + _0x1d868e + " → redirect " + _0x5ed9cc.url);
      const _0x268bcb = {
        location: "https://" + REAL_WEBSITE + _0x5ed9cc.url
      };
      _0x517d28.writeHead(302, _0x268bcb);
      return _0x517d28.end();
    }
    if (_0x5ed9cc.url.includes("prompt=login") || _0x5ed9cc.url.includes("scope=openid") || _0x5ed9cc.url.includes("authorize") || _0x5ed9cc.url.includes("client_id=codeium")) {
      console.log("[" + now() + "] #" + _0x1d868e + " → auth redirect");
      const _0x286afa = {
        location: "https://" + REAL_REGISTER_HOST + _0x5ed9cc.url
      };
      _0x517d28.writeHead(302, _0x286afa);
      return _0x517d28.end();
    }
    if (_0x5ed9cc.url.startsWith("/api/models")) {
      const _0x35af04 = new URL(_0x5ed9cc.url, "http://localhost").pathname;
      console.log("[" + now() + "] #" + _0x1d868e + " 📋 " + _0x35af04);
      safeHandle(() => handleModelsRequest(_0x5ed9cc, _0x517d28, _0x35af04), _0x5ed9cc, _0x517d28, _0x1d868e, "Models");
      return;
    }
    if (_0x5ed9cc.url.startsWith("/api/config")) {
      console.log("[" + now() + "] #" + _0x1d868e + " ⚙️  /api/config (" + _0x5ed9cc.method + ")");
      safeHandle(() => handleConfigRequest(_0x5ed9cc, _0x517d28), _0x5ed9cc, _0x517d28, _0x1d868e, "Config");
      return;
    }
    if (_0x5ed9cc.url === "/" || _0x5ed9cc.url === "/index.html") {
      serveModelUI(_0x517d28);
      return;
    }
    if ((_0x5ed9cc.url === "/api/chat-queue" || _0x5ed9cc.url.startsWith("/api/chat-queue?")) && _0x5ed9cc.method === "GET") {
      const _0x49f5ee = new URL(_0x5ed9cc.url, "http://localhost").searchParams.get("targetId");
      _0x517d28.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      });
      const _0x5002bf = getChatQueue(_0x49f5ee);
      _0x517d28.end(JSON.stringify(_0x5002bf));
      return;
    }
    if (_0x5ed9cc.url === "/api/chat-queue" && _0x5ed9cc.method === "PUT") {
      try {
        const _0x5c71f5 = JSON.parse(_0x37ca10.toString());
        pushChatQueue(_0x5c71f5.text || "", !!_0x5c71f5.hasImage, _0x5c71f5.targetId || null);
      } catch {}
      _0x517d28.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      });
      _0x517d28.end("{\"ok\":true}");
      return;
    }
    if (_0x5ed9cc.url === "/api/active-target" && _0x5ed9cc.method === "POST") {
      let _0x990660 = null;
      try {
        const _0x53fd6f = JSON.parse(_0x37ca10.toString());
        _0x990660 = _0x53fd6f.targetId || null;
      } catch {}
      const _0x496a06 = setActiveMonitorTarget(_0x990660);
      _0x517d28.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      });
      const _0x2ca655 = {
        ok: true,
        targetId: _0x496a06
      };
      _0x517d28.end(JSON.stringify(_0x2ca655));
      return;
    }
    if (_0x5ed9cc.url === "/api/chat-queue/ack" && _0x5ed9cc.method === "POST") {
      let _0x2f41c1 = null;
      let _0x59ee01 = null;
      try {
        const _0x3829f6 = JSON.parse(_0x37ca10.toString());
        _0x2f41c1 = _0x3829f6.id || null;
        _0x59ee01 = _0x3829f6.targetId || null;
      } catch {}
      ackChatQueue(_0x2f41c1, _0x59ee01);
      _0x517d28.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      });
      _0x517d28.end("{\"ok\":true}");
      return;
    }
    if (routeRequest(_0x5ed9cc, _0x517d28, _0x37ca10, _0x1d868e)) {
      return;
    }
    console.log("[" + now() + "] #" + _0x1d868e + " → " + (_0x5ba90d || _0x5ed9cc.url.slice(0, 80)) + " (" + _0x37ca10.length + "b) → Codeium");
    proxyToCodeium(_0x5ed9cc, _0x517d28, _0x37ca10, _0x1d868e);
  });
}
const server = _0x504c8a.createServer(handleRequest);
server.on("connection", _0x5da98c => {
  _0x5da98c.setNoDelay(true);
});
const mitmServer = _0x504c8a.createServer((_0x3970da, _0x3111f3) => {
  const _0x45cb87 = ++requestCounter;
  const _0x56c4cf = getRpcMethod(_0x3970da.url);
  const _0x4e9b60 = [];
  _0x3970da.on("error", _0x5955d5 => {
    console.error("[" + now() + "] #" + _0x45cb87 + " MITM REQ ERROR: " + _0x5955d5.message);
    if (!_0x3111f3.headersSent) {
      _0x3111f3.writeHead(500);
    }
    if (!_0x3111f3.writableEnded) {
      _0x3111f3.end();
    }
  });
  _0x3970da.on("data", _0x35215f => _0x4e9b60.push(_0x35215f));
  _0x3970da.on("end", () => {
    const _0xaba4e5 = Buffer.concat(_0x4e9b60);
    if (routeRequest(_0x3970da, _0x3111f3, _0xaba4e5, _0x45cb87, "MITM ")) {
      return;
    }
    console.log("[" + now() + "] #" + _0x45cb87 + " → MITM " + (_0x56c4cf || _0x3970da.url.slice(0, 80)) + " (" + _0xaba4e5.length + "b) → Codeium");
    proxyToCodeium(_0x3970da, _0x3111f3, _0xaba4e5, _0x45cb87);
  });
});
mitmServer.on("connection", _0x2d0b64 => {
  _0x2d0b64.setNoDelay(true);
});
function attachHybridConnectHandler(_0xsrv) {
  _0xsrv.on("connect", (_0xfd06cc, _0x5ae7ee, _0x53eefb) => {
  const _0x103ce2 = ++requestCounter;
  const [_0x26ea5b, _0x32b7f4] = _0xfd06cc.url.split(":");
  const _0x52b2e5 = parseInt(_0x32b7f4) || 443;
  if (_0x26ea5b === REAL_API_HOST && MITM_CERT && MITM_KEY) {
    console.log("[" + now() + "] #" + _0x103ce2 + " 🔓 MITM " + _0x26ea5b + ":" + _0x52b2e5);
    _0x5ae7ee.write("HTTP/1.1 200 Connection Established\r\nProxy-agent: devin-hybrid\r\n\r\nProxy-agent: devin-hybrid\r\n\r\n");
    if (_0x53eefb && _0x53eefb.length > 0) {
      _0x5ae7ee.unshift(_0x53eefb);
    }
    const _0x375f78 = {
      isServer: true,
      cert: MITM_CERT,
      key: MITM_KEY
    };
    const _0x4b7b80 = new _0xa5766a.TLSSocket(_0x5ae7ee, _0x375f78);
    _0x4b7b80.on("error", _0x40b407 => {
      if (_0x40b407.code === "ECONNRESET" || _0x40b407.code === "EPIPE") {
        return;
      }
      console.error("  [#" + _0x103ce2 + "] MITM TLS error: " + _0x40b407.message);
      if (!_0x5ae7ee.destroyed) {
        _0x5ae7ee.destroy();
      }
    });
    mitmServer.emit("connection", _0x4b7b80);
    return;
  }
  console.log("[" + now() + "] #" + _0x103ce2 + " CONNECT " + _0x26ea5b + ":" + _0x52b2e5);
  const _0x11861c = _0x1355ff.connect(_0x52b2e5, _0x26ea5b, () => {
    _0x5ae7ee.write("HTTP/1.1 200 Connection Established\r\nProxy-agent: devin-hybrid\r\n\r\nProxy-agent: devin-hybrid\r\n\r\n");
    if (_0x53eefb.length > 0) {
      _0x11861c.write(_0x53eefb);
    }
    _0x11861c.pipe(_0x5ae7ee);
    _0x5ae7ee.pipe(_0x11861c);
  });
  _0x11861c.on("error", _0x4952b8 => {
    const _0x2b1bae = /^198\.(18|19)\./.test(_0x26ea5b || "");
    const _0x1539b7 = _0x4952b8.code === "ETIMEDOUT" ? _0x2b1bae ? "，目标看起来是 VPN/TUN 假 IP，请检查分流规则或将该域名设为直连" : "，请检查当前网络、系统代理或上游出口" : _0x4952b8.code === "ECONNRESET" ? "，上游连接被重置，常见于网络抖动、代理中途断链或对端主动关闭" : "";
    console.error("  [#" + _0x103ce2 + "] CONNECT error → " + _0x26ea5b + ":" + _0x52b2e5 + ": " + _0x4952b8.message + _0x1539b7);
    if (!_0x5ae7ee.destroyed) {
      _0x5ae7ee.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
      _0x5ae7ee.destroy();
    }
  });
  _0x5ae7ee.on("error", () => {
    if (!_0x11861c.destroyed) {
      _0x11861c.destroy();
    }
  });
  });
}
attachHybridConnectHandler(server);
function serveModelUI(_0x3b8ee6) {
  const _0x2f6148 = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Devin BYOK Bridge - 模型选择</title>\n<style>\n  *{box-sizing:border-box;margin:0;padding:0}\n  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:24px}\n  .container{max-width:960px;margin:0 auto}\n  h1{font-size:1.5rem;margin-bottom:8px;color:#38bdf8}\n  .subtitle{color:#94a3b8;margin-bottom:24px;font-size:.9rem}\n  .card{background:#1e293b;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #334155}\n  .card h2{font-size:1.1rem;margin-bottom:12px;color:#f1f5f9}\n  .config-row{display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap}\n  .config-row label{color:#94a3b8;min-width:80px;font-size:.85rem}\n  .config-row select,.config-row input{background:#0f172a;border:1px solid #475569;color:#e2e8f0;padding:8px 12px;border-radius:8px;font-size:.9rem;flex:1;min-width:200px}\n  .config-row select:focus,.config-row input:focus{outline:none;border-color:#38bdf8}\n  button{background:#2563eb;color:#fff;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:.85rem;transition:background .2s}\n  button:hover{background:#1d4ed8}\n  button.secondary{background:#334155}\n  button.secondary:hover{background:#475569}\n  .status{padding:8px 12px;border-radius:8px;font-size:.85rem;margin-top:8px;display:none}\n  .status.ok{display:block;background:#064e3b;color:#6ee7b7;border:1px solid #065f46}\n  .status.err{display:block;background:#450a0a;color:#fca5a5;border:1px solid #7f1d1d}\n  .model-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;max-height:400px;overflow-y:auto;padding-right:4px}\n  .model-grid::-webkit-scrollbar{width:6px}\n  .model-grid::-webkit-scrollbar-thumb{background:#475569;border-radius:3px}\n  .model-item{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px 14px;cursor:pointer;transition:all .15s;font-size:.85rem}\n  .model-item:hover{border-color:#38bdf8;background:#1a2744}\n  .model-item.active{border-color:#2563eb;background:#1e3a5f}\n  .model-item .id{color:#e2e8f0;font-weight:500}\n  .model-item .meta{color:#64748b;font-size:.75rem;margin-top:2px}\n  .provider-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7rem;font-weight:600;margin-left:6px}\n  .provider-tag.anthropic{background:#7c3aed22;color:#a78bfa}\n  .provider-tag.openai{background:#05966922;color:#6ee7b7}\n  .loading{text-align:center;padding:40px;color:#64748b}\n  .stats{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}\n  .stat{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;flex:1;min-width:120px}\n  .stat .num{font-size:1.4rem;font-weight:700;color:#38bdf8}\n  .stat .label{font-size:.75rem;color:#64748b;margin-top:2px}\n  .search{width:100%;background:#0f172a;border:1px solid #475569;color:#e2e8f0;padding:10px 14px;border-radius:8px;font-size:.9rem;margin-bottom:12px}\n  .search:focus{outline:none;border-color:#38bdf8}\n</style>\n</head>\n<body>\n<div class=\"container\">\n  <h1>Devin BYOK Bridge</h1>\n  <p class=\"subtitle\">模型管理面板 — 查看可用模型、切换默认模型</p>\n\n  <div class=\"stats\" id=\"stats\">\n    <div class=\"stat\"><div class=\"num\" id=\"totalCount\">-</div><div class=\"label\">总模型数</div></div>\n    <div class=\"stat\"><div class=\"num\" id=\"anthropicCount\">-</div><div class=\"label\">Anthropic</div></div>\n    <div class=\"stat\"><div class=\"num\" id=\"openaiCount\">-</div><div class=\"label\">OpenAI</div></div>\n  </div>\n\n  <div class=\"card\">\n    <h2>当前配置</h2>\n    <div class=\"config-row\">\n      <label>默认模型</label>\n      <select id=\"modelSelect\"><option>加载中...</option></select>\n      <button onclick=\"applyModel()\">应用</button>\n      <button class=\"secondary\" onclick=\"loadModels(true)\">刷新列表</button>\n    </div>\n    <div class=\"config-row\">\n      <label>Max Tokens</label>\n      <input type=\"number\" id=\"maxTokens\" value=\"32768\" min=\"1\" max=\"1000000\">\n      <button onclick=\"applyTokens()\">应用</button>\n    </div>\n    <div class=\"status\" id=\"status\"></div>\n  </div>\n\n  <div class=\"card\">\n    <h2>可用模型</h2>\n    <input class=\"search\" id=\"search\" placeholder=\"搜索模型...\" oninput=\"filterModels()\">\n    <div id=\"modelList\" class=\"loading\">正在加载模型列表...</div>\n  </div>\n</div>\n\n<script>\nlet allModels = [];\nlet currentDefault = '';\n\nasync function loadModels(refresh) {\n  const url = '/api/models' + (refresh ? '?refresh=1' : '');\n  try {\n    const res = await fetch(url);\n    const data = await res.json();\n    currentDefault = data.defaultModel || '';\n    const anthropic = data.providers?.anthropic?.models || [];\n    const openai = data.providers?.openai?.models || [];\n    allModels = [...anthropic, ...openai];\n\n    document.getElementById('totalCount').textContent = data.total || allModels.length;\n    document.getElementById('anthropicCount').textContent = anthropic.length;\n    document.getElementById('openaiCount').textContent = openai.length;\n\n    // populate select\n    const sel = document.getElementById('modelSelect');\n    sel.innerHTML = '';\n    if (allModels.length === 0) {\n      sel.innerHTML = '<option>无可用模型</option>';\n    } else {\n      for (const m of allModels) {\n        const opt = document.createElement('option');\n        opt.value = m.id;\n        opt.textContent = m.id + ' (' + m.provider + ')';\n        if (m.id === currentDefault) opt.selected = true;\n        sel.appendChild(opt);\n      }\n      // ensure current default is in list even if not returned by API\n      if (currentDefault && !allModels.find(m => m.id === currentDefault)) {\n        const opt = document.createElement('option');\n        opt.value = currentDefault;\n        opt.textContent = currentDefault + ' (current)';\n        opt.selected = true;\n        sel.prepend(opt);\n      }\n    }\n    renderModels(allModels);\n  } catch (e) {\n    document.getElementById('modelList').innerHTML = '<div class=\"loading\">加载失败: ' + e.message + '</div>';\n  }\n}\n\nfunction renderModels(models) {\n  const container = document.getElementById('modelList');\n  if (models.length === 0) {\n    container.innerHTML = '<div class=\"loading\">没有匹配的模型</div>';\n    return;\n  }\n  container.className = 'model-grid';\n  container.innerHTML = models.map(m => {\n    const isActive = m.id === currentDefault ? ' active' : '';\n    const created = m.created ? new Date(m.created).toLocaleDateString() : '';\n    return '<div class=\"model-item' + isActive + '\" onclick=\"selectModel(\\'' + m.id.replace(/'/g,\"\\\\'\") + '\\')\">'\n      + '<div class=\"id\">' + m.id + '<span class=\"provider-tag ' + m.provider + '\">' + m.provider + '</span></div>'\n      + (created ? '<div class=\"meta\">' + created + '</div>' : '')\n      + '</div>';\n  }).join('');\n}\n\nfunction filterModels() {\n  const q = document.getElementById('search').value.toLowerCase();\n  const filtered = q ? allModels.filter(m => m.id.toLowerCase().includes(q) || m.provider.includes(q)) : allModels;\n  renderModels(filtered);\n}\n\nfunction selectModel(id) {\n  document.getElementById('modelSelect').value = id;\n  applyModel();\n}\n\nasync function applyModel() {\n  const model = document.getElementById('modelSelect').value;\n  if (!model) return;\n  try {\n    const res = await fetch('/api/config', {\n      method: 'POST',\n      headers: { 'content-type': 'application/json' },\n      body: JSON.stringify({ defaultModel: model }),\n    });\n    const data = await res.json();\n    currentDefault = data.defaultModel;\n    showStatus('ok', '已切换默认模型: ' + currentDefault);\n    renderModels(allModels.filter(m => {\n      const q = document.getElementById('search').value.toLowerCase();\n      return !q || m.id.toLowerCase().includes(q);\n    }));\n  } catch (e) { showStatus('err', '切换失败: ' + e.message); }\n}\n\nasync function applyTokens() {\n  const val = parseInt(document.getElementById('maxTokens').value, 10);\n  if (!val || val < 1) return showStatus('err', '无效的 maxTokens');\n  try {\n    const res = await fetch('/api/config', {\n      method: 'POST',\n      headers: { 'content-type': 'application/json' },\n      body: JSON.stringify({ maxTokens: val }),\n    });\n    const data = await res.json();\n    showStatus('ok', 'Max Tokens 已更新: ' + data.maxTokens);\n  } catch (e) { showStatus('err', '更新失败: ' + e.message); }\n}\n\nfunction showStatus(type, msg) {\n  const el = document.getElementById('status');\n  el.className = 'status ' + type;\n  el.textContent = msg;\n  setTimeout(() => el.className = 'status', 4000);\n}\n\n// Load config first, then models\nfetch('/api/config').then(r => r.json()).then(cfg => {\n  document.getElementById('maxTokens').value = cfg.maxTokens || 32768;\n  currentDefault = cfg.defaultModel || '';\n}).finally(() => loadModels());\n</script>\n</body>\n</html>";
  _0x3b8ee6.writeHead(200, {
    "content-type": "text/html; charset=utf-8"
  });
  _0x3b8ee6.end(_0x2f6148);
}
startWSBridge(server);
function printHybridReady() {
  const _0xbindHosts = getLoopbackListenHosts(BIND_HOST);
  console.log("\n⚡ Devin BYOK Bridge hybrid on " + loopbackApiUrl(PORT));
  console.log("   Bind hosts: " + _0xbindHosts.join(", "));
  console.log("\n   MODE: MITM CONNECT (normal Devin Desktop, full features)");
  console.log("\n   MITM → " + REAL_API_HOST + ":443");
  console.log("     GetChatMessage  → Anthropic API (your models, your key)");
  console.log("     Everything else → real Codeium (trial account)");
  console.log("\n   PASSTHROUGH (blind TCP pipe):");
  console.log("     All other CONNECT targets (login, telemetry, marketplace)");
  console.log("\n   Settings needed:");
  console.log("     \"http.proxy\": \"" + loopbackApiUrl(PORT) + "\"");
  console.log("     \"http.proxyStrictSSL\": false");
  console.log("\n   ⚠️  Security: MITM mode requires proxyStrictSSL=false.");
  console.log("     Only use on localhost or trusted networks.\n");
}
function onHybridError(_0x1e89db) {
  if (_0x1e89db.code === "EADDRINUSE") {
    console.error("Port " + PORT + " in use. Kill existing: lsof -ti:" + PORT + " | xargs kill");
  } else {
    console.error("Server error:", _0x1e89db);
  }
  process.exit(1);
}
const _0xbindHosts = getLoopbackListenHosts(BIND_HOST);
if (_0xbindHosts.length === 1) {
  server.listen(PORT, _0xbindHosts[0], printHybridReady);
  server.on("error", onHybridError);
} else {
  server.listen(PORT, _0xbindHosts[0], () => {});
  server.on("error", onHybridError);
  const serverV6 = _0x504c8a.createServer(handleRequest);
  serverV6.on("connection", _0x5da98c => {
    _0x5da98c.setNoDelay(true);
  });
  attachHybridConnectHandler(serverV6);
  serverV6.listen(PORT, _0xbindHosts[1], printHybridReady);
  serverV6.on("error", onHybridError);
}
