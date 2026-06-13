import crypto from "node:crypto";
import https from "node:https";
import { writeMessageField, writeBytesField, parseFields, getField, getAllFields } from "../proto.js";
import { wrapUnary, unaryHeaders, unwrapRequest, wrapEnvelope, endOfStreamEnvelope, streamHeaders, tryGunzip } from "../connect.js";
import { isRetriableError, calculateRetryDelay, isTimeoutError, serviceCircuitBreakers } from "../retry-utils.js";
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || "";
const VOYAGE_MODEL = "voyage-3-lite";
const EMBEDDING_DIM = 512;
const VOYAGE_MAX_BATCH = 128;
function callVoyageAPI(arg0, tmp1 = "document", retryCount = 0) {
  return new Promise((fn, fn2) => {
    const circuitBreaker = serviceCircuitBreakers.voyage;
    if (!circuitBreaker.allowRequest()) {
      console.error("  🔒 Voyage circuit breaker is OPEN - request blocked");
      fn2(new Error("Circuit breaker open"));
      return;
    }

    const tmp2 = {
      model: VOYAGE_MODEL,
      input: arg0,
      input_type: tmp1
    };
    const tmp3 = JSON.stringify(tmp2);
    const retryPrefix = retryCount > 0 ? `[Retry ${retryCount}] ` : "";
    const tmp4 = https.request({
      hostname: "api.voyageai.com",
      path: "/v1/embeddings",
      method: "POST",
      headers: {
        Authorization: "Bearer " + VOYAGE_API_KEY,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(tmp3)
      }
    }, arg02 => {
      const tmp12 = [];
      arg02.on("data", arg03 => tmp12.push(arg03));
      arg02.on("end", () => {
        try {
          const tmp0 = Buffer.concat(tmp12).toString();
          const tmp13 = JSON.parse(tmp0);
          if (tmp13.data) {
            const tmp02 = tmp13.data.sort((arg03, arg1) => arg03.index - arg1.index);
            circuitBreaker.recordSuccess();
            fn(tmp02.map(arg03 => new Float32Array(arg03.embedding)));
          } else {
            const errorMsg = tmp13.detail || tmp13.error?.message || "Unknown Voyage error";
            console.error("  ❌ Voyage API error: " + errorMsg);

            // 判断是否应该重试
            if (shouldRetryVoyageRequest(arg02.statusCode, null, retryCount)) {
              retryVoyageRequest(arg0, tmp1, retryCount, arg02.statusCode, null, fn, fn2);
            } else {
              circuitBreaker.recordFailure();
              fn2(new Error(errorMsg));
            }
          }
        } catch (tmp0) {
          console.error("  ❌ Voyage JSON parse error: " + tmp0.message);
          fn2(tmp0);
        }
      });
    });
    tmp4.on("error", error => {
      console.error("  ❌ Voyage request error: " + error.message);

      // 判断是否应该重试
      if (shouldRetryVoyageRequest(0, error, retryCount)) {
        retryVoyageRequest(arg0, tmp1, retryCount, 0, error, fn, fn2);
      } else {
        circuitBreaker.recordFailure();
        fn2(error);
      }
    });
    tmp4.setTimeout(30000, () => {
      console.warn("  ❌ Voyage timeout after 30000ms");
      tmp4.destroy();

      // 超时错误：判断是否应该重试
      const timeoutError = { code: "ETIMEDOUT", timeout: true };
      if (shouldRetryVoyageRequest(0, timeoutError, retryCount)) {
        retryVoyageRequest(arg0, tmp1, retryCount, 0, timeoutError, fn, fn2);
      } else {
        circuitBreaker.recordFailure();
        fn2(new Error("Voyage timeout"));
      }
    });
    tmp4.end(tmp3);
  });
}

// 判断是否应该重试 Voyage 请求
function shouldRetryVoyageRequest(statusCode, error, retryCount) {
  const MAX_RETRIES = parseInt(process.env.MAX_EMBEDDINGS_RETRIES || "2", 10);

  // 超过最大重试次数
  if (retryCount >= MAX_RETRIES) {
    return false;
  }

  // 使用通用的重试判断逻辑
  return isRetriableError(error, statusCode);
}

