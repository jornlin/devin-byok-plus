/**
 * 针对两个 PR 合并后新增/改动逻辑的单元测试：
 *   - byok-slots.correctApiPathForProvider   (PR#4 DeepSeek/Kimi 路径修正)
 *   - openai-request.shouldFallbackToChatCompletions (PR#4 404 回退增强)
 *   - proxyManager.prototype._parseBalance    (PR#2 余额解析，NewAPI quota/500000 约定)
 *
 * _parseBalance 是 ProxyManager 上的纯方法（不依赖 this），
 * 但 proxyManager.js 在模块顶层 require("vscode")，测试环境无该模块，
 * 故用 createRequire + Module._load 钩子注入最小 vscode 桩。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// --- 注入最小 vscode 桩，使 proxyManager.js 能被 require ---
const vscodeStub = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  window: {
    createStatusBarItem: () => ({
      text: '', tooltip: '', command: '',
      show() {}, hide() {}, dispose() {},
    }),
  },
  workspace: { getConfiguration: () => ({ get: () => undefined }) },
  commands: { registerCommand: () => ({ dispose() {} }) },
};
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'vscode') return vscodeStub;
  return origLoad.apply(this, arguments);
};

const { ProxyManager } = require(join(__dirname, '../../src/managers/proxyManager.js'));
Module._load = origLoad; // 恢复，避免影响其它测试

const slots = await import('../../src/proxy/handlers/byok-slots.js');
const openaiReq = await import('../../src/proxy/handlers/openai-request.js');

const { correctApiPathForProvider } = slots;
const { shouldFallbackToChatCompletions } = openaiReq;
const parseBalance = ProxyManager.prototype._parseBalance;

// ============================================================
// PR#4: correctApiPathForProvider
// ============================================================

test('anthropic + deepseek 默认路径 /v1/messages → /anthropic', () => {
  assert.equal(correctApiPathForProvider('anthropic', 'api.deepseek.com', '/v1/messages'), '/anthropic');
});

test('anthropic + deepseek 空路径 → /anthropic', () => {
  assert.equal(correctApiPathForProvider('anthropic', 'api.deepseek.com', ''), '/anthropic');
});

test('anthropic + moonshot(kimi) 默认路径 → /anthropic', () => {
  assert.equal(correctApiPathForProvider('anthropic', 'api.moonshot.cn', '/v1/messages'), '/anthropic');
  assert.equal(correctApiPathForProvider('anthropic', 'api.moonshot.ai', ''), '/anthropic');
});

test('anthropic + deepseek 用户自定义路径 → 尊重用户，不修正', () => {
  assert.equal(correctApiPathForProvider('anthropic', 'api.deepseek.com', '/custom/messages'), '/custom/messages');
});

test('anthropic + 普通 host（非 deepseek/moonshot）→ 原样返回', () => {
  assert.equal(correctApiPathForProvider('anthropic', 'api.anthropic.com', '/v1/messages'), '/v1/messages');
});

test('openai + deepseek 默认 /v1/responses → /v1/chat/completions', () => {
  assert.equal(correctApiPathForProvider('openai', 'api.deepseek.com', '/v1/responses'), '/v1/chat/completions');
});

test('openai + siliconflow /v1/responses → /v1/chat/completions', () => {
  assert.equal(correctApiPathForProvider('openai', 'api.siliconflow.cn', '/v1/responses'), '/v1/chat/completions');
});

test('openai + deepseek 已是 /v1/chat/completions → 保持', () => {
  assert.equal(correctApiPathForProvider('openai', 'api.deepseek.com', '/v1/chat/completions'), '/v1/chat/completions');
});

test('openai + deepseek 用户自定义路径 → 尊重用户', () => {
  assert.equal(correctApiPathForProvider('openai', 'api.deepseek.com', '/foo/bar'), '/foo/bar');
});

test('未知 protocolKind → 原样返回 currentPath', () => {
  assert.equal(correctApiPathForProvider('gemini', 'api.deepseek.com', '/v1/messages'), '/v1/messages');
});

test('host 大小写不敏感（DeepSeek 命中）', () => {
  assert.equal(correctApiPathForProvider('anthropic', 'API.DeepSeek.COM', '/v1/messages'), '/anthropic');
});

// ============================================================
// PR#4: shouldFallbackToChatCompletions
// ============================================================

test('404 无论 body → 回退', () => {
  assert.equal(shouldFallbackToChatCompletions(404, ''), true);
  assert.equal(shouldFallbackToChatCompletions(404, 'anything'), true);
});

test('200 → 不回退', () => {
  assert.equal(shouldFallbackToChatCompletions(200, 'not implemented'), false);
});

test('400 + "not implemented" → 回退', () => {
  assert.equal(shouldFallbackToChatCompletions(400, 'Responses API not implemented'), true);
});

test('500 + "route not found" → 回退', () => {
  assert.equal(shouldFallbackToChatCompletions(500, 'Route not found'), true);
});

test('400 + 无匹配关键字 → 不回退', () => {
  assert.equal(shouldFallbackToChatCompletions(400, 'some unrelated validation error'), false);
});

test('增强模式：method not allowed → 回退', () => {
  assert.equal(shouldFallbackToChatCompletions(405, 'method not allowed'), true);
});

test('不在状态码白名单（如 401/403）→ 不回退', () => {
  assert.equal(shouldFallbackToChatCompletions(401, 'not found'), false);
  assert.equal(shouldFallbackToChatCompletions(403, 'route not found'), false);
});

// ============================================================
// PR#2: _parseBalance (NewAPI quota/500000 约定)
// ============================================================

test('NewAPI success+data.quota → quota/500000', () => {
  assert.equal(parseBalance({ success: true, data: { quota: 5000000 } }), 10);
});

test('success+data.total_available 优先于 quota 之后的分支', () => {
  assert.equal(parseBalance({ success: true, data: { total_available: 3.5 } }), 3.5);
});

test('success+data.balance', () => {
  assert.equal(parseBalance({ success: true, data: { balance: '12.34' } }), 12.34);
});

test('通用 total_available', () => {
  assert.equal(parseBalance({ total_available: 42 }), 42);
});

test('通用 balance', () => {
  assert.equal(parseBalance({ balance: '7.5' }), 7.5);
});

test('顶层 quota 兜底 → /500000', () => {
  assert.equal(parseBalance({ quota: 500000 }), 1);
});

test('data.quota 兜底 → /500000', () => {
  assert.equal(parseBalance({ data: { quota: 1000000 } }), 2);
});

test('无余额字段 → null', () => {
  assert.equal(parseBalance({ success: true, data: {} }), null);
  assert.equal(parseBalance({ foo: 'bar' }), null);
});

test('非对象输入 → null', () => {
  assert.equal(parseBalance(null), null);
  assert.equal(parseBalance('string'), null);
  assert.equal(parseBalance(undefined), null);
});

test('quota 为 0 或负数 → 不当作有效额度（跳过 quota 分支）', () => {
  // quota<=0 时跳过 quota 分支，且无其它字段 → null
  assert.equal(parseBalance({ success: true, data: { quota: 0 } }), null);
  assert.equal(parseBalance({ quota: -5 }), null);
});

