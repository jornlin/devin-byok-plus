import _0x5de1c8 from "node:http";
import _0x2152da from "node:https";
import _0x2a0f3a from "node:crypto";
import { parseFields, writeStringField, writeMessageField, writeVarintField } from "../proto.js";
import { wrapUnary, unaryHeaders, unwrapRequest } from "../connect.js";
import { getProviderConfig, getRuntimeConfig } from "./models.js";
const PROXY_DEVICE_ID = process.env.PROXY_DEVICE_ID || "";
const PROXY_CLIENT_VERSION = process.env.PROXY_CLIENT_VERSION || "0.0.0";
const _COMPLETION_MODEL = process.env.COMPLETION_MODEL || "";
function getCompletionModel() {
  return _COMPLETION_MODEL || getRuntimeConfig().defaultModel || "claude-sonnet-4-20250514";
}
const MAX_TOKENS = 256;
function getCompletionTimeoutMs() {
  return getRuntimeConfig().completionTimeoutMs || 12000;
}
const PREFIX_CHARS = 2000;
const SUFFIX_CHARS = 500;
const SYSTEM_PROMPT = "You are a precise code completion engine. Return only the code that should be inserted at the cursor position. Do not include explanations, Markdown, backticks, headings, comments about what you changed, or any surrounding prose. Preserve the local coding style and continue the existing code naturally.";
function extractAllStrings(_0x37008f, _0x482ae3 = 0, _0x1ed73d = 0) {
  if (_0x482ae3 > 6 || !_0x37008f || _0x37008f.length === 0) {
    return [];
  }
  let _0x37400d;
  try {
    _0x37400d = parseFields(_0x37008f);
  } catch {
    return [];
  }
  const _0x21dd22 = [];
  for (const _0x54e4bd of _0x37400d) {
    if (_0x54e4bd.wireType !== 2) {
      continue;
    }
    const _0x15cd29 = _0x54e4bd.value;
    if (!_0x15cd29 || _0x15cd29.length === 0) {
      continue;
    }
    const _0x1e56cb = _0x15cd29.toString("utf8");
    const _0x4ad400 = (_0x1e56cb.match(/[\x09\x0a\x0d\x20-\x7e]/g) || []).length;
    const _0x47bea3 = _0x4ad400 / (_0x1e56cb.length || 1);
    if (_0x1e56cb.length > 5 && _0x47bea3 >= 0.8) {
      const _0x510140 = {
        text: _0x1e56cb,
        field: _0x54e4bd.field,
        parentField: _0x1ed73d,
        depth: _0x482ae3
      };
      _0x21dd22.push(_0x510140);
    }
    const _0x4e7338 = extractAllStrings(_0x15cd29, _0x482ae3 + 1, _0x54e4bd.field);
    _0x21dd22.push(..._0x4e7338);
  }
  return _0x21dd22;
}
function extractCodeContext(_0x461391) {
  const _0x408d2d = extractAllStrings(_0x461391);
  const _0x1ff55d = new Set();
  const _0xce3c0 = [];
  for (const _0x4205c8 of _0x408d2d) {
    if (!_0x1ff55d.has(_0x4205c8.text)) {
      _0x1ff55d.add(_0x4205c8.text);
      _0xce3c0.push(_0x4205c8);
    }
  }
  _0xce3c0.sort((_0x2dde45, _0x18b2a5) => _0x18b2a5.text.length - _0x2dde45.text.length);
  const _0x528bd4 = _0x463c00 => {
    if (_0x463c00.length < 10) {
      return false;
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(_0x463c00)) {
      return false;
    }
    if (/^[0-9a-f]+$/i.test(_0x463c00) && _0x463c00.length < 80) {
      return false;
    }
    if (/^\d+$/.test(_0x463c00)) {
      return false;
    }
    return true;
  };
  const _0xa51083 = _0xce3c0.filter(_0x508bc7 => _0x528bd4(_0x508bc7.text));
  const _0x3152e4 = _0xa51083[0]?.text ?? "";
  const _0x57c918 = _0xa51083[1]?.text ?? "";
  const _0x2c8baf = {
    prefix: _0x3152e4,
    suffix: _0x57c918,
    allCandidates: _0xce3c0,
    codeCandidates: _0xa51083
  };
  return _0x2c8baf;
}
function buildGetCompletionsResponse(_0xfcf0f6) {
  if (!_0xfcf0f6) {
    return Buffer.alloc(0);
  }
  const _0x329be0 = _0x2a0f3a.randomUUID();
  const _0xe42cbf = Buffer.concat([writeStringField(1, _0x329be0), writeStringField(2, _0xfcf0f6), writeVarintField(12, 2)]);
  const _0x48f176 = writeMessageField(1, _0xe42cbf);
  const _0x457a77 = writeMessageField(1, _0x48f176);
  return _0x457a77;
}
function callAnthropicAPI(_0x4b9f88, _0x12a311) {
  return new Promise(_0x2083e0 => {
    const _0x24f835 = getProviderConfig().anthropic;
    if (!_0x24f835.apiKey) {
      console.error("  [completions] No Anthropic API key set");
      _0x2083e0("");
      return;
    }
    const _0x34087d = _0x4b9f88.slice(-PREFIX_CHARS);
    const _0x374ec7 = _0x12a311.slice(0, SUFFIX_CHARS);
    let _0x51ce80;
    if (_0x374ec7.length > 0) {
      _0x51ce80 = "Complete the code at the cursor position.\n\n<code_before_cursor>\n" + _0x34087d + "\n</code_before_cursor>\n\n<code_after_cursor>\n" + _0x374ec7 + "\n</code_after_cursor>\n\nOutput only the text to insert between the two blocks.";
    } else {
      _0x51ce80 = "Continue the following code:\n\n" + _0x34087d;
    }
    const _0x52ff68 = {
      role: "user",
      content: _0x51ce80
    };
    const _0x14c292 = {
      model: getCompletionModel(),
      system: SYSTEM_PROMPT,
      messages: [_0x52ff68],
      stream: false,
      max_tokens: MAX_TOKENS
    };
    const _0x46e39c = JSON.stringify(_0x14c292);
    const _0x1c3a05 = getCompletionTimeoutMs();
    console.log("  [completions] API call: model=" + getCompletionModel() + (" prefix=" + _0x34087d.length + "b suffix=" + _0x374ec7.length + "b timeout=" + _0x1c3a05 + "ms"));
    const _0x2eb1a5 = _0x24f835.useHttp ? _0x5de1c8 : _0x2152da;
    const _0x286f48 = _0x24f835.parsed.port !== 443 ? _0x24f835.parsed.port : _0x24f835.useHttp ? 80 : 443;
    const _0x513a93 = _0x2eb1a5.request({
      hostname: _0x24f835.parsed.hostname,
      port: _0x286f48,
      path: _0x24f835.apiPath,
      method: "POST",
      rejectUnauthorized: !_0x24f835.useHttp && _0x24f835.parsed.port === 443,
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": _0x24f835.apiKey,
        "content-length": Buffer.byteLength(_0x46e39c),
        "x-proxy-device-id": PROXY_DEVICE_ID,
        "x-proxy-client-version": PROXY_CLIENT_VERSION,
        "x-proxy-timestamp": Date.now().toString(),
        "x-proxy-nonce": _0x2a0f3a.randomBytes(16).toString("hex"),
        "x-proxy-requested-model": getCompletionModel()
      }
    }, _0x50f996 => {
      let _0x2334e9 = "";
      _0x50f996.setEncoding("utf8");
      _0x50f996.on("data", _0x4adc2c => {
        _0x2334e9 += _0x4adc2c;
      });
      _0x50f996.on("end", () => {
        console.log("  [completions] API status=" + _0x50f996.statusCode + (" body=" + _0x2334e9.slice(0, 400)));
        if (_0x50f996.statusCode !== 200) {
          console.error("  [completions] API error " + _0x50f996.statusCode + ": " + _0x2334e9.slice(0, 200));
          _0x2083e0("");
          return;
        }
        try {
          const _0x7a3f0d = JSON.parse(_0x2334e9);
          const _0x5f0b4f = _0x7a3f0d?.content?.[0]?.text ?? "";
          console.log("  [completions] Completion text: " + JSON.stringify(_0x5f0b4f.slice(0, 120)));
          _0x2083e0(_0x5f0b4f.trim());
        } catch (_0x27218c) {
          console.error("  [completions] JSON parse error: " + _0x27218c.message);
          _0x2083e0("");
        }
      });
      _0x50f996.on("error", _0x16a80e => {
        console.error("  [completions] API response error: " + _0x16a80e.message);
        _0x2083e0("");
      });
    });
    _0x513a93.setTimeout(_0x1c3a05, () => {
      console.warn("  [completions] API timeout after " + _0x1c3a05 + "ms — returning empty");
      _0x513a93.destroy();
      _0x2083e0("");
    });
    _0x513a93.on("error", _0x4a097a => {
      if (_0x4a097a.message.includes("socket hang up") || _0x4a097a.message.includes("ECONNRESET")) {
        return;
      }
      console.error("  [completions] API request error: " + _0x4a097a.message);
      _0x2083e0("");
    });
    _0x513a93.end(_0x46e39c);
  });
}
export async function handleGetCompletions(_0x369c89, _0x2ae51a, _0x2ae3e0) {
  console.log("[completions] GetCompletions (" + (_0x2ae3e0?.length ?? 0) + "b)");
  let _0x3c5655;
  try {
    _0x3c5655 = unwrapRequest(_0x2ae3e0, _0x369c89.headers);
  } catch (_0x504402) {
    console.error("  [completions] unwrapRequest failed: " + _0x504402.message);
    const _0xc9e001 = wrapUnary(Buffer.alloc(0));
    _0x2ae51a.writeHead(200, {
      ...unaryHeaders(),
      "content-length": _0xc9e001.length
    });
    _0x2ae51a.end(_0xc9e001);
    return;
  }
  let _0x1e1a6c = [];
  try {
    _0x1e1a6c = parseFields(_0x3c5655);
  } catch (_0x237e77) {
    console.error("  [completions] parseFields failed: " + _0x237e77.message);
  }
  console.log("  [completions] Top-level fields (" + _0x1e1a6c.length + "):");
  for (const _0x34c488 of _0x1e1a6c) {
    if (_0x34c488.wireType === 0) {
      console.log("    field " + _0x34c488.field + " (varint): " + _0x34c488.value);
    } else if (_0x34c488.wireType === 1) {
      const _0x1bca05 = Buffer.isBuffer(_0x34c488.value) ? _0x34c488.value.toString("hex") : String(_0x34c488.value);
      console.log("    field " + _0x34c488.field + " (fixed64): " + _0x1bca05);
    } else if (_0x34c488.wireType === 2) {
      const _0x524454 = _0x34c488.value;
      const _0x1321f9 = _0x524454.toString("utf8");
      const _0x22e05a = (_0x1321f9.match(/[\x09\x0a\x0d\x20-\x7e]/g) || []).length;
      const _0x251e05 = _0x22e05a / (_0x524454.length || 1);
      if (_0x251e05 >= 0.85) {
        console.log("    field " + _0x34c488.field + " (string/" + _0x524454.length + "b): " + JSON.stringify(_0x1321f9.slice(0, 120)));
      } else {
        console.log("    field " + _0x34c488.field + " (bytes/" + _0x524454.length + "b): [binary] " + _0x524454.toString("hex").slice(0, 48));
      }
    } else if (_0x34c488.wireType === 5) {
      const _0x43c3fb = Buffer.isBuffer(_0x34c488.value) ? _0x34c488.value.toString("hex") : String(_0x34c488.value);
      console.log("    field " + _0x34c488.field + " (fixed32): " + _0x43c3fb);
    }
  }
  const {
    prefix: _0x15233f,
    suffix: _0xa14bd,
    allCandidates: _0x422788,
    codeCandidates: _0x5edca1
  } = extractCodeContext(_0x3c5655);
  console.log("  [completions] String candidates: " + _0x422788.length + " total, " + (_0x5edca1.length + " code-like"));
  for (const _0x2cbbd1 of _0x5edca1.slice(0, 6)) {
    console.log("    [field=" + _0x2cbbd1.field + " parent=" + _0x2cbbd1.parentField + " depth=" + _0x2cbbd1.depth + (" len=" + _0x2cbbd1.text.length + "]: ") + JSON.stringify(_0x2cbbd1.text.slice(0, 100)));
  }
  console.log("  [completions] prefix=" + _0x15233f.length + "b suffix=" + _0xa14bd.length + "b");
  if (_0x15233f.length > 0) {
    console.log("  [completions] prefix tail: " + JSON.stringify(_0x15233f.slice(-100)));
  }
  if (_0xa14bd.length > 0) {
    console.log("  [completions] suffix head: " + JSON.stringify(_0xa14bd.slice(0, 100)));
  }
  let _0x2e2045 = "";
  if (_0x15233f.length > 0) {
    _0x2e2045 = await callAnthropicAPI(_0x15233f, _0xa14bd);
  } else {
    console.log("  [completions] No code context found — skipping API call, returning empty");
  }
  const _0x5823fa = buildGetCompletionsResponse(_0x2e2045);
  const _0x4ed718 = wrapUnary(_0x5823fa);
  console.log("  [completions] Response: proto=" + _0x5823fa.length + "b" + (" gzip=" + _0x4ed718.length + "b") + (" completion=" + _0x2e2045.length + "b"));
  _0x2ae51a.writeHead(200, {
    ...unaryHeaders(),
    "content-length": _0x4ed718.length
  });
  _0x2ae51a.end(_0x4ed718);
}
