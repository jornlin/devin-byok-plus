/**
 * 网络请求重试工具模块
 * 提供统一的重试策略、错误分类和退避算法
 */

// 默认重试配置
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAYS = [1000, 2000, 5000]; // 毫秒
const DEFAULT_TIMEOUT_RETRY_DELAYS = [500, 1500, 3000]; // 超时错误使用更快的重试

// 环境变量配置
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || String(DEFAULT_MAX_RETRIES), 10);
const ENABLE_RETRY = process.env.ENABLE_RETRY !== "false";

/**
 * 判断错误是否可重试
 * @param {Error|Object} error 错误对象
 * @param {number} statusCode HTTP 状态码
 * @returns {boolean} 是否可重试
 */
export function isRetriableError(error, statusCode) {
  if (!ENABLE_RETRY) {
    return false;
  }

  // 网络层错误（可重试）
  const retriableNetworkCodes = [
    "ETIMEDOUT",      // 连接超时
    "ECONNRESET",     // 连接重置
    "ECONNREFUSED",   // 连接被拒绝
    "ENOTFOUND",      // DNS 解析失败
    "EAI_AGAIN",      // DNS 临时失败
    "ENETUNREACH",    // 网络不可达
    "EHOSTUNREACH",   // 主机不可达
    "EPIPE",          // 管道破裂
    "ECONNABORTED"    // 连接中止
  ];

  if (error && error.code && retriableNetworkCodes.includes(error.code)) {
    return true;
  }

  // HTTP 状态码错误（可重试）
  // 502: Bad Gateway (上游服务器错误)
  // 503: Service Unavailable (服务不可用)
  // 504: Gateway Timeout (网关超时)
  // 408: Request Timeout (请求超时)
  // 429: Too Many Requests (限流，需特殊处理)
  if (statusCode === 502 || statusCode === 503 || statusCode === 504 || statusCode === 408) {
    return true;
  }

  // 限流错误（429）- 可重试但需要更长的延迟
  if (statusCode === 429) {
    return true;
  }

  // 不可重试的错误
  // 4xx 客户端错误（除了 408, 429）
  // 401: Unauthorized (认证失败)
  // 403: Forbidden (权限不足)
  // 400: Bad Request (参数错误)
  // 404: Not Found (资源不存在)
  if (statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 429) {
    return false;
  }

  return false;
}

/**
 * 判断是否为超时错误
 * @param {Error|Object} error 错误对象
 * @returns {boolean} 是否为超时错误
 */
export function isTimeoutError(error) {
  return error && (error.code === "ETIMEDOUT" || error.timeout === true);
}

/**
 * 计算重试延迟时间（指数退避算法）
 * @param {number} retryCount 当前重试次数（从 0 开始）
 * @param {number} statusCode HTTP 状态码
 * @param {Object} headers 响应头
 * @param {boolean} isTimeout 是否为超时错误
 * @returns {number} 延迟毫秒数
 */
export function calculateRetryDelay(retryCount, statusCode = 0, headers = {}, isTimeout = false) {
  // 429 限流错误：优先使用 Retry-After 头
  if (statusCode === 429) {
    const retryAfter = headers["retry-after"] || headers["Retry-After"];
    if (retryAfter) {
      const delaySeconds = parseInt(retryAfter, 10);
      if (!isNaN(delaySeconds)) {
        // Retry-After 可能是秒数或时间戳
        if (delaySeconds > 1000000000) {
          // 看起来像时间戳
          return Math.max(0, delaySeconds * 1000 - Date.now());
        }
        // 秒数，最大等待 60 秒
        return Math.min(delaySeconds * 1000, 60000);
      }
    }
    // 没有 Retry-After 头，使用默认的长延迟
    return 10000 + retryCount * 5000; // 10s, 15s, 20s
  }

  // 超时错误使用更快的重试策略
  const delays = isTimeout ? DEFAULT_TIMEOUT_RETRY_DELAYS : DEFAULT_RETRY_DELAYS;

  if (retryCount < delays.length) {
    return delays[retryCount];
  }

  // 超出预定义延迟，使用指数退避（最大 30 秒）
  const exponentialDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);

  // 添加随机抖动（±20%）避免惊群效应
  const jitter = exponentialDelay * (0.8 + Math.random() * 0.4);

  return Math.floor(jitter);
}

