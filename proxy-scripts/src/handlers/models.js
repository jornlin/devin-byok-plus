import _0x5802b5 from "node:https";
import _0x4ce406 from "node:http";
import { stripProtocol, parseHost, isLocalTarget } from "../net-utils.js";
import { slotField, sanitizeThinkingEffort } from "./byok-slots.js";
const _initialAnthropicHost = stripProtocol(process.env.ANTHROPIC_API_HOST || "");
const _initialOpenaiHost = stripProtocol(process.env.OPENAI_API_HOST || _initialAnthropicHost);
function readSlotConfigFromEnv(_0x4c2fd1, _0x5f0a8b = null) {
  const _0x2e8b1a = stripProtocol(process.env[slotField(_0x4c2fd1, "ANTHROPIC_API_HOST")] || "");
  const _0x1f4c90 = process.env[slotField(_0x4c2fd1, "ANTHROPIC_API_KEY")] || "";
  const _0x39e0d2 = process.env[slotField(_0x4c2fd1, "ANTHROPIC_API_PATH")] || "/v1/messages";
  const _0x4ab21e = stripProtocol(process.env[slotField(_0x4c2fd1, "OPENAI_API_HOST")] || _0x2e8b1a);
  const _0x52d8f4 = process.env[slotField(_0x4c2fd1, "OPENAI_API_KEY")] || _0x1f4c90;
  const _0x6c8a11 = process.env[slotField(_0x4c2fd1, "OPENAI_API_PATH")] || "/v1/responses";
  const _0x7b2e44 = String(process.env[slotField(_0x4c2fd1, "MODEL")] || "").trim();
  const _0x8f3c21 = sanitizeThinkingEffort(process.env[slotField(_0x4c2fd1, "THINKING_EFFORT")] || "");
  const _0x31f6de = {
    anthropicHost: _0x2e8b1a,
    anthropicApiPath: _0x39e0d2,
    anthropicApiKey: _0x1f4c90,
    openaiHost: _0x4ab21e,
    openaiApiPath: _0x6c8a11,
    openaiApiKey: _0x52d8f4,
    model: _0x7b2e44,
    thinkingEffort: _0x8f3c21
  };
  if (!_0x31f6de.anthropicHost && !_0x31f6de.anthropicApiKey && !_0x31f6de.model && _0x5f0a8b) {
    return {
      ..._0x5f0a8b
    };
  }
  return _0x31f6de;
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
function sanitizeReasoningEffort(_0x5b4734) {
  const _0x311973 = String(_0x5b4734 ?? "").trim();
  if (["", "low", "medium", "high", "xhigh", "max"].includes(_0x311973)) {
    return _0x311973;
  } else {
    return "medium";
  }
}
function sanitizeBooleanString(_0x41b625) {
  return String(_0x41b625 ?? "").trim().toLowerCase() === "true";
}
function sanitizePositiveInteger(_0x77df2e, _0x5626f7, _0x1575c2 = 1, _0x1e4fda = Number.MAX_SAFE_INTEGER) {
  const _0x45c56b = Number.parseInt(String(_0x77df2e ?? ""), 10);
  if (!Number.isInteger(_0x45c56b) || _0x45c56b < _0x1575c2) {
    return _0x5626f7;
  }
  return Math.min(_0x45c56b, _0x1e4fda);
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
function buildProviderFromSlot(_0x2f6d8a) {
  const _0x4986e5 = stripProtocol(_0x2f6d8a.anthropicHost || "");
  const _0x307450 = stripProtocol(_0x2f6d8a.openaiHost || _0x4986e5);
  const _0x2a7129 = parseHost(_0x4986e5);
  const _0x56516e = parseHost(_0x307450);
  return {
    anthropic: {
      host: _0x4986e5,
      apiPath: _0x2f6d8a.anthropicApiPath || "/v1/messages",
      apiKey: _0x2f6d8a.anthropicApiKey || "",
      parsed: _0x2a7129,
      useHttp: isLocalTarget(_0x4986e5)
    },
    openai: {
      host: _0x307450,
      apiPath: _0x2f6d8a.openaiApiPath || "/v1/responses",
      apiKey: _0x2f6d8a.openaiApiKey || _0x2f6d8a.anthropicApiKey || "",
      parsed: _0x56516e,
      useHttp: isLocalTarget(_0x307450)
    }
  };
}
function syncLegacyFromByok1() {
  const _0x1a2b3c = _runtimeConfig.byok1;
  _runtimeConfig.anthropicHost = _0x1a2b3c.anthropicHost;
  _runtimeConfig.anthropicApiPath = _0x1a2b3c.anthropicApiPath;
  _runtimeConfig.anthropicApiKey = _0x1a2b3c.anthropicApiKey;
  _runtimeConfig.openaiHost = _0x1a2b3c.openaiHost;
  _runtimeConfig.openaiApiPath = _0x1a2b3c.openaiApiPath;
  _runtimeConfig.openaiApiKey = _0x1a2b3c.openaiApiKey;
  _runtimeConfig.defaultModel = _0x1a2b3c.model;
}
syncLegacyFromByok1();
export function getSlotRuntime(_0x5c4a11) {
  return _0x5c4a11 === 2 ? {
    ..._runtimeConfig.byok2
  } : {
    ..._runtimeConfig.byok1
  };
}
export function getSlotModel(_0x3ef812) {
  return getSlotRuntime(_0x3ef812).model || "";
}
export function getSlotThinkingEffort(_0x3ef812) {
  return getSlotRuntime(_0x3ef812).thinkingEffort || "";
}
export function getRuntimeConfig() {
  const _0x4d6e9f = {
    ..._runtimeConfig
  };
  return _0x4d6e9f;
}
export function getProviderConfig(_0x4c2fd1 = null) {
  if (_0x4c2fd1 === 1 || _0x4c2fd1 === 2) {
    return buildProviderFromSlot(getSlotRuntime(_0x4c2fd1));
  }
  return buildProviderFromSlot(_runtimeConfig.byok1);
}
function setStringField(_0x1fc2b9, _0x5a27b1, _0x25f98b, _0x32f741 = _0x5c4f69 => _0x5c4f69) {
  if (!Object.prototype.hasOwnProperty.call(_0x1fc2b9, _0x5a27b1)) {
    return false;
  }
  const _0x4ff17f = _0x32f741(String(_0x1fc2b9[_0x5a27b1] ?? "").trim());
  if (_runtimeConfig[_0x25f98b] === _0x4ff17f) {
    return false;
  }
  _runtimeConfig[_0x25f98b] = _0x4ff17f;
  return true;
}
function setSlotStringField(_0x1fc2b9, _0x5a27b1, _0x4c2fd1, _0x25f98b, _0x32f741 = _0x5c4f69 => _0x5c4f69) {
  if (!Object.prototype.hasOwnProperty.call(_0x1fc2b9, _0x5a27b1)) {
    return false;
  }
  const _0x4ff17f = _0x32f741(String(_0x1fc2b9[_0x5a27b1] ?? "").trim());
  const _0x3a8f12 = _0x4c2fd1 === 2 ? "byok2" : "byok1";
  if (_runtimeConfig[_0x3a8f12][_0x25f98b] === _0x4ff17f) {
    return false;
  }
  _runtimeConfig[_0x3a8f12][_0x25f98b] = _0x4ff17f;
  return true;
}
function applySlotPatch(_0x2f8ea3, _0x4c2fd1) {
  let _0x4e8aac = false;
  const _0x5b8e01 = slotField(_0x4c2fd1, "");
  _0x4e8aac = setSlotStringField(_0x2f8ea3, _0x5b8e01 + "ANTHROPIC_API_HOST", _0x4c2fd1, "anthropicHost", stripProtocol) || _0x4e8aac;
  _0x4e8aac = setSlotStringField(_0x2f8ea3, _0x5b8e01 + "ANTHROPIC_API_PATH", _0x4c2fd1, "anthropicApiPath") || _0x4e8aac;
  _0x4e8aac = setSlotStringField(_0x2f8ea3, _0x5b8e01 + "ANTHROPIC_API_KEY", _0x4c2fd1, "anthropicApiKey") || _0x4e8aac;
  _0x4e8aac = setSlotStringField(_0x2f8ea3, _0x5b8e01 + "OPENAI_API_HOST", _0x4c2fd1, "openaiHost", stripProtocol) || _0x4e8aac;
  _0x4e8aac = setSlotStringField(_0x2f8ea3, _0x5b8e01 + "OPENAI_API_PATH", _0x4c2fd1, "openaiApiPath") || _0x4e8aac;
  _0x4e8aac = setSlotStringField(_0x2f8ea3, _0x5b8e01 + "OPENAI_API_KEY", _0x4c2fd1, "openaiApiKey") || _0x4e8aac;
  if (Object.prototype.hasOwnProperty.call(_0x2f8ea3, _0x5b8e01 + "MODEL")) {
    const _0x7b2e44 = typeof _0x2f8ea3[_0x5b8e01 + "MODEL"] === "string" ? _0x2f8ea3[_0x5b8e01 + "MODEL"].trim() : "";
    const _0x3a8f12 = _0x4c2fd1 === 2 ? "byok2" : "byok1";
    if (_runtimeConfig[_0x3a8f12].model !== _0x7b2e44) {
      _runtimeConfig[_0x3a8f12].model = _0x7b2e44;
      _0x4e8aac = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(_0x2f8ea3, _0x5b8e01 + "THINKING_EFFORT")) {
    const _0x8f3c21 = sanitizeThinkingEffort(_0x2f8ea3[_0x5b8e01 + "THINKING_EFFORT"]);
    const _0x3a8f12 = _0x4c2fd1 === 2 ? "byok2" : "byok1";
    if (_runtimeConfig[_0x3a8f12].thinkingEffort !== _0x8f3c21) {
      _runtimeConfig[_0x3a8f12].thinkingEffort = _0x8f3c21;
      _0x4e8aac = true;
    }
  }
  return _0x4e8aac;
}
export function setRuntimeConfig(_0x2f8ea3) {
  if (Object.prototype.hasOwnProperty.call(_0x2f8ea3, "defaultModel")) {
    _runtimeConfig.defaultModel = typeof _0x2f8ea3.defaultModel === "string" ? _0x2f8ea3.defaultModel.trim() : "";
  }
  if (_0x2f8ea3.maxTokens && Number.isInteger(_0x2f8ea3.maxTokens) && _0x2f8ea3.maxTokens > 0) {
    _runtimeConfig.maxTokens = _0x2f8ea3.maxTokens;
  }
  let _0x4e8aac = false;
  _0x4e8aac = applySlotPatch(_0x2f8ea3, 1) || _0x4e8aac;
  _0x4e8aac = applySlotPatch(_0x2f8ea3, 2) || _0x4e8aac;
  _0x4e8aac = setStringField(_0x2f8ea3, "ANTHROPIC_API_HOST", "anthropicHost", stripProtocol) || _0x4e8aac;
  _0x4e8aac = setStringField(_0x2f8ea3, "ANTHROPIC_API_PATH", "anthropicApiPath") || _0x4e8aac;
  _0x4e8aac = setStringField(_0x2f8ea3, "ANTHROPIC_API_KEY", "anthropicApiKey") || _0x4e8aac;
  _0x4e8aac = setStringField(_0x2f8ea3, "OPENAI_API_HOST", "openaiHost", stripProtocol) || _0x4e8aac;
  _0x4e8aac = setStringField(_0x2f8ea3, "OPENAI_API_PATH", "openaiApiPath") || _0x4e8aac;
  _0x4e8aac = setStringField(_0x2f8ea3, "OPENAI_API_KEY", "openaiApiKey") || _0x4e8aac;
  if (Object.prototype.hasOwnProperty.call(_0x2f8ea3, "DEFAULT_MODEL")) {
    const _0x7b2e44 = typeof _0x2f8ea3.DEFAULT_MODEL === "string" ? _0x2f8ea3.DEFAULT_MODEL.trim() : "";
    if (_runtimeConfig.byok1.model !== _0x7b2e44) {
      _runtimeConfig.byok1.model = _0x7b2e44;
      _0x4e8aac = true;
    }
  }
  setStringField(_0x2f8ea3, "OPENAI_REASONING_EFFORT", "openaiReasoningEffort", sanitizeReasoningEffort);
  if (Object.prototype.hasOwnProperty.call(_0x2f8ea3, "OPENAI_THINKING_ENABLED")) {
    _runtimeConfig.openaiThinkingEnabled = _0x2f8ea3.OPENAI_THINKING_ENABLED === true || sanitizeBooleanString(_0x2f8ea3.OPENAI_THINKING_ENABLED);
  }
  const _0x42ed7e = Number.parseInt(String(_0x2f8ea3.COMPLETION_TIMEOUT_MS ?? ""), 10);
  if (Number.isInteger(_0x42ed7e) && _0x42ed7e > 0) {
    _runtimeConfig.completionTimeoutMs = Math.min(Math.max(_0x42ed7e, 2000), 60000);
  }
  syncLegacyFromByok1();
  if (_0x4e8aac) {
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
  const _0x4a870c = {
    ..._runtimeConfig
  };
  return _0x4a870c;
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
function isCacheValid(_0x4c2fd1 = null) {
  const _0x3f8a12 = _0x4c2fd1 === 1 || _0x4c2fd1 === 2 ? _slotCache[_0x4c2fd1] : _cache;
  return _0x3f8a12.ts > 0 && Date.now() - _0x3f8a12.ts < CACHE_TTL_MS;
}
function httpsGetJson(_0x3ad2ec, _0x484fda, _0x3feba3, _0x5bd3dc = 15000, _0x3599eb = false) {
  const _0x446707 = parseHost(_0x3ad2ec);
  const _0x379dc5 = _0x3599eb || _0x446707.port !== 443;
  const _0x17ce63 = _0x379dc5 ? _0x4ce406 : _0x5802b5;
  const _0xf8c459 = _0x379dc5 && _0x446707.port === 443 ? 80 : _0x446707.port;
  return new Promise((_0x31b14d, _0x2172b7) => {
    const _0x3722fe = {
      hostname: _0x446707.hostname,
      port: _0xf8c459,
      path: _0x484fda,
      method: "GET",
      headers: _0x3feba3
    };
    const _0xafa90a = _0x3722fe;
    if (!_0x379dc5) {
      _0xafa90a.rejectUnauthorized = !isLocalTarget(_0x3ad2ec);
    }
    const _0x33f0ff = _0x17ce63.request(_0xafa90a, _0x4f5e82 => {
      let _0x319443 = "";
      _0x4f5e82.setEncoding("utf8");
      _0x4f5e82.on("data", _0x329f69 => _0x319443 += _0x329f69);
      _0x4f5e82.on("end", () => {
        if (_0x4f5e82.statusCode !== 200) {
          _0x2172b7(new Error("HTTP " + _0x4f5e82.statusCode + ": " + _0x319443.slice(0, 300)));
          return;
        }
        try {
          _0x31b14d(JSON.parse(_0x319443));
        } catch (_0xa907dc) {
          _0x2172b7(new Error("JSON parse error: " + _0xa907dc.message));
        }
      });
    });
    _0x33f0ff.setTimeout(_0x5bd3dc, () => {
      _0x33f0ff.destroy();
      _0x2172b7(new Error("timeout"));
    });
    _0x33f0ff.on("error", _0x2172b7);
    _0x33f0ff.end();
  });
}
async function fetchAnthropicModels(_0x4c2fd1 = null) {
  const _0x67cb06 = getProviderConfig(_0x4c2fd1).anthropic;
  if (!_0x67cb06.apiKey) {
    return [];
  }
  try {
    const _0x570623 = await httpsGetJson(_0x67cb06.host, "/v1/models", {
      "x-api-key": _0x67cb06.apiKey,
      "anthropic-version": "2023-06-01"
    }, 15000, _0x67cb06.useHttp);
    const _0x422c0a = (_0x570623.data || _0x570623.models || []).map(_0x48c414 => ({
      id: _0x48c414.id,
      name: _0x48c414.display_name || _0x48c414.id,
      provider: "anthropic",
      created: _0x48c414.created_at || _0x48c414.created || null
    }));
    _0x422c0a.sort((_0x551c16, _0x303c21) => _0x551c16.id.localeCompare(_0x303c21.id));
    return _0x422c0a;
  } catch (_0x423621) {
    console.error("  ❌ Fetch Anthropic models failed: " + _0x423621.message);
    return [];
  }
}
async function fetchOpenAIModels(_0x4c2fd1 = null) {
  const _0x321905 = getProviderConfig(_0x4c2fd1).openai;
  if (!_0x321905.apiKey) {
    return [];
  }
  try {
    const _0x43f6c8 = await httpsGetJson(_0x321905.host, "/v1/models", {
      authorization: "Bearer " + _0x321905.apiKey
    }, 15000, _0x321905.useHttp);
    const _0x566d23 = (_0x43f6c8.data || _0x43f6c8.models || []).map(_0x16f110 => ({
      id: _0x16f110.id,
      name: _0x16f110.id,
      provider: "openai",
      created: _0x16f110.created ? new Date(_0x16f110.created * 1000).toISOString() : null,
      owned_by: _0x16f110.owned_by || null
    }));
    _0x566d23.sort((_0x35f59b, _0x1a1f99) => _0x35f59b.id.localeCompare(_0x1a1f99.id));
    return _0x566d23;
  } catch (_0x379a01) {
    console.error("  ❌ Fetch OpenAI models failed: " + _0x379a01.message);
    return [];
  }
}
async function getAllModels(_0x4a6497 = false, _0x4c2fd1 = null) {
  const _0x3f8a12 = _0x4c2fd1 === 1 || _0x4c2fd1 === 2 ? _slotCache[_0x4c2fd1] : _cache;
  if (!_0x4a6497 && isCacheValid(_0x4c2fd1)) {
    const _0x15ced4 = {
      anthropic: _0x3f8a12.anthropic,
      openai: _0x3f8a12.openai
    };
    return _0x15ced4;
  }
  const [_0x1f0f03, _0x39ab48] = await Promise.all([fetchAnthropicModels(_0x4c2fd1), fetchOpenAIModels(_0x4c2fd1)]);
  const _0x5d1c44 = {
    anthropic: _0x1f0f03,
    openai: _0x39ab48,
    ts: Date.now()
  };
  if (_0x4c2fd1 === 1 || _0x4c2fd1 === 2) {
    _slotCache[_0x4c2fd1] = _0x5d1c44;
  } else {
    _cache = _0x5d1c44;
  }
  const _0x2e6677 = {
    anthropic: _0x1f0f03,
    openai: _0x39ab48
  };
  return _0x2e6677;
}
function getAllowedOrigin(_0x4cf5bf) {
  const _0x442b64 = _0x4cf5bf.headers.origin || "";
  if (!_0x442b64) {
    return "*";
  }
  try {
    const _0x2ba6a1 = new URL(_0x442b64);
    if (_0x2ba6a1.hostname === "localhost" || _0x2ba6a1.hostname === "127.0.0.1" || _0x2ba6a1.hostname === "::1") {
      return _0x442b64;
    }
  } catch {}
  return "null";
}
function corsHeaders(_0x5174bc) {
  return {
    "access-control-allow-origin": getAllowedOrigin(_0x5174bc),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, x-admin-token",
    vary: "Origin"
  };
}
function jsonResponse(_0x131f30, _0x556fe3, _0x53dc02, _0x2c355a) {
  const _0x423944 = JSON.stringify(_0x2c355a, null, 2);
  _0x556fe3.writeHead(_0x53dc02, {
    "content-type": "application/json",
    ...corsHeaders(_0x131f30)
  });
  _0x556fe3.end(_0x423944);
}
export async function handleModelsRequest(_0x2f88a8, _0x541283, _0x4dda89) {
  if (_0x2f88a8.method === "OPTIONS") {
    _0x541283.writeHead(204, corsHeaders(_0x2f88a8));
    _0x541283.end();
    return;
  }
  const _0x4f0a12 = new URL(_0x2f88a8.url, "http://localhost");
  const _0x4367a9 = _0x4f0a12.searchParams.get("refresh") === "1";
  const _0x7c2d11 = Number.parseInt(String(_0x4f0a12.searchParams.get("slot") || ""), 10);
  const _0x4c2fd1 = _0x7c2d11 === 1 || _0x7c2d11 === 2 ? _0x7c2d11 : null;
  try {
    if (_0x4dda89 === "/api/models" || _0x4dda89 === "/api/models/") {
      const {
        anthropic: _0x310450,
        openai: _0x22127e
      } = await getAllModels(_0x4367a9, _0x4c2fd1);
      const _0x5e8062 = getProviderConfig(_0x4c2fd1);
      const _0x25c2c2 = {
        host: _0x5e8062.anthropic.host,
        count: _0x310450.length,
        models: _0x310450
      };
      const _0x267fad = {
        host: _0x5e8062.openai.host,
        count: _0x22127e.length,
        models: _0x22127e
      };
      const _0x21d4e6 = {
        anthropic: _0x25c2c2,
        openai: _0x267fad
      };
      jsonResponse(_0x2f88a8, _0x541283, 200, {
        slot: _0x4c2fd1,
        defaultModel: _0x4c2fd1 ? getSlotModel(_0x4c2fd1) : _runtimeConfig.defaultModel,
        providers: _0x21d4e6,
        total: _0x310450.length + _0x22127e.length
      });
    } else if (_0x4dda89 === "/api/models/anthropic") {
      const {
        anthropic: _0x51841a
      } = await getAllModels(_0x4367a9);
      jsonResponse(_0x2f88a8, _0x541283, 200, {
        provider: "anthropic",
        host: getProviderConfig().anthropic.host,
        models: _0x51841a
      });
    } else if (_0x4dda89 === "/api/models/openai") {
      const {
        openai: _0x52800a
      } = await getAllModels(_0x4367a9);
      jsonResponse(_0x2f88a8, _0x541283, 200, {
        provider: "openai",
        host: getProviderConfig().openai.host,
        models: _0x52800a
      });
    } else {
      jsonResponse(_0x2f88a8, _0x541283, 404, {
        error: "Not found"
      });
    }
  } catch (_0x19aa1f) {
    console.error("  ❌ /api/models error: " + _0x19aa1f.message);
    const _0x5d57cc = {
      error: _0x19aa1f.message
    };
    jsonResponse(_0x2f88a8, _0x541283, 500, _0x5d57cc);
  }
}
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const ALLOW_UNAUTH_CONFIG_POST = process.env.ALLOW_UNAUTH_CONFIG_POST === "true";
export async function handleConfigRequest(_0x2b546d, _0x4ea31b) {
  if (_0x2b546d.method === "OPTIONS") {
    _0x4ea31b.writeHead(204, corsHeaders(_0x2b546d));
    _0x4ea31b.end();
    return;
  }
  if (_0x2b546d.method === "GET") {
    const _0x5dd6dd = getProviderConfig();
    const _0x1cbbcf = {
      host: _0x5dd6dd.anthropic.host,
      hasKey: !!_0x5dd6dd.anthropic.apiKey
    };
    const _0x44cb2e = {
      host: _0x5dd6dd.openai.host,
      hasKey: !!_0x5dd6dd.openai.apiKey
    };
    const _0x30be49 = {
      anthropic: _0x1cbbcf,
      openai: _0x44cb2e
    };
    const _0x25b809 = {
      ..._runtimeConfig
    };
    _0x25b809.providers = _0x30be49;
    jsonResponse(_0x2b546d, _0x4ea31b, 200, _0x25b809);
    return;
  }
  if (_0x2b546d.method === "POST") {
    if (ADMIN_TOKEN) {
      const _0x282208 = _0x2b546d.headers.authorization || "";
      const _0x40e052 = _0x282208.startsWith("Bearer ") ? _0x282208.slice(7) : _0x2b546d.headers["x-admin-token"] || "";
      if (_0x40e052 !== ADMIN_TOKEN) {
        return jsonResponse(_0x2b546d, _0x4ea31b, 403, {
          error: "Forbidden: invalid ADMIN_TOKEN"
        });
      }
    } else if (!ALLOW_UNAUTH_CONFIG_POST) {
      const _0x4982f5 = _0x2b546d.socket?.remoteAddress || "";
      const _0x2b436d = _0x4982f5 === "127.0.0.1" || _0x4982f5 === "::1" || _0x4982f5 === "::ffff:127.0.0.1";
      if (!_0x2b436d) {
        return jsonResponse(_0x2b546d, _0x4ea31b, 403, {
          error: "Forbidden: set ADMIN_TOKEN or use localhost"
        });
      }
    }
    const _0x1d7a09 = 16384;
    let _0x2af9cd = "";
    let _0x212eaf = false;
    _0x2b546d.setEncoding("utf8");
    _0x2b546d.on("data", _0x3e8330 => {
      _0x2af9cd += _0x3e8330;
      if (_0x2af9cd.length > _0x1d7a09 && !_0x212eaf) {
        _0x212eaf = true;
        const _0x1ada73 = {
          error: "Body too large (max " + _0x1d7a09 + " bytes)"
        };
        jsonResponse(_0x2b546d, _0x4ea31b, 413, _0x1ada73);
        _0x2b546d.destroy();
      }
    });
    _0x2b546d.on("end", () => {
      if (_0x212eaf) {
        return;
      }
      try {
        const _0x1f7a53 = JSON.parse(_0x2af9cd);
        const _0x2e545f = setRuntimeConfig(_0x1f7a53);
        console.log("  ⚙️  Config updated: model=" + _0x2e545f.defaultModel + ", maxTokens=" + _0x2e545f.maxTokens);
        jsonResponse(_0x2b546d, _0x4ea31b, 200, _0x2e545f);
      } catch (_0x2cb658) {
        const _0x1b6d9a = {
          error: "Invalid JSON: " + _0x2cb658.message
        };
        jsonResponse(_0x2b546d, _0x4ea31b, 400, _0x1b6d9a);
      }
    });
    return;
  }
  jsonResponse(_0x2b546d, _0x4ea31b, 405, {
    error: "Method not allowed"
  });
}
