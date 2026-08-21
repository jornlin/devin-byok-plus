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

// 闸门测试要用真实的间隔清洗逻辑（profileStore 顶层无副作用，直接 require 安全）
const realStore = require(join(__dirname, '../../src/services/profileStore.js'));

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

/**
 * 最小假 this。字段必须覆盖 fetchApiBalance 触碰到的每一个实例属性——
 * 少一个（例如 successfulEndpoints）就会在取值时抛 TypeError 被外层 catch 吞掉，
 * 测试跑进「查询异常」分支却仍能让「结果不等于 X」这类断言通过，成为假阳性。
 */
function makeFakeManager(profile) {
  const calls = { show: 0, hide: 0, stopTimer: 0, ensureTimer: 0 };
  return {
    calls,
    ensureTimerMinutes: [],
    balanceStatusBar: {
      text: '',
      tooltip: '',
      show() { calls.show++; },
      hide() { calls.hide++; },
    },
    readEnvConfig: () => ({}),
    stopBalanceTimer() { calls.stopTimer++; },
    ensureBalanceTimer(minutes) { calls.ensureTimer++; this.ensureTimerMinutes.push(minutes); },
    _sanitizeHeaderValue: ProxyManager.prototype._sanitizeHeaderValue,
    _renderBalance: ProxyManager.prototype._renderBalance,
    _parseBalance: ProxyManager.prototype._parseBalance,
    balanceCache: null,
    balanceRequestLog: {},
    successfulEndpoints: {},
    _balanceFetching: false,
    _balancePending: false,
    _activeProfile: profile,
  };
}

// 走真实网络分支的用例统一用这个地址：127. 前缀让实现走 http 模块，
// 端口 1 上没有监听者，连接立即 ECONNREFUSED——不出网、不等超时。
const DEAD_HOST = '127.0.0.1:1';

/**
 * 起一个只回固定 JSON 的本地网关，用于覆盖「拿到 200 之后」的解析与落库分支。
 * 连不上的地址只能测失败路径，测不到解析逻辑。
 */
