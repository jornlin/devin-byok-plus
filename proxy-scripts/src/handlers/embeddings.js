import _0x10143c from "node:crypto";
import _0x3e491b from "node:https";
import { writeMessageField, writeBytesField, parseFields, getField, getAllFields } from "../proto.js";
import { wrapUnary, unaryHeaders, unwrapRequest, wrapEnvelope, endOfStreamEnvelope, streamHeaders, tryGunzip } from "../connect.js";
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || "";
const VOYAGE_MODEL = "voyage-3-lite";
const EMBEDDING_DIM = 512;
const VOYAGE_MAX_BATCH = 128;
function callVoyageAPI(_0x5f2453, _0x187539 = "document") {
  return new Promise((_0x359432, _0x2e0464) => {
    const _0x54f162 = {
      model: VOYAGE_MODEL,
      input: _0x5f2453,
      input_type: _0x187539
    };
    const _0x198a81 = JSON.stringify(_0x54f162);
    const _0x190ad8 = _0x3e491b.request({
      hostname: "api.voyageai.com",
      path: "/v1/embeddings",
      method: "POST",
      headers: {
        Authorization: "Bearer " + VOYAGE_API_KEY,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(_0x198a81)
      }
    }, _0x190421 => {
      const _0x53e843 = [];
      _0x190421.on("data", _0x2fb736 => _0x53e843.push(_0x2fb736));
      _0x190421.on("end", () => {
        try {
          const _0x4bada0 = Buffer.concat(_0x53e843).toString();
          const _0xfd34f6 = JSON.parse(_0x4bada0);
          if (_0xfd34f6.data) {
            const _0x6c7a67 = _0xfd34f6.data.sort((_0x558e2a, _0x13ace6) => _0x558e2a.index - _0x13ace6.index);
            _0x359432(_0x6c7a67.map(_0x64cffb => new Float32Array(_0x64cffb.embedding)));
          } else {
            _0x2e0464(new Error(_0xfd34f6.detail || _0xfd34f6.error?.message || "Unknown Voyage error"));
          }
        } catch (_0x211a34) {
          _0x2e0464(_0x211a34);
        }
      });
    });
    _0x190ad8.on("error", _0x2e0464);
    _0x190ad8.setTimeout(30000, () => {
      _0x190ad8.destroy();
      _0x2e0464(new Error("Voyage timeout"));
    });
    _0x190ad8.end(_0x198a81);
  });
}
async function getEmbeddings(_0x581359, _0x1b941a = 1) {
  const _0x230eaf = _0x1b941a === 2 ? "query" : "document";
  if (!VOYAGE_API_KEY) {
    return _0x581359.map(_0x15d135 => hashToEmbedding(_0x15d135));
  }
  try {
    if (_0x581359.length <= VOYAGE_MAX_BATCH) {
      return await callVoyageAPI(_0x581359, _0x230eaf);
    }
    const _0x359e8d = [];
    for (let _0x13c4ec = 0; _0x13c4ec < _0x581359.length; _0x13c4ec += VOYAGE_MAX_BATCH) {
      const _0x4caaab = _0x581359.slice(_0x13c4ec, _0x13c4ec + VOYAGE_MAX_BATCH);
      const _0x23010b = await callVoyageAPI(_0x4caaab, _0x230eaf);
      _0x359e8d.push(..._0x23010b);
    }
    return _0x359e8d;
  } catch (_0x217c3) {
    console.log("  ⚠️ Voyage API failed: " + _0x217c3.message + " — using hash fallback");
    return _0x581359.map(_0x47cc61 => hashToEmbedding(_0x47cc61));
  }
}
function hashToEmbedding(_0x4f322f) {
  const _0x8437f8 = _0x10143c.createHash("sha512").update(_0x4f322f).digest();
  const _0x3c71e6 = new Float32Array(EMBEDDING_DIM);
  let _0x52a40b = _0x8437f8;
  let _0x2f5d6f = 0;
  for (let _0x55c1d1 = 0; _0x55c1d1 < EMBEDDING_DIM; _0x55c1d1++) {
    if (_0x2f5d6f + 4 > _0x52a40b.length) {
      _0x52a40b = _0x10143c.createHash("sha512").update(_0x52a40b).update(Buffer.from([_0x55c1d1 & 255, _0x55c1d1 >> 8 & 255])).digest();
      _0x2f5d6f = 0;
    }
    const _0x114253 = _0x52a40b.readUInt32LE(_0x2f5d6f);
    _0x3c71e6[_0x55c1d1] = _0x114253 / 4294967295 * 2 - 1;
    _0x2f5d6f += 4;
  }
  let _0x5a2cbd = 0;
  for (let _0x4ead41 = 0; _0x4ead41 < EMBEDDING_DIM; _0x4ead41++) {
    _0x5a2cbd += _0x3c71e6[_0x4ead41] * _0x3c71e6[_0x4ead41];
  }
  _0x5a2cbd = Math.sqrt(_0x5a2cbd);
  if (_0x5a2cbd > 0) {
    for (let _0x765a3d = 0; _0x765a3d < EMBEDDING_DIM; _0x765a3d++) {
      _0x3c71e6[_0x765a3d] /= _0x5a2cbd;
    }
  }
  return _0x3c71e6;
}
function buildEmbeddingProto(_0x6ae2a7) {
  const _0x46f173 = _0x6ae2a7.length;
  const _0x27885d = Buffer.allocUnsafe(_0x46f173 * 4);
  for (let _0x3b6d69 = 0; _0x3b6d69 < _0x46f173; _0x3b6d69++) {
    _0x27885d.writeFloatLE(_0x6ae2a7[_0x3b6d69], _0x3b6d69 * 4);
  }
  return writeBytesField(1, _0x27885d);
}
function buildEmbeddingResponse(_0x22ed97) {
  const _0x3b8e71 = _0x22ed97.map(_0x1a63c1 => writeMessageField(1, buildEmbeddingProto(_0x1a63c1)));
  return Buffer.concat(_0x3b8e71);
}
function buildGetEmbeddingsResponse(_0x473d4c, _0x1d589a) {
  const _0xe4a813 = buildEmbeddingResponse(_0x473d4c);
  const _0x5c414f = Buffer.allocUnsafe(8);
  _0x5c414f.writeDoubleLE(_0x1d589a / 1000, 0);
  const _0x222cc1 = Buffer.concat([Buffer.from([17]), _0x5c414f]);
  return Buffer.concat([writeMessageField(1, _0xe4a813), _0x222cc1]);
}
function extractPrompts(_0x2e070d) {
  try {
    const _0x4e3745 = parseFields(_0x2e070d);
    const _0x33dba4 = getField(_0x4e3745, 1, 2);
    if (!_0x33dba4) {
      return {
        prompts: [""],
        prefix: 1
      };
    }
    const _0x53e0ed = parseFields(_0x33dba4.value);
    const _0x509159 = getAllFields(_0x53e0ed, 1).filter(_0x1cd1e6 => _0x1cd1e6.wireType === 2);
    const _0x52f1fe = getField(_0x53e0ed, 3, 0);
    const _0x32bcdd = _0x52f1fe ? _0x52f1fe.value : 1;
    const _0x254051 = {
      prompts: [""],
      prefix: _0x32bcdd
    };
    if (_0x509159.length === 0) {
      return _0x254051;
    }
    return {
      prompts: _0x509159.map(_0x422771 => _0x422771.value.toString("utf8")),
      prefix: _0x32bcdd
    };
  } catch {
    return {
      prompts: [""],
      prefix: 1
    };
  }
}
function parseEnvelopes(_0x384530) {
  const _0x451670 = [];
  let _0x58cc26 = 0;
  while (_0x58cc26 + 5 <= _0x384530.length) {
    const _0x39c48a = _0x384530[_0x58cc26];
    const _0x5bdaaf = _0x384530.readUInt32BE(_0x58cc26 + 1);
    _0x58cc26 += 5;
    if (_0x58cc26 + _0x5bdaaf > _0x384530.length) {
      break;
    }
    const _0x15712b = _0x384530.slice(_0x58cc26, _0x58cc26 + _0x5bdaaf);
    _0x58cc26 += _0x5bdaaf;
    if (_0x39c48a === 2 || _0x39c48a === 3) {
      continue;
    }
    let _0x2b3720 = _0x15712b;
    if (_0x39c48a === 1) {
      const _0x241407 = tryGunzip(_0x15712b);
      if (_0x241407) {
        _0x2b3720 = _0x241407;
      }
    }
    _0x451670.push(_0x2b3720);
  }
  return _0x451670;
}
export function handleGetEmbeddings(_0x27a2d3, _0x2efea9, _0x314225) {
  const _0xbfa0e6 = _0x27a2d3.headers["content-type"] || "";
  const _0x47a8f0 = _0xbfa0e6.includes("connect+proto");
  if (_0x47a8f0) {
    handleStreamingEmbeddings(_0x27a2d3, _0x2efea9, _0x314225);
  } else {
    handleUnaryEmbeddings(_0x27a2d3, _0x2efea9, _0x314225);
  }
}
async function handleUnaryEmbeddings(_0x58d712, _0x4f5643, _0x448b59) {
  let _0x588d53 = [""];
  let _0x4776e = 1;
  if (_0x448b59 && _0x448b59.length > 0) {
    try {
      const _0xa3cf95 = unwrapRequest(_0x448b59, _0x58d712.headers);
      const _0x1ff1b9 = extractPrompts(_0xa3cf95);
      _0x588d53 = _0x1ff1b9.prompts;
      _0x4776e = _0x1ff1b9.prefix;
    } catch (_0x51b961) {
      console.log("  🧮 Embeddings parse error: " + _0x51b961.message);
    }
  }
  const _0x11d267 = Date.now();
  const _0x55ae37 = await getEmbeddings(_0x588d53, _0x4776e);
  const _0x533d91 = Date.now() - _0x11d267;
  console.log("  🧮 Embeddings (unary): " + _0x588d53.length + " texts → Voyage " + _0x533d91 + "ms, first=\"" + (_0x588d53[0]?.slice(0, 60) || "") + "\"");
  const _0x252c5e = buildGetEmbeddingsResponse(_0x55ae37, _0x533d91);
  const _0x149ed3 = wrapUnary(_0x252c5e);
  _0x4f5643.writeHead(200, {
    ...unaryHeaders(),
    "content-length": _0x149ed3.length
  });
  _0x4f5643.end(_0x149ed3);
}
async function handleStreamingEmbeddings(_0x16112f, _0x25e3ea, _0x10167b) {
  let _0x4753ef = [];
  if (_0x10167b && _0x10167b.length > 0) {
    let _0x40b129 = _0x10167b;
    const _0x603584 = _0x16112f.headers["content-encoding"] || "";
    if (_0x603584.includes("gzip")) {
      const _0x59f7c2 = tryGunzip(_0x40b129);
      if (_0x59f7c2) {
        _0x40b129 = _0x59f7c2;
      }
    }
    _0x4753ef = parseEnvelopes(_0x40b129);
  }
  console.log("  🧮 Embeddings (stream): " + _0x4753ef.length + " request frames");
  _0x25e3ea.writeHead(200, streamHeaders());
  for (const _0x1b0996 of _0x4753ef) {
    const {
      prompts: _0x3bd80b,
      prefix: _0x2bfbc4
    } = extractPrompts(_0x1b0996);
    const _0x421c58 = Date.now();
    const _0x5a199c = await getEmbeddings(_0x3bd80b, _0x2bfbc4);
    const _0x3dae56 = Date.now() - _0x421c58;
    console.log("  🧮   Frame: " + _0x3bd80b.length + " texts → Voyage " + _0x3dae56 + "ms");
    const _0x20f14b = buildGetEmbeddingsResponse(_0x5a199c, _0x3dae56);
    _0x25e3ea.write(wrapEnvelope(_0x20f14b));
  }
  if (_0x4753ef.length === 0) {
    const _0x26f0cc = await getEmbeddings([""], 1);
    const _0x42f36a = buildGetEmbeddingsResponse(_0x26f0cc, 1);
    _0x25e3ea.write(wrapEnvelope(_0x42f36a));
  }
  _0x25e3ea.write(endOfStreamEnvelope());
  _0x25e3ea.end();
}
