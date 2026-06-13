import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import { parseFields, writeStringField, writeMessageField, writeVarintField } from "../proto.js";
import { wrapUnary, unaryHeaders, unwrapRequest } from "../connect.js";
import { getProviderConfig, getRuntimeConfig } from "./models.js";
import { isRetriableError, calculateRetryDelay, isTimeoutError } from "../retry-utils.js";
const PROXY_DEVICE_ID = process.env.PROXY_DEVICE_ID || "";
const PROXY_CLIENT_VERSION = process.env.PROXY_CLIENT_VERSION || "0.0.0";
const _COMPLETION_MODEL = process.env.COMPLETION_MODEL || "";
function getCompletionModel() {
  return _COMPLETION_MODEL || getRuntimeConfig().defaultModel || "claude-sonnet-4-20250514";
}
const MAX_TOKENS = 256;
function getCompletionTimeoutMs() {
  return getRuntimeConfig().completionTimeoutMs || 12000;
}
const PREFIX_CHARS = 2000;
const SUFFIX_CHARS = 500;
const SYSTEM_PROMPT = "You are a precise code completion engine. Return only the code that should be inserted at the cursor position. Do not include explanations, Markdown, backticks, headings, comments about what you changed, or any surrounding prose. Preserve the local coding style and continue the existing code naturally.";
function extractAllStrings(arg0, tmp1 = 0, tmp2 = 0) {
  if (tmp1 > 6 || !arg0 || arg0.length === 0) {
    return [];
  }
  let tmp3;
  try {
    tmp3 = parseFields(arg0);
  } catch {
    return [];
  }
  const tmp4 = [];
  for (const tmp0 of tmp3) {
    if (tmp0.wireType !== 2) {
      continue;
    }
    const tmp02 = tmp0.value;
    if (!tmp02 || tmp02.length === 0) {
      continue;
    }
    const tmp12 = tmp02.toString("utf8");
    const tmp22 = (tmp12.match(/[\x09\x0a\x0d\x20-\x7e]/g) || []).length;
    const tmp32 = tmp22 / (tmp12.length || 1);
    if (tmp12.length > 5 && tmp32 >= 0.8) {
      const tmp03 = {
        text: tmp12,
        field: tmp0.field,
        parentField: tmp2,
        depth: tmp1
      };
      tmp4.push(tmp03);
    }
    const tmp42 = extractAllStrings(tmp02, tmp1 + 1, tmp0.field);
    tmp4.push(...tmp42);
  }
  return tmp4;
}
function extractCodeContext(arg0) {
  const tmp1 = extractAllStrings(arg0);
  const tmp2 = new Set();
  const tmp3 = [];
  for (const tmp0 of tmp1) {
    if (!tmp2.has(tmp0.text)) {
      tmp2.add(tmp0.text);
      tmp3.push(tmp0);
    }
  }
  tmp3.sort((arg02, arg1) => arg1.text.length - arg02.text.length);
  const fn = arg02 => {
    if (arg02.length < 10) {
      return false;
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg02)) {
      return false;
    }
    if (/^[0-9a-f]+$/i.test(arg02) && arg02.length < 80) {
      return false;
    }
    if (/^\d+$/.test(arg02)) {
      return false;
    }
    return true;
  };
  const tmp5 = tmp3.filter(arg02 => fn(arg02.text));
  const tmp6 = tmp5[0]?.text ?? "";
  const tmp7 = tmp5[1]?.text ?? "";
  const tmp8 = {
    prefix: tmp6,
    suffix: tmp7,
    allCandidates: tmp3,
    codeCandidates: tmp5
  };
  return tmp8;
}
function buildGetCompletionsResponse(arg0) {
  if (!arg0) {
    return Buffer.alloc(0);
  }
  const tmp1 = crypto.randomUUID();
  const tmp2 = Buffer.concat([writeStringField(1, tmp1), writeStringField(2, arg0), writeVarintField(12, 2)]);
  const tmp3 = writeMessageField(1, tmp2);
  const tmp4 = writeMessageField(1, tmp3);
  return tmp4;
}
function callAnthropicAPI(arg0, arg1, retryCount = 0) {
  return new Promise(fn => {
    const tmp1 = getProviderConfig().anthropic;
    if (!tmp1.apiKey) {
      console.error("  [completions] No Anthropic API key set");
      fn("");
      return;
    }
    const tmp2 = arg0.slice(-PREFIX_CHARS);
    const tmp3 = arg1.slice(0, SUFFIX_CHARS);
    let tmp4;
    if (tmp3.length > 0) {
      tmp4 = "Complete the code at the cursor position.\n\n<code_before_cursor>\n" + tmp2 + "\n</code_before_cursor>\n\n<code_after_cursor>\n" + tmp3 + "\n</code_after_cursor>\n\nOutput only the text to insert between the two blocks.";
    } else {
      tmp4 = "Continue the following code:\n\n" + tmp2;
    }
    const tmp5 = {
      role: "user",
      content: tmp4
    };
    const tmp6 = {
      model: getCompletionModel(),
      system: SYSTEM_PROMPT,
      messages: [tmp5],
      stream: false,
      max_tokens: MAX_TOKENS
    };
    const tmp7 = JSON.stringify(tmp6);
    const tmp8 = getCompletionTimeoutMs();
    const retryPrefix = retryCount > 0 ? `[Retry ${retryCount}] ` : "";
    console.log("  " + retryPrefix + "[completions] API call: model=" + getCompletionModel() + (" prefix=" + tmp2.length + "b suffix=" + tmp3.length + "b timeout=" + tmp8 + "ms"));
    const tmp9 = tmp1.useHttp ? http : https;
    const tmp10 = tmp1.parsed.port !== 443 ? tmp1.parsed.port : tmp1.useHttp ? 80 : 443;

    const attemptRequest = () => {
      const tmp11 = tmp9.request({
        hostname: tmp1.parsed.hostname,
        port: tmp10,
        path: tmp1.apiPath,
        method: "POST",
        rejectUnauthorized: !tmp1.useHttp && tmp1.parsed.port === 443,
        headers: {
          "content-type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": tmp1.apiKey,
          "content-length": Buffer.byteLength(tmp7),
          "x-proxy-device-id": PROXY_DEVICE_ID,
          "x-proxy-client-version": PROXY_CLIENT_VERSION,
          "x-proxy-timestamp": Date.now().toString(),
          "x-proxy-nonce": crypto.randomBytes(16).toString("hex"),
          "x-proxy-requested-model": getCompletionModel()
        }
      }, arg02 => {
        let tmp12 = "";
        arg02.setEncoding("utf8");
        arg02.on("data", arg03 => {
          tmp12 += arg03;
        });
        arg02.on("end", () => {
          console.log("  [completions] API status=" + arg02.statusCode + (" body=" + tmp12.slice(0, 400)));
          if (arg02.statusCode !== 200) {
            console.error("  [completions] API error " + arg02.statusCode + ": " + tmp12.slice(0, 200));

            // 判断是否应该重试
            if (shouldRetryCompletionRequest(arg02.statusCode, null, retryCount)) {
              retryCompletionRequest(arg0, arg1, retryCount, arg02.statusCode, null, fn);
            } else {
              fn("");
            }
            return;
          }
          try {
            const tmp0 = JSON.parse(tmp12);
            const tmp13 = tmp0?.content?.[0]?.text ?? "";
            console.log("  [completions] Completion text: " + JSON.stringify(tmp13.slice(0, 120)));
            fn(tmp13.trim());
          } catch (tmp0) {
            console.error("  [completions] JSON parse error: " + tmp0.message);
            fn("");
          }
        });
        arg02.on("error", arg03 => {
          console.error("  [completions] API response error: " + arg03.message);
          fn("");
        });
      });
      tmp11.setTimeout(tmp8, () => {
        console.warn("  [completions] API timeout after " + tmp8 + "ms");
        tmp11.destroy();

        // 超时错误：判断是否应该重试
        const timeoutError = { code: "ETIMEDOUT", timeout: true };
        if (shouldRetryCompletionRequest(0, timeoutError, retryCount)) {
          retryCompletionRequest(arg0, arg1, retryCount, 0, timeoutError, fn);
        } else {
          fn("");
        }
      });
      tmp11.on("error", arg02 => {
        if (arg02.message.includes("socket hang up") || arg02.message.includes("ECONNRESET")) {
          // 连接错误：判断是否应该重试
          if (shouldRetryCompletionRequest(0, arg02, retryCount)) {
            retryCompletionRequest(arg0, arg1, retryCount, 0, arg02, fn);
          } else {
            fn("");
          }
          return;
        }
        console.error("  [completions] API request error: " + arg02.message);

        // 其他网络错误：判断是否应该重试
        if (shouldRetryCompletionRequest(0, arg02, retryCount)) {
          retryCompletionRequest(arg0, arg1, retryCount, 0, arg02, fn);
        } else {
          fn("");
        }
      });
      tmp11.end(tmp7);
    };

    attemptRequest();
  });
}