async function startBalanceServer(payload, statusCode = 200) {
  const http = await import('node:http');
  const server = http.createServer((req, res) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    host: `127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * fetchApiBalance 内部 require('../services/profileStore')，用 Module._load 钩子
 * 把它换成返回指定 profile 的桩，从而在不落盘的前提下驱动闸门分支。
 * 桩必须带上 fetchApiBalance 实际用到的每个导出，缺一个就会在闸门里抛
 * TypeError 被外层 catch 吞掉，测出来是「分支没走到」这种误导性失败。
 *
 * profileSequence 用来模拟「查询途中用户切了方案」：实现会在渲染前重新取一次
 * 激活方案做身份复核，给出多个值即可让首取与复核取到不同的方案。
 */
async function runFetch(fake, forceRefresh = false, profileSequence = null) {
  const hook = Module._load;
  let nth = 0;
  Module._load = function (request) {
    if (request === 'vscode') return vscodeStub;
    if (request === '../services/profileStore') {
      return {
        getActiveProfile: () => {
          if (!profileSequence) return fake._activeProfile;
          const p = profileSequence[Math.min(nth, profileSequence.length - 1)];
          nth += 1;
          return p;
        },
        sanitizeBalanceInterval: realStore.sanitizeBalanceInterval,
      };
    }
    return hook.apply(this, arguments);
  };
  try {
    await ProxyManager.prototype.fetchApiBalance.call(fake, forceRefresh);
  } finally {
    Module._load = hook;
  }
}

// 断言这一轮真的走完了控制流，没有掉进 catch-all
function assertNoInternalError(fake) {
  assert.doesNotMatch(fake.balanceStatusBar.text, /查询异常/, '掉进了 catch-all，说明假 this 缺字段');
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

test('只填访问令牌、BYOK1 没有 key 时也应放行（令牌本身就能查 /api/user/self）', async () => {
  const fake = makeFakeManager({
    balanceEnabled: true,
    balanceToken: 'tok',
    userId: '562',
    byok1: { host: 'api.example.com', key: '' },
  });
  // 无缓存 + host 已配 → 会走到发请求阶段，这里只验证没被「未配置」提前拦掉
  await runFetch(fake);
  assert.doesNotMatch(fake.balanceStatusBar.text, /未配置/);
});

// ============================================================
// balanceInterval：间隔清洗 + 定时器装卸
// ============================================================

test('间隔清洗：缺省 / 非法 / NaN 一律回落 3 分钟', () => {
  const s = realStore.sanitizeBalanceInterval;
  assert.equal(s(undefined), 3);
  assert.equal(s(null), 3);
  assert.equal(s('abc'), 3);
  assert.equal(s(NaN), 3);
  assert.equal(s(-5), 3);
});

test('间隔清洗：会被 Number() 悄悄转成 0 的输入必须回落默认值而非「禁用刷新」', () => {
  const s = realStore.sanitizeBalanceInterval;
  assert.equal(s(''), 3);
  assert.equal(s('   '), 3);
  assert.equal(s(false), 3);
  assert.equal(s([]), 3);
  assert.equal(s({}), 3);
});

test('间隔清洗：卡死上界，避免乘 60000 后溢出 int32 反而变成疯狂轮询', () => {
  const s = realStore.sanitizeBalanceInterval;
  assert.equal(s(60), 60);
  assert.equal(s(61), 60);
  assert.equal(s(999999999), 60);
  assert.ok(s(999999999) * 60 * 1000 < 2 ** 31 - 1);
});

test('间隔清洗：0 是合法值（仅手动刷新），不能被当成缺省值顶掉', () => {
  assert.equal(realStore.sanitizeBalanceInterval(0), 0);
  assert.equal(realStore.sanitizeBalanceInterval('0'), 0);
});

test('间隔清洗：小数取整', () => {
  assert.equal(realStore.sanitizeBalanceInterval(2.4), 2);
  assert.equal(realStore.sanitizeBalanceInterval(2.6), 3);
});

test('间隔为 0 时传给 ensureBalanceTimer 的就是 0（由它决定不装定时器）', async () => {
  const fake = makeFakeManager({
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: '', key: '' },
    balanceInterval: 0,
  });
  await runFetch(fake);
  assert.deepEqual(fake.ensureTimerMinutes, [0]);
});

test('方案里的自定义间隔原样传给定时器', async () => {
  const fake = makeFakeManager({
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: '', key: '' },
    balanceInterval: 15,
  });
  await runFetch(fake);
  assert.deepEqual(fake.ensureTimerMinutes, [15]);
});

// ============================================================
// 缓存：必须按「方案 + 网关」隔离，否则多方案同 host 会串号
// ============================================================

test('缓存命中：同方案同 host 且未过期，直接渲染缓存值', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    name: '方案一',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: 'api.example.com', key: 'sk-1' },
    balanceInterval: 3,
  });
  fake.balanceCache = {
    balance: 42.5,
    timestamp: Date.now(),
    key: 'p1::api.example.com',
    endpoint: '/api/user/self',
  };
  await runFetch(fake);

  assert.match(fake.balanceStatusBar.text, /42\.50/);
  assert.match(fake.balanceStatusBar.tooltip, /缓存/);
});

test('缓存隔离：同一 host 换了方案不得命中上一个方案的余额', async () => {
  const fake = makeFakeManager({
    id: 'p2',
    name: '方案二',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: DEAD_HOST, key: 'sk-2' },
    balanceInterval: 3,
  });
  // 缓存属于 p1，当前激活的是 p2 —— 同 host 但凭据不同，串号会显示错余额
  fake.balanceCache = {
    balance: 42.5,
    timestamp: Date.now(),
    key: `p1::${DEAD_HOST}`,
    endpoint: '/api/user/self',
  };
  await runFetch(fake);

  assertNoInternalError(fake);
  assert.doesNotMatch(fake.balanceStatusBar.text, /42\.50/);
  // 缓存没命中就必须真的去探测，最终落到「不支持」而不是原地返回
  assert.match(fake.balanceStatusBar.text, /不支持/);
});

test('强制刷新绕过未过期的缓存', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: DEAD_HOST, key: 'sk-1' },
    balanceInterval: 3,
  });
  fake.balanceCache = {
    balance: 42.5,
    timestamp: Date.now(),
    key: `p1::${DEAD_HOST}`,
    endpoint: '/api/user/self',
  };
  await runFetch(fake, true);

  assertNoInternalError(fake);
  assert.doesNotMatch(fake.balanceStatusBar.tooltip, /缓存/);
  assert.match(fake.balanceStatusBar.text, /不支持/);
});

test('间隔 0（仅手动）仍走短期缓存：否则防抖自动保存会比设了间隔发更多请求', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: DEAD_HOST, key: 'sk-1' },
    balanceInterval: 0,
  });
  fake.balanceCache = {
    balance: 42.5,
    timestamp: Date.now(),
    key: `p1::${DEAD_HOST}`,
    endpoint: '/api/user/self',
  };
  await runFetch(fake);
  assert.match(fake.balanceStatusBar.text, /42\.50/);
  // 但定时器仍然不装——0 的语义只是「不自动轮询」
  assert.deepEqual(fake.ensureTimerMinutes, [0]);
});

test('间隔 0 时超出地板期的缓存不再命中', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: DEAD_HOST, key: 'sk-1' },
    balanceInterval: 0,
  });
  fake.balanceCache = {
    balance: 42.5,
    timestamp: Date.now() - 31 * 1000,
    key: `p1::${DEAD_HOST}`,
    endpoint: '/api/user/self',
  };
  await runFetch(fake);

  assertNoInternalError(fake);
  assert.doesNotMatch(fake.balanceStatusBar.text, /42\.50/);
});

test('关闭开关时即便有新鲜缓存也不渲染', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    balanceEnabled: false,
    byok1: { host: 'api.example.com', key: 'sk-1' },
  });
  fake.balanceCache = {
    balance: 42.5,
    timestamp: Date.now(),
    key: 'p1::api.example.com',
    endpoint: '/api/user/self',
  };
  await runFetch(fake);

  assert.equal(fake.calls.hide, 1);
  assert.equal(fake.calls.show, 0);
});

// ============================================================
// 探测清单：不发空凭据请求；限流按「路径 + 凭据变体」记账
// ============================================================

test('没有 apiKey 时不探测通用计费端点（否则发的是空 Bearer，稳定 401）', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: DEAD_HOST, key: '' },
    balanceInterval: 3,
  });
  await runFetch(fake);

  assertNoInternalError(fake);
  const tip = fake.balanceStatusBar.tooltip;
  assert.doesNotMatch(tip, /credit_grants/);
  assert.doesNotMatch(tip, /v1\/user\/balance/);
  // 该走的令牌端点仍然走了
  assert.match(tip, /api\/v1\/usage/);
});

test('有 apiKey 时才带上通用计费端点', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: DEAD_HOST, key: 'sk-1' },
    balanceInterval: 3,
  });
  await runFetch(fake);

  assertNoInternalError(fake);
  assert.match(fake.balanceStatusBar.tooltip, /credit_grants/);
});

test('限流按「路径 + 凭据变体」记账：单轮内同路径的多个变体不互相吃配额', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    balanceEnabled: true,
    balanceToken: 'tok',
    userId: '562',
    byok1: { host: DEAD_HOST, key: '' },
    balanceInterval: 3,
  });
  await runFetch(fake);

  assertNoInternalError(fake);
  // /api/user/self 有 bearer 与 raw 两个变体，都必须真的被探测到，
  // 不能有任何一个因为「同路径已用满配额」而被跳过
  assert.doesNotMatch(fake.balanceStatusBar.tooltip, /频率限制/);
  const keys = Object.keys(fake.balanceRequestLog);
  assert.ok(keys.some(k => k.endsWith('::tok-bearer+uid')), '缺 bearer 变体的记账');
  assert.ok(keys.some(k => k.endsWith('::tok-raw+uid')), '缺 raw 变体的记账');
  // 每个「路径+变体」在单轮内只应记一次
  for (const k of keys) {
    assert.equal(fake.balanceRequestLog[k].length, 1, `${k} 单轮内被记了多次`);
  }
});

test('限流时间戳数组会被写回（否则只增不减，长期泄漏）', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: DEAD_HOST, key: '' },
    balanceInterval: 3,
  });
  // 塞入一批过期时间戳，跑完一轮后必须被清掉而不是累积
  fake.balanceRequestLog[`${DEAD_HOST}/api/v1/usage::tok-bearer`] =
    Array.from({ length: 50 }, () => Date.now() - 120 * 1000);
  await runFetch(fake);

  assertNoInternalError(fake);
  assert.equal(fake.balanceRequestLog[`${DEAD_HOST}/api/v1/usage::tok-bearer`].length, 1);
});

// ============================================================
// 在飞锁：不得把旧方案的结果写到新方案头上
// ============================================================

test('查询途中切了方案：旧方案的失败结果不写进状态栏', async () => {
  const oldProfile = {
    id: 'p1',
    name: '方案一',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: DEAD_HOST, key: '' },
    balanceInterval: 3,
  };
  const newProfile = { ...oldProfile, id: 'p2', name: '方案二' };
  const fake = makeFakeManager(oldProfile);
  // 首取拿到 p1（整轮按 p1 探测），渲染前复核时已经切到 p2
  await runFetch(fake, false, [oldProfile, newProfile]);

  assertNoInternalError(fake);
  assert.doesNotMatch(fake.balanceStatusBar.text, /不支持/);
});

test('被在飞锁挡回的调用会被记下，由持锁方收尾时补跑', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: DEAD_HOST, key: '' },
    balanceInterval: 3,
  });
  fake._balanceFetching = true; // 假装已有一轮在飞
  await runFetch(fake);

  assert.equal(fake._balancePending, true, '被挡回的调用必须留下补跑标记');
  assert.equal(fake._balanceFetching, true, '不得释放别人持有的锁');
});

test('正常跑完一轮后锁被释放', async () => {
  const fake = makeFakeManager({
    id: 'p1',
    balanceEnabled: true,
    balanceToken: 'tok',
    byok1: { host: DEAD_HOST, key: '' },
    balanceInterval: 3,
  });
  await runFetch(fake);
  assert.equal(fake._balanceFetching, false);
});

// ============================================================
// _parseBalance：sub2api 新增格式 + NewAPI 既有优先级不能被改动
// ============================================================

const parseBalance = ProxyManager.prototype._parseBalance;

test('sub2api /api/v1/usage 列表格式', () => {
  assert.equal(
    parseBalance({ code: 0, data: { items: [{ user: { balance: 181.56 } }] } }),
    181.56
  );
});

test('sub2api 变体：data.user.balance', () => {
  assert.equal(parseBalance({ data: { user: { balance: 181.56 } } }), 181.56);
});

test('sub2api 变体：顶层 user.balance', () => {
  assert.equal(parseBalance({ user: { balance: 189.32 } }), 189.32);
});

test('sub2api：items 为空数组时不误判，继续往后匹配', () => {
  assert.equal(parseBalance({ code: 0, data: { items: [] } }), null);
});

test('NewAPI quota 仍优先于同响应里的 balance（改顺序会让老用户数字变掉）', () => {
  assert.equal(
    parseBalance({ success: true, data: { quota: 5000000, balance: 999 } }),
    10
  );
});

test('NewAPI 只有 quota 时按 /500000 折算', () => {
  assert.equal(parseBalance({ success: true, data: { quota: 2500000 } }), 5);
});

test('非对象输入不抛错', () => {
  assert.equal(parseBalance(null), null);
  assert.equal(parseBalance('str'), null);
  assert.equal(parseBalance(undefined), null);
});

test('无任何可识别字段时返回 null（交给调用方降级到下一个端点）', () => {
  assert.equal(parseBalance({ success: true, data: { nothing: 1 } }), null);
});

test('parseFloat 对非数字文本会得到 NaN——调用方必须用 isFinite 而不是 !== null 判定', () => {
  // 这类响应真实存在（无限额度的网关），NaN !== null 成立，
  // 若调用方只判 null 就会显示「余额: NaN」并把它写进缓存与成功端点记忆
  const parsed = parseBalance({ success: true, data: { quota: 0, balance: 'unlimited' } });
  assert.ok(Number.isNaN(parsed));
  assert.ok(!Number.isFinite(parsed));
});

test('NaN 结果不被当成查询成功：不渲染、不写缓存、不记成功端点', async () => {
  // 必须让请求真的拿到 200 响应才能走到解析分支——用连不上的地址只会验证
  // 「请求失败时不写缓存」，跟 NaN 判定毫无关系。
  const { host, close } = await startBalanceServer({
    success: true,
    data: { quota: 0, balance: 'unlimited' },
  });
  try {
    const fake = makeFakeManager({
      id: 'p1',
      balanceEnabled: true,
      balanceToken: 'tok',
      byok1: { host, key: '' },
      balanceInterval: 3,
    });
    await runFetch(fake);

    assertNoInternalError(fake);
    assert.doesNotMatch(fake.balanceStatusBar.text, /NaN/);
    assert.equal(fake.balanceCache, null, 'NaN 不得进缓存');
    assert.deepEqual(fake.successfulEndpoints, {}, 'NaN 不得把端点记成成功');
    assert.match(fake.balanceStatusBar.tooltip, /余额值非数字/);
  } finally {
    await close();
  }
});

test('真实成功响应：渲染金额、写缓存、记住成功端点', async () => {
  const { host, close } = await startBalanceServer({
    success: true,
    data: { quota: 5000000 },
  });
  try {
    const fake = makeFakeManager({
      id: 'p1',
      name: '方案一',
      balanceEnabled: true,
      balanceToken: 'tok',
      byok1: { host, key: '' },
      balanceInterval: 3,
    });
    await runFetch(fake);

    assertNoInternalError(fake);
    assert.match(fake.balanceStatusBar.text, /10\.00/);
    assert.equal(fake.balanceCache.balance, 10);
    assert.equal(fake.balanceCache.key, `p1::${host}`);
    assert.equal(fake.successfulEndpoints[`p1::${host}`], '/api/v1/usage');
  } finally {
    await close();
  }
});

test('sub2api 响应端到端：/api/v1/usage 的列表格式能正常显示', async () => {
  const { host, close } = await startBalanceServer({
    code: 0,
    data: { items: [{ user: { balance: 181.56 } }] },
  });
  try {
    const fake = makeFakeManager({
      id: 'p1',
      balanceEnabled: true,
      balanceToken: 'tok',
      byok1: { host, key: '' },
      balanceInterval: 3,
    });
    await runFetch(fake);

    assertNoInternalError(fake);
    assert.match(fake.balanceStatusBar.text, /181\.56/);
  } finally {
    await close();
  }
});

test('查询途中切了方案：成功结果也不渲染，但缓存照记（切回来还能用）', async () => {
  const { host, close } = await startBalanceServer({ success: true, data: { quota: 5000000 } });
  try {
    const oldProfile = {
      id: 'p1',
      name: '方案一',
      balanceEnabled: true,
      balanceToken: 'tok',
      byok1: { host, key: '' },
      balanceInterval: 3,
    };
    const newProfile = { ...oldProfile, id: 'p2', name: '方案二' };
    const fake = makeFakeManager(oldProfile);
    await runFetch(fake, false, [oldProfile, newProfile]);

    assertNoInternalError(fake);
    assert.doesNotMatch(fake.balanceStatusBar.text, /10\.00/, '不得把 p1 的余额显示成 p2 的');
    assert.equal(fake.balanceCache.key, `p1::${host}`, '缓存仍按 p1 记，切回去可复用');
  } finally {
    await close();
  }
});
