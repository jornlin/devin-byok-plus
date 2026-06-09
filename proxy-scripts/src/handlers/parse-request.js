import _0xeb933f from "node:fs";
import _0x17a0b8 from "node:path";
import { parseFields, getField, getAllFields } from "../proto.js";
import { unwrapRequest } from "../connect.js";
import { KNOWN_TOOL_NAMES, normalizeToolInvocation } from "./tool-normalization.js";
const SYSTEM_PROMPT_OVERRIDE = process.env.SYSTEM_PROMPT_OVERRIDE === "true";
const SYSTEM_PROMPT_PATH = process.env.SYSTEM_PROMPT_PATH || "";
const DEBUG_UNKNOWN_FIELDS = process.env.DEBUG_UNKNOWN_FIELDS === "1";
const DEBUG_EXPORT_SYSTEM_PROMPT = process.env.DEBUG_EXPORT_SYSTEM_PROMPT === "1";
const DEBUG_SYSTEM_PROMPT_DUMP_PATH = process.env.DEBUG_SYSTEM_PROMPT_DUMP_PATH || "./debug/original-system-prompt.txt";
let _promptCache = {
  content: "",
  mtime: 0,
  path: ""
};
let _promptDumpCache = {
  content: "",
  path: ""
};
function getCustomSystemPrompt() {
  if (!SYSTEM_PROMPT_OVERRIDE || !SYSTEM_PROMPT_PATH) {
    return "";
  }
  try {
    const _0x255c60 = _0xeb933f.statSync(SYSTEM_PROMPT_PATH);
    if (_promptCache.path === SYSTEM_PROMPT_PATH && _promptCache.mtime === _0x255c60.mtimeMs) {
      return _promptCache.content;
    }
    const _0x24f11a = _0xeb933f.readFileSync(SYSTEM_PROMPT_PATH, "utf8").trim();
    const _0x5a1a92 = {
      content: _0x24f11a,
      mtime: _0x255c60.mtimeMs,
      path: SYSTEM_PROMPT_PATH
    };
    _promptCache = _0x5a1a92;
    console.log("  📝 Custom system prompt loaded (" + _0x24f11a.length + " chars)");
    return _0x24f11a;
  } catch (_0x1ad256) {
    console.error("  ❌ Failed to load custom system prompt: " + _0x1ad256.message);
    return "";
  }
}
function dumpOriginalSystemPrompt(_0x1efcb5) {
  if (!DEBUG_EXPORT_SYSTEM_PROMPT || !_0x1efcb5) {
    return;
  }
  const _0x1788fa = _0x17a0b8.isAbsolute(DEBUG_SYSTEM_PROMPT_DUMP_PATH) ? DEBUG_SYSTEM_PROMPT_DUMP_PATH : _0x17a0b8.resolve(process.cwd(), DEBUG_SYSTEM_PROMPT_DUMP_PATH);
  if (_promptDumpCache.path === _0x1788fa && _promptDumpCache.content === _0x1efcb5) {
    return;
  }
  try {
    _0xeb933f.mkdirSync(_0x17a0b8.dirname(_0x1788fa), {
      recursive: true
    });
    const _0x8699a3 = _0x1efcb5.split("\n").map(_0x4f7508 => /(?:key|token|secret|password|credential)\s*[:=]\s*\S/i.test(_0x4f7508) ? "[REDACTED]" : _0x4f7508).join("\n");
    _0xeb933f.writeFileSync(_0x1788fa, _0x8699a3.trim() + "\n", {
      encoding: "utf8",
      mode: 384
    });
    const _0x213317 = {
      content: _0x1efcb5,
      path: _0x1788fa
    };
    _promptDumpCache = _0x213317;
    console.log("  📝 Dumped original system prompt to " + _0x1788fa + " (" + _0x1efcb5.length + " chars)");
    console.warn("  ⚠️  DEBUG_EXPORT_SYSTEM_PROMPT is ON — disable in production");
  } catch (_0x1d6c58) {
    console.error("  ❌ Failed to dump original system prompt: " + _0x1d6c58.message);
  }
}
const KEEP_SECTIONS = ["tool_calling", "making_code_changes", "debugging", "running_commands", "calling_external_apis", "communication", "workflows"];
const KEEP_LINE_PATTERNS = [/^There will be an <ephemeral_message>/];
function extractFunctionalSections(_0x58999a) {
  const _0x2183dc = [];
  for (const _0x582410 of KEEP_SECTIONS) {
    const _0x16c19e = new RegExp("<" + _0x582410 + ">[\\s\\S]*?</" + _0x582410 + ">", "g");
    let _0x3eed66;
    while ((_0x3eed66 = _0x16c19e.exec(_0x58999a)) !== null) {
      _0x2183dc.push(_0x3eed66[0]);
    }
    const _0x52c432 = "<" + _0x582410 + " ";
    const _0x3e8471 = "</" + _0x582410 + ">";
    let _0x291792 = _0x58999a.indexOf(_0x52c432);
    while (_0x291792 !== -1) {
      const _0x1ed0da = _0x58999a.indexOf(_0x3e8471, _0x291792);
      if (_0x1ed0da !== -1) {
        _0x2183dc.push(_0x58999a.slice(_0x291792, _0x1ed0da + _0x3e8471.length));
      }
      _0x291792 = _0x58999a.indexOf(_0x52c432, _0x291792 + 1);
    }
  }
  for (const _0xd9accb of _0x58999a.split("\n")) {
    const _0x4592c3 = _0xd9accb.trim();
    if (KEEP_LINE_PATTERNS.some(_0x46df65 => _0x46df65.test(_0x4592c3))) {
      _0x2183dc.push(_0x4592c3);
    }
  }
  return _0x2183dc.join("\n\n");
}
function compactPromptText(_0x175c9b) {
  if (!_0x175c9b) {
    return "";
  }
  return _0x175c9b.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
const SOURCE = {
  UNSPECIFIED: 0,
  USER: 1,
  SYSTEM: 2,
  UNKNOWN: 3,
  TOOL: 4,
  SYSTEM_PROMPT: 5
};
function parseImageData(_0x3952b7) {
  const _0x1cebd8 = parseFields(_0x3952b7);
  const _0x5beecb = getField(_0x1cebd8, 1, 2);
  const _0x44456a = getField(_0x1cebd8, 2, 2);
  const _0x319721 = getField(_0x1cebd8, 3, 2);
  return {
    base64_data: _0x5beecb ? _0x5beecb.value.toString("utf8") : "",
    mime_type: _0x44456a ? _0x44456a.value.toString("utf8") : "image/png",
    caption: _0x319721 ? _0x319721.value.toString("utf8") : ""
  };
}
function parseChatToolCall(_0x1cde40) {
  const _0x289138 = parseFields(_0x1cde40);
  const _0x3c9c5b = getField(_0x289138, 1, 2);
  const _0x1019e3 = getField(_0x289138, 2, 2);
  const _0x2a69ef = getField(_0x289138, 3, 2);
  const _0xbb2299 = _0x1019e3 ? _0x1019e3.value.toString("utf8") : "";
  const _0x4d001a = _0x2a69ef ? _0x2a69ef.value.toString("utf8") : "{}";
  const _0x406d28 = normalizeToolInvocation(_0xbb2299, _0x4d001a);
  return {
    id: _0x3c9c5b ? _0x3c9c5b.value.toString("utf8") : "",
    name: _0x406d28.toolName,
    arguments_json: JSON.stringify(_0x406d28.params ?? {})
  };
}
function parseChatMessagePrompt(_0x165da4) {
  const _0x1478d5 = parseFields(_0x165da4);
  const _0x4420cf = getField(_0x1478d5, 1, 2);
  const _0x2c1c75 = getField(_0x1478d5, 2, 0);
  const _0x15103b = getField(_0x1478d5, 3, 2);
  const _0x516225 = getField(_0x1478d5, 7, 2);
  const _0x29c40d = getField(_0x1478d5, 9, 0);
  const _0x143929 = getField(_0x1478d5, 11, 2);
  const _0x3f0060 = getField(_0x1478d5, 12, 2);
  const _0x5e48f9 = getAllFields(_0x1478d5, 6);
  const _0x5a818a = getAllFields(_0x1478d5, 10);
  return {
    messageId: _0x4420cf ? _0x4420cf.value.toString("utf8") : "",
    source: _0x2c1c75 ? _0x2c1c75.value : 0,
    prompt: _0x15103b ? _0x15103b.value.toString("utf8") : "",
    toolCalls: _0x5e48f9.map(_0x1ccfda => parseChatToolCall(_0x1ccfda.value)),
    toolCallId: _0x516225 ? _0x516225.value.toString("utf8") : "",
    toolResultIsError: _0x29c40d ? Boolean(_0x29c40d.value) : false,
    images: _0x5a818a.map(_0x4efaeb => parseImageData(_0x4efaeb.value)),
    thinking: _0x143929 ? _0x143929.value.toString("utf8") : "",
    signature: _0x3f0060 ? _0x3f0060.value.toString("utf8") : ""
  };
}
function parseChatToolDefinition(_0x197d00) {
  const _0x51493 = parseFields(_0x197d00);
  const _0x580984 = getField(_0x51493, 1, 2);
  const _0x5b4db2 = getField(_0x51493, 2, 2);
  const _0x462e01 = getField(_0x51493, 3, 2);
  const _0x3b5b0f = _0x580984 ? _0x580984.value.toString("utf8") : "";
  const _0x5af645 = _0x5b4db2 ? _0x5b4db2.value.toString("utf8") : "";
  const _0x2a3ef2 = _0x462e01 ? _0x462e01.value.toString("utf8") : "{}";
  let _0x39270f;
  try {
    _0x39270f = JSON.parse(_0x2a3ef2);
  } catch {
    _0x39270f = {
      type: "object",
      properties: {}
    };
  }
  if (!_0x39270f.type) {
    _0x39270f.type = "object";
  }
  if (_0x39270f.type === "object" && !_0x39270f.properties) {
    _0x39270f.properties = {};
  }
  const _0x5bfba2 = KNOWN_TOOL_NAMES.has(_0x3b5b0f) ? _0x3b5b0f : normalizeToolInvocation(_0x3b5b0f, {}).toolName || _0x3b5b0f;
  const _0x31a319 = {
    name: _0x5bfba2,
    description: _0x5af645,
    input_schema: _0x39270f
  };
  return _0x31a319;
}
function parseChatToolChoice(_0x485553) {
  const _0x57a96d = parseFields(_0x485553);
  const _0x5e7c6c = getField(_0x57a96d, 1, 2);
  const _0x2f12ff = getField(_0x57a96d, 2, 2);
  const _0x13c6ad = _0x2f12ff ? _0x2f12ff.value.toString("utf8").trim() : "";
  const _0x1e3206 = _0x5e7c6c ? _0x5e7c6c.value.toString("utf8").trim() : "";
  if (_0x13c6ad) {
    const _0x3208b5 = normalizeToolInvocation(_0x13c6ad, {});
    const _0x3d7dbd = {
      type: "tool",
      name: _0x3208b5.toolName
    };
    return _0x3d7dbd;
  }
  if (_0x1e3206) {
    const _0x129766 = {
      type: _0x1e3206
    };
    return _0x129766;
  }
  return undefined;
}
function toAnthropicMessage(_0x44c0f9) {
  const {
    source: _0x474c05,
    prompt: _0x2b538c,
    toolCalls: _0x4c89b9,
    toolCallId: _0x2325c9,
    toolResultIsError: _0xa40617,
    images: _0x31b782,
    thinking: _0x547441,
    signature: _0x54a45a
  } = _0x44c0f9;
  if (_0x474c05 === SOURCE.SYSTEM_PROMPT || _0x474c05 === SOURCE.UNSPECIFIED) {
    return null;
  }
  if (_0x474c05 === SOURCE.TOOL) {
    const _0x3d7046 = {
      type: "tool_result",
      tool_use_id: _0x2325c9,
      content: _0x2b538c
    };
    const _0x37dd22 = _0x3d7046;
    if (_0xa40617) {
      _0x37dd22.is_error = true;
    }
    const _0x290245 = {
      role: "user",
      content: [_0x37dd22]
    };
    return _0x290245;
  }
  if (_0x474c05 === SOURCE.USER) {
    if (_0x31b782 && _0x31b782.length > 0) {
      const _0x5858ee = [];
      for (const _0x331d13 of _0x31b782) {
        if (_0x331d13.base64_data) {
          const _0x4bcec6 = {
            type: "image",
            source: {}
          };
          _0x4bcec6.source.type = "base64";
          _0x4bcec6.source.media_type = _0x331d13.mime_type || "image/png";
          _0x4bcec6.source.data = _0x331d13.base64_data;
          _0x5858ee.push(_0x4bcec6);
        }
      }
      if (_0x2b538c) {
        const _0x42ebfd = {
          type: "text",
          text: _0x2b538c
        };
        _0x5858ee.push(_0x42ebfd);
      }
      const _0x23385a = {
        role: "user",
        content: _0x5858ee
      };
      return _0x23385a;
    }
    const _0x487691 = {
      role: "user",
      content: _0x2b538c
    };
    return _0x487691;
  }
  if (_0x474c05 === SOURCE.UNKNOWN || _0x474c05 === SOURCE.SYSTEM) {
    const _0x43c8b8 = [];
    if (_0x547441) {
      const _0x3e5d32 = {
        type: "thinking",
        thinking: _0x547441
      };
      const _0x3ba3e2 = _0x3e5d32;
      if (_0x54a45a) {
        _0x3ba3e2.signature = _0x54a45a;
      }
      _0x43c8b8.push(_0x3ba3e2);
    }
    if (_0x2b538c) {
      const _0xf00ed9 = {
        type: "text",
        text: _0x2b538c
      };
      _0x43c8b8.push(_0xf00ed9);
    }
    for (const _0x33be17 of _0x4c89b9) {
      let _0x349c78;
      try {
        _0x349c78 = JSON.parse(_0x33be17.arguments_json);
      } catch {
        _0x349c78 = {};
      }
      const _0x551738 = {
        type: "tool_use",
        id: _0x33be17.id,
        name: _0x33be17.name,
        input: _0x349c78
      };
      _0x43c8b8.push(_0x551738);
    }
    if (_0x43c8b8.length > 1 || _0x43c8b8.length === 1 && _0x43c8b8[0].type !== "text") {
      const _0x3b5d08 = {
        role: "assistant",
        content: _0x43c8b8
      };
      return _0x3b5d08;
    }
    const _0x1b32cb = {
      role: "assistant",
      content: _0x2b538c
    };
    return _0x1b32cb;
  }
  return null;
}
function normalizeContent(_0x133d18) {
  if (typeof _0x133d18 === "string") {
    const _0x15ba2a = {
      type: "text",
      text: _0x133d18
    };
    return [_0x15ba2a];
  }
  if (Array.isArray(_0x133d18)) {
    return _0x133d18;
  } else {
    return [];
  }
}
function mergeConsecutiveMessages(_0x28f20d) {
  if (_0x28f20d.length <= 1) {
    return _0x28f20d;
  }
  const _0x45ee8b = [_0x28f20d[0]];
  for (let _0x71ac08 = 1; _0x71ac08 < _0x28f20d.length; _0x71ac08++) {
    const _0x3a033f = _0x45ee8b[_0x45ee8b.length - 1];
    const _0x6e02a2 = _0x28f20d[_0x71ac08];
    if (_0x3a033f.role === _0x6e02a2.role) {
      const _0x2e03f3 = normalizeContent(_0x3a033f.content);
      const _0x29291e = normalizeContent(_0x6e02a2.content);
      _0x3a033f.content = [..._0x2e03f3, ..._0x29291e];
    } else {
      _0x45ee8b.push(_0x6e02a2);
    }
  }
  for (const _0x226340 of _0x45ee8b) {
    if (Array.isArray(_0x226340.content) && _0x226340.content.length === 1 && _0x226340.content[0].type === "text") {
      _0x226340.content = _0x226340.content[0].text;
    }
  }
  return _0x45ee8b;
}
export { extractFunctionalSections, compactPromptText };
export function parseGetChatMessageRequest(_0x169e7e, _0x3a1c63) {
  const _0x3c07c1 = unwrapRequest(_0x169e7e, _0x3a1c63);
  const _0x25f8ca = parseFields(_0x3c07c1);
  const _0x48ecf1 = new Set([1, 2, 3, 10, 12, 21]);
  const _0x131fc7 = _0x25f8ca.filter(_0x2318c7 => !_0x48ecf1.has(_0x2318c7.field));
  if (_0x131fc7.length > 0) {
    const _0x5a76db = _0x131fc7.map(_0x5fd812 => _0x5fd812.field + "/" + _0x5fd812.wireType).join(", ");
    if (DEBUG_UNKNOWN_FIELDS) {
      console.log("  🔍 GetChatMessage unknown fields: " + _0x5a76db);
      for (const _0x36d585 of _0x131fc7) {
        if (_0x36d585.wireType === 0) {
          console.log("    field " + _0x36d585.field + " (varint): " + _0x36d585.value);
        } else if (_0x36d585.wireType === 2) {
          const _0x1a740a = _0x36d585.value.toString("utf8");
          const _0x336e13 = /^[\x20-\x7e\n\r\t]+$/.test(_0x1a740a.slice(0, 50));
          console.log("    field " + _0x36d585.field + " (bytes/" + _0x36d585.value.length + "b): " + (_0x336e13 ? _0x1a740a.slice(0, 120) : "[binary " + _0x36d585.value.toString("hex").slice(0, 40) + "]"));
        } else {
          console.log("    field " + _0x36d585.field + " (wire " + _0x36d585.wireType + "): " + _0x36d585.value?.toString?.("hex")?.slice(0, 40));
        }
      }
    }
  }
  const _0x311ecf = getField(_0x25f8ca, 2, 2);
  let _0x25de41 = _0x311ecf ? _0x311ecf.value.toString("utf8") : "";
  dumpOriginalSystemPrompt(_0x25de41);
  if (SYSTEM_PROMPT_OVERRIDE) {
    const _0x2bf087 = getCustomSystemPrompt();
    if (_0x2bf087) {
      const _0xa12aa0 = _0x25de41.length;
      const _0x27cd9c = compactPromptText(extractFunctionalSections(_0x25de41));
      _0x25de41 = compactPromptText(_0x27cd9c ? _0x2bf087 + "\n\n" + _0x27cd9c : _0x2bf087);
      console.log("  🔀 System prompt: custom " + _0x2bf087.length + " + preserved " + _0x27cd9c.length + " chars (was " + _0xa12aa0 + ")");
    }
  }
  const _0x1c949f = getField(_0x25f8ca, 21, 2);
  const _0x501039 = _0x1c949f ? _0x1c949f.value.toString("utf8") : "";
  const _0x3763b7 = getAllFields(_0x25f8ca, 3, 2);
  const _0x5016ab = _0x3763b7.map(_0x1d3c62 => parseChatMessagePrompt(_0x1d3c62.value));
  for (const _0x275f2b of _0x5016ab) {
    if (_0x275f2b.source === SOURCE.SYSTEM_PROMPT && _0x275f2b.prompt) {
      _0x25de41 += (_0x25de41 ? "\n\n" : "") + _0x275f2b.prompt;
    }
  }
  _0x25de41 = compactPromptText(_0x25de41);
  let _0x323a1c = "agent";
  const _0x2d2b64 = _0x5016ab.filter(_0x3d5591 => _0x3d5591.source !== SOURCE.SYSTEM_PROMPT && _0x3d5591.source !== SOURCE.UNSPECIFIED);
  if (_0x2d2b64.length > 0) {
    const _0x9bdbda = _0x2d2b64[_0x2d2b64.length - 1];
    if (_0x9bdbda.source === SOURCE.USER) {
      const _0x20b20d = _0x2d2b64.length >= 2 ? _0x2d2b64[_0x2d2b64.length - 2] : null;
      if (!_0x20b20d || _0x20b20d.source !== SOURCE.TOOL) {
        _0x323a1c = "user";
      } else {
        console.log("  🔍 Agent-round trailing USER text (" + _0x9bdbda.prompt.length + " chars): \"" + _0x9bdbda.prompt.slice(0, 150) + "...\"");
      }
    }
  }
  const _0x1d7b31 = mergeConsecutiveMessages(_0x5016ab.map(toAnthropicMessage).filter(Boolean));
  const _0x57d300 = getAllFields(_0x25f8ca, 10, 2);
  let _0x3b8c13 = _0x57d300.map(_0x4bc3af => parseChatToolDefinition(_0x4bc3af.value)).filter(_0x9bd957 => _0x9bd957.name);
  if (_0x3b8c13.length > 0) {
    const _0x4391aa = new Map();
    for (const _0x8e0e8e of _0x3b8c13) {
      if (!_0x8e0e8e.name) {
        continue;
      }
      if (!KNOWN_TOOL_NAMES.has(_0x8e0e8e.name) && !_0x8e0e8e.name.startsWith("mcp0_")) {
        console.log("  ⚠️  Dropping unknown tool definition: " + _0x8e0e8e.name);
        continue;
      }
      if (!_0x4391aa.has(_0x8e0e8e.name)) {
        _0x4391aa.set(_0x8e0e8e.name, _0x8e0e8e);
      }
    }
    _0x3b8c13 = [..._0x4391aa.values()];
  }
  if (_0x3b8c13.length === 0) {
    _0x3b8c13 = undefined;
  }
  const _0x5ee6b1 = getField(_0x25f8ca, 12, 2);
  const _0x11ecbf = _0x5ee6b1 ? parseChatToolChoice(_0x5ee6b1.value) : undefined;
  const _0x5791d6 = {
    systemPrompt: _0x25de41,
    messages: _0x1d7b31,
    tools: _0x3b8c13,
    toolChoice: _0x11ecbf,
    requestedModel: _0x501039,
    initiator: _0x323a1c
  };
  return _0x5791d6;
}
