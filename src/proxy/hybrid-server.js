import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import fs from "node:fs";
import { handleGetChatMessage } from "./handlers/chat.js";
import { handleGetWebSearchResults, handleGetWebSearchRedirect } from "./handlers/web-search.js";
import { handleGetEmbeddings } from "./handlers/embeddings.js";
import { handleModelsRequest, handleConfigRequest } from "./handlers/models.js";
import { parseFields, writeStringField, writeBytesField, writeVarintField, writeFixed64Field, writeFixed32Field } from "./proto.js";
import { tryGunzip } from "./connect.js";
import crypto from "node:crypto";
import { startWSBridge, getChatQueue, ackChatQueue, pushChatQueue, setActiveMonitorTarget } from "./ws-bridge.js";
import { getLoopbackListenHosts, loopbackApiUrl } from "./net-utils.js";
const _DEVICE_ID = process.env.PROXY_DEVICE_ID || "";
const _SESSION_SECRET = process.env.PROXY_SESSION_SECRET || "";
function signUpstreamRequest(arg0, arg1, arg2) {
  if (!_SESSION_SECRET) {
    return {};
  }
  const tmp3 = Math.floor(Date.now() / 1000).toString();
  const tmp4 = crypto.randomBytes(16).toString("hex");
  const tmp5 = crypto.createHash("sha256").update(arg2 || "").digest("hex");
  const tmp6 = [tmp3, tmp4, arg0.toUpperCase(), arg1, tmp5].join("|");
  const tmp7 = crypto.createHmac("sha256", _SESSION_SECRET).update(tmp6).digest("hex");
  const tmp8 = {
    "x-device-id": _DEVICE_ID,
    "x-timestamp": tmp3,
    "x-nonce": tmp4,
    "x-body-hash": tmp5,
    "x-signature": tmp7
  };
  return tmp8;
}
function parsePortEnv(arg0, arg1) {
  const tmp2 = process.env[arg0];
  const tmp3 = parseInt(String(tmp2 ?? ""), 10);
  if (Number.isInteger(tmp3) && tmp3 > 0 && tmp3 <= 65535) {
    return tmp3;
  } else {
    return arg1;
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
  MITM_CERT = fs.readFileSync(new URL(CERT_HOST + ".pem", CERTS_DIR));
  MITM_KEY = fs.readFileSync(new URL(CERT_HOST + "-key.pem", CERTS_DIR));
} catch {
  console.log("⚠️  No MITM certs found for " + CERT_HOST + " — CONNECT MITM disabled (OK if behind nginx)");
}
let requestCounter = 0;
function getRpcMethod(arg0) {
  const tmp1 = arg0.split("/");
  return tmp1[tmp1.length - 1] || "";
}
function getUpstreamHost(arg0) {
  if (arg0.includes("unleash") || arg0.includes("experiment_config")) {
    return REAL_UNLEASH_HOST;
  }
  return REAL_API_HOST;
}
function stripRoutePrefix(arg0) {
  return arg0.replace(/^\/_route\/api_server/, "");
}
function now() {
  return new Date().toISOString().slice(11, 23);
}
function safeHandle(fn, arg1, arg2, arg3, arg4) {
  try {
    const tmp02 = fn();
    if (tmp02 && typeof tmp02.catch === "function") {
      tmp02.catch(arg0 => {
        console.error("[" + now() + "] #" + arg3 + " " + arg4 + " error: " + arg0.message);
        if (!arg2.headersSent) {
          arg2.writeHead(500);
        }
        if (!arg2.writableEnded) {
          arg2.end();
        }
      });
    }
  } catch (tmp02) {
    console.error("[" + now() + "] #" + arg3 + " " + arg4 + " error: " + tmp02.message);
    if (!arg2.headersSent) {
      arg2.writeHead(500);
    }
    if (!arg2.writableEnded) {
      arg2.end();
    }
  }
}
function rewriteRegisterUser(arg0) {
  try {
    const tmp02 = parseFields(arg0);
    const tmp1 = [];
    for (const tmp03 of tmp02) {
      if (tmp03.field === 3 && tmp03.wireType === 2) {
        const tmp04 = tmp03.value.toString("utf8");
        console.log("  🔄 RegisterUser: " + tmp04 + " → " + loopbackApiUrl(PORT));
        tmp1.push(writeStringField(3, loopbackApiUrl(PORT)));
      } else if (tmp03.wireType === 0) {
        tmp1.push(writeVarintField(tmp03.field, tmp03.value));
      } else if (tmp03.wireType === 2) {
        tmp1.push(writeBytesField(tmp03.field, tmp03.value));
      } else if (tmp03.wireType === 1) {
        tmp1.push(writeFixed64Field(tmp03.field, tmp03.value));
      } else if (tmp03.wireType === 5) {
        tmp1.push(writeFixed32Field(tmp03.field, tmp03.value));
      }
    }
    return Buffer.concat(tmp1);
  } catch (tmp02) {
    console.error("  ❌ RegisterUser rewrite failed: " + tmp02.message);
    return arg0;
  }
}
const STREAMING_METHODS = new Set(["GetStreamingCompletions", "GetStreamingExternalChatCompletions"]);
function proxyToCodeium(arg0, arg1, arg2, arg3, tmp4 = {}) {
  const tmp5 = getRpcMethod(arg0.url);
  const tmp6 = getUpstreamHost(arg0.url);
  const tmp7 = stripRoutePrefix(arg0.url);
  const tmp8 = STREAMING_METHODS.has(tmp5);
  const tmp9 = {
    ...arg0.headers
  };
  const tmp10 = tmp9;
  delete tmp10.host;
  delete tmp10.connection;
  tmp10.host = tmp6;
  const tmp11 = signUpstreamRequest(arg0.method, tmp7, arg2);
  Object.assign(tmp10, tmp11);
  const tmp12 = {
    hostname: tmp6,
    port: 443,
    path: tmp7,
    method: arg0.method,
    headers: tmp10
  };
  const tmp13 = https.request(tmp12, arg02 => {
    if (tmp8) {
      console.log("  [#" + arg3 + "] ← " + arg02.statusCode + " (streaming " + tmp5 + ")");
      arg1.writeHead(arg02.statusCode, {
        ...arg02.headers
      });
      arg02.pipe(arg1);
      arg02.on("error", () => {
        if (!arg1.writableEnded) {
          arg1.end();
        }
      });
    } else {
      const tmp02 = [];
      arg02.on("data", arg03 => tmp02.push(arg03));
      arg02.on("end", () => {
        let tmp03 = Buffer.concat(tmp02);
        console.log("  [#" + arg3 + "] ← " + arg02.statusCode + " (" + tmp03.length + "b)");
        if (!tmp4.skipRewrite && tmp5 === "RegisterUser" && arg02.statusCode === 200 && tmp03.length > 5) {
          try {
            const tmp04 = tmp03[0];
            const tmp14 = tmp03.readUInt32BE(1);
            if (tmp14 === tmp03.length - 5 && tmp04 <= 1) {
              let tmp05 = tmp03.subarray(5);
              if (tmp04 === 1) {
                const tmp06 = tryGunzip(tmp05);
                if (tmp06) {
                  tmp05 = tmp06;
                }
              }
              const tmp15 = rewriteRegisterUser(tmp05);
              const tmp22 = Buffer.alloc(5 + tmp15.length);
              tmp22[0] = 0;
              tmp22.writeUInt32BE(tmp15.length, 1);
              tmp15.copy(tmp22, 5);
              tmp03 = tmp22;
              console.log("  [#" + arg3 + "] 🔄 RegisterUser rewritten");
            }
          } catch (tmp04) {
            console.error("  [#" + arg3 + "] RegisterUser rewrite error: " + tmp04.message);
          }
        }
        const tmp1 = {
          ...arg02.headers
        };
        const tmp2 = tmp1;
        delete tmp2["content-length"];
        tmp2["content-length"] = tmp03.length;
        arg1.writeHead(arg02.statusCode, tmp2);
        arg1.end(tmp03);
      });
      arg02.on("error", arg03 => {
        console.error("  [#" + arg3 + "] ← error: " + arg03.message);
        if (!arg1.headersSent) {
          arg1.writeHead(502);
        }
        if (!arg1.writableEnded) {
          arg1.end();
        }
      });
    }
  });
  tmp13.on("error", arg02 => {
    console.error("  [#" + arg3 + "] ✗ upstream: " + arg02.message);
    if (!arg1.headersSent) {
      arg1.writeHead(502);
    }
    if (!arg1.writableEnded) {
      arg1.end("Upstream error: " + arg02.message);
    }
  });
  tmp13.end(arg2);
}
function routeRequest(arg0, arg1, arg2, arg3, tmp4 = "") {
  const tmp5 = getRpcMethod(arg0.url);
  if (tmp5 === "GetChatMessage") {
    console.log("[" + now() + "] #" + arg3 + " ⚡ " + tmp4 + "GetChatMessage → API (" + arg2.length + "b)");
    safeHandle(() => handleGetChatMessage(arg0, arg1, arg2), arg0, arg1, arg3, "Chat");
    return true;
  }
  if (tmp5 === "GetWebSearchResults") {
    console.log("[" + now() + "] #" + arg3 + " 🔍 " + tmp4 + "GetWebSearchResults (" + arg2.length + "b)");
    safeHandle(() => handleGetWebSearchResults(arg0, arg1, arg2), arg0, arg1, arg3, "WebSearch");
    return true;
  }
  if (tmp5 === "GetWebSearchRedirect") {
    console.log("[" + now() + "] #" + arg3 + " 🔍 " + tmp4 + "GetWebSearchRedirect (" + arg2.length + "b)");
    safeHandle(() => handleGetWebSearchRedirect(arg0, arg1, arg2), arg0, arg1, arg3, "WebRedirect");
    return true;
  }
  if (tmp5 === "GetEmbeddings") {
    console.log("[" + now() + "] #" + arg3 + " 🧮 " + tmp4 + "GetEmbeddings (" + arg2.length + "b)");
    safeHandle(() => handleGetEmbeddings(arg0, arg1, arg2), arg0, arg1, arg3, "Embeddings");
    return true;
  }
  return false;
}
function handleRequest(arg0, arg1) {
  const tmp2 = ++requestCounter;
  const tmp3 = getRpcMethod(arg0.url);
  const tmp4 = [];
  arg0.on("error", arg02 => {
    console.error("[" + now() + "] #" + tmp2 + " REQ ERROR: " + arg02.message);
    if (!arg1.headersSent) {
      arg1.writeHead(500);
    }
    if (!arg1.writableEnded) {
      arg1.end();
    }
  });
  arg0.on("data", arg02 => tmp4.push(arg02));
  arg0.on("end", () => {
    const tmp02 = Buffer.concat(tmp4);
    if (arg0.url.startsWith("/profile") || arg0.url.startsWith("/login") || arg0.url.startsWith("/signup") || arg0.url.startsWith("/redirect/") || arg0.url.startsWith("/changelog") || arg0.url === "/favicon.ico") {
      console.log("[" + now() + "] #" + tmp2 + " → redirect " + arg0.url);
      const tmp03 = {
        location: "https://" + REAL_WEBSITE + arg0.url
      };
      arg1.writeHead(302, tmp03);
      return arg1.end();
    }
    if (arg0.url.includes("prompt=login") || arg0.url.includes("scope=openid") || arg0.url.includes("authorize") || arg0.url.includes("client_id=codeium")) {
      console.log("[" + now() + "] #" + tmp2 + " → auth redirect");
      const tmp03 = {
        location: "https://" + REAL_REGISTER_HOST + arg0.url
      };
      arg1.writeHead(302, tmp03);
      return arg1.end();
    }
    if (arg0.url.startsWith("/api/models")) {
      const tmp03 = new URL(arg0.url, "http://localhost").pathname;
      console.log("[" + now() + "] #" + tmp2 + " 📋 " + tmp03);
      safeHandle(() => handleModelsRequest(arg0, arg1, tmp03), arg0, arg1, tmp2, "Models");
      return;
    }
    if (arg0.url.startsWith("/api/config")) {
      console.log("[" + now() + "] #" + tmp2 + " ⚙️  /api/config (" + arg0.method + ")");
      // ✅ 关键改进：对于 POST 请求，传递预缓冲的请求体
      if (arg0.method === "POST") {
        safeHandle(() => handleConfigRequest(arg0, arg1, tmp02), arg0, arg1, tmp2, "Config");
      } else {
        safeHandle(() => handleConfigRequest(arg0, arg1), arg0, arg1, tmp2, "Config");
      }
      return;
    }
    if (arg0.url === "/" || arg0.url === "/index.html") {
      serveModelUI(arg1);
      return;
    }
    if ((arg0.url === "/api/chat-queue" || arg0.url.startsWith("/api/chat-queue?")) && arg0.method === "GET") {
      const tmp03 = new URL(arg0.url, "http://localhost").searchParams.get("targetId");
      arg1.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      });
      const tmp1 = getChatQueue(tmp03);
      arg1.end(JSON.stringify(tmp1));
      return;
    }
    if (arg0.url === "/api/chat-queue" && arg0.method === "PUT") {
      try {
        const tmp03 = JSON.parse(tmp02.toString());
        pushChatQueue(tmp03.text || "", !!tmp03.hasImage, tmp03.targetId || null);
      } catch {}
      arg1.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      });
      arg1.end("{\"ok\":true}");
      return;
    }
    if (arg0.url === "/api/active-target" && arg0.method === "POST") {
      let tmp03 = null;
      try {
        const tmp04 = JSON.parse(tmp02.toString());
        tmp03 = tmp04.targetId || null;
      } catch {}
      const tmp1 = setActiveMonitorTarget(tmp03);
      arg1.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      });
      const tmp22 = {
        ok: true,
        targetId: tmp1
      };
      arg1.end(JSON.stringify(tmp22));
      return;
    }
    if (arg0.url === "/api/chat-queue/ack" && arg0.method === "POST") {
      let tmp03 = null;
      let tmp1 = null;
      try {
        const tmp04 = JSON.parse(tmp02.toString());
        tmp03 = tmp04.id || null;
        tmp1 = tmp04.targetId || null;
      } catch {}
      ackChatQueue(tmp03, tmp1);
      arg1.writeHead(200, {
        "content-type": "application/json",
        "access-control-allow-origin": "*"
      });
      arg1.end("{\"ok\":true}");
      return;
    }
    if (routeRequest(arg0, arg1, tmp02, tmp2)) {
      return;
    }
    console.log("[" + now() + "] #" + tmp2 + " → " + (tmp3 || arg0.url.slice(0, 80)) + " (" + tmp02.length + "b) → Codeium");
    proxyToCodeium(arg0, arg1, tmp02, tmp2);
  });
}
const server = http.createServer(handleRequest);
server.on("connection", arg0 => {
  arg0.setNoDelay(true);
});
const mitmServer = http.createServer((arg0, arg1) => {
  const tmp2 = ++requestCounter;
  const tmp3 = getRpcMethod(arg0.url);
  const tmp4 = [];
  arg0.on("error", arg02 => {
    console.error("[" + now() + "] #" + tmp2 + " MITM REQ ERROR: " + arg02.message);
    if (!arg1.headersSent) {
      arg1.writeHead(500);
    }
    if (!arg1.writableEnded) {
      arg1.end();
    }
  });
  arg0.on("data", arg02 => tmp4.push(arg02));
  arg0.on("end", () => {
    const tmp02 = Buffer.concat(tmp4);
    if (routeRequest(arg0, arg1, tmp02, tmp2, "MITM ")) {
      return;
    }
    console.log("[" + now() + "] #" + tmp2 + " → MITM " + (tmp3 || arg0.url.slice(0, 80)) + " (" + tmp02.length + "b) → Codeium");
    proxyToCodeium(arg0, arg1, tmp02, tmp2);
  });
});
mitmServer.on("connection", arg0 => {
  arg0.setNoDelay(true);
});
function attachHybridConnectHandler(arg0) {
  arg0.on("connect", (arg02, arg1, arg2) => {
    const tmp3 = ++requestCounter;
    const [tmp4, tmp5] = arg02.url.split(":");
    const tmp6 = parseInt(tmp5) || 443;
    if (tmp4 === REAL_API_HOST && MITM_CERT && MITM_KEY) {
      console.log("[" + now() + "] #" + tmp3 + " 🔓 MITM " + tmp4 + ":" + tmp6);
      arg1.write("HTTP/1.1 200 Connection Established\r\nProxy-agent: devin-hybrid\r\n\r\nProxy-agent: devin-hybrid\r\n\r\n");
      if (arg2 && arg2.length > 0) {
        arg1.unshift(arg2);
      }
      const tmp02 = {
        isServer: true,
        cert: MITM_CERT,
        key: MITM_KEY
      };
      const tmp1 = new tls.TLSSocket(arg1, tmp02);
      tmp1.on("error", arg03 => {
        if (arg03.code === "ECONNRESET" || arg03.code === "EPIPE") {
          return;
        }
        console.error("  [#" + tmp3 + "] MITM TLS error: " + arg03.message);
        if (!arg1.destroyed) {
          arg1.destroy();
        }
      });
      mitmServer.emit("connection", tmp1);
      return;
    }
    console.log("[" + now() + "] #" + tmp3 + " CONNECT " + tmp4 + ":" + tmp6);
    const tmp7 = net.connect(tmp6, tmp4, () => {
      arg1.write("HTTP/1.1 200 Connection Established\r\nProxy-agent: devin-hybrid\r\n\r\nProxy-agent: devin-hybrid\r\n\r\n");
      if (arg2.length > 0) {
        tmp7.write(arg2);
      }
      tmp7.pipe(arg1);
      arg1.pipe(tmp7);
    });
    tmp7.on("error", arg03 => {
      const tmp1 = /^198\.(18|19)\./.test(tmp4 || "");
      const tmp2 = arg03.code === "ETIMEDOUT" ? tmp1 ? "，目标看起来是 VPN/TUN 假 IP，请检查分流规则或将该域名设为直连" : "，请检查当前网络、系统代理或上游出口" : arg03.code === "ECONNRESET" ? "，上游连接被重置，常见于网络抖动、代理中途断链或对端主动关闭" : "";
      console.error("  [#" + tmp3 + "] CONNECT error → " + tmp4 + ":" + tmp6 + ": " + arg03.message + tmp2);
      if (!arg1.destroyed) {
        arg1.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        arg1.destroy();
      }
    });
    arg1.on("error", () => {
      if (!tmp7.destroyed) {
        tmp7.destroy();
      }
    });
  });
}
attachHybridConnectHandler(server);
function serveModelUI(arg0) {
  const tmp1 = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Devin BYOK Bridge - 模型选择</title>\n<style>\n  *{box-sizing:border-box;margin:0;padding:0}\n  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:24px}\n  .container{max-width:960px;margin:0 auto}\n  h1{font-size:1.5rem;margin-bottom:8px;color:#38bdf8}\n  .subtitle{color:#94a3b8;margin-bottom:24px;font-size:.9rem}\n  .card{background:#1e293b;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #334155}\n  .card h2{font-size:1.1rem;margin-bottom:12px;color:#f1f5f9}\n  .config-row{display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap}\n  .config-row label{color:#94a3b8;min-width:80px;font-size:.85rem}\n  .config-row select,.config-row input{background:#0f172a;border:1px solid #475569;color:#e2e8f0;padding:8px 12px;border-radius:8px;font-size:.9rem;flex:1;min-width:200px}\n  .config-row select:focus,.config-row input:focus{outline:none;border-color:#38bdf8}\n  button{background:#2563eb;color:#fff;border:none;padding:8px 20px;border-radius:8px;cursor:pointer;font-size:.85rem;transition:background .2s}\n  button:hover{background:#1d4ed8}\n  button.secondary{background:#334155}\n  button.secondary:hover{background:#475569}\n  .status{padding:8px 12px;border-radius:8px;font-size:.85rem;margin-top:8px;display:none}\n  .status.ok{display:block;background:#064e3b;color:#6ee7b7;border:1px solid #065f46}\n  .status.err{display:block;background:#450a0a;color:#fca5a5;border:1px solid #7f1d1d}\n  .model-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px;max-height:400px;overflow-y:auto;padding-right:4px}\n  .model-grid::-webkit-scrollbar{width:6px}\n  .model-grid::-webkit-scrollbar-thumb{background:#475569;border-radius:3px}\n  .model-item{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px 14px;cursor:pointer;transition:all .15s;font-size:.85rem}\n  .model-item:hover{border-color:#38bdf8;background:#1a2744}\n  .model-item.active{border-color:#2563eb;background:#1e3a5f}\n  .model-item .id{color:#e2e8f0;font-weight:500}\n  .model-item .meta{color:#64748b;font-size:.75rem;margin-top:2px}\n  .provider-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.7rem;font-weight:600;margin-left:6px}\n  .provider-tag.anthropic{background:#7c3aed22;color:#a78bfa}\n  .provider-tag.openai{background:#05966922;color:#6ee7b7}\n  .loading{text-align:center;padding:40px;color:#64748b}\n  .stats{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}\n  .stat{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;flex:1;min-width:120px}\n  .stat .num{font-size:1.4rem;font-weight:700;color:#38bdf8}\n  .stat .label{font-size:.75rem;color:#64748b;margin-top:2px}\n  .search{width:100%;background:#0f172a;border:1px solid #475569;color:#e2e8f0;padding:10px 14px;border-radius:8px;font-size:.9rem;margin-bottom:12px}\n  .search:focus{outline:none;border-color:#38bdf8}\n</style>\n</head>\n<body>\n<div class=\"container\">\n  <h1>Devin BYOK Bridge</h1>\n  <p class=\"subtitle\">模型管理面板 — 查看可用模型、切换默认模型</p>\n\n  <div class=\"stats\" id=\"stats\">\n    <div class=\"stat\"><div class=\"num\" id=\"totalCount\">-</div><div class=\"label\">总模型数</div></div>\n    <div class=\"stat\"><div class=\"num\" id=\"anthropicCount\">-</div><div class=\"label\">Anthropic</div></div>\n    <div class=\"stat\"><div class=\"num\" id=\"openaiCount\">-</div><div class=\"label\">OpenAI</div></div>\n  </div>\n\n  <div class=\"card\">\n    <h2>当前配置</h2>\n    <div class=\"config-row\">\n      <label>默认模型</label>\n      <select id=\"modelSelect\"><option>加载中...</option></select>\n      <button onclick=\"applyModel()\">应用</button>\n      <button class=\"secondary\" onclick=\"loadModels(true)\">刷新列表</button>\n    </div>\n    <div class=\"config-row\">\n      <label>Max Tokens</label>\n      <input type=\"number\" id=\"maxTokens\" value=\"32768\" min=\"1\" max=\"1000000\">\n      <button onclick=\"applyTokens()\">应用</button>\n    </div>\n    <div class=\"status\" id=\"status\"></div>\n  </div>\n\n  <div class=\"card\">\n    <h2>可用模型</h2>\n    <input class=\"search\" id=\"search\" placeholder=\"搜索模型...\" oninput=\"filterModels()\">\n    <div id=\"modelList\" class=\"loading\">正在加载模型列表...</div>\n  </div>\n</div>\n\n<script>\nlet allModels = [];\nlet currentDefault = '';\n\nasync function loadModels(refresh) {\n  const url = '/api/models' + (refresh ? '?refresh=1' : '');\n  try {\n    const res = await fetch(url);\n    const data = await res.json();\n    currentDefault = data.defaultModel || '';\n    const anthropic = data.providers?.anthropic?.models || [];\n    const openai = data.providers?.openai?.models || [];\n    allModels = [...anthropic, ...openai];\n\n    document.getElementById('totalCount').textContent = data.total || allModels.length;\n    document.getElementById('anthropicCount').textContent = anthropic.length;\n    document.getElementById('openaiCount').textContent = openai.length;\n\n    // populate select\n    const sel = document.getElementById('modelSelect');\n    sel.innerHTML = '';\n    if (allModels.length === 0) {\n      sel.innerHTML = '<option>无可用模型</option>';\n    } else {\n      for (const m of allModels) {\n        const opt = document.createElement('option');\n        opt.value = m.id;\n        opt.textContent = m.id + ' (' + m.provider + ')';\n        if (m.id === currentDefault) opt.selected = true;\n        sel.appendChild(opt);\n      }\n      // ensure current default is in list even if not returned by API\n      if (currentDefault && !allModels.find(m => m.id === currentDefault)) {\n        const opt = document.createElement('option');\n        opt.value = currentDefault;\n        opt.textContent = currentDefault + ' (current)';\n        opt.selected = true;\n        sel.prepend(opt);\n      }\n    }\n    renderModels(allModels);\n  } catch (e) {\n    document.getElementById('modelList').innerHTML = '<div class=\"loading\">加载失败: ' + e.message + '</div>';\n  }\n}\n\nfunction renderModels(models) {\n  const container = document.getElementById('modelList');\n  if (models.length === 0) {\n    container.innerHTML = '<div class=\"loading\">没有匹配的模型</div>';\n    return;\n  }\n  container.className = 'model-grid';\n  container.innerHTML = models.map(m => {\n    const isActive = m.id === currentDefault ? ' active' : '';\n    const created = m.created ? new Date(m.created).toLocaleDateString() : '';\n    return '<div class=\"model-item' + isActive + '\" onclick=\"selectModel(\\'' + m.id.replace(/'/g,\"\\\\'\") + '\\')\">'\n      + '<div class=\"id\">' + m.id + '<span class=\"provider-tag ' + m.provider + '\">' + m.provider + '</span></div>'\n      + (created ? '<div class=\"meta\">' + created + '</div>' : '')\n      + '</div>';\n  }).join('');\n}\n\nfunction filterModels() {\n  const q = document.getElementById('search').value.toLowerCase();\n  const filtered = q ? allModels.filter(m => m.id.toLowerCase().includes(q) || m.provider.includes(q)) : allModels;\n  renderModels(filtered);\n}\n\nfunction selectModel(id) {\n  document.getElementById('modelSelect').value = id;\n  applyModel();\n}\n\nasync function applyModel() {\n  const model = document.getElementById('modelSelect').value;\n  if (!model) return;\n  try {\n    const res = await fetch('/api/config', {\n      method: 'POST',\n      headers: { 'content-type': 'application/json' },\n      body: JSON.stringify({ defaultModel: model }),\n    });\n    const data = await res.json();\n    currentDefault = data.defaultModel;\n    showStatus('ok', '已切换默认模型: ' + currentDefault);\n    renderModels(allModels.filter(m => {\n      const q = document.getElementById('search').value.toLowerCase();\n      return !q || m.id.toLowerCase().includes(q);\n    }));\n  } catch (e) { showStatus('err', '切换失败: ' + e.message); }\n}\n\nasync function applyTokens() {\n  const val = parseInt(document.getElementById('maxTokens').value, 10);\n  if (!val || val < 1) return showStatus('err', '无效的 maxTokens');\n  try {\n    const res = await fetch('/api/config', {\n      method: 'POST',\n      headers: { 'content-type': 'application/json' },\n      body: JSON.stringify({ maxTokens: val }),\n    });\n    const data = await res.json();\n    showStatus('ok', 'Max Tokens 已更新: ' + data.maxTokens);\n  } catch (e) { showStatus('err', '更新失败: ' + e.message); }\n}\n\nfunction showStatus(type, msg) {\n  const el = document.getElementById('status');\n  el.className = 'status ' + type;\n  el.textContent = msg;\n  setTimeout(() => el.className = 'status', 4000);\n}\n\n// Load config first, then models\nfetch('/api/config').then(r => r.json()).then(cfg => {\n  document.getElementById('maxTokens').value = cfg.maxTokens || 32768;\n  currentDefault = cfg.defaultModel || '';\n}).finally(() => loadModels());\n</script>\n</body>\n</html>";
  arg0.writeHead(200, {
    "content-type": "text/html; charset=utf-8"
  });
  arg0.end(tmp1);
}
startWSBridge(server);
function printHybridReady() {
  const tmp02 = getLoopbackListenHosts(BIND_HOST);
  console.log("\n⚡ Devin BYOK Bridge hybrid on " + loopbackApiUrl(PORT));
  console.log("   Bind hosts: " + tmp02.join(", "));
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
function onHybridError(arg0) {
  if (arg0.code === "EADDRINUSE") {
    console.error("Port " + PORT + " in use. Kill existing: lsof -ti:" + PORT + " | xargs kill");
  } else {
    console.error("Server error:", arg0);
  }
  process.exit(1);
}
const tmp0 = getLoopbackListenHosts(BIND_HOST);
if (tmp0.length === 1) {
  server.listen(PORT, tmp0[0], printHybridReady);
  server.on("error", onHybridError);
} else {
  server.listen(PORT, tmp0[0], () => {});
  server.on("error", onHybridError);
  const serverV6 = http.createServer(handleRequest);
  serverV6.on("connection", arg0 => {
    arg0.setNoDelay(true);
  });
  attachHybridConnectHandler(serverV6);
  serverV6.listen(PORT, tmp0[1], printHybridReady);
  serverV6.on("error", onHybridError);
}
