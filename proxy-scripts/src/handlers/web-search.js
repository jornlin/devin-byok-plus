import _0x372a8a from "node:https";
import _0x5f0373 from "node:http";
import _0x9f70ff from "node:crypto";
import { URL } from "node:url";
import { writeStringField, writeVarintField, writeMessageField, parseFields, getField } from "../proto.js";
import { wrapUnary, unaryHeaders, unwrapRequest } from "../connect.js";
function searchDuckDuckGo(_0x2f644f, _0x3e8847 = 8) {
  return new Promise((_0x5567b1, _0x155c25) => {
    const _0x1fe5a2 = "q=" + encodeURIComponent(_0x2f644f);
    const _0x352f62 = _0x372a8a.request({
      hostname: "html.duckduckgo.com",
      path: "/html/",
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "content-length": Buffer.byteLength(_0x1fe5a2),
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      }
    }, _0x412028 => {
      let _0x115ccd = "";
      _0x412028.setEncoding("utf8");
      _0x412028.on("data", _0x21c343 => _0x115ccd += _0x21c343);
      _0x412028.on("end", () => {
        try {
          const _0x3d362c = parseDDGResults(_0x115ccd, _0x3e8847);
          _0x5567b1(_0x3d362c);
        } catch (_0x4fedd0) {
          _0x155c25(_0x4fedd0);
        }
      });
    });
    _0x352f62.on("error", _0x155c25);
    _0x352f62.setTimeout(10000, () => {
      _0x352f62.destroy();
      _0x155c25(new Error("DDG timeout"));
    });
    _0x352f62.end(_0x1fe5a2);
  });
}
function parseDDGResults(_0x58d6d0, _0x295c49) {
  const _0x14cbc0 = [];
  const _0x3a5fe4 = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const _0x5d3a9a = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const _0x52a7ea = [];
  let _0x270e41;
  while ((_0x270e41 = _0x3a5fe4.exec(_0x58d6d0)) !== null) {
    const _0x33be58 = {
      url: _0x270e41[1],
      rawTitle: _0x270e41[2]
    };
    _0x52a7ea.push(_0x33be58);
  }
  const _0x1ad54b = [];
  while ((_0x270e41 = _0x5d3a9a.exec(_0x58d6d0)) !== null) {
    _0x1ad54b.push(_0x270e41[1]);
  }
  for (let _0x192aee = 0; _0x192aee < _0x52a7ea.length && _0x14cbc0.length < _0x295c49; _0x192aee++) {
    let {
      url: _0x19e8a9,
      rawTitle: _0xcbca49
    } = _0x52a7ea[_0x192aee];
    const _0x1fb14d = _0x19e8a9.match(/uddg=([^&]+)/);
    if (_0x1fb14d) {
      _0x19e8a9 = decodeURIComponent(_0x1fb14d[1]);
    }
    const _0xa17cba = stripHtml(_0xcbca49);
    const _0x102ec4 = _0x192aee < _0x1ad54b.length ? stripHtml(_0x1ad54b[_0x192aee]) : "";
    if (_0x19e8a9 && _0xa17cba && !_0x19e8a9.startsWith("/") && _0x19e8a9.startsWith("http")) {
      let _0x2df0ec = "";
      try {
        const _0x1de62a = new URL(_0x19e8a9);
        _0x2df0ec = "https://www.google.com/s2/favicons?domain=" + _0x1de62a.hostname + "&sz=32";
      } catch {}
      const _0x4f5975 = {
        title: _0xa17cba,
        url: _0x19e8a9,
        snippet: _0x102ec4,
        faviconUrl: _0x2df0ec
      };
      _0x14cbc0.push(_0x4f5975);
    }
  }
  return _0x14cbc0;
}
function stripHtml(_0x39072b) {
  return _0x39072b.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function resolveRedirectUrl(_0x3a830f, _0x483ca7 = 5) {
  return new Promise((_0x1de237, _0x37a4db) => {
    if (_0x483ca7 <= 0) {
      return _0x1de237(_0x3a830f);
    }
    if (!isAllowedUrl(_0x3a830f)) {
      return _0x1de237(_0x3a830f);
    }
    const _0x2ad638 = new URL(_0x3a830f);
    const _0x41d7bb = _0x2ad638.protocol === "https:" ? _0x372a8a : _0x5f0373;
    const _0x4f6522 = _0x41d7bb.request({
      hostname: _0x2ad638.hostname,
      port: _0x2ad638.port || (_0x2ad638.protocol === "https:" ? 443 : 80),
      path: _0x2ad638.pathname + _0x2ad638.search,
      method: "HEAD",
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      }
    }, _0x3da2ef => {
      _0x3da2ef.resume();
      if (_0x3da2ef.statusCode >= 300 && _0x3da2ef.statusCode < 400 && _0x3da2ef.headers.location) {
        const _0x2c9997 = new URL(_0x3da2ef.headers.location, _0x3a830f).toString();
        resolveRedirectUrl(_0x2c9997, _0x483ca7 - 1).then(_0x1de237, _0x37a4db);
      } else {
        _0x1de237(_0x3a830f);
      }
    });
    _0x4f6522.on("error", () => _0x1de237(_0x3a830f));
    _0x4f6522.setTimeout(5000, () => {
      _0x4f6522.destroy();
      _0x1de237(_0x3a830f);
    });
    _0x4f6522.end();
  });
}
function isAllowedUrl(_0x45014a) {
  try {
    const _0x4fef57 = new URL(_0x45014a);
    if (_0x4fef57.protocol !== "http:" && _0x4fef57.protocol !== "https:") {
      return false;
    }
    const _0x39f396 = _0x4fef57.hostname.toLowerCase();
    if (_0x39f396 === "localhost" || _0x39f396 === "127.0.0.1" || _0x39f396 === "::1" || _0x39f396 === "0.0.0.0") {
      return false;
    }
    if (/^0\./.test(_0x39f396)) {
      return false;
    }
    if (/^10\./.test(_0x39f396)) {
      return false;
    }
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(_0x39f396)) {
      return false;
    }
    if (/^192\.168\./.test(_0x39f396)) {
      return false;
    }
    if (/^169\.254\./.test(_0x39f396)) {
      return false;
    }
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(_0x39f396)) {
      return false;
    }
    if (/^fc00:/i.test(_0x39f396) || /^fe80:/i.test(_0x39f396) || /^fd/i.test(_0x39f396)) {
      return false;
    }
    if (_0x39f396 === "[::1]" || _0x39f396 === "[::]") {
      return false;
    }
    if (_0x39f396.endsWith(".local") || _0x39f396.endsWith(".internal") || _0x39f396.endsWith(".localhost")) {
      return false;
    }
    if (_0x39f396 === "metadata.google.internal" || _0x39f396 === "169.254.169.254") {
      return false;
    }
    if (_0x4fef57.port && ["22", "23", "25", "3306", "5432", "6379", "27017"].includes(_0x4fef57.port)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
function fetchUrlContent(_0x12446b, _0x17051e = 50000) {
  return new Promise((_0x20d8e5, _0x50f6c5) => {
    if (!isAllowedUrl(_0x12446b)) {
      return _0x50f6c5(new Error("Blocked URL (private/internal): " + _0x12446b));
    }
    const _0x1fd050 = new URL(_0x12446b);
    const _0x563f05 = _0x1fd050.protocol === "https:" ? _0x372a8a : _0x5f0373;
    const _0x28a6c3 = _0x563f05.request({
      hostname: _0x1fd050.hostname,
      port: _0x1fd050.port || (_0x1fd050.protocol === "https:" ? 443 : 80),
      path: _0x1fd050.pathname + _0x1fd050.search,
      method: "GET",
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    }, _0xc41b6c => {
      if (_0xc41b6c.statusCode >= 300 && _0xc41b6c.statusCode < 400 && _0xc41b6c.headers.location) {
        const _0x165cdb = new URL(_0xc41b6c.headers.location, _0x12446b).toString();
        _0xc41b6c.resume();
        if (!isAllowedUrl(_0x165cdb)) {
          return _0x50f6c5(new Error("Redirect to private/internal URL blocked: " + _0x165cdb));
        }
        return fetchUrlContent(_0x165cdb, _0x17051e).then(_0x20d8e5, _0x50f6c5);
      }
      let _0x386c73 = "";
      let _0x4a769e = 0;
      _0xc41b6c.setEncoding("utf8");
      _0xc41b6c.on("data", _0x52b247 => {
        _0x4a769e += Buffer.byteLength(_0x52b247);
        if (_0x4a769e <= _0x17051e) {
          _0x386c73 += _0x52b247;
        }
      });
      _0xc41b6c.on("end", () => {
        const _0x4d1bb0 = _0x386c73.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim().slice(0, 30000);
        _0x20d8e5(_0x4d1bb0);
      });
    });
    _0x28a6c3.on("error", _0x50f6c5);
    _0x28a6c3.setTimeout(15000, () => {
      _0x28a6c3.destroy();
      _0x50f6c5(new Error("Fetch timeout"));
    });
    _0x28a6c3.end();
  });
}
function buildKnowledgeBaseItem(_0x38d8d6) {
  const _0x3303e8 = [writeStringField(1, _0x38d8d6.identifier || _0x9f70ff.randomUUID()), writeStringField(2, _0x38d8d6.content || _0x38d8d6.snippet || ""), writeStringField(3, _0x38d8d6.url), writeStringField(4, _0x38d8d6.title), writeStringField(7, _0x38d8d6.snippet || "")];
  return Buffer.concat(_0x3303e8);
}
function buildSearchResponse(_0x54b333, _0x3f83ad) {
  const _0x441b54 = _0x54b333.map(_0x19bda1 => writeMessageField(1, buildKnowledgeBaseItem(_0x19bda1)));
  _0x441b54.push(writeStringField(2, "https://duckduckgo.com/?q=" + encodeURIComponent(_0x3f83ad)));
  return Buffer.concat(_0x441b54);
}
function buildRedirectResponse(_0x4ba5b7) {
  return writeStringField(1, _0x4ba5b7);
}
function sendProtoResponse(_0x290c90, _0x56f1fa, _0x418da1) {
  const _0x30f699 = wrapUnary(_0x418da1);
  _0x56f1fa.writeHead(200, {
    ...unaryHeaders(),
    "content-length": _0x30f699.length
  });
  _0x56f1fa.end(_0x30f699);
}
export function handleGetWebSearchResults(_0x2d96a9, _0xcab5a9, _0x2e9c95) {
  const _0x4a1b37 = _0x2d96a9.headers;
  console.log("  🔍 WebSearch headers: accept-enc=\"" + (_0x4a1b37["accept-encoding"] || "") + "\" connect-accept-enc=\"" + (_0x4a1b37["connect-accept-encoding"] || "") + "\" content-enc=\"" + (_0x4a1b37["content-encoding"] || "") + "\"");
  let _0x540fa2 = "";
  if (_0x2e9c95 && _0x2e9c95.length > 0) {
    try {
      const _0x1c2d09 = unwrapRequest(_0x2e9c95, _0x4a1b37);
      const _0x531593 = parseFields(_0x1c2d09);
      const _0x54239e = getField(_0x531593, 2, 2);
      if (_0x54239e) {
        _0x540fa2 = _0x54239e.value.toString("utf8");
      }
    } catch (_0x5d00b6) {
      console.log("  🔍 WebSearch parse error: " + _0x5d00b6.message);
    }
  }
  if (!_0x540fa2) {
    console.log("  🔍 WebSearch: empty query");
    return sendProtoResponse(_0x2d96a9, _0xcab5a9, Buffer.alloc(0));
  }
  console.log("  🔍 WebSearch: \"" + _0x540fa2 + "\"");
  searchDuckDuckGo(_0x540fa2).then(async _0x3ec8c1 => {
    console.log("  🔍 WebSearch: " + _0x3ec8c1.length + " results for \"" + _0x540fa2 + "\"");
    const _0x5dcde5 = _0x3ec8c1.slice(0, 5).map(_0x558ed2 => fetchUrlContent(_0x558ed2.url).then(_0x1a7df5 => {
      _0x558ed2.content = _0x1a7df5;
    }).catch(() => {}));
    await Promise.allSettled(_0x5dcde5);
    const _0x3d1067 = buildSearchResponse(_0x3ec8c1, _0x540fa2);
    console.log("  🔍 WebSearch response: " + _0x3d1067.length + "b, " + _0x3ec8c1.length + " results");
    sendProtoResponse(_0x2d96a9, _0xcab5a9, _0x3d1067);
  }).catch(_0x5df9f5 => {
    console.error("  ❌ WebSearch error: " + _0x5df9f5.message);
    sendProtoResponse(_0x2d96a9, _0xcab5a9, Buffer.alloc(0));
  });
}
export function handleGetWebSearchRedirect(_0x31a09c, _0x162e03, _0x47fb51) {
  let _0x3294fb = "";
  if (_0x47fb51 && _0x47fb51.length > 0) {
    try {
      const _0x5bc2d0 = unwrapRequest(_0x47fb51, _0x31a09c.headers);
      const _0x2ab7a0 = parseFields(_0x5bc2d0);
      const _0x52cdde = getField(_0x2ab7a0, 1, 2);
      if (_0x52cdde) {
        _0x3294fb = _0x52cdde.value.toString("utf8");
      }
    } catch (_0x12d9fb) {
      console.log("  🔍 WebRedirect parse error: " + _0x12d9fb.message);
    }
  }
  if (!_0x3294fb) {
    console.log("  🔍 WebRedirect: empty URL");
    return sendProtoResponse(_0x31a09c, _0x162e03, Buffer.alloc(0));
  }
  console.log("  🔍 WebRedirect: " + _0x3294fb);
  resolveRedirectUrl(_0x3294fb).then(_0x4f627c => {
    console.log("  🔍 WebRedirect: " + _0x3294fb + " → " + _0x4f627c);
    sendProtoResponse(_0x31a09c, _0x162e03, buildRedirectResponse(_0x4f627c));
  }).catch(_0x655610 => {
    console.error("  ❌ WebRedirect error: " + _0x655610.message);
    sendProtoResponse(_0x31a09c, _0x162e03, buildRedirectResponse(_0x3294fb));
  });
}
