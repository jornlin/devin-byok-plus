import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pa = require('../../src/services/preferredAgent.js');

/**
 * 构造 vscode 配置桩。
 * @param {Object} initial - { 'devin.acp': {preferredAgent: x}, 'windsurf.acp': {...} }
 */
function makeVscode(initial = {}) {
  const store = JSON.parse(JSON.stringify(initial));
  const writes = [];
  return {
    store,
    writes,
    ConfigurationTarget: { Global: 1 },
    workspace: {
      getConfiguration: (section) => ({
        get: (key) => store[section]?.[key],
        update: (key, value, target) => {
          writes.push({ section, key, value, target });
          store[section] = store[section] || {};
          if (value === undefined) {
            delete store[section][key];
          } else {
            store[section][key] = value;
          }
          return Promise.resolve();
        },
      }),
    },
  };
}

test('CASCADE_SENTINEL 必须与 workbench 的 O7 常量一致', () => {
  // workbench.desktop.main.js 里 O7="__cascade__"，写错会让开关静默无效
  assert.equal(pa.CASCADE_SENTINEL, '__cascade__');
});

test('两个配置前缀都要写（Devin 内部是 dualRead）', async () => {
  const vs = makeVscode();
  await pa.applyCascadePreference(vs, true);
  const sections = vs.writes.map((w) => w.section).sort();
  assert.deepEqual(sections, ['devin.acp', 'windsurf.acp']);
  assert.ok(vs.writes.every((w) => w.key === 'preferredAgent'));
  assert.ok(vs.writes.every((w) => w.value === '__cascade__'));
  assert.ok(vs.writes.every((w) => w.target === 1), '应写入 Global 作用域');
});

test('开启：未设置时写入哨兵值', async () => {
  const vs = makeVscode();
  assert.equal(pa.isCascadePreferred(vs), false);
  const r = await pa.applyCascadePreference(vs, true);
  assert.equal(r.changed, true);
  assert.equal(r.skipped, false);
  assert.equal(pa.isCascadePreferred(vs), true);
});

test('开启：已是 Cascade 时幂等，不重复写', async () => {
  const vs = makeVscode({ 'devin.acp': { preferredAgent: '__cascade__' } });
  const r = await pa.applyCascadePreference(vs, true);
  assert.equal(r.changed, false);
  assert.equal(vs.writes.length, 0, '幂等：不应产生写操作');
});

test('开启：用户已手动指定其他 agent 时不覆盖', async () => {
  const vs = makeVscode({ 'devin.acp': { preferredAgent: 'claude-code' } });
  const r = await pa.applyCascadePreference(vs, true);
  assert.equal(r.changed, false);
  assert.equal(r.skipped, true);
  assert.equal(r.foreign, 'claude-code');
  assert.equal(vs.writes.length, 0, '不应覆盖用户的主动选择');
  assert.equal(vs.store['devin.acp'].preferredAgent, 'claude-code');
});

test('关闭：清除哨兵值以回落 Devin 默认行为', async () => {
  const vs = makeVscode({
    'devin.acp': { preferredAgent: '__cascade__' },
    'windsurf.acp': { preferredAgent: '__cascade__' },
  });
  const r = await pa.applyCascadePreference(vs, false);
  assert.equal(r.changed, true);
  assert.ok(vs.writes.every((w) => w.value === undefined), '应传 undefined 以清除该项');
  assert.equal(pa.isCascadePreferred(vs), false);
  assert.equal(vs.store['devin.acp'].preferredAgent, undefined);
});

test('关闭：非哨兵值时不动用户设置', async () => {
  const vs = makeVscode({ 'devin.acp': { preferredAgent: 'claude-code' } });
  const r = await pa.applyCascadePreference(vs, false);
  assert.equal(r.changed, false);
  assert.equal(vs.writes.length, 0);
  assert.equal(vs.store['devin.acp'].preferredAgent, 'claude-code');
});

test('读取时容忍空白与缺省', () => {
  assert.equal(pa.readPreferredAgent(makeVscode()), '');
  assert.equal(pa.readPreferredAgent(makeVscode({ 'devin.acp': { preferredAgent: '   ' } })), '');
  assert.equal(
    pa.readPreferredAgent(makeVscode({ 'devin.acp': { preferredAgent: '  __cascade__  ' } })),
    '__cascade__',
    '应 trim 后比较'
  );
});

test('devin.* 缺失时回退读 windsurf.*', () => {
  const vs = makeVscode({ 'windsurf.acp': { preferredAgent: '__cascade__' } });
  assert.equal(pa.isCascadePreferred(vs), true);
});

test('配置 API 不可用时不抛异常', () => {
  const broken = {
    workspace: {
      getConfiguration: () => {
        throw new Error('no config service');
      },
    },
  };
  assert.equal(pa.readPreferredAgent(broken), '');
  assert.equal(pa.isCascadePreferred(broken), false);
  assert.equal(pa.getForeignPreference(broken), '');
});

test('两个前缀都写失败时抛错（供上层提示用户）', async () => {
  const broken = {
    ConfigurationTarget: { Global: 1 },
    workspace: {
      getConfiguration: () => ({
        get: () => undefined,
        update: () => Promise.reject(new Error('read-only settings')),
      }),
    },
  };
  await assert.rejects(() => pa.applyCascadePreference(broken, true), /read-only settings/);
});

test('仅一个前缀写失败时不抛错（另一个已生效）', async () => {
  const partial = {
    ConfigurationTarget: { Global: 1 },
    workspace: {
      getConfiguration: (section) => ({
        get: () => undefined,
        update: () =>
          section === 'devin.acp'
            ? Promise.resolve()
            : Promise.reject(new Error('legacy section missing')),
      }),
    },
  };
  await pa.applyCascadePreference(partial, true);
});

test('开关展示状态真值表（含"记录开启但未生效"）', () => {
  // 复刻 sidebarProvider.getPreferCascadeState 的判定；
  // 关键：不能只信 globalState，否则写入失败时会显示"开着"但实际没生效
  const state = (stored, actualPref) => {
    const vs = makeVscode(
      actualPref === undefined ? {} : { 'devin.acp': { preferredAgent: actualPref } }
    );
    const actual = pa.isCascadePreferred(vs);
    const foreign = pa.getForeignPreference(vs);
    if (foreign) return { checked: false, foreign, stale: false };
    if (stored === false) return { checked: false, foreign: '', stale: false };
    return { checked: actual, foreign: '', stale: stored === true && !actual };
  };

  const U = undefined;
  const cases = [
    [U, U, false, false],
    [U, '__cascade__', true, false],
    [true, '__cascade__', true, false],
    [true, U, false, true], // 记录开启但实际没生效 → stale
    [false, U, false, false],
    [false, '__cascade__', false, false], // 尊重用户的关闭意图
    [true, 'claude-code', false, false],
    [U, 'claude-code', false, false],
  ];
  for (const [stored, pref, wantChecked, wantStale] of cases) {
    const r = state(stored, pref);
    assert.equal(
      r.checked,
      wantChecked,
      `stored=${stored} pref=${pref} 应 checked=${wantChecked}`
    );
    assert.equal(r.stale, wantStale, `stored=${stored} pref=${pref} 应 stale=${wantStale}`);
  }

  // foreign 必须回报 agent 名，否则用户不知道开关为何点不动
  assert.equal(state(true, 'claude-code').foreign, 'claude-code');
});

test('getForeignPreference 不把哨兵值当成外部偏好', () => {
  const vs = makeVscode({ 'devin.acp': { preferredAgent: '__cascade__' } });
  assert.equal(pa.getForeignPreference(vs), '');
});
