import tmp0 from "node:zlib";
export function gzipSync(arg0) {
  return tmp0.gzipSync(arg0);
}
export function gunzipSync(arg0) {
  return tmp0.gunzipSync(arg0);
}
export function tryGunzip(arg0) {
  try {
    return tmp0.gunzipSync(arg0);
  } catch {
    return null;
  }
}
export function wrapEnvelope(arg0, tmp1 = true) {
  if (tmp1) {
    const tmp02 = gzipSync(arg0);
    const tmp12 = Buffer.alloc(5);
    tmp12[0] = 1;
    tmp12.writeUInt32BE(tmp02.length, 1);
    return Buffer.concat([tmp12, tmp02]);
  }
  const tmp2 = Buffer.alloc(5);
  tmp2[0] = 0;
  tmp2.writeUInt32BE(arg0.length, 1);
  return Buffer.concat([tmp2, arg0]);
}
export function endOfStreamEnvelope() {
  const tmp02 = gzipSync(Buffer.from("{}"));
  const tmp1 = Buffer.alloc(5);
  tmp1[0] = 3;
  tmp1.writeUInt32BE(tmp02.length, 1);
  return Buffer.concat([tmp1, tmp02]);
}
export function unwrapRequest(arg0, arg1) {
  const tmp2 = arg1["connect-content-encoding"] || arg1["content-encoding"] || "";
  const tmp3 = tmp2.includes("gzip");
  let tmp4 = arg0;
  if (tmp3) {
    const tmp02 = tryGunzip(tmp4);
    if (tmp02) {
      tmp4 = tmp02;
    }
  }
  if (tmp4.length > 5) {
    const tmp02 = tmp4[0];
    const tmp1 = tmp4.readUInt32BE(1);
    if (tmp1 === tmp4.length - 5 && tmp02 <= 1) {
      let tmp03 = tmp4.slice(5);
      if (tmp02 === 1) {
        const tmp04 = tryGunzip(tmp03);
        if (tmp04) {
          tmp03 = tmp04;
        }
      }
      return tmp03;
    }
  }
  return tmp4;
}
export function emptyResponse() {
  return gzipSync(Buffer.alloc(0));
}
export function wrapUnary(arg0) {
  return gzipSync(arg0);
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
