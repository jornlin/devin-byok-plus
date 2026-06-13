import https from "node:https";
import http from "node:http";
import crypto from "node:crypto";
import { URL } from "node:url";
import { writeStringField, writeVarintField, writeMessageField, parseFields, getField } from "../proto.js";
import { wrapUnary, unaryHeaders, unwrapRequest } from "../connect.js";
import { isRetriableError, calculateRetryDelay, isTimeoutError, serviceCircuitBreakers } from "../retry-utils.js";
function searchDuckDuckGo(arg0, tmp1 = 8, retryCount = 0) {
  return new Promise((fn, fn2) => {
    const circuitBreaker = serviceCircuitBreakers.duckduckgo;
    if (!circuitBreaker.allowRequest()) {
      console.error("  🔒 DuckDuckGo circuit breaker is OPEN - request blocked");
      fn2(new Error("Circuit breaker open"));
      return;
    }

    const tmp2 = "q=" + encodeURIComponent(arg0);
    const retryPrefix = retryCount > 0 ? `[Retry ${retryCount}] ` : "";
    const tmp3 = https.request({
      hostname: "html.duckduckgo.com",
      path: "/html/",
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "content-length": Buffer.byteLength(tmp2),
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      }
    }, arg02 => {
      let tmp12 = "";
      arg02.setEncoding("utf8");
      arg02.on("data", arg03 => tmp12 += arg03);
      arg02.on("end", () => {
        try {
          const tmp0 = parseDDGResults(tmp12, tmp1);
          circuitBreaker.recordSuccess();
          fn(tmp0);
        } catch (tmp0) {
          console.error("  ❌ DDG parse error: " + tmp0.message);
          fn2(tmp0);
        }
      });
    });
    tmp3.on("error", error => {
      console.error("  ❌ DDG request error: " + error.message);

      // 判断是否应该重试
      if (shouldRetryWebSearchRequest(0, error, retryCount)) {
        retryWebSearchRequest(arg0, tmp1, retryCount, 0, error, fn, fn2);
      } else {
        circuitBreaker.recordFailure();
        fn2(error);
      }
    });
    tmp3.setTimeout(10000, () => {
      tmp3.destroy();
      console.warn("  ❌ DDG timeout after 10000ms");

      // 超时错误：判断是否应该重试
      const timeoutError = { code: "ETIMEDOUT", timeout: true };
      if (shouldRetryWebSearchRequest(0, timeoutError, retryCount)) {
        retryWebSearchRequest(arg0, tmp1, retryCount, 0, timeoutError, fn, fn2);
      } else {
        circuitBreaker.recordFailure();
        fn2(new Error("DDG timeout"));
      }
    });
    tmp3.end(tmp2);
  });
}

// 判断是否应该重试 Web Search 请求
function shouldRetryWebSearchRequest(statusCode, error, retryCount) {
  const MAX_RETRIES = parseInt(process.env.MAX_WEBSEARCH_RETRIES || "1", 10); // Web Search 只重试 1 次

  // 超过最大重试次数
  if (retryCount >= MAX_RETRIES) {
    return false;
  }

  // 使用通用的重试判断逻辑
  return isRetriableError(error, statusCode);
}

