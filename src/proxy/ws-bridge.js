import crypto from "node:crypto";
const WS_PORT_OFFSET = 100;
let clients = new Set();
let injectedMessages = [];
let activeMonitorTargetId = "default";
let activeMonitorTargetBroadcastAt = 0;
function encodeFrame(arg0) {
  const tmp1 = typeof arg0 === "string" ? Buffer.from(arg0) : arg0;
  const tmp2 = tmp1.length;
  let tmp3;
  if (tmp2 < 126) {
    tmp3 = Buffer.alloc(2);
    tmp3[0] = 129;
    tmp3[1] = tmp2;
  } else if (tmp2 < 65536) {
    tmp3 = Buffer.alloc(4);
    tmp3[0] = 129;
    tmp3[1] = 126;
    tmp3.writeUInt16BE(tmp2, 2);
  } else {
    tmp3 = Buffer.alloc(10);
    tmp3[0] = 129;
    tmp3[1] = 127;
    tmp3.writeBigUInt64BE(BigInt(tmp2), 2);
  }
  return Buffer.concat([tmp3, tmp1]);
}
function decodeFrame(arg0) {
  if (arg0.length < 2) {
    return null;
  }
  const tmp1 = (arg0[1] & 128) !== 0;
  let tmp2 = arg0[1] & 127;
  let tmp3 = 2;
  if (tmp2 === 126) {
    if (arg0.length < 4) {
      return null;
    }
    tmp2 = arg0.readUInt16BE(2);
    tmp3 = 4;
  } else if (tmp2 === 127) {
    if (arg0.length < 10) {
      return null;
    }
    tmp2 = Number(arg0.readBigUInt64BE(2));
    tmp3 = 10;
  }
  if (tmp1) {
    if (arg0.length < tmp3 + 4 + tmp2) {
      return null;
    }
    const tmp0 = arg0.subarray(tmp3, tmp3 + 4);
    tmp3 += 4;
    const tmp12 = arg0.subarray(tmp3, tmp3 + tmp2);
    for (let tmp02 = 0; tmp02 < tmp12.length; tmp02++) {
      tmp12[tmp02] ^= tmp0[tmp02 & 3];
    }
    return tmp12.toString("utf8");
  }
  return arg0.subarray(tmp3, tmp3 + tmp2).toString("utf8");
}
export function startWSBridge(arg0) {
  arg0.on("upgrade", (arg02, arg1, arg2) => {
    if (arg02.url !== "/ws/bridge") {
      arg1.destroy();
      return;
    }
    const tmp3 = arg02.headers["sec-websocket-key"];
    if (!tmp3) {
      arg1.destroy();
      return;
    }
    const tmp4 = crypto.createHash("sha1").update(tmp3 + "258EAFA5-E914-47DA-95CA-5AB5A3DF5B7A").digest("base64");
    arg1.setTimeout(0);
    arg1.setNoDelay(true);
    arg1.setKeepAlive(true, 30000);
    arg1.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" + ("Sec-WebSocket-Accept: " + tmp4 + "\r\n") + "\r\n");
    clients.add(arg1);
    console.log("[WS Bridge] Client connected (" + clients.size + " active)");
    try {
      arg1.write(encodeFrame(JSON.stringify({
        type: "connected",
        injectedQueueSize: injectedMessages.length
      })));
    } catch {}
    function fn(arg03) {
      if (arg03.length < 2) {
        return;
      }
      const tmp1 = arg03[0] & 15;
      if (tmp1 === 9) {
        const tmp0 = Buffer.alloc(2);
        tmp0[0] = 138;
        tmp0[1] = 0;
        try {
          arg1.write(tmp0);
        } catch {}
        return;
      }
      if (tmp1 === 8) {
        clients.delete(arg1);
        try {
          const tmp0 = Buffer.alloc(2);
          tmp0[0] = 136;
          tmp0[1] = 0;
          arg1.write(tmp0);
        } catch {}
        arg1.end();
        return;
      }
      if (tmp1 === 1) {
        try {
          const tmp0 = decodeFrame(arg03);
          if (!tmp0) {
            return;
          }
          const tmp12 = JSON.parse(tmp0);
          handleClientMessage(tmp12);
        } catch {}
      }
    }
    if (arg2 && arg2.length > 0) {
      fn(arg2);
    }
    arg1.on("data", fn);
    arg1.on("close", () => {
      clients.delete(arg1);
      console.log("[WS Bridge] Client disconnected (" + clients.size + " active)");
    });
    arg1.on("error", arg03 => {
      console.log("[WS Bridge] Socket error: " + arg03.message);
      clients.delete(arg1);
    });
  });
  console.log("[WS Bridge] Listening on ws://localhost (upgrade on same port, path=/ws/bridge)");
}
export function broadcast(arg0) {
  if (clients.size === 0) {
    return;
  }
  const tmp1 = encodeFrame(JSON.stringify(arg0));
  for (const tmp0 of clients) {
    try {
      tmp0.write(tmp1);
    } catch {
      clients.delete(tmp0);
    }
  }
}
function monitorTarget(arg0) {
  return queueKey(arg0 || activeMonitorTargetId);
}
export function setActiveMonitorTarget(arg0) {
  const tmp1 = queueKey(arg0);
  const tmp2 = Date.now();
  const tmp3 = tmp1 !== activeMonitorTargetId;
  activeMonitorTargetId = tmp1;
  if (tmp3 || tmp2 - activeMonitorTargetBroadcastAt > 3000) {
    activeMonitorTargetBroadcastAt = tmp2;
    const tmp0 = {
      type: "active_target",
      ts: tmp2,
      targetId: activeMonitorTargetId
    };
    broadcast(tmp0);
  }
  return activeMonitorTargetId;
}
export function getActiveMonitorTarget() {
  return activeMonitorTargetId;
}
export function emitToolCall(arg0, arg1, arg2, tmp3 = null) {
  broadcast({
    type: "tool_call",
    ts: Date.now(),
    targetId: monitorTarget(tmp3),
    tool: arg0,
    args: typeof arg1 === "string" ? arg1.slice(0, 2000) : JSON.stringify(arg1).slice(0, 2000),
    callId: arg2
  });
}
export function emitToolResult(arg0, arg1, arg2) {
  broadcast({
    type: "tool_result",
    ts: Date.now(),
    tool: arg0,
    result: typeof arg1 === "string" ? arg1.slice(0, 2000) : JSON.stringify(arg1).slice(0, 2000),
    callId: arg2
  });
}
export function emitAIText(arg0, tmp1 = false, tmp2 = null) {
  broadcast({
    type: "ai_text",
    ts: Date.now(),
    targetId: monitorTarget(tmp2),
    text: arg0.slice(0, 3000),
    partial: tmp1
  });
}
export function emitChatStart(arg0, arg1, arg2, tmp3 = null) {
  broadcast({
    type: "chat_start",
    ts: Date.now(),
    targetId: monitorTarget(tmp3),
    model: arg0,
    messages: arg1,
    tools: arg2
  });
}
export function emitChatEnd(arg0, arg1, tmp2 = null) {
  broadcast({
    type: "chat_end",
    ts: Date.now(),
    targetId: monitorTarget(tmp2),
    stopReason: arg0,
    toolsCalled: arg1 || []
  });
}
export function emitStreamStatus(arg0, arg1, tmp2 = null) {
  if (arg0 === "timing" && process.env.PROXY_MONITOR_TIMING !== "1") {
    return;
  }
  broadcast({
    type: "status",
    ts: Date.now(),
    targetId: monitorTarget(tmp2),
    status: arg0,
    detail: arg1
  });
}
const chatQueues = new Map();
const chatQueueInFlight = new Map();
function queueKey(arg0) {
  return arg0 || "default";
}
function getQueue(arg0) {
  const tmp1 = queueKey(arg0);
  if (!chatQueues.has(tmp1)) {
    chatQueues.set(tmp1, []);
  }
  return chatQueues.get(tmp1);
}
export function pushChatQueue(arg0, tmp1 = false, tmp2 = null) {
  const tmp3 = Date.now() + "-" + Math.random().toString(16).slice(2);
  const tmp4 = queueKey(tmp2);
  const tmp5 = getQueue(tmp4);
  tmp5.push({
    id: tmp3,
    text: arg0,
    hasImage: tmp1,
    targetId: tmp4,
    ts: Date.now()
  });
  console.log("[WS Bridge] Chat queue push target=" + tmp4 + " (" + tmp5.length + " pending): " + (arg0 || "").slice(0, 60));
}
export function getChatQueue(tmp0 = null) {
  const tmp1 = queueKey(tmp0);
  const tmp2 = chatQueueInFlight.get(tmp1);
  if (tmp2 && Date.now() - (tmp2.claimedAt || 0) > 15000) {
    console.log("[WS Bridge] Chat queue claim expired target=" + tmp1 + ", releasing in-flight message");
    chatQueueInFlight.delete(tmp1);
  }
  if (chatQueueInFlight.has(tmp1)) {
    return {
      pending: false
    };
  }
  const tmp3 = getQueue(tmp1);
  if (tmp3.length === 0) {
    return {
      pending: false
    };
  }
  const tmp4 = {
    ...tmp3[0],
    claimedAt: Date.now()
  };
  chatQueueInFlight.set(tmp1, tmp4);
  const tmp5 = {
    pending: true,
    message: tmp4
  };
  return tmp5;
}
function handleClientMessage(arg0) {
  if (arg0.type === "inject") {
    injectedMessages.push({
      role: arg0.role || "user",
      content: arg0.content || "",
      ts: Date.now()
    });
    console.log("[WS Bridge] Queued injected message (" + injectedMessages.length + " pending): " + (arg0.content || "").slice(0, 80));
    broadcast({
      type: "inject_ack",
      queueSize: injectedMessages.length
    });
  }
  if (arg0.type === "clear_queue") {
    injectedMessages = [];
    broadcast({
      type: "inject_ack",
      queueSize: 0
    });
  }
  if (arg0.type === "push_chat_queue") {
    pushChatQueue(arg0.text || "", !!arg0.hasImage, arg0.targetId || null);
    broadcast({
      type: "inject_ack",
      queueSize: getQueue(arg0.targetId || null).length,
      targetId: queueKey(arg0.targetId || null)
    });
  }
}
export function consumeInjectedMessages() {
  if (injectedMessages.length === 0) {
    return [];
  }
  const tmp0 = [...injectedMessages];
  injectedMessages = [];
  console.log("[WS Bridge] Consuming " + tmp0.length + " injected message(s)");
  return tmp0;
}
export function hasInjectedMessages() {
  return injectedMessages.length > 0;
}
export function ackChatQueue(arg0, tmp1 = null) {
  const tmp2 = queueKey(tmp1);
  const tmp3 = chatQueueInFlight.get(tmp2);
  if (tmp3 && (!arg0 || tmp3.id === arg0)) {
    const tmp0 = getQueue(tmp2);
    tmp0.shift();
    chatQueueInFlight.delete(tmp2);
    console.log("[WS Bridge] Chat queue ack target=" + tmp2 + " (" + tmp0.length + " remaining)");
  }
}
