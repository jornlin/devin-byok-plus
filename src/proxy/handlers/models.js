import https from "node:https";
import http from "node:http";
import { stripProtocol, parseHost, isLocalTarget } from "../net-utils.js";
import { slotField, sanitizeThinkingEffort } from "./byok-slots.js";
const _initialAnthropicHost = stripProtocol(process.env.ANTHROPIC_API_HOST || "");
const _initialOpenaiHost = stripProtocol(process.env.OPENAI_API_HOST || _initialAnthropicHost);
function readSlotConfigFromEnv(arg0, tmp1 = null) {
  const tmp2 = stripProtocol(process.env[slotField(arg0, "ANTHROPIC_API_HOST")] || "");
  const tmp3 = process.env[slotField(arg0, "ANTHROPIC_API_KEY")] || "";
  const tmp4 = process.env[slotField(arg0, "ANTHROPIC_API_PATH")] || "/v1/messages";
  const tmp5 = stripProtocol(process.env[slotField(arg0, "OPENAI_API_HOST")] || tmp2);
  const tmp6 = process.env[slotField(arg0, "OPENAI_API_KEY")] || tmp3;
  const tmp7 = process.env[slotField(arg0, "OPENAI_API_PATH")] || "/v1/responses";
  const tmp8 = String(process.env[slotField(arg0, "MODEL")] || "").trim();
  const tmp9 = sanitizeThinkingEffort(process.env[slotField(arg0, "THINKING_EFFORT")] || "");
  const tmp10 = {
    anthropicHost: tmp2,
    anthropicApiPath: tmp4,
    anthropicApiKey: tmp3,
    openaiHost: tmp5,
    openaiApiPath: tmp7,
    openaiApiKey: tmp6,
    model: tmp8,
    thinkingEffort: tmp9
  };
  if (!tmp10.anthropicHost && !tmp10.anthropicApiKey && !tmp10.model && tmp1) {
    return {
      ...tmp1
    };
  }
  return tmp10;
}
const _legacySlotFallback = {
  anthropicHost: _initialAnthropicHost,
  anthropicApiPath: process.env.ANTHROPIC_API_PATH || "/v1/messages",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  openaiHost: _initialOpenaiHost,
  openaiApiPath: process.env.OPENAI_API_PATH || "/v1/responses",
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || "",
  model: process.env.DEFAULT_MODEL || "",
  thinkingEffort: sanitizeThinkingEffort(process.env.BYOK1_THINKING_EFFORT || process.env.OPENAI_REASONING_EFFORT || "")
};
const _emptySlot = {
  anthropicHost: "",
  anthropicApiPath: "/v1/messages",
  anthropicApiKey: "",
  openaiHost: "",
  openaiApiPath: "/v1/responses",
  openaiApiKey: "",
  model: "",
  thinkingEffort: ""
};
function sanitizeReasoningEffort(arg0) {
  const tmp1 = String(arg0 ?? "").trim();
  if (["", "low", "medium", "high", "xhigh", "max"].includes(tmp1)) {
    return tmp1;
  } else {
    return "medium";
  }
}
function sanitizeBooleanString(arg0) {
  return String(arg0 ?? "").trim().toLowerCase() === "true";
}
function sanitizePositiveInteger(arg0, arg1, tmp2 = 1, tmp3 = Number.MAX_SAFE_INTEGER) {
  const tmp4 = Number.parseInt(String(arg0 ?? ""), 10);
  if (!Number.isInteger(tmp4) || tmp4 < tmp2) {
    return arg1;
  }
  return Math.min(tmp4, tmp3);
}
let _runtimeConfig = {
  defaultModel: process.env.DEFAULT_MODEL || "",
  maxTokens: parseInt(process.env.MAX_TOKENS || "32768", 10),
  anthropicHost: _initialAnthropicHost,
  anthropicApiPath: process.env.ANTHROPIC_API_PATH || "/v1/messages",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  openaiHost: _initialOpenaiHost,
  openaiApiPath: process.env.OPENAI_API_PATH || "/v1/responses",
  openaiApiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || "",
  openaiReasoningEffort: Object.prototype.hasOwnProperty.call(process.env, "OPENAI_REASONING_EFFORT") ? sanitizeReasoningEffort(process.env.OPENAI_REASONING_EFFORT) : "",
  openaiThinkingEnabled: sanitizeBooleanString(process.env.OPENAI_THINKING_ENABLED),
  completionTimeoutMs: sanitizePositiveInteger(process.env.COMPLETION_TIMEOUT_MS, 12000, 2000, 60000),
  byok1: readSlotConfigFromEnv(1, _legacySlotFallback),
  byok2: readSlotConfigFromEnv(2, _emptySlot)
};
function buildProviderFromSlot(arg0) {
  const tmp1 = stripProtocol(arg0.anthropicHost || "");
  const tmp2 = stripProtocol(arg0.openaiHost || tmp1);
  const tmp3 = parseHost(tmp1);
  const tmp4 = parseHost(tmp2);
  return {
    anthropic: {
      host: tmp1,
      apiPath: arg0.anthropicApiPath || "/v1/messages",
      apiKey: arg0.anthropicApiKey || "",
      parsed: tmp3,
      useHttp: isLocalTarget(tmp1)
    },
    openai: {
      host: tmp2,
      apiPath: arg0.openaiApiPath || "/v1/responses",
      apiKey: arg0.openaiApiKey || arg0.anthropicApiKey || "",
      parsed: tmp4,
      useHttp: isLocalTarget(tmp2)
    }
  };
}
function syncLegacyFromByok1() {
  const tmp0 = _runtimeConfig.byok1;
  _runtimeConfig.anthropicHost = tmp0.anthropicHost;
  _runtimeConfig.anthropicApiPath = tmp0.anthropicApiPath;
  _runtimeConfig.anthropicApiKey = tmp0.anthropicApiKey;
  _runtimeConfig.openaiHost = tmp0.openaiHost;
  _runtimeConfig.openaiApiPath = tmp0.openaiApiPath;
  _runtimeConfig.openaiApiKey = tmp0.openaiApiKey;
  _runtimeConfig.defaultModel = tmp0.model;
}
syncLegacyFromByok1();
export function getSlotRuntime(arg0) {
  return arg0 === 2 ? {
    ..._runtimeConfig.byok2
  } : {
    ..._runtimeConfig.byok1
  };
}
export function getSlotModel(arg0) {
  return getSlotRuntime(arg0).model || "";
}
export function getSlotThinkingEffort(arg0) {
  return getSlotRuntime(arg0).thinkingEffort || "";
}
export function getRuntimeConfig() {
  const tmp0 = {
    ..._runtimeConfig
  };
  return tmp0;
}
export function getProviderConfig(tmp0 = null) {
  if (tmp0 === 1 || tmp0 === 2) {
    return buildProviderFromSlot(getSlotRuntime(tmp0));
  }
  return buildProviderFromSlot(_runtimeConfig.byok1);
}
function setStringField(arg0, arg1, arg2, fn = arg02 => arg02) {
  if (!Object.prototype.hasOwnProperty.call(arg0, arg1)) {
    return false;
  }
  const tmp4 = fn(String(arg0[arg1] ?? "").trim());
  if (_runtimeConfig[arg2] === tmp4) {
    return false;
  }
  _runtimeConfig[arg2] = tmp4;
  return true;
}
function setSlotStringField(arg0, arg1, arg2, arg3, fn = arg02 => arg02) {
  if (!Object.prototype.hasOwnProperty.call(arg0, arg1)) {
    return false;
  }
  const tmp5 = fn(String(arg0[arg1] ?? "").trim());
  const tmp6 = arg2 === 2 ? "byok2" : "byok1";
  if (_runtimeConfig[tmp6][arg3] === tmp5) {
    return false;
  }
  _runtimeConfig[tmp6][arg3] = tmp5;
  return true;
}
function applySlotPatch(arg0, arg1) {
  let tmp2 = false;
  const tmp3 = slotField(arg1, "");
  tmp2 = setSlotStringField(arg0, tmp3 + "ANTHROPIC_API_HOST", arg1, "anthropicHost", stripProtocol) || tmp2;
  tmp2 = setSlotStringField(arg0, tmp3 + "ANTHROPIC_API_PATH", arg1, "anthropicApiPath") || tmp2;
  tmp2 = setSlotStringField(arg0, tmp3 + "ANTHROPIC_API_KEY", arg1, "anthropicApiKey") || tmp2;
  tmp2 = setSlotStringField(arg0, tmp3 + "OPENAI_API_HOST", arg1, "openaiHost", stripProtocol) || tmp2;
  tmp2 = setSlotStringField(arg0, tmp3 + "OPENAI_API_PATH", arg1, "openaiApiPath") || tmp2;
  tmp2 = setSlotStringField(arg0, tmp3 + "OPENAI_API_KEY", arg1, "openaiApiKey") || tmp2;
  if (Object.prototype.hasOwnProperty.call(arg0, tmp3 + "MODEL")) {
    const tmp0 = typeof arg0[tmp3 + "MODEL"] === "string" ? arg0[tmp3 + "MODEL"].trim() : "";
    const tmp1 = arg1 === 2 ? "byok2" : "byok1";
    if (_runtimeConfig[tmp1].model !== tmp0) {
      _runtimeConfig[tmp1].model = tmp0;
      tmp2 = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(arg0, tmp3 + "THINKING_EFFORT")) {
    const tmp0 = sanitizeThinkingEffort(arg0[tmp3 + "THINKING_EFFORT"]);
    const tmp1 = arg1 === 2 ? "byok2" : "byok1";
    if (_runtimeConfig[tmp1].thinkingEffort !== tmp0) {
      _runtimeConfig[tmp1].thinkingEffort = tmp0;
      tmp2 = true;
    }
  }
  return tmp2;
}
export function setRuntimeConfig(arg0) {
  if (Object.prototype.hasOwnProperty.call(arg0, "defaultModel")) {
    _runtimeConfig.defaultModel = typeof arg0.defaultModel === "string" ? arg0.defaultModel.trim() : "";
  }
  if (arg0.maxTokens && Number.isInteger(arg0.maxTokens) && arg0.maxTokens > 0) {
    _runtimeConfig.maxTokens = arg0.maxTokens;
  }
  let tmp1 = false;
  tmp1 = applySlotPatch(arg0, 1) || tmp1;
  tmp1 = applySlotPatch(arg0, 2) || tmp1;
  tmp1 = setStringField(arg0, "ANTHROPIC_API_HOST", "anthropicHost", stripProtocol) || tmp1;
  tmp1 = setStringField(arg0, "ANTHROPIC_API_PATH", "anthropicApiPath") || tmp1;
  tmp1 = setStringField(arg0, "ANTHROPIC_API_KEY", "anthropicApiKey") || tmp1;
  tmp1 = setStringField(arg0, "OPENAI_API_HOST", "openaiHost", stripProtocol) || tmp1;
  tmp1 = setStringField(arg0, "OPENAI_API_PATH", "openaiApiPath") || tmp1;
  tmp1 = setStringField(arg0, "OPENAI_API_KEY", "openaiApiKey") || tmp1;
  if (Object.prototype.hasOwnProperty.call(arg0, "DEFAULT_MODEL")) {
    const tmp0 = typeof arg0.DEFAULT_MODEL === "string" ? arg0.DEFAULT_MODEL.trim() : "";
    if (_runtimeConfig.byok1.model !== tmp0) {
      _runtimeConfig.byok1.model = tmp0;
      tmp1 = true;
    }
  }
  setStringField(arg0, "OPENAI_REASONING_EFFORT", "openaiReasoningEffort", sanitizeReasoningEffort);
  if (Object.prototype.hasOwnProperty.call(arg0, "OPENAI_THINKING_ENABLED")) {
    _runtimeConfig.openaiThinkingEnabled = arg0.OPENAI_THINKING_ENABLED === true || sanitizeBooleanString(arg0.OPENAI_THINKING_ENABLED);
  }
  const tmp2 = Number.parseInt(String(arg0.COMPLETION_TIMEOUT_MS ?? ""), 10);
  if (Number.isInteger(tmp2) && tmp2 > 0) {
    _runtimeConfig.completionTimeoutMs = Math.min(Math.max(tmp2, 2000), 60000);
  }
  syncLegacyFromByok1();
  if (tmp1) {
    _cache = {
      anthropic: null,
      openai: null,
      ts: 0
    };
    _slotCache = {
      1: {
        anthropic: null,
        openai: null,
        ts: 0
      },
      2: {
        anthropic: null,
        openai: null,
        ts: 0
      }
    };
  }
  const tmp3 = {
    ..._runtimeConfig
  };
  return tmp3;
}
const CACHE_TTL_MS = 300000;
let _cache = {
  anthropic: null,
  openai: null,
  ts: 0
};
let _slotCache = {
  1: {
    anthropic: null,
    openai: null,
    ts: 0
  },
  2: {
    anthropic: null,
    openai: null,
    ts: 0
  }
};
function isCacheValid(tmp0 = null) {
  const tmp1 = tmp0 === 1 || tmp0 === 2 ? _slotCache[tmp0] : _cache;
  return tmp1.ts > 0 && Date.now() - tmp1.ts < CACHE_TTL_MS;
}
function httpsGetJson(arg0, arg1, arg2, tmp3 = 15000, tmp4 = false) {
  const tmp5 = parseHost(arg0);
  const tmp6 = tmp4 || tmp5.port !== 443;
  const tmp7 = tmp6 ? http : https;
  const tmp8 = tmp6 && tmp5.port === 443 ? 80 : tmp5.port;
  return new Promise((fn, fn2) => {
    const tmp2 = {
      hostname: tmp5.hostname,
      port: tmp8,
      path: arg1,
      method: "GET",
      headers: arg2
    };
    const tmp32 = tmp2;
    if (!tmp6) {
      tmp32.rejectUnauthorized = !isLocalTarget(arg0);
    }
    const tmp42 = tmp7.request(tmp32, arg02 => {
      let tmp1 = "";
      arg02.setEncoding("utf8");
      arg02.on("data", arg03 => tmp1 += arg03);
      arg02.on("end", () => {
        if (arg02.statusCode !== 200) {
          fn2(new Error("HTTP " + arg02.statusCode + ": " + tmp1.slice(0, 300)));
          return;
        }
        try {
          fn(JSON.parse(tmp1));
        } catch (tmp0) {
          fn2(new Error("JSON parse error: " + tmp0.message));
        }
      });
    });
    tmp42.setTimeout(tmp3, () => {
      tmp42.destroy();
      fn2(new Error("timeout"));
    });
    tmp42.on("error", fn2);
    tmp42.end();
  });
}
async function fetchAnthropicModels(tmp0 = null) {
  const tmp1 = getProviderConfig(tmp0).anthropic;
  if (!tmp1.apiKey) {
    return [];
  }
  try {
    const tmp02 = await httpsGetJson(tmp1.host, "/v1/models", {
      "x-api-key": tmp1.apiKey,
      "anthropic-version": "2023-06-01"
    }, 15000, tmp1.useHttp);
    const tmp12 = (tmp02.data || tmp02.models || []).map(arg0 => ({
      id: arg0.id,
      name: arg0.display_name || arg0.id,
      provider: "anthropic",
      created: arg0.created_at || arg0.created || null
    }));
    tmp12.sort((arg0, arg1) => arg0.id.localeCompare(arg1.id));
    return tmp12;
  } catch (tmp02) {
    console.error("  ❌ Fetch Anthropic models failed: " + tmp02.message);
    return [];
  }
}
async function fetchOpenAIModels(tmp0 = null) {
  const tmp1 = getProviderConfig(tmp0).openai;
  if (!tmp1.apiKey) {
    return [];
  }
  try {
    const tmp02 = await httpsGetJson(tmp1.host, "/v1/models", {
      authorization: "Bearer " + tmp1.apiKey
    }, 15000, tmp1.useHttp);
    const tmp12 = (tmp02.data || tmp02.models || []).map(arg0 => ({
      id: arg0.id,
      name: arg0.id,
      provider: "openai",
      created: arg0.created ? new Date(arg0.created * 1000).toISOString() : null,
      owned_by: arg0.owned_by || null
    }));
    tmp12.sort((arg0, arg1) => arg0.id.localeCompare(arg1.id));
    return tmp12;
  } catch (tmp02) {
    console.error("  ❌ Fetch OpenAI models failed: " + tmp02.message);
    return [];
  }
}
async function getAllModels(tmp0 = false, tmp1 = null) {
  const tmp2 = tmp1 === 1 || tmp1 === 2 ? _slotCache[tmp1] : _cache;
  if (!tmp0 && isCacheValid(tmp1)) {
    const tmp02 = {
      anthropic: tmp2.anthropic,
      openai: tmp2.openai
    };
    return tmp02;
  }
  const [tmp3, tmp4] = await Promise.all([fetchAnthropicModels(tmp1), fetchOpenAIModels(tmp1)]);
  const tmp5 = {
    anthropic: tmp3,
    openai: tmp4,
    ts: Date.now()
  };
  if (tmp1 === 1 || tmp1 === 2) {
    _slotCache[tmp1] = tmp5;
  } else {
    _cache = tmp5;
  }
  const tmp6 = {
    anthropic: tmp3,
    openai: tmp4
  };
  return tmp6;
}
function getAllowedOrigin(arg0) {
  const tmp1 = arg0.headers.origin || "";
  if (!tmp1) {
    return "*";
  }
  try {
    const tmp0 = new URL(tmp1);
    if (tmp0.hostname === "localhost" || tmp0.hostname === "127.0.0.1" || tmp0.hostname === "::1") {
      return tmp1;
    }
  } catch {}
  return "null";
}
function corsHeaders(arg0) {
  return {
    "access-control-allow-origin": getAllowedOrigin(arg0),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-admin-token",
    vary: "Origin"
  };
}
function jsonResponse(arg0, arg1, arg2, arg3) {
  const tmp4 = JSON.stringify(arg3, null, 2);
  arg1.writeHead(arg2, {
    "content-type": "application/json",
    ...corsHeaders(arg0)
  });
  arg1.end(tmp4);
}
export async function handleModelsRequest(arg0, arg1, arg2) {
  if (arg0.method === "OPTIONS") {
    arg1.writeHead(204, corsHeaders(arg0));
    arg1.end();
    return;
  }
  const tmp3 = new URL(arg0.url, "http://localhost");
  const tmp4 = tmp3.searchParams.get("refresh") === "1";
  const tmp5 = Number.parseInt(String(tmp3.searchParams.get("slot") || ""), 10);
  const tmp6 = tmp5 === 1 || tmp5 === 2 ? tmp5 : null;
  try {
    if (arg2 === "/api/models" || arg2 === "/api/models/") {
      const {
        anthropic: tmp0,
        openai: tmp1
      } = await getAllModels(tmp4, tmp6);
      const tmp2 = getProviderConfig(tmp6);
      const tmp32 = {
        host: tmp2.anthropic.host,
        count: tmp0.length,
        models: tmp0
      };
      const tmp42 = {
        host: tmp2.openai.host,
        count: tmp1.length,
        models: tmp1
      };
      const tmp52 = {
        anthropic: tmp32,
        openai: tmp42
      };
      jsonResponse(arg0, arg1, 200, {
        slot: tmp6,
        defaultModel: tmp6 ? getSlotModel(tmp6) : _runtimeConfig.defaultModel,
        providers: tmp52,
        total: tmp0.length + tmp1.length
      });
    } else if (arg2 === "/api/models/anthropic") {
      const {
        anthropic: tmp0
      } = await getAllModels(tmp4);
      jsonResponse(arg0, arg1, 200, {
        provider: "anthropic",
        host: getProviderConfig().anthropic.host,
        models: tmp0
      });
    } else if (arg2 === "/api/models/openai") {
      const {
        openai: tmp0
      } = await getAllModels(tmp4);
      jsonResponse(arg0, arg1, 200, {
        provider: "openai",
        host: getProviderConfig().openai.host,
        models: tmp0
      });
    } else {
      jsonResponse(arg0, arg1, 404, {
        error: "Not found"
      });
    }
  } catch (tmp0) {
    console.error("  ❌ /api/models error: " + tmp0.message);
    const tmp1 = {
      error: tmp0.message
    };
    jsonResponse(arg0, arg1, 500, tmp1);
  }
}
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ALLOW_UNAUTH_CONFIG_POST = process.env.ALLOW_UNAUTH_CONFIG_POST === "true";
const CONFIG_POST_MAX_BYTES = 16384;

/**
 * 授权配置修改请求
 * @param {Object} req - HTTP 请求对象
 * @param {Object} res - HTTP 响应对象
 * @returns {boolean} - 是否通过授权
 */
function authorizeConfigPost(req, res) {
  if (ADMIN_TOKEN) {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.headers["x-admin-token"] || "";

    if (token !== ADMIN_TOKEN) {
      jsonResponse(req, res, 403, { error: "Forbidden: invalid ADMIN_TOKEN" });
      return false;
    }
    return true;
  }

  if (!ALLOW_UNAUTH_CONFIG_POST) {
    const remoteAddr = req.socket?.remoteAddress || "";
    const isLocal = remoteAddr === "127.0.0.1" ||
                    remoteAddr === "::1" ||
                    remoteAddr === "::ffff:127.0.0.1";

    if (!isLocal) {
      jsonResponse(req, res, 403, {
        error: "Forbidden: set ADMIN_TOKEN or use localhost"
      });
      return false;
    }
  }

  return true;
}

/**
 * 应用配置 POST 请求体
 * @param {Object} req - HTTP 请求对象
 * @param {Object} res - HTTP 响应对象
 * @param {string|Buffer} body - 请求体内容
 */
function applyConfigPostBody(req, res, body) {
  const bodyStr = typeof body === "string"
    ? body
    : Buffer.isBuffer(body)
      ? body.toString("utf8")
      : "";

  if (Buffer.byteLength(bodyStr, "utf8") > CONFIG_POST_MAX_BYTES) {
    jsonResponse(req, res, 413, {
      error: `Body too large (max ${CONFIG_POST_MAX_BYTES} bytes)`
    });
    return;
  }

  try {
    const config = JSON.parse(bodyStr || "{}");
    const updated = setRuntimeConfig(config);
    console.log(`  ⚙️  Config updated: model=${updated.defaultModel}, maxTokens=${updated.maxTokens}`);
    jsonResponse(req, res, 200, updated);
  } catch (err) {
    jsonResponse(req, res, 400, {
      error: `Invalid JSON: ${err.message}`
    });
  }
}

export async function handleConfigRequest(arg0, arg1, bufferedBody = null) {
  if (arg0.method === "OPTIONS") {
    arg1.writeHead(204, corsHeaders(arg0));
    arg1.end();
    return;
  }
  if (arg0.method === "GET") {
    const tmp0 = getProviderConfig();
    const tmp1 = {
      host: tmp0.anthropic.host,
      hasKey: !!tmp0.anthropic.apiKey
    };
    const tmp2 = {
      host: tmp0.openai.host,
      hasKey: !!tmp0.openai.apiKey
    };
    const tmp3 = {
      anthropic: tmp1,
      openai: tmp2
    };
    const tmp4 = {
      ..._runtimeConfig
    };
    tmp4.providers = tmp3;
    jsonResponse(arg0, arg1, 200, tmp4);
    return;
  }
  if (arg0.method === "POST") {
    if (!authorizeConfigPost(arg0, arg1)) {
      return;
    }

    // ✅ 关键改进：接受预缓冲的请求体
    if (bufferedBody !== null && bufferedBody !== undefined) {
      applyConfigPostBody(arg0, arg1, bufferedBody);
      return;
    }

    // Fallback: 流式读取请求体
    let body = "";
    let oversized = false;
    arg0.setEncoding("utf8");

    arg0.on("data", chunk => {
      body += chunk;
      if (body.length > CONFIG_POST_MAX_BYTES && !oversized) {
        oversized = true;
        jsonResponse(arg0, arg1, 413, {
          error: `Body too large (max ${CONFIG_POST_MAX_BYTES} bytes)`
        });
        arg0.destroy();
      }
    });

    arg0.on("end", () => {
      if (oversized) return;
      applyConfigPostBody(arg0, arg1, body);
    });

    return;
  }
  jsonResponse(arg0, arg1, 405, {
    error: "Method not allowed"
  });
}
