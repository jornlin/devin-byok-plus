'use strict';

/**
 * 模型拉取与规范化
 *
 * 从 sidebarProvider.js 抽离。除 fetchModelsFromGateway 需注入 proxyManager 外，
 * 其余均为纯函数。实现逐字保留，保证行为不变。
 */

const https = require('https');
const http = require('http');
const { ensureGatewayUrl, stripProtoServer } = require('../utils/gatewayUrl');

/**
 * 将上游模型响应规范化为 { providers: { anthropic, openai } } 结构
 */
function normalizeModelsResponse(resp) {
  if (resp?.data && Array.isArray(resp.data)) {
    const mapped = resp.data.map((m) => ({
      id: m.id,
      provider: /claude|anthropic/i.test(m.id) ? 'anthropic' : 'openai',
    }));
    return {
      providers: {
        anthropic: { models: mapped.filter((m) => m.provider === 'anthropic') },
        openai: { models: mapped.filter((m) => m.provider === 'openai') },
      },
    };
  }
  if (resp?.providers) {
    return resp;
  }
  throw new Error('未知的模型列表格式');
}

/**
 * 由 Base URL 推导 /models 列表地址
 */
function getModelListUrl(baseUrl) {
  const s = String(baseUrl || '').trim();
  if (!s) {
    throw new Error('请先填写 Base URL');
  }
  const u = new URL(ensureGatewayUrl(s));
  const p = u.pathname.replace(/\/+$/, '');
  if (/\/models$/i.test(p)) {
    u.pathname = p;
  } else {
    u.pathname = (p.replace(/\/(messages|responses)$/i, '') || '/v1') + '/models';
  }
  u.search = '';
  return u.toString();
}

/**
 * 规范化各 BYOK 槽位的 Base URL：拆出 host，并在路径非默认时推导 API 路径
 */
function normalizeProviderBaseUrl(config) {
  const out = { ...config };
  for (const prefix of ['', 'BYOK1_', 'BYOK2_']) {
    for (const hostKey of ['ANTHROPIC_API_HOST', 'OPENAI_API_HOST']) {
      const raw = String(out[prefix + hostKey] || '').trim();
      if (!raw) {
        continue;
      }
      const withProto = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
      let parsed;
      try {
        parsed = new URL(withProto);
      } catch {
        out[prefix + hostKey] = stripProtoServer(raw);
        continue;
      }
      const p = parsed.pathname.replace(/\/+$/, '');
      out[prefix + hostKey] = parsed.host;
      if (p && p !== '/') {
        const pathKey =
          prefix + (hostKey === 'ANTHROPIC_API_HOST' ? 'ANTHROPIC_API_PATH' : 'OPENAI_API_PATH');
        if (!out[pathKey] || out[pathKey] === '/v1/messages' || out[pathKey] === '/v1/responses') {
          const suffix = hostKey === 'ANTHROPIC_API_HOST' ? '/messages' : '/responses';
          let base = p.replace(/\/models$/i, '');
          if (/\/(messages|responses)$/i.test(base)) {
            base = base.replace(/\/(messages|responses)$/i, '');
          }
          out[pathKey] = (base || '/v1') + suffix;
        }
      }
    }
  }
  return out;
}

function resolveModelFetchCredentials(apiKey, baseUrl) {
  return { apiKey: String(apiKey || '').trim(), baseUrl: String(baseUrl || '').trim() };
}

function isSslProtocolMismatch(err) {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /EPROTO|WRONG_VERSION_NUMBER|SSL routines/i.test(msg);
}

function toggleGatewayProtocol(url) {
  const u = new URL(url);
  if (u.protocol === 'https:') {
    u.protocol = 'http:';
    return u.toString();
  }
  if (u.protocol === 'http:') {
    u.protocol = 'https:';
    return u.toString();
  }
  return url;
}

function flattenModelIds(resp) {
  const providers = resp?.providers || {};
  const all = [
    ...(Array.isArray(providers.anthropic?.models) ? providers.anthropic.models : []),
    ...(Array.isArray(providers.openai?.models) ? providers.openai.models : []),
    ...(Array.isArray(resp?.data) ? resp.data : []),
    ...(Array.isArray(resp?.models) ? resp.models : []),
  ];
  const ids = all.map((m) => String(m?.id || m?.name || m || '').trim()).filter(Boolean);
  return Array.from(new Set(ids));
}

