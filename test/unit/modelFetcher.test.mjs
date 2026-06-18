/**
 * modelFetcher.js 单元测试
 * 锁定从 sidebarProvider 抽离的模型拉取逻辑行为
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const mf = require(join(__dirname, '../../src/services/modelFetcher.js'));

test('normalizeModelsResponse', async (t) => {
  await t.test('data 数组按 provider 分流', () => {
    const out = mf.normalizeModelsResponse({
      data: [{ id: 'claude-opus-4' }, { id: 'gpt-5' }],
    });
    assert.deepStrictEqual(out.providers.anthropic.models, [{ id: 'claude-opus-4', provider: 'anthropic' }]);
    assert.deepStrictEqual(out.providers.openai.models, [{ id: 'gpt-5', provider: 'openai' }]);
  });
  await t.test('已是 providers 结构则原样返回', () => {
    const input = { providers: { anthropic: { models: [] } } };
    assert.strictEqual(mf.normalizeModelsResponse(input), input);
  });
  await t.test('未知格式抛错', () => {
    assert.throws(() => mf.normalizeModelsResponse({ foo: 1 }), /未知的模型列表格式/);
  });
});

test('getModelListUrl', async (t) => {
  await t.test('空值抛错', () => {
    assert.throws(() => mf.getModelListUrl(''), /请先填写 Base URL/);
  });
  await t.test('messages 路径转为 /models', () => {
    assert.strictEqual(mf.getModelListUrl('https://api.x.com/v1/messages'), 'https://api.x.com/v1/models');
  });
  await t.test('已是 /models 保持不变', () => {
    assert.strictEqual(mf.getModelListUrl('https://api.x.com/v1/models'), 'https://api.x.com/v1/models');
  });
  await t.test('本地非标端口用 http', () => {
    assert.strictEqual(mf.getModelListUrl('127.0.0.1:3006'), 'http://127.0.0.1:3006/v1/models');
  });
});

test('flattenModelIds / modelIdMatches', async (t) => {
  await t.test('扁平化并去重', () => {
    const ids = mf.flattenModelIds({
      providers: { anthropic: { models: [{ id: 'a' }] }, openai: { models: [{ id: 'b' }] } },
      data: [{ id: 'a' }],
    });
    assert.deepStrictEqual(ids.sort(), ['a', 'b']);
  });
  await t.test('空目标视为匹配', () => {
    assert.strictEqual(mf.modelIdMatches(['a'], ''), true);
  });
  await t.test('忽略 -thinking 后缀匹配', () => {
    assert.strictEqual(mf.modelIdMatches(['claude-opus-4'], 'claude-opus-4-thinking'), true);
    assert.strictEqual(mf.modelIdMatches(['x'], 'y'), false);
  });
});

test('isSslProtocolMismatch / toggleGatewayProtocol', async (t) => {
  await t.test('识别 SSL 协议不匹配', () => {
    assert.strictEqual(mf.isSslProtocolMismatch(new Error('EPROTO ssl')), true);
    assert.strictEqual(mf.isSslProtocolMismatch(new Error('timeout')), false);
  });
  await t.test('https<->http 切换', () => {
    assert.strictEqual(mf.toggleGatewayProtocol('https://a.com/x'), 'http://a.com/x');
    assert.strictEqual(mf.toggleGatewayProtocol('http://a.com/x'), 'https://a.com/x');
  });
});

test('formatModelFetchError', async (t) => {
  await t.test('SSL 错误给出协议提示', () => {
    assert.match(mf.formatModelFetchError(new Error('WRONG_VERSION_NUMBER')), /协议不匹配/);
  });
  await t.test('401 给出 key 无效提示', () => {
    assert.match(mf.formatModelFetchError(new Error('HTTP 401')), /API Key 无效/);
  });
});

test('normalizeProviderBaseUrl', async (t) => {
  await t.test('拆出 host 并推导路径', () => {
    const out = mf.normalizeProviderBaseUrl({ ANTHROPIC_API_HOST: 'https://api.x.com/custom' });
    assert.strictEqual(out.ANTHROPIC_API_HOST, 'api.x.com');
    assert.strictEqual(out.ANTHROPIC_API_PATH, '/custom/messages');
  });
});

test('fetchModelsFromGateway（注入 proxyManager）', async (t) => {
  await t.test('无 baseUrl 且代理未运行时抛错', async () => {
    const proxyManager = { getStatus: () => ({ running: false }) };
    await assert.rejects(
      mf.fetchModelsFromGateway('', '', proxyManager),
      /请先填写 Base URL/
    );
  });
});
