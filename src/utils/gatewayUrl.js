'use strict';

function stripProtoServer(arg0) {
  return String(arg0 || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function shouldUseHttpGateway(arg0) {
  const tmp1 = stripProtoServer(arg0).toLowerCase();
  if (!tmp1) {
    return false;
  }
  const tmp2 = tmp1.replace(/:\d+$/, "");
  if (tmp2 === "127.0.0.1" || tmp2 === "localhost" || tmp2 === "0.0.0.0" || tmp2 === "::1" || tmp2 === "[::1]") {
    return true;
  }
  const tmp3 = tmp1.match(/:(\d+)$/);
  if (tmp3) {
    const tmp4 = Number(tmp3[1]);
    return tmp4 !== 443 && tmp4 !== 80;
  }
  return false;
}

function ensureGatewayUrl(arg0) {
  const tmp1 = String(arg0 || "").trim();
  if (!tmp1) {
    throw new Error("请先填写 Base URL");
  }
  if (/^https?:\/\//i.test(tmp1)) {
    return tmp1;
  }
  const tmp2 = shouldUseHttpGateway(tmp1) ? "http://" : "https://";
  return tmp2 + stripProtoServer(tmp1);
}

module.exports = {
  stripProtoServer,
  shouldUseHttpGateway,
  ensureGatewayUrl
};
