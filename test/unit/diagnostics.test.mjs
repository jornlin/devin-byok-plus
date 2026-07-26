/**
 * diagnostics.js 单元测试
 * 锁定从 sidebarProvider 抽离的诊断分类器与路由解析行为
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const d = require(join(__dirname, '../../src/services/diagnostics.js'));

test('classifyProbeBody', async (t) => {
  await t.test('空响应体', () => {
    assert.strictEqual(d.classifyProbeBody(''), '无响应体');
  });
  await t.test('解析 SSE data 行中的 error', () => {
    const out = d.classifyProbeBody('data: {"error":{"type":"auth_error","message":"bad key"}}');
    assert.strictEqual(out, 'auth_error：bad key');
  });
  await t.test('非 JSON 回退为压缩文本', () => {
    assert.strictEqual(d.classifyProbeBody('plain   text'), 'plain text');
  });
});

test('classifyProbeHttpStatus', async (t) => {
  await t.test('401 鉴权失败', () => {
    assert.match(d.classifyProbeHttpStatus(401, ''), /HTTP 401 鉴权失败/);
  });
  await t.test('429 限流', () => {
    assert.match(d.classifyProbeHttpStatus(429, ''), /HTTP 429 额度\/限流/);
  });
  await t.test('500+ 上游错误', () => {
    assert.match(d.classifyProbeHttpStatus(503, ''), /HTTP 503 上游服务错误/);
  });
});

test('classifyProbeSseError', async (t) => {
  await t.test('非错误事件返回 undefined', () => {
    assert.strictEqual(d.classifyProbeSseError('data: {"text":"hi"}'), undefined);
  });
  await t.test('鉴权类 SSE 错误', () => {
    const out = d.classifyProbeSseError('event: error\ndata: {"error":{"message":"invalid api key"}}');
    assert.match(out, /鉴权失败/);
  });
});

test('classifyProbeNetworkError', async (t) => {
  await t.test('DNS 失败', () => {
    assert.match(d.classifyProbeNetworkError({ code: 'ENOTFOUND', message: 'x' }), /DNS 解析失败/);
  });
  await t.test('连接被重置', () => {
    assert.match(d.classifyProbeNetworkError({ code: 'ECONNRESET', message: 'x' }), /连接失败\/被重置/);
  });
  await t.test('TLS 证书错误', () => {
    assert.match(d.classifyProbeNetworkError({ message: 'self signed certificate' }), /TLS\/证书错误/);
  });
});

test('诊断模型路由', async (t) => {
  await t.test('stripDiagnosticThinkingSuffix 去后缀', () => {
    assert.strictEqual(d.stripDiagnosticThinkingSuffix('claude-opus-4-8-thinking'), 'claude-opus-4-8');
  });
  await t.test('isDiagnosticOpenAIModel 识别 gpt 前缀', () => {
    assert.strictEqual(d.isDiagnosticOpenAIModel('gpt-5.4'), true);
    assert.strictEqual(d.isDiagnosticOpenAIModel('claude-opus-4-8'), false);
  });
  await t.test('resolveDiagnosticModelRoute __DEFAULT__ 走默认模型', () => {
    const r = d.resolveDiagnosticModelRoute('MODEL_CLAUDE_OPUS_4', { DEFAULT_MODEL: 'claude-opus-4-8' });
    assert.strictEqual(r.resolved, 'claude-opus-4-8');
    assert.strictEqual(r.provider, 'Anthropic');
    assert.strictEqual(r.usesDefault, true);
  });
  await t.test('resolveDiagnosticModelRoute 映射到具体模型并识别 OpenAI', () => {
    const r = d.resolveDiagnosticModelRoute('MODEL_GPT_4O', { DEFAULT_MODEL: '' });
    assert.strictEqual(r.resolved, 'gpt-4o');
    assert.strictEqual(r.provider, 'OpenAI');
  });
  await t.test('-priority 标记 fast tier', () => {
    const r = d.resolveDiagnosticModelRoute('gpt-5-4-xhigh-priority', { DEFAULT_MODEL: '' });
    assert.strictEqual(r.serviceTier, 'fast');
  });
  await t.test('OpenAI 模型的 service_tier=priority 被保留（对齐上游 v2.6.1）', () => {
    const r = d.resolveDiagnosticModelRoute('MODEL_GPT_4O', {
      DEFAULT_MODEL: '',
      OPENAI_SERVICE_TIER: 'priority',
    });
    assert.strictEqual(r.serviceTier, 'priority');
  });
});

test('checkModelRoutingDiagnostic', async (t) => {
  await t.test('有默认模型时 status=ok', () => {
    const item = d.checkModelRoutingDiagnostic({ DEFAULT_MODEL: 'claude-opus-4-8' });
    assert.strictEqual(item.id, 'model-routing');
    assert.strictEqual(item.status, 'ok');
    assert.match(item.detail, /DEFAULT_MODEL=claude-opus-4-8/);
  });
  await t.test('无默认模型时 status=warning', () => {
    assert.strictEqual(d.checkModelRoutingDiagnostic({ DEFAULT_MODEL: '' }).status, 'warning');
  });
});

test('checkInlineFastTimeoutRisk', async (t) => {
  await t.test('thinking 模型命中风险', () => {
    const item = d.checkInlineFastTimeoutRisk({ DEFAULT_MODEL: 'claude-opus-4-8-thinking' });
    assert.strictEqual(item.status, 'warning');
    assert.match(item.detail, /thinking 会增加首包等待/);
  });
  await t.test('普通快速模型无明显风险', () => {
    const item = d.checkInlineFastTimeoutRisk({ DEFAULT_MODEL: 'claude-haiku', COMPLETION_TIMEOUT_MS: '12000' });
    assert.strictEqual(item.status, 'ok');
  });
});

test('sanitizeDiagnosticText / sanitizeEnvConfig', async (t) => {
  await t.test('脱敏 api_key 赋值', () => {
    assert.strictEqual(d.sanitizeDiagnosticText('api_key: sk-abcd1234efgh'), 'api_key: ***');
  });
  await t.test('脱敏 sk- 前缀令牌（无敏感键名前缀时）', () => {
    assert.strictEqual(d.sanitizeDiagnosticText('用了 sk-abcd1234efgh5678'), '用了 sk-abcd1234***');
  });
  await t.test('按键名脱敏配置对象', () => {
    const out = d.sanitizeEnvConfig({ ANTHROPIC_API_KEY: 'sk-1234567890ab', FOO: 'bar' });
    assert.match(out.ANTHROPIC_API_KEY, /\.\.\./);
    assert.strictEqual(out.FOO, 'bar');
  });
});

test('readJsonObject', async (t) => {
  await t.test('文件不存在返回 undefined', () => {
    assert.strictEqual(d.readJsonObject('/nonexistent/x.json'), undefined);
  });
});
