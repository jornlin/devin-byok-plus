import { KNOWN_TOOL_NAMES, normalizeToolArguments, normalizeToolInvocation } from "./tool-normalization.js";
const TOOL_CALL_START_MARKERS = ["<tool_call>", "<tool>", "<minimax:tool_call", "<tool_calls_section_begin>", "{\"action\":\"tool_call\"", "{\"action\": \"tool_call\""];
const MAX_TOOL_MARKER_LOOKBEHIND = Math.max(...TOOL_CALL_START_MARKERS.map(_0x5c3948 => _0x5c3948.length));
function toRecoveredCalls(_0x11317d) {
  const _0x2faa27 = new Map();
  for (const _0xcf9e72 of _0x11317d) {
    if (!_0xcf9e72 || typeof _0xcf9e72.name !== "string") {
      continue;
    }
    const _0x4bde97 = normalizeToolInvocation(_0xcf9e72.name, _0xcf9e72.input ?? _0xcf9e72.arguments ?? _0xcf9e72.params ?? {});
    if (!_0x4bde97.toolName || !KNOWN_TOOL_NAMES.has(_0x4bde97.toolName)) {
      continue;
    }
    const _0x30bf6b = _0x4bde97.params ?? {};
    if (typeof _0x30bf6b !== "object" || _0x30bf6b == null || Array.isArray(_0x30bf6b)) {
      continue;
    }
    const _0x4cf471 = _0x4bde97.toolName + ":" + JSON.stringify(_0x30bf6b);
    if (!_0x2faa27.has(_0x4cf471)) {
      const _0x1bd917 = {
        name: _0x4bde97.toolName,
        input: _0x30bf6b
      };
      _0x2faa27.set(_0x4cf471, _0x1bd917);
    }
  }
  return [..._0x2faa27.values()];
}
function extractBalancedJsonObject(_0x36bc82, _0x337d4e) {
  if (!_0x36bc82 || _0x337d4e < 0 || _0x337d4e >= _0x36bc82.length || _0x36bc82[_0x337d4e] !== "{") {
    return null;
  }
  let _0x1a7136 = 0;
  let _0x374288 = false;
  let _0x59c169 = false;
  for (let _0x46a2bf = _0x337d4e; _0x46a2bf < _0x36bc82.length; _0x46a2bf++) {
    const _0x43ac75 = _0x36bc82[_0x46a2bf];
    if (_0x374288) {
      if (_0x59c169) {
        _0x59c169 = false;
      } else if (_0x43ac75 === "\\") {
        _0x59c169 = true;
      } else if (_0x43ac75 === "\"") {
        _0x374288 = false;
      }
      continue;
    }
    if (_0x43ac75 === "\"") {
      _0x374288 = true;
      continue;
    }
    if (_0x43ac75 === "{") {
      _0x1a7136++;
    }
    if (_0x43ac75 === "}") {
      _0x1a7136--;
      if (_0x1a7136 === 0) {
        return _0x36bc82.slice(_0x337d4e, _0x46a2bf + 1);
      }
    }
  }
  return null;
}
export function findToolCallStartIndex(_0xbed1eb) {
  if (!_0xbed1eb || typeof _0xbed1eb !== "string") {
    return -1;
  }
  let _0x5aaf1e = -1;
  for (const _0x3d931d of TOOL_CALL_START_MARKERS) {
    const _0x442cda = _0xbed1eb.indexOf(_0x3d931d);
    if (_0x442cda !== -1 && (_0x5aaf1e === -1 || _0x442cda < _0x5aaf1e)) {
      _0x5aaf1e = _0x442cda;
    }
  }
  return _0x5aaf1e;
}
export { MAX_TOOL_MARKER_LOOKBEHIND };
export function parseJsonActionToolCalls(_0x4328c6) {
  if (!_0x4328c6 || typeof _0x4328c6 !== "string") {
    return [];
  }
  const _0x29e571 = [];
  const _0x5a9239 = ["{\"action\":\"tool_call\"", "{\"action\": \"tool_call\""];
  for (const _0x16be70 of _0x5a9239) {
    let _0x386483 = 0;
    while (_0x386483 < _0x4328c6.length) {
      const _0x558f81 = _0x4328c6.indexOf(_0x16be70, _0x386483);
      if (_0x558f81 === -1) {
        break;
      }
      const _0x57871e = extractBalancedJsonObject(_0x4328c6, _0x558f81);
      if (!_0x57871e) {
        break;
      }
      try {
        const _0x1b1970 = JSON.parse(_0x57871e);
        if (_0x1b1970 && _0x1b1970.action === "tool_call" && Array.isArray(_0x1b1970.tool_calls)) {
          _0x29e571.push(..._0x1b1970.tool_calls.map(_0x5801e8 => ({
            name: _0x5801e8?.name,
            input: normalizeToolArguments(_0x5801e8?.arguments ?? {})
          })));
        }
      } catch {}
      _0x386483 = _0x558f81 + _0x16be70.length;
    }
  }
  return toRecoveredCalls(_0x29e571);
}
export function parseInlineToolCalls(_0x2a6ee0) {
  if (!_0x2a6ee0 || typeof _0x2a6ee0 !== "string") {
    return [];
  }
  const _0x57b6b8 = [..._0x2a6ee0.matchAll(/<tool(?:_call)?>\s*([\w.-]+)\s*(\{[\s\S]*?\})(?=\s*(?:<\/tool(?:_call)?>|$))/g)];
  if (_0x57b6b8.length === 0) {
    return [];
  }
  const _0x1c7bf6 = [];
  for (const _0x3f917c of _0x57b6b8) {
    const _0x3ed80e = _0x3f917c[1];
    const _0x1ede24 = _0x3f917c[2];
    try {
      _0x1c7bf6.push({
        name: _0x3ed80e,
        input: normalizeToolArguments(JSON.parse(_0x1ede24))
      });
    } catch {}
  }
  return toRecoveredCalls(_0x1c7bf6);
}
export function parseMiniMaxToolCalls(_0x32a46c) {
  if (!_0x32a46c || typeof _0x32a46c !== "string") {
    return [];
  }
  const _0xab6fea = [];
  const _0x38e170 = /<minimax:tool_call[^>]*>([\s\S]*?)<\/minimax:tool_call>/g;
  let _0x573fd0;
  while ((_0x573fd0 = _0x38e170.exec(_0x32a46c)) !== null) {
    const _0x15c812 = _0x573fd0[1].trim();
    if (!_0x15c812) {
      continue;
    }
    try {
      const _0x58d38f = JSON.parse(_0x15c812);
      const _0x1ba77d = _0x58d38f.name || _0x58d38f.tool_name || _0x58d38f.function || "";
      const _0x20eef6 = _0x58d38f.arguments || _0x58d38f.parameters || _0x58d38f.input || _0x58d38f.params || {};
      if (!_0x1ba77d) {
        continue;
      }
      _0xab6fea.push({
        name: _0x1ba77d,
        input: normalizeToolArguments(typeof _0x20eef6 === "string" ? JSON.parse(_0x20eef6) : _0x20eef6)
      });
      continue;
    } catch {}
    const _0x35bc0f = _0x15c812.split("\n").map(_0x5e4b76 => _0x5e4b76.trim()).filter(Boolean);
    if (_0x35bc0f.length >= 2) {
      const _0x1f07cc = _0x35bc0f[0].replace(/^functions\./, "").replace(/:\d+$/, "");
      try {
        _0xab6fea.push({
          name: _0x1f07cc,
          input: normalizeToolArguments(JSON.parse(_0x35bc0f.slice(1).join("")))
        });
      } catch {}
    }
  }
  return toRecoveredCalls(_0xab6fea);
}
export function parseSectionToolCalls(_0x327905) {
  if (!_0x327905 || typeof _0x327905 !== "string") {
    return [];
  }
  const _0x2e77fa = [];
  const _0x33678d = _0x327905.indexOf("<tool_calls_section_begin>");
  const _0x106207 = _0x327905.indexOf("<tool_calls_section_end>");
  if (_0x33678d === -1) {
    return _0x2e77fa;
  }
  const _0x47b02b = _0x327905.substring(_0x33678d, _0x106207 !== -1 ? _0x106207 : undefined);
  const _0x23b594 = /<tool_call_begin>\s*([\s\S]*?)<tool_call_end>/g;
  let _0xcadecf;
  while ((_0xcadecf = _0x23b594.exec(_0x47b02b)) !== null) {
    const _0x54379a = _0xcadecf[1];
    const _0x548447 = _0x54379a.match(/^\s*(?:functions\.)?([\w.-]+?)(?::\d+)?\s*<tool_call_argument_begin>/s);
    if (!_0x548447) {
      continue;
    }
    const _0x537d65 = _0x548447[1];
    const _0x1919bf = _0x54379a.indexOf("<tool_call_argument_begin>");
    if (_0x1919bf === -1) {
      continue;
    }
    const _0x45921d = _0x54379a.substring(_0x1919bf + "<tool_call_argument_begin>".length).trim();
    try {
      _0x2e77fa.push({
        name: _0x537d65,
        input: normalizeToolArguments(JSON.parse(_0x45921d))
      });
    } catch {}
  }
  return toRecoveredCalls(_0x2e77fa);
}
export function parseTextToolCalls(_0x4203d1) {
  if (!_0x4203d1 || typeof _0x4203d1 !== "string") {
    return [];
  }
  const _0x125bd0 = [parseJsonActionToolCalls, parseInlineToolCalls, parseMiniMaxToolCalls, parseSectionToolCalls];
  const _0x46c842 = [];
  for (const _0x118057 of _0x125bd0) {
    const _0x1efe55 = _0x118057(_0x4203d1);
    if (_0x1efe55.length > 0) {
      _0x46c842.push(..._0x1efe55);
    }
  }
  return toRecoveredCalls(_0x46c842);
}
