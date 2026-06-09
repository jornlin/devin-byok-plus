export function stripProtocol(_0x14df4f) {
  return _0x14df4f.replace(/^https?:\/\//, "");
}
export function parseHost(_0x42803b) {
  const _0xf8f932 = _0x42803b.split(":");
  if (_0xf8f932.length >= 2 && /^\d+$/.test(_0xf8f932[_0xf8f932.length - 1])) {
    return {
      hostname: _0xf8f932.slice(0, -1).join(":"),
      port: parseInt(_0xf8f932[_0xf8f932.length - 1], 10)
    };
  }
  const _0x3d7225 = {
    hostname: _0x42803b,
    port: 443
  };
  return _0x3d7225;
}
export function isLocalTarget(_0x591d92) {
  const _0x1ad909 = stripProtocol(_0x591d92).toLowerCase();
  const _0x165e59 = _0x1ad909.replace(/:\d+$/, "");
  if (_0x165e59 === "127.0.0.1" || _0x165e59 === "localhost" || _0x165e59 === "0.0.0.0" || _0x165e59 === "::1" || _0x165e59 === "[::1]") {
    return true;
  }
  const _0x237cae = parseHost(_0x1ad909);
  return _0x237cae.port !== 443 && _0x237cae.port !== 80 && /:\d+$/.test(_0x1ad909);
}
