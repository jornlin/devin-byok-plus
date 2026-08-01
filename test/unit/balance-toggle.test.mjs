/**
 * 余额显示开关（balanceEnabled）相关逻辑测试：
 *   - profileStore.createDefaultProfile / normalizeProfile 的默认值与旧数据兼容
 *   - proxyManager.prototype._sanitizeHeaderValue  请求头值清洗
 *   - proxyManager.prototype.fetchApiBalance       开关闸门（关闭时零网络请求）
 *
 * fetchApiBalance 依赖较多实例状态，这里用最小假 this 调用原型方法，
 * 只验证「闸门 + 定时器装卸 + 状态栏显隐」这几个纯控制流分支，不打真实网络。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// proxyManager.js 顶层 require("vscode")，测试环境无该模块，注入最小桩
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
Module._load = function (request) {
  if (request === 'vscode') return vscodeStub;
  return origLoad.apply(this, arguments);
};
const { ProxyManager } = require(join(__dirname, '../../src/managers/proxyManager.js'));
Module._load = origLoad;

const sanitizeHeaderValue = ProxyManager.prototype._sanitizeHeaderValue;

// ============================================================
// _sanitizeHeaderValue：剥控制字符，防 ERR_INVALID_CHAR / header 注入
// ============================================================

test('清洗：去掉首尾空白', () => {
  assert.equal(sanitizeHeaderValue('  abc123  '), 'abc123');
});

test('清洗：剥掉复制令牌时常见的换行与制表符', () => {
  assert.equal(sanitizeHeaderValue('sk-abc\ndef\r\n'), 'sk-abcdef');
  assert.equal(sanitizeHeaderValue('sk-abc\tdef'), 'sk-abcdef');
});

test('清洗：阻断 CRLF header 注入', () => {
  assert.equal(
    sanitizeHeaderValue('token\r\nX-Injected: evil'),
    'tokenX-Injected: evil'
  );
});

test('清洗：null / undefined / 数字输入不抛错', () => {
  assert.equal(sanitizeHeaderValue(null), '');
  assert.equal(sanitizeHeaderValue(undefined), '');
  assert.equal(sanitizeHeaderValue(562), '562');
});

test('清洗：纯控制字符 → 空串（等价于未填）', () => {
  assert.equal(sanitizeHeaderValue('\r\n\t'), '');
});

test('清洗：保留非 ASCII 字符（不误伤合法值）', () => {
  assert.equal(sanitizeHeaderValue('令牌-abc'), '令牌-abc');
});

// ============================================================
// profileStore：balanceEnabled 默认值与旧数据兼容
// ============================================================

let counter = 0;
function setupConfigDir() {
  const dir = path.join(os.tmpdir(), 'byok-balance-test-' + Date.now() + '-' + counter++);
  fs.mkdirSync(dir, { recursive: true });
  process.env.DEVIN_BYOK_CONFIG_DIR = dir;
  return dir;
}
function cleanConfigDir(dir) {
  delete process.env.DEVIN_BYOK_CONFIG_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
}
async function importStoreFresh() {
  return import('../../src/services/profileStore.js?t=' + Date.now() + Math.random());
}

test('新方案默认不开启余额显示', async () => {
  const store = await importStoreFresh();
  const profile = store.createDefaultProfile({});
  assert.equal(profile.balanceEnabled, false);
  assert.equal(profile.balanceToken, '');
  assert.equal(profile.userId, '');
});

test('从 env 迁移出余额凭据时视为已开启（升级后行为不变）', async () => {
  const store = await importStoreFresh();
  const profile = store.createDefaultProfile({
    BYOK1_BALANCE_TOKEN: 'tok-1',
    BYOK1_USER_ID: '562',
  });
  assert.equal(profile.balanceEnabled, true);
  assert.equal(profile.balanceToken, 'tok-1');
  assert.equal(profile.userId, '562');
});

test('只有 userId 也算已开启', async () => {
  const store = await importStoreFresh();
  assert.equal(store.createDefaultProfile({ BYOK1_USER_ID: '562' }).balanceEnabled, true);
});

test('旧方案（无 balanceEnabled 字段）：填过凭据 → 迁移为开启', async () => {
  const dir = setupConfigDir();
  try {
    const store = await importStoreFresh();
    fs.writeFileSync(
      path.join(dir, 'profiles.json'),
      JSON.stringify({
        version: 1,
        activeId: 'p1',
        profiles: [{ id: 'p1', name: '旧方案', balanceToken: 'tok', userId: '562' }],
      })
    );
    const active = store.getActiveProfile({});
    assert.equal(active.balanceEnabled, true);
  } finally {
    cleanConfigDir(dir);
  }
});

test('旧方案（无 balanceEnabled 字段）：从未填过凭据 → 保持关闭', async () => {
  const dir = setupConfigDir();
  try {
    const store = await importStoreFresh();
    fs.writeFileSync(
      path.join(dir, 'profiles.json'),
      JSON.stringify({
        version: 1,
        activeId: 'p1',
        profiles: [{ id: 'p1', name: '旧方案' }],
      })
    );
    assert.equal(store.getActiveProfile({}).balanceEnabled, false);
  } finally {
    cleanConfigDir(dir);
  }
});

test('凭据只有空白字符的旧方案 → 视为未填，保持关闭', async () => {
  const dir = setupConfigDir();
  try {
    const store = await importStoreFresh();
    fs.writeFileSync(
      path.join(dir, 'profiles.json'),
      JSON.stringify({
        version: 1,
        activeId: 'p1',
        profiles: [{ id: 'p1', name: '旧方案', balanceToken: '   ', userId: '' }],
      })
    );
    assert.equal(store.getActiveProfile({}).balanceEnabled, false);
  } finally {
    cleanConfigDir(dir);
  }
});

test('显式关闭的方案即使填了凭据也保持关闭（开关优先于凭据）', async () => {
  const dir = setupConfigDir();
  try {
    const store = await importStoreFresh();
    fs.writeFileSync(
      path.join(dir, 'profiles.json'),
      JSON.stringify({
        version: 1,
        activeId: 'p1',
        profiles: [
          { id: 'p1', name: '方案', balanceEnabled: false, balanceToken: 'tok', userId: '562' },
        ],
      })
    );
    assert.equal(store.getActiveProfile({}).balanceEnabled, false);
  } finally {
    cleanConfigDir(dir);
  }
});

test('balanceEnabled 非布尔真值被规整为布尔（不把 "false" 当真）', async () => {
  const dir = setupConfigDir();
  try {
    const store = await importStoreFresh();
    fs.writeFileSync(
      path.join(dir, 'profiles.json'),
      JSON.stringify({
        version: 1,
        activeId: 'p1',
        profiles: [{ id: 'p1', name: '方案', balanceEnabled: 'false', balanceToken: 'tok' }],
      })
    );
    assert.equal(store.getActiveProfile({}).balanceEnabled, false);
  } finally {
    cleanConfigDir(dir);
  }
});

// ============================================================
// fetchApiBalance 闸门：关闭时零网络请求 + 拆定时器 + 隐藏状态栏
// ============================================================

function makeFakeManager(profile) {
  const calls = { show: 0, hide: 0, stopTimer: 0, ensureTimer: 0 };
  return {
    calls,
    balanceStatusBar: {
      text: '',
      tooltip: '',
      show() { calls.show++; },
      hide() { calls.hide++; },
    },
    readEnvConfig: () => ({}),
    stopBalanceTimer() { calls.stopTimer++; },
    ensureBalanceTimer() { calls.ensureTimer++; },
    _sanitizeHeaderValue: ProxyManager.prototype._sanitizeHeaderValue,
    _activeProfile: profile,
  };
}

/**
 * fetchApiBalance 内部 require('../services/profileStore')，用 Module._load 钩子
 * 把它换成返回指定 profile 的桩，从而在不落盘的前提下驱动闸门分支。
 */