// 判断是否应该重试 Completion 请求
function shouldRetryCompletionRequest(statusCode, error, retryCount) {
  const MAX_RETRIES = parseInt(process.env.MAX_COMPLETION_RETRIES || "2", 10); // Completion 重试次数较少

  // 超过最大重试次数
  if (retryCount >= MAX_RETRIES) {
    return false;
  }

  // 使用通用的重试判断逻辑
  return isRetriableError(error, statusCode);
}

// 重试 Completion 请求
function retryCompletionRequest(arg0, arg1, currentRetryCount, statusCode, error, resolve) {
  const nextRetryCount = currentRetryCount + 1;
  const isTimeout = isTimeoutError(error);
  const delay = calculateRetryDelay(currentRetryCount, statusCode, {}, isTimeout);

  const errorDesc = error?.code || error?.message || `HTTP ${statusCode}`;
  const MAX_RETRIES = parseInt(process.env.MAX_COMPLETION_RETRIES || "2", 10);
  console.log(`  ↩️  [completions] Retry ${nextRetryCount}/${MAX_RETRIES} after ${delay}ms (${errorDesc})`);

  setTimeout(() => {
    callAnthropicAPI(arg0, arg1, nextRetryCount).then(resolve);
  }, delay);
}
export async function handleGetCompletions(arg0, arg1, arg2) {
  console.log("[completions] GetCompletions (" + (arg2?.length ?? 0) + "b)");
  let tmp3;
  try {
    tmp3 = unwrapRequest(arg2, arg0.headers);
  } catch (tmp0) {
    console.error("  [completions] unwrapRequest failed: " + tmp0.message);
    const tmp1 = wrapUnary(Buffer.alloc(0));
    arg1.writeHead(200, {
      ...unaryHeaders(),
      "content-length": tmp1.length
    });
    arg1.end(tmp1);
    return;
  }
  let tmp4 = [];
  try {
    tmp4 = parseFields(tmp3);
  } catch (tmp0) {
    console.error("  [completions] parseFields failed: " + tmp0.message);
  }
  console.log("  [completions] Top-level fields (" + tmp4.length + "):");
  for (const tmp0 of tmp4) {
    if (tmp0.wireType === 0) {
      console.log("    field " + tmp0.field + " (varint): " + tmp0.value);
    } else if (tmp0.wireType === 1) {
      const tmp02 = Buffer.isBuffer(tmp0.value) ? tmp0.value.toString("hex") : String(tmp0.value);
      console.log("    field " + tmp0.field + " (fixed64): " + tmp02);
    } else if (tmp0.wireType === 2) {
      const tmp02 = tmp0.value;
      const tmp1 = tmp02.toString("utf8");
      const tmp2 = (tmp1.match(/[\x09\x0a\x0d\x20-\x7e]/g) || []).length;
      const tmp32 = tmp2 / (tmp02.length || 1);
      if (tmp32 >= 0.85) {
        console.log("    field " + tmp0.field + " (string/" + tmp02.length + "b): " + JSON.stringify(tmp1.slice(0, 120)));
      } else {
        console.log("    field " + tmp0.field + " (bytes/" + tmp02.length + "b): [binary] " + tmp02.toString("hex").slice(0, 48));
      }
    } else if (tmp0.wireType === 5) {
      const tmp02 = Buffer.isBuffer(tmp0.value) ? tmp0.value.toString("hex") : String(tmp0.value);
      console.log("    field " + tmp0.field + " (fixed32): " + tmp02);
    }
  }
  const {
    prefix: tmp5,
    suffix: tmp6,
    allCandidates: tmp7,
    codeCandidates: tmp8
  } = extractCodeContext(tmp3);
  console.log("  [completions] String candidates: " + tmp7.length + " total, " + (tmp8.length + " code-like"));
  for (const tmp0 of tmp8.slice(0, 6)) {
    console.log("    [field=" + tmp0.field + " parent=" + tmp0.parentField + " depth=" + tmp0.depth + (" len=" + tmp0.text.length + "]: ") + JSON.stringify(tmp0.text.slice(0, 100)));
  }
  console.log("  [completions] prefix=" + tmp5.length + "b suffix=" + tmp6.length + "b");
  if (tmp5.length > 0) {
    console.log("  [completions] prefix tail: " + JSON.stringify(tmp5.slice(-100)));
  }
  if (tmp6.length > 0) {
    console.log("  [completions] suffix head: " + JSON.stringify(tmp6.slice(0, 100)));
  }
  let tmp9 = "";
  if (tmp5.length > 0) {
    tmp9 = await callAnthropicAPI(tmp5, tmp6);
  } else {
    console.log("  [completions] No code context found — skipping API call, returning empty");
  }
  const tmp10 = buildGetCompletionsResponse(tmp9);
  const tmp11 = wrapUnary(tmp10);
  console.log("  [completions] Response: proto=" + tmp10.length + "b" + (" gzip=" + tmp11.length + "b") + (" completion=" + tmp9.length + "b"));
  arg1.writeHead(200, {
    ...unaryHeaders(),
    "content-length": tmp11.length
  });
  arg1.end(tmp11);
}