/**
 * 通用的重试包装器（Promise 风格）
 * @param {Function} fn 要执行的异步函数
 * @param {Object} options 重试选项
 * @returns {Promise} 执行结果
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = MAX_RETRIES,
    onRetry = null,
    context = "request",
    shouldRetry = isRetriableError
  } = options;

  let lastError = null;
  let lastStatusCode = 0;
  let lastHeaders = {};

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      lastStatusCode = error.statusCode || error.status || 0;
      lastHeaders = error.headers || {};

      // 检查是否可重试
      const canRetry = shouldRetry(error, lastStatusCode);
      const isLastAttempt = attempt >= maxRetries;

      if (!canRetry || isLastAttempt) {
        throw error;
      }

      // 计算延迟
      const isTimeout = isTimeoutError(error);
      const delay = calculateRetryDelay(attempt, lastStatusCode, lastHeaders, isTimeout);

      // 回调通知
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, delay, error);
      } else {
        const errorDesc = error.code || error.message || `HTTP ${lastStatusCode}`;
        console.log(`  ↩️  [${context}] Retry ${attempt + 1}/${maxRetries} after ${delay}ms (${errorDesc})`);
      }

      // 等待后重试
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * 包装 HTTP 请求，添加重试能力（基于回调）
 * @param {Function} requestFn 发起请求的函数，接收 (resolve, reject, attempt) 参数
 * @param {Object} options 重试选项
 * @returns {Promise} 请求结果
 */
export function retryHttpRequest(requestFn, options = {}) {
  const {
    maxRetries = MAX_RETRIES,
    context = "HTTP",
    onRetry = null
  } = options;

  return new Promise((resolve, reject) => {
    let attempt = 0;

    const attemptRequest = () => {
      requestFn(
        resolve,
        (error, statusCode = 0, headers = {}) => {
          // 判断是否可重试
          const canRetry = isRetriableError(error, statusCode);
          const isLastAttempt = attempt >= maxRetries;

          if (!canRetry || isLastAttempt) {
            reject(error);
            return;
          }

          // 计算延迟
          const isTimeout = isTimeoutError(error);
          const delay = calculateRetryDelay(attempt, statusCode, headers, isTimeout);

          // 回调通知
          if (onRetry) {
            onRetry(attempt + 1, maxRetries, delay, error);
          } else {
            const errorDesc = error.code || error.message || `HTTP ${statusCode}`;
            console.log(`  ↩️  [${context}] Retry ${attempt + 1}/${maxRetries} after ${delay}ms (${errorDesc})`);
          }

          // 延迟后重试
          attempt++;
          setTimeout(attemptRequest, delay);
        },
        attempt
      );
    };

    attemptRequest();
  });
}

/**
 * 简单的 sleep 函数
 * @param {number} ms 毫秒数
 * @returns {Promise} 延迟 Promise
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 电路熔断器（防止级联失败）
 */
export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5; // 连续失败次数阈值
    this.resetTimeout = options.resetTimeout || 60000; // 熔断后恢复时间（毫秒）
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
  }

  /**
   * 记录成功
   */
  recordSuccess() {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
      console.log("  🔓 Circuit breaker: state changed to CLOSED (recovered)");
    }
  }

  /**
   * 记录失败
   */
  recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold && this.state === "CLOSED") {
      this.state = "OPEN";
      console.error(`  🔒 Circuit breaker: state changed to OPEN (${this.failureCount} consecutive failures)`);
    }
  }

  /**
   * 检查是否允许请求通过
   * @returns {boolean} 是否允许
   */
  allowRequest() {
    if (this.state === "CLOSED") {
      return true;
    }

    if (this.state === "OPEN") {
      // 检查是否可以进入半开状态
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = "HALF_OPEN";
        console.log("  🔓 Circuit breaker: state changed to HALF_OPEN (attempting recovery)");
        return true;
      }
      return false;
    }

    // HALF_OPEN 状态，允许少量请求尝试恢复
    return true;
  }

  /**
   * 获取当前状态
   * @returns {string} 状态
   */
  getState() {
    return this.state;
  }
}

/**
 * 为特定服务创建专用的熔断器实例
 */
export const serviceCircuitBreakers = {
  anthropic: new CircuitBreaker({ failureThreshold: 10, resetTimeout: 60000 }),
  openai: new CircuitBreaker({ failureThreshold: 10, resetTimeout: 60000 }),
  voyage: new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 }),
  duckduckgo: new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 })
};