// 重试 Web Search 请求
function retryWebSearchRequest(arg0, tmp1, currentRetryCount, statusCode, error, resolve, reject) {
  const nextRetryCount = currentRetryCount + 1;
  const isTimeout = isTimeoutError(error);
  const delay = calculateRetryDelay(currentRetryCount, statusCode, {}, isTimeout);

  const errorDesc = error?.code || error?.message || `HTTP ${statusCode}`;
  const MAX_RETRIES = parseInt(process.env.MAX_WEBSEARCH_RETRIES || "1", 10);
  console.log(`  ↩️  [WebSearch] Retry ${nextRetryCount}/${MAX_RETRIES} after ${delay}ms (${errorDesc})`);

  setTimeout(() => {
    searchDuckDuckGo(arg0, tmp1, nextRetryCount).then(resolve, reject);
  }, delay);
}
function parseDDGResults(arg0, arg1) {
  const tmp2 = [];
  const tmp3 = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const tmp4 = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const tmp5 = [];
  let tmp6;
  while ((tmp6 = tmp3.exec(arg0)) !== null) {
    const tmp0 = {
      url: tmp6[1],
      rawTitle: tmp6[2]
    };
    tmp5.push(tmp0);
  }
  const tmp7 = [];
  while ((tmp6 = tmp4.exec(arg0)) !== null) {
    tmp7.push(tmp6[1]);
  }
  for (let tmp0 = 0; tmp0 < tmp5.length && tmp2.length < arg1; tmp0++) {
    let {
      url: tmp02,
      rawTitle: tmp1
    } = tmp5[tmp0];
    const tmp22 = tmp02.match(/uddg=([^&]+)/);
    if (tmp22) {
      tmp02 = decodeURIComponent(tmp22[1]);
    }
    const tmp32 = stripHtml(tmp1);
    const tmp42 = tmp0 < tmp7.length ? stripHtml(tmp7[tmp0]) : "";
    if (tmp02 && tmp32 && !tmp02.startsWith("/") && tmp02.startsWith("http")) {
      let tmp03 = "";
      try {
        const tmp04 = new URL(tmp02);
        tmp03 = "https://www.google.com/s2/favicons?domain=" + tmp04.hostname + "&sz=32";
      } catch {}
      const tmp12 = {
        title: tmp32,
        url: tmp02,
        snippet: tmp42,
        faviconUrl: tmp03
      };
      tmp2.push(tmp12);
    }
  }
  return tmp2;
}
function stripHtml(arg0) {
  return arg0.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function resolveRedirectUrl(arg0, tmp1 = 5) {
  return new Promise((fn, arg1) => {
    if (tmp1 <= 0) {
      return fn(arg0);
    }
    if (!isAllowedUrl(arg0)) {
      return fn(arg0);
    }
    const tmp2 = new URL(arg0);
    const tmp3 = tmp2.protocol === "https:" ? https : http;
    const tmp4 = tmp3.request({
      hostname: tmp2.hostname,
      port: tmp2.port || (tmp2.protocol === "https:" ? 443 : 80),
      path: tmp2.pathname + tmp2.search,
      method: "HEAD",
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      }
    }, arg02 => {
      arg02.resume();
      if (arg02.statusCode >= 300 && arg02.statusCode < 400 && arg02.headers.location) {
        const tmp0 = new URL(arg02.headers.location, arg0).toString();
        resolveRedirectUrl(tmp0, tmp1 - 1).then(fn, arg1);
      } else {
        fn(arg0);
      }
    });
    tmp4.on("error", () => fn(arg0));
    tmp4.setTimeout(5000, () => {
      tmp4.destroy();
      fn(arg0);
    });
    tmp4.end();
  });
}
function isAllowedUrl(arg0) {
  try {
    const tmp0 = new URL(arg0);
    if (tmp0.protocol !== "http:" && tmp0.protocol !== "https:") {
      return false;
    }
    const tmp1 = tmp0.hostname.toLowerCase();
    if (tmp1 === "localhost" || tmp1 === "127.0.0.1" || tmp1 === "::1" || tmp1 === "0.0.0.0") {
      return false;
    }
    if (/^0\./.test(tmp1)) {
      return false;
    }
    if (/^10\./.test(tmp1)) {
      return false;
    }
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(tmp1)) {
      return false;
    }
    if (/^192\.168\./.test(tmp1)) {
      return false;
    }
    if (/^169\.254\./.test(tmp1)) {
      return false;
    }
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(tmp1)) {
      return false;
    }
    if (/^fc00:/i.test(tmp1) || /^fe80:/i.test(tmp1) || /^fd/i.test(tmp1)) {
      return false;
    }
    if (tmp1 === "[::1]" || tmp1 === "[::]") {
      return false;
    }
    if (tmp1.endsWith(".local") || tmp1.endsWith(".internal") || tmp1.endsWith(".localhost")) {
      return false;
    }
    if (tmp1 === "metadata.google.internal" || tmp1 === "169.254.169.254") {
      return false;
    }
    if (tmp0.port && ["22", "23", "25", "3306", "5432", "6379", "27017"].includes(tmp0.port)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
function fetchUrlContent(arg0, tmp1 = 50000) {
  return new Promise((fn, fn2) => {
    if (!isAllowedUrl(arg0)) {
      return fn2(new Error("Blocked URL (private/internal): " + arg0));
    }
    const tmp2 = new URL(arg0);
    const tmp3 = tmp2.protocol === "https:" ? https : http;
    const tmp4 = tmp3.request({
      hostname: tmp2.hostname,
      port: tmp2.port || (tmp2.protocol === "https:" ? 443 : 80),
      path: tmp2.pathname + tmp2.search,
      method: "GET",
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    }, arg02 => {
      if (arg02.statusCode >= 300 && arg02.statusCode < 400 && arg02.headers.location) {
        const tmp0 = new URL(arg02.headers.location, arg0).toString();
        arg02.resume();
        if (!isAllowedUrl(tmp0)) {
          return fn2(new Error("Redirect to private/internal URL blocked: " + tmp0));
        }
        return fetchUrlContent(tmp0, tmp1).then(fn, fn2);
      }
      let tmp12 = "";
      let tmp22 = 0;
      arg02.setEncoding("utf8");
      arg02.on("data", arg03 => {
        tmp22 += Buffer.byteLength(arg03);
        if (tmp22 <= tmp1) {
          tmp12 += arg03;
        }
      });
      arg02.on("end", () => {
        const tmp0 = tmp12.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim().slice(0, 30000);
        fn(tmp0);
      });
    });
    tmp4.on("error", fn2);
    tmp4.setTimeout(15000, () => {
      tmp4.destroy();
      fn2(new Error("Fetch timeout"));
    });
    tmp4.end();
  });
}
function buildKnowledgeBaseItem(arg0) {
  const tmp1 = [writeStringField(1, arg0.identifier || crypto.randomUUID()), writeStringField(2, arg0.content || arg0.snippet || ""), writeStringField(3, arg0.url), writeStringField(4, arg0.title), writeStringField(7, arg0.snippet || "")];
  return Buffer.concat(tmp1);
}
function buildSearchResponse(arg0, arg1) {
  const tmp2 = arg0.map(arg02 => writeMessageField(1, buildKnowledgeBaseItem(arg02)));
  tmp2.push(writeStringField(2, "https://duckduckgo.com/?q=" + encodeURIComponent(arg1)));
  return Buffer.concat(tmp2);
}
function buildRedirectResponse(arg0) {
  return writeStringField(1, arg0);
}
function sendProtoResponse(arg0, arg1, arg2) {
  const tmp3 = wrapUnary(arg2);
  arg1.writeHead(200, {
    ...unaryHeaders(),
    "content-length": tmp3.length
  });
  arg1.end(tmp3);
}
export function handleGetWebSearchResults(arg0, arg1, arg2) {
  const tmp3 = arg0.headers;
  console.log("  🔍 WebSearch headers: accept-enc=\"" + (tmp3["accept-encoding"] || "") + "\" connect-accept-enc=\"" + (tmp3["connect-accept-encoding"] || "") + "\" content-enc=\"" + (tmp3["content-encoding"] || "") + "\"");
  let tmp4 = "";
  if (arg2 && arg2.length > 0) {
    try {
      const tmp0 = unwrapRequest(arg2, tmp3);
      const tmp1 = parseFields(tmp0);
      const tmp2 = getField(tmp1, 2, 2);
      if (tmp2) {
        tmp4 = tmp2.value.toString("utf8");
      }
    } catch (tmp0) {
      console.log("  🔍 WebSearch parse error: " + tmp0.message);
    }
  }
  if (!tmp4) {
    console.log("  🔍 WebSearch: empty query");
    return sendProtoResponse(arg0, arg1, Buffer.alloc(0));
  }
  console.log("  🔍 WebSearch: \"" + tmp4 + "\"");
  searchDuckDuckGo(tmp4).then(async arg02 => {
    console.log("  🔍 WebSearch: " + arg02.length + " results for \"" + tmp4 + "\"");
    const tmp1 = arg02.slice(0, 5).map(arg03 => fetchUrlContent(arg03.url).then(arg04 => {
      arg03.content = arg04;
    }).catch(() => {}));
    await Promise.allSettled(tmp1);
    const tmp2 = buildSearchResponse(arg02, tmp4);
    console.log("  🔍 WebSearch response: " + tmp2.length + "b, " + arg02.length + " results");
    sendProtoResponse(arg0, arg1, tmp2);
  }).catch(arg02 => {
    console.error("  ❌ WebSearch error: " + arg02.message);
    sendProtoResponse(arg0, arg1, Buffer.alloc(0));
  });
}
export function handleGetWebSearchRedirect(arg0, arg1, arg2) {
  let tmp3 = "";
  if (arg2 && arg2.length > 0) {
    try {
      const tmp0 = unwrapRequest(arg2, arg0.headers);
      const tmp1 = parseFields(tmp0);
      const tmp2 = getField(tmp1, 1, 2);
      if (tmp2) {
        tmp3 = tmp2.value.toString("utf8");
      }
    } catch (tmp0) {
      console.log("  🔍 WebRedirect parse error: " + tmp0.message);
    }
  }
  if (!tmp3) {
    console.log("  🔍 WebRedirect: empty URL");
    return sendProtoResponse(arg0, arg1, Buffer.alloc(0));
  }
  console.log("  🔍 WebRedirect: " + tmp3);
  resolveRedirectUrl(tmp3).then(arg02 => {
    console.log("  🔍 WebRedirect: " + tmp3 + " → " + arg02);
    sendProtoResponse(arg0, arg1, buildRedirectResponse(arg02));
  }).catch(arg02 => {
    console.error("  ❌ WebRedirect error: " + arg02.message);
    sendProtoResponse(arg0, arg1, buildRedirectResponse(tmp3));
  });
}
