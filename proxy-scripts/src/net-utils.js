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
export function getLoopbackListenHosts(_0xbindHost) {
  const _0xhost = String(_0xbindHost ?? process.env.BIND_HOST ?? "127.0.0.1").trim();
  if (_0xhost && _0xhost !== "127.0.0.1") {
    return [_0xhost];
  }
  return ["127.0.0.1", "::1"];
}
export function listenHttpOnLoopback(_0xcreateServer, _0xport, _0xbindHost, _0xonReady, _0xonError) {
  const _0xhosts = getLoopbackListenHosts(_0xbindHost);
  if (_0xhosts.length === 1) {
    const _0xserver = _0xcreateServer(true);
    _0xserver.listen(_0xport, _0xhosts[0], _0xonReady);
    if (_0xonError) {
      _0xserver.on("error", _0xonError);
    }
    return _0xserver;
  }
  let _0xpending = _0xhosts.length;
  let _0xprimary = null;
  const _0xdone = () => {
    _0xpending -= 1;
    if (_0xpending === 0 && _0xonReady) {
      _0xonReady();
    }
  };
  for (let _0xi = 0; _0xi < _0xhosts.length; _0xi++) {
    const _0xserver = _0xcreateServer(_0xi === 0);
    if (_0xi === 0) {
      _0xprimary = _0xserver;
    }
    if (_0xonError) {
      _0xserver.on("error", _0xonError);
    }
    _0xserver.listen(_0xport, _0xhosts[_0xi], _0xdone);
  }
  return _0xprimary;
}
export function loopbackApiUrl(_0xport) {
  return "http://127.0.0.1:" + _0xport;
}
