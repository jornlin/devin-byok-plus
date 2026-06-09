import _0xedaa8b from "node:crypto";
const WS_PORT_OFFSET = 100;
let clients = new Set();
let injectedMessages = [];
let activeMonitorTargetId = "default";
let activeMonitorTargetBroadcastAt = 0;
function encodeFrame(_0x28b7eb) {
  const _0x22e584 = typeof _0x28b7eb === "string" ? Buffer.from(_0x28b7eb) : _0x28b7eb;
  const _0x380dd2 = _0x22e584.length;
  let _0x2db431;
  if (_0x380dd2 < 126) {
    _0x2db431 = Buffer.alloc(2);
    _0x2db431[0] = 129;
    _0x2db431[1] = _0x380dd2;
  } else if (_0x380dd2 < 65536) {
    _0x2db431 = Buffer.alloc(4);
    _0x2db431[0] = 129;
    _0x2db431[1] = 126;
    _0x2db431.writeUInt16BE(_0x380dd2, 2);
  } else {
    _0x2db431 = Buffer.alloc(10);
    _0x2db431[0] = 129;
    _0x2db431[1] = 127;
    _0x2db431.writeBigUInt64BE(BigInt(_0x380dd2), 2);
  }
  return Buffer.concat([_0x2db431, _0x22e584]);
}
function decodeFrame(_0x1a136b) {
  if (_0x1a136b.length < 2) {
    return null;
  }
  const _0x2dc29e = (_0x1a136b[1] & 128) !== 0;
  let _0x40c8d3 = _0x1a136b[1] & 127;
  let _0x5b68c4 = 2;
  if (_0x40c8d3 === 126) {
    if (_0x1a136b.length < 4) {
      return null;
    }
    _0x40c8d3 = _0x1a136b.readUInt16BE(2);
    _0x5b68c4 = 4;
  } else if (_0x40c8d3 === 127) {
    if (_0x1a136b.length < 10) {
      return null;
    }
    _0x40c8d3 = Number(_0x1a136b.readBigUInt64BE(2));
    _0x5b68c4 = 10;
  }
  if (_0x2dc29e) {
    if (_0x1a136b.length < _0x5b68c4 + 4 + _0x40c8d3) {
      return null;
    }
    const _0x44ceb3 = _0x1a136b.subarray(_0x5b68c4, _0x5b68c4 + 4);
    _0x5b68c4 += 4;
    const _0x163086 = _0x1a136b.subarray(_0x5b68c4, _0x5b68c4 + _0x40c8d3);
    for (let _0x89d448 = 0; _0x89d448 < _0x163086.length; _0x89d448++) {
      _0x163086[_0x89d448] ^= _0x44ceb3[_0x89d448 & 3];
    }
    return _0x163086.toString("utf8");
  }
  return _0x1a136b.subarray(_0x5b68c4, _0x5b68c4 + _0x40c8d3).toString("utf8");
}
export function startWSBridge(_0x29354e) {
  _0x29354e.on("upgrade", (_0x19e08b, _0x22b2a0, _0x1f57ee) => {
    if (_0x19e08b.url !== "/ws/bridge") {
      _0x22b2a0.destroy();
      return;
    }
    const _0x27cd15 = _0x19e08b.headers["sec-websocket-key"];
    if (!_0x27cd15) {
      _0x22b2a0.destroy();
      return;
    }
    const _0x4afba2 = _0xedaa8b.createHash("sha1").update(_0x27cd15 + "258EAFA5-E914-47DA-95CA-5AB5A3DF5B7A").digest("base64");
    _0x22b2a0.setTimeout(0);
    _0x22b2a0.setNoDelay(true);
    _0x22b2a0.setKeepAlive(true, 30000);
    _0x22b2a0.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" + ("Sec-WebSocket-Accept: " + _0x4afba2 + "\r\n") + "\r\n");
    clients.add(_0x22b2a0);
    console.log("[WS Bridge] Client connected (" + clients.size + " active)");
    try {
      _0x22b2a0.write(encodeFrame(JSON.stringify({
        type: "connected",
        injectedQueueSize: injectedMessages.length
      })));
    } catch {}
    function _0x5edba1(_0x46f6a6) {
      if (_0x46f6a6.length < 2) {
        return;
      }
      const _0x1fc579 = _0x46f6a6[0] & 15;
      if (_0x1fc579 === 9) {
        const _0x26ddee = Buffer.alloc(2);
        _0x26ddee[0] = 138;
        _0x26ddee[1] = 0;
        try {
          _0x22b2a0.write(_0x26ddee);
        } catch {}
        return;
      }
      if (_0x1fc579 === 8) {
        clients.delete(_0x22b2a0);
        try {
          const _0x5d4ddd = Buffer.alloc(2);
          _0x5d4ddd[0] = 136;
          _0x5d4ddd[1] = 0;
          _0x22b2a0.write(_0x5d4ddd);
        } catch {}
        _0x22b2a0.end();
        return;
      }
      if (_0x1fc579 === 1) {
        try {
          const _0x21a140 = decodeFrame(_0x46f6a6);
          if (!_0x21a140) {
            return;
          }
          const _0x3db663 = JSON.parse(_0x21a140);
          handleClientMessage(_0x3db663);
        } catch {}
      }
    }
    if (_0x1f57ee && _0x1f57ee.length > 0) {
      _0x5edba1(_0x1f57ee);
    }
    _0x22b2a0.on("data", _0x5edba1);
    _0x22b2a0.on("close", () => {
      clients.delete(_0x22b2a0);
      console.log("[WS Bridge] Client disconnected (" + clients.size + " active)");
    });
    _0x22b2a0.on("error", _0x12f9ed => {
      console.log("[WS Bridge] Socket error: " + _0x12f9ed.message);
      clients.delete(_0x22b2a0);
    });
  });
  console.log("[WS Bridge] Listening on ws://localhost (upgrade on same port, path=/ws/bridge)");
}
export function broadcast(_0x326616) {
  if (clients.size === 0) {
    return;
  }
  const _0x53fe93 = encodeFrame(JSON.stringify(_0x326616));
  for (const _0x1d1ecc of clients) {
    try {
      _0x1d1ecc.write(_0x53fe93);
    } catch {
      clients.delete(_0x1d1ecc);
    }
  }
}
function monitorTarget(_0x104b96) {
  return queueKey(_0x104b96 || activeMonitorTargetId);
}
export function setActiveMonitorTarget(_0x4ebbe9) {
  const _0x94049 = queueKey(_0x4ebbe9);
  const _0x1c827f = Date.now();
  const _0x5a3ff0 = _0x94049 !== activeMonitorTargetId;
  activeMonitorTargetId = _0x94049;
  if (_0x5a3ff0 || _0x1c827f - activeMonitorTargetBroadcastAt > 3000) {
    activeMonitorTargetBroadcastAt = _0x1c827f;
    const _0x2c64ba = {
      type: "active_target",
      ts: _0x1c827f,
      targetId: activeMonitorTargetId
    };
    broadcast(_0x2c64ba);
  }
  return activeMonitorTargetId;
}
export function getActiveMonitorTarget() {
  return activeMonitorTargetId;
}
export function emitToolCall(_0x56f006, _0x4b7440, _0x28b8c9, _0x48856b = null) {
  broadcast({
    type: "tool_call",
    ts: Date.now(),
    targetId: monitorTarget(_0x48856b),
    tool: _0x56f006,
    args: typeof _0x4b7440 === "string" ? _0x4b7440.slice(0, 2000) : JSON.stringify(_0x4b7440).slice(0, 2000),
    callId: _0x28b8c9
  });
}
export function emitToolResult(_0x57fb6f, _0x230a23, _0x491b67) {
  broadcast({
    type: "tool_result",
    ts: Date.now(),
    tool: _0x57fb6f,
    result: typeof _0x230a23 === "string" ? _0x230a23.slice(0, 2000) : JSON.stringify(_0x230a23).slice(0, 2000),
    callId: _0x491b67
  });
}
export function emitAIText(_0x7cf340, _0x5d474b = false, _0x54a271 = null) {
  broadcast({
    type: "ai_text",
    ts: Date.now(),
    targetId: monitorTarget(_0x54a271),
    text: _0x7cf340.slice(0, 3000),
    partial: _0x5d474b
  });
}
export function emitChatStart(_0x1e3cfc, _0x79e304, _0x475894, _0x4f5704 = null) {
  broadcast({
    type: "chat_start",
    ts: Date.now(),
    targetId: monitorTarget(_0x4f5704),
    model: _0x1e3cfc,
    messages: _0x79e304,
    tools: _0x475894
  });
}
export function emitChatEnd(_0x369be8, _0x23ea5f, _0x5a2180 = null) {
  broadcast({
    type: "chat_end",
    ts: Date.now(),
    targetId: monitorTarget(_0x5a2180),
    stopReason: _0x369be8,
    toolsCalled: _0x23ea5f || []
  });
}
export function emitStreamStatus(_0x467229, _0x36fdf4, _0x4da32a = null) {
  if (_0x467229 === "timing" && process.env.PROXY_MONITOR_TIMING !== "1") {
    return;
  }
  broadcast({
    type: "status",
    ts: Date.now(),
    targetId: monitorTarget(_0x4da32a),
    status: _0x467229,
    detail: _0x36fdf4
  });
}
const chatQueues = new Map();
const chatQueueInFlight = new Map();
function queueKey(_0x238d57) {
  return _0x238d57 || "default";
}
function getQueue(_0x5dfd6c) {
  const _0x41f5b1 = queueKey(_0x5dfd6c);
  if (!chatQueues.has(_0x41f5b1)) {
    chatQueues.set(_0x41f5b1, []);
  }
  return chatQueues.get(_0x41f5b1);
}
export function pushChatQueue(_0x2b354f, _0x571d3a = false, _0x1663fc = null) {
  const _0x78ba2a = Date.now() + "-" + Math.random().toString(16).slice(2);
  const _0xeeaa5c = queueKey(_0x1663fc);
  const _0x3ae4e0 = getQueue(_0xeeaa5c);
  _0x3ae4e0.push({
    id: _0x78ba2a,
    text: _0x2b354f,
    hasImage: _0x571d3a,
    targetId: _0xeeaa5c,
    ts: Date.now()
  });
  console.log("[WS Bridge] Chat queue push target=" + _0xeeaa5c + " (" + _0x3ae4e0.length + " pending): " + (_0x2b354f || "").slice(0, 60));
}
export function getChatQueue(_0x251740 = null) {
  const _0x223e28 = queueKey(_0x251740);
  const _0x1f1d18 = chatQueueInFlight.get(_0x223e28);
  if (_0x1f1d18 && Date.now() - (_0x1f1d18.claimedAt || 0) > 15000) {
    console.log("[WS Bridge] Chat queue claim expired target=" + _0x223e28 + ", releasing in-flight message");
    chatQueueInFlight.delete(_0x223e28);
  }
  if (chatQueueInFlight.has(_0x223e28)) {
    return {
      pending: false
    };
  }
  const _0x2cd25d = getQueue(_0x223e28);
  if (_0x2cd25d.length === 0) {
    return {
      pending: false
    };
  }
  const _0x3d0807 = {
    ..._0x2cd25d[0],
    claimedAt: Date.now()
  };
  chatQueueInFlight.set(_0x223e28, _0x3d0807);
  const _0x582260 = {
    pending: true,
    message: _0x3d0807
  };
  return _0x582260;
}
function handleClientMessage(_0x784b4d) {
  if (_0x784b4d.type === "inject") {
    injectedMessages.push({
      role: _0x784b4d.role || "user",
      content: _0x784b4d.content || "",
      ts: Date.now()
    });
    console.log("[WS Bridge] Queued injected message (" + injectedMessages.length + " pending): " + (_0x784b4d.content || "").slice(0, 80));
    broadcast({
      type: "inject_ack",
      queueSize: injectedMessages.length
    });
  }
  if (_0x784b4d.type === "clear_queue") {
    injectedMessages = [];
    broadcast({
      type: "inject_ack",
      queueSize: 0
    });
  }
  if (_0x784b4d.type === "push_chat_queue") {
    pushChatQueue(_0x784b4d.text || "", !!_0x784b4d.hasImage, _0x784b4d.targetId || null);
    broadcast({
      type: "inject_ack",
      queueSize: getQueue(_0x784b4d.targetId || null).length,
      targetId: queueKey(_0x784b4d.targetId || null)
    });
  }
}
export function consumeInjectedMessages() {
  if (injectedMessages.length === 0) {
    return [];
  }
  const _0x25f7fc = [...injectedMessages];
  injectedMessages = [];
  console.log("[WS Bridge] Consuming " + _0x25f7fc.length + " injected message(s)");
  return _0x25f7fc;
}
export function hasInjectedMessages() {
  return injectedMessages.length > 0;
}
export function ackChatQueue(_0x272711, _0x5ca2a4 = null) {
  const _0x2aaa82 = queueKey(_0x5ca2a4);
  const _0x399a34 = chatQueueInFlight.get(_0x2aaa82);
  if (_0x399a34 && (!_0x272711 || _0x399a34.id === _0x272711)) {
    const _0x4ae655 = getQueue(_0x2aaa82);
    _0x4ae655.shift();
    chatQueueInFlight.delete(_0x2aaa82);
    console.log("[WS Bridge] Chat queue ack target=" + _0x2aaa82 + " (" + _0x4ae655.length + " remaining)");
  }
}
