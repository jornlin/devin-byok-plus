import _0x9e05fd from "node:zlib";
export function gzipSync(_0x5dabf3) {
  return _0x9e05fd.gzipSync(_0x5dabf3);
}
export function gunzipSync(_0x4d9c44) {
  return _0x9e05fd.gunzipSync(_0x4d9c44);
}
export function tryGunzip(_0x504127) {
  try {
    return _0x9e05fd.gunzipSync(_0x504127);
  } catch {
    return null;
  }
}
export function wrapEnvelope(_0x73ef26, _0x596056 = true) {
  if (_0x596056) {
    const _0x40294d = gzipSync(_0x73ef26);
    const _0x5cbc47 = Buffer.alloc(5);
    _0x5cbc47[0] = 1;
    _0x5cbc47.writeUInt32BE(_0x40294d.length, 1);
    return Buffer.concat([_0x5cbc47, _0x40294d]);
  }
  const _0x4d2255 = Buffer.alloc(5);
  _0x4d2255[0] = 0;
  _0x4d2255.writeUInt32BE(_0x73ef26.length, 1);
  return Buffer.concat([_0x4d2255, _0x73ef26]);
}
export function endOfStreamEnvelope() {
  const _0x4d0355 = gzipSync(Buffer.from("{}"));
  const _0x363e0b = Buffer.alloc(5);
  _0x363e0b[0] = 3;
  _0x363e0b.writeUInt32BE(_0x4d0355.length, 1);
  return Buffer.concat([_0x363e0b, _0x4d0355]);
}
export function unwrapRequest(_0x4b2831, _0x24fbc2) {
  const _0x2c5f38 = _0x24fbc2["connect-content-encoding"] || _0x24fbc2["content-encoding"] || "";
  const _0x1e11f1 = _0x2c5f38.includes("gzip");
  let _0x3b6e50 = _0x4b2831;
  if (_0x1e11f1) {
    const _0x8b64fb = tryGunzip(_0x3b6e50);
    if (_0x8b64fb) {
      _0x3b6e50 = _0x8b64fb;
    }
  }
  if (_0x3b6e50.length > 5) {
    const _0x58d1bb = _0x3b6e50[0];
    const _0x56a317 = _0x3b6e50.readUInt32BE(1);
    if (_0x56a317 === _0x3b6e50.length - 5 && _0x58d1bb <= 1) {
      let _0x228782 = _0x3b6e50.slice(5);
      if (_0x58d1bb === 1) {
        const _0x524bca = tryGunzip(_0x228782);
        if (_0x524bca) {
          _0x228782 = _0x524bca;
        }
      }
      return _0x228782;
    }
  }
  return _0x3b6e50;
}
export function emptyResponse() {
  return gzipSync(Buffer.alloc(0));
}
export function wrapUnary(_0x416b8b) {
  return gzipSync(_0x416b8b);
}
export function unaryHeaders() {
  return {
    "content-type": "application/proto",
    "content-encoding": "gzip"
  };
}
export function streamHeaders() {
  return {
    "content-type": "application/connect+proto",
    "connect-content-encoding": "gzip",
    "transfer-encoding": "chunked"
  };
}