async function runFetch(fake) {
  const hook = Module._load;
  Module._load = function (request) {
    if (request === 'vscode') return vscodeStub;
    if (request === '../services/profileStore') {
      return { getActiveProfile: () => fake._activeProfile };
    }
    return hook.apply(this, arguments);
  };
  try {
    await ProxyManager.prototype.fetchApiBalance.call(fake);
  } finally {
    Module._load = hook;
  }
}

test('开关关闭：隐藏状态栏、拆掉定时器、不发起任何请求', async () => {
  const fake = makeFakeManager({
    balanceEnabled: false,
    balanceToken: 'tok',
    userId: '562',
    byok1: { host: 'api.example.com', key: 'sk-1' },
  });
  await runFetch(fake);

  assert.equal(fake.calls.hide, 1);
  assert.equal(fake.calls.stopTimer, 1);
  assert.equal(fake.calls.show, 0);
  assert.equal(fake.calls.ensureTimer, 0);
});

test('缺少 balanceEnabled 字段的 profile 一律按关闭处理', async () => {
  const fake = makeFakeManager({ byok1: { host: 'api.example.com', key: 'sk-1' } });
  await runFetch(fake);
  assert.equal(fake.calls.hide, 1);
  assert.equal(fake.calls.ensureTimer, 0);
});

test('没有激活方案时按关闭处理，不抛错', async () => {
  const fake = makeFakeManager(null);
  await runFetch(fake);
  assert.equal(fake.calls.hide, 1);
  assert.equal(fake.calls.stopTimer, 1);
});

test('开启但 host/key 未配齐：显示「未配置」并装上定时器（等配好后自动恢复）', async () => {
  const fake = makeFakeManager({
    balanceEnabled: true,
    balanceToken: 'tok',
    userId: '562',
    byok1: { host: '', key: '' },
  });
  await runFetch(fake);

  assert.equal(fake.calls.show, 1);
  assert.equal(fake.calls.ensureTimer, 1);
  assert.equal(fake.calls.stopTimer, 0);
  assert.match(fake.balanceStatusBar.text, /未配置/);
});