// 重试 Voyage 请求
function retryVoyageRequest(arg0, tmp1, currentRetryCount, statusCode, error, resolve, reject) {
  const nextRetryCount = currentRetryCount + 1;
  const isTimeout = isTimeoutError(error);
  const delay = calculateRetryDelay(currentRetryCount, statusCode, {}, isTimeout);

  const errorDesc = error?.code || error?.message || `HTTP ${statusCode}`;
  const MAX_RETRIES = parseInt(process.env.MAX_EMBEDDINGS_RETRIES || "2", 10);
  console.log(`  ↩️  [Voyage] Retry ${nextRetryCount}/${MAX_RETRIES} after ${delay}ms (${errorDesc})`);

  setTimeout(() => {
    callVoyageAPI(arg0, tmp1, nextRetryCount).then(resolve, reject);
  }, delay);
}
async function getEmbeddings(arg0, tmp1 = 1) {
  const tmp2 = tmp1 === 2 ? "query" : "document";
  if (!VOYAGE_API_KEY) {
    return arg0.map(arg02 => hashToEmbedding(arg02));
  }
  try {
    if (arg0.length <= VOYAGE_MAX_BATCH) {
      return await callVoyageAPI(arg0, tmp2);
    }
    const tmp0 = [];
    for (let tmp02 = 0; tmp02 < arg0.length; tmp02 += VOYAGE_MAX_BATCH) {
      const tmp03 = arg0.slice(tmp02, tmp02 + VOYAGE_MAX_BATCH);
      const tmp12 = await callVoyageAPI(tmp03, tmp2);
      tmp0.push(...tmp12);
    }
    return tmp0;
  } catch (tmp0) {
    console.log("  ⚠️ Voyage API failed: " + tmp0.message + " — using hash fallback");
    return arg0.map(arg02 => hashToEmbedding(arg02));
  }
}
function hashToEmbedding(arg0) {
  const tmp1 = crypto.createHash("sha512").update(arg0).digest();
  const tmp2 = new Float32Array(EMBEDDING_DIM);
  let tmp3 = tmp1;
  let tmp4 = 0;
  for (let tmp0 = 0; tmp0 < EMBEDDING_DIM; tmp0++) {
    if (tmp4 + 4 > tmp3.length) {
      tmp3 = crypto.createHash("sha512").update(tmp3).update(Buffer.from([tmp0 & 255, tmp0 >> 8 & 255])).digest();
      tmp4 = 0;
    }
    const tmp02 = tmp3.readUInt32LE(tmp4);
    tmp2[tmp0] = tmp02 / 4294967295 * 2 - 1;
    tmp4 += 4;
  }
  let tmp5 = 0;
  for (let tmp0 = 0; tmp0 < EMBEDDING_DIM; tmp0++) {
    tmp5 += tmp2[tmp0] * tmp2[tmp0];
  }
  tmp5 = Math.sqrt(tmp5);
  if (tmp5 > 0) {
    for (let tmp0 = 0; tmp0 < EMBEDDING_DIM; tmp0++) {
      tmp2[tmp0] /= tmp5;
    }
  }
  return tmp2;
}
function buildEmbeddingProto(arg0) {
  const tmp1 = arg0.length;
  const tmp2 = Buffer.allocUnsafe(tmp1 * 4);
  for (let tmp0 = 0; tmp0 < tmp1; tmp0++) {
    tmp2.writeFloatLE(arg0[tmp0], tmp0 * 4);
  }
  return writeBytesField(1, tmp2);
}
function buildEmbeddingResponse(arg0) {
  const tmp1 = arg0.map(arg02 => writeMessageField(1, buildEmbeddingProto(arg02)));
  return Buffer.concat(tmp1);
}
function buildGetEmbeddingsResponse(arg0, arg1) {
  const tmp2 = buildEmbeddingResponse(arg0);
  const tmp3 = Buffer.allocUnsafe(8);
  tmp3.writeDoubleLE(arg1 / 1000, 0);
  const tmp4 = Buffer.concat([Buffer.from([17]), tmp3]);
  return Buffer.concat([writeMessageField(1, tmp2), tmp4]);
}
function extractPrompts(arg0) {
  try {
    const tmp0 = parseFields(arg0);
    const tmp1 = getField(tmp0, 1, 2);
    if (!tmp1) {
      return {
        prompts: [""],
        prefix: 1
      };
    }
    const tmp2 = parseFields(tmp1.value);
    const tmp3 = getAllFields(tmp2, 1).filter(arg02 => arg02.wireType === 2);
    const tmp4 = getField(tmp2, 3, 0);
    const tmp5 = tmp4 ? tmp4.value : 1;
    const tmp6 = {
      prompts: [""],
      prefix: tmp5
    };
    if (tmp3.length === 0) {
      return tmp6;
    }
    return {
      prompts: tmp3.map(arg02 => arg02.value.toString("utf8")),
      prefix: tmp5
    };
  } catch {
    return {
      prompts: [""],
      prefix: 1
    };
  }
}
function parseEnvelopes(arg0) {
  const tmp1 = [];
  let tmp2 = 0;
  while (tmp2 + 5 <= arg0.length) {
    const tmp0 = arg0[tmp2];
    const tmp12 = arg0.readUInt32BE(tmp2 + 1);
    tmp2 += 5;
    if (tmp2 + tmp12 > arg0.length) {
      break;
    }
    const tmp22 = arg0.slice(tmp2, tmp2 + tmp12);
    tmp2 += tmp12;
    if (tmp0 === 2 || tmp0 === 3) {
      continue;
    }
    let tmp3 = tmp22;
    if (tmp0 === 1) {
      const tmp02 = tryGunzip(tmp22);
      if (tmp02) {
        tmp3 = tmp02;
      }
    }
    tmp1.push(tmp3);
  }
  return tmp1;
}
export function handleGetEmbeddings(arg0, arg1, arg2) {
  const tmp3 = arg0.headers["content-type"] || "";
  const tmp4 = tmp3.includes("connect+proto");
  if (tmp4) {
    handleStreamingEmbeddings(arg0, arg1, arg2);
  } else {
    handleUnaryEmbeddings(arg0, arg1, arg2);
  }
}
async function handleUnaryEmbeddings(arg0, arg1, arg2) {
  let tmp3 = [""];
  let tmp4 = 1;
  if (arg2 && arg2.length > 0) {
    try {
      const tmp0 = unwrapRequest(arg2, arg0.headers);
      const tmp1 = extractPrompts(tmp0);
      tmp3 = tmp1.prompts;
      tmp4 = tmp1.prefix;
    } catch (tmp0) {
      console.log("  🧮 Embeddings parse error: " + tmp0.message);
    }
  }
  const tmp5 = Date.now();
  const tmp6 = await getEmbeddings(tmp3, tmp4);
  const tmp7 = Date.now() - tmp5;
  console.log("  🧮 Embeddings (unary): " + tmp3.length + " texts → Voyage " + tmp7 + "ms, first=\"" + (tmp3[0]?.slice(0, 60) || "") + "\"");
  const tmp8 = buildGetEmbeddingsResponse(tmp6, tmp7);
  const tmp9 = wrapUnary(tmp8);
  arg1.writeHead(200, {
    ...unaryHeaders(),
    "content-length": tmp9.length
  });
  arg1.end(tmp9);
}
async function handleStreamingEmbeddings(arg0, arg1, arg2) {
  let tmp3 = [];
  if (arg2 && arg2.length > 0) {
    let tmp0 = arg2;
    const tmp1 = arg0.headers["content-encoding"] || "";
    if (tmp1.includes("gzip")) {
      const tmp02 = tryGunzip(tmp0);
      if (tmp02) {
        tmp0 = tmp02;
      }
    }
    tmp3 = parseEnvelopes(tmp0);
  }
  console.log("  🧮 Embeddings (stream): " + tmp3.length + " request frames");
  arg1.writeHead(200, streamHeaders());
  for (const tmp0 of tmp3) {
    const {
      prompts: tmp02,
      prefix: tmp1
    } = extractPrompts(tmp0);
    const tmp2 = Date.now();
    const tmp32 = await getEmbeddings(tmp02, tmp1);
    const tmp4 = Date.now() - tmp2;
    console.log("  🧮   Frame: " + tmp02.length + " texts → Voyage " + tmp4 + "ms");
    const tmp5 = buildGetEmbeddingsResponse(tmp32, tmp4);
    arg1.write(wrapEnvelope(tmp5));
  }
  if (tmp3.length === 0) {
    const tmp0 = await getEmbeddings([""], 1);
    const tmp1 = buildGetEmbeddingsResponse(tmp0, 1);
    arg1.write(wrapEnvelope(tmp1));
  }
  arg1.write(endOfStreamEnvelope());
  arg1.end();
}