function modelIdMatches(ids, target) {
  const t = String(target || '')
    .trim()
    .replace(/-thinking$/i, '');
  if (!t) {
    return true;
  }
  return ids.some((id) => id === t || id.replace(/-thinking$/i, '') === t);
}

function formatModelFetchError(err) {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (/EPROTO|WRONG_VERSION_NUMBER|SSL routines/i.test(msg)) {
    return '加载模型失败：Base URL 的 HTTP/HTTPS 协议不匹配。本地或非 443 端口网关请使用 http://，公网 API 请使用 https://。';
  }
  if (/convert_request_failed|not implemented|new_api_error|responses api/i.test(msg)) {
    return '加载模型失败：当前网关可能不支持 OpenAI Responses API；如使用 GPT 网关，请在高级路由中尝试 /v1/chat/completions。';
  }
  if (/signature.*field required|field required.*signature|ValidationException/i.test(msg)) {
    return '加载模型失败：上游 Bedrock/Anthropic thinking 历史缺少 signature；请新开对话或关闭思考强度后重试。';
  }
  if (/HTTP\s*403/i.test(msg) || /not assigned to any group|permission_error|分组|权限/i.test(msg)) {
    return '加载模型失败：API Key 没有模型权限或服务拒绝访问，请检查 Base URL 和 API Key。';
  }
  if (/HTTP\s*401/i.test(msg) || /invalid.*key|unauthorized|鉴权/i.test(msg)) {
    return '加载模型失败：API Key 无效或已过期，请检查 Base URL 和 API Key。';
  }
  return msg || '加载模型失败，请检查 API Key、Base URL 和网络连接';
}

/**
 * 发起 GET 请求拉取模型列表，并规范化结果
 */
function httpGetModels(url, apiKey, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const headers = {};
    if (apiKey) {
      headers['x-api-key'] = apiKey;
      headers.authorization = 'Bearer ' + apiKey;
    }
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port ? Number(u.port) : u.protocol === 'http:' ? 80 : 443,
        path: '' + u.pathname + u.search,
        method: 'GET',
        timeout,
        agent: u.hostname === '127.0.0.1' || u.hostname === 'localhost' ? undefined : false,
        headers,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error('HTTP ' + res.statusCode + ': ' + body.slice(0, 200)));
            return;
          }
          try {
            resolve(normalizeModelsResponse(JSON.parse(body)));
          } catch (e) {
            reject(new Error('JSON 解析失败: ' + e.message));
          }
        });
      }
    );
    req.on('error', (e) => reject(e));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    req.end();
  });
}

/**
 * 拉取模型：优先用 Base URL + API Key；否则回退到运行中的本地代理。
 * @param {string} apiKey
 * @param {string} baseUrl
 * @param {object} proxyManager - 注入依赖（getStatus()）
 */
async function fetchModelsFromGateway(apiKey, baseUrl, proxyManager) {
  const base = String(baseUrl || '').trim();
  if (base) {
    const url = getModelListUrl(base);
    try {
      return await httpGetModels(url, apiKey, 8000);
    } catch (err) {
      if (isSslProtocolMismatch(err)) {
        const toggled = toggleGatewayProtocol(url);
        if (toggled !== url) {
          return await httpGetModels(toggled, apiKey, 8000);
        }
      }
      throw err;
    }
  }
  const status = proxyManager.getStatus();
  if (status.running) {
    try {
      return await httpGetModels(
        'http://127.0.0.1:' + status.hybridPort + '/api/models',
        undefined,
        3000
      );
    } catch {}
  }
  throw new Error('请先填写 Base URL 和 API Key，或启动代理后加载模型');
}

module.exports = {
  normalizeModelsResponse,
  getModelListUrl,
  normalizeProviderBaseUrl,
  resolveModelFetchCredentials,
  isSslProtocolMismatch,
  toggleGatewayProtocol,
  flattenModelIds,
  modelIdMatches,
  formatModelFetchError,
  httpGetModels,
  fetchModelsFromGateway,
};


