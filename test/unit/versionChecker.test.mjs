import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { VersionChecker } = require('../../src/services/versionChecker.js');

/** 最小 globalState 桩 */
function makeContext(initial = {}) {
  const store = { ...initial };
  return {
    store,
    globalState: {
      get: (key) => store[key],
      update: async (key, value) => {
        if (value === undefined) delete store[key];
        else store[key] = value;
      },
    },
  };
}

function makeChecker(currentVersion, initialState = {}) {
  return new VersionChecker(makeContext(initialState), currentVersion);
}

test('compareVersions 正确比较语义化版本', () => {
  const vc = makeChecker('2.4.0');
  assert.equal(vc.compareVersions('2.5.0', '2.4.0'), 1);
  assert.equal(vc.compareVersions('2.4.0', '2.5.0'), -1);
  assert.equal(vc.compareVersions('2.4.0', '2.4.0'), 0);
  assert.equal(vc.compareVersions('2.10.0', '2.9.0'), 1, '10 > 9 而非字符串比较');
  assert.equal(vc.compareVersions('3.0.0', '2.99.99'), 1);
});

test('normalizeVersion 去掉 v 前缀', () => {
  const vc = makeChecker('2.4.0');
  assert.equal(vc.normalizeVersion('v2.5.0'), '2.5.0');
  assert.equal(vc.normalizeVersion('2.5.0'), '2.5.0');
  assert.equal(vc.normalizeVersion(' v2.5.0 '), '2.5.0');
});

test('只打了 tag 没建 Release 时，用 tag 兜底识别新版本', async () => {
  const vc = makeChecker('2.4.0');
  // 复现线上现象：/releases/latest 停在 v2.4.0，但 tag 里已有 v2.5.0
  vc.fetchJson = async (url) => {
    if (url.includes('/releases/latest')) {
      return { tag_name: 'v2.4.0', html_url: 'https://github.com/x/y/releases/tag/v2.4.0' };
    }
    return [{ name: 'v2.5.0' }, { name: 'v2.4.0' }, { name: 'v2.3.0' }];
  };

  const resolved = await vc.resolveLatestVersion();
  assert.equal(resolved.version, '2.5.0');
  // 该 Release 不存在，必须指向 releases 列表页而不是 404 详情页
  assert.match(resolved.url, /\/releases$/);
});

test('Release 与 tag 一致时优先用 Release 的详情页链接', async () => {
  const vc = makeChecker('2.4.0');
  vc.fetchJson = async (url) => {
    if (url.includes('/releases/latest')) {
      return { tag_name: 'v2.5.0', html_url: 'https://github.com/x/y/releases/tag/v2.5.0' };
    }
    return [{ name: 'v2.5.0' }];
  };

  const resolved = await vc.resolveLatestVersion();
  assert.equal(resolved.version, '2.5.0');
  assert.equal(resolved.url, 'https://github.com/x/y/releases/tag/v2.5.0');
});

test('fetchLatestTag 忽略非语义化 tag', async () => {
  const vc = makeChecker('2.4.0');
  vc.fetchJson = async () => [
    { name: 'latest' },
    { name: 'nightly-build' },
    { name: 'v2.4.0' },
    { name: '2.1.1' },
  ];
  assert.equal(await vc.fetchLatestTag(), '2.4.0');
});

test('手动检查（force）跳过 1 小时节流', async () => {
  const vc = makeChecker('2.4.0', {
    'devin-byok-plus.lastVersionCheck': Date.now(),
  });
  let calls = 0;
  vc.fetchJson = async (url) => {
    calls++;
    if (url.includes('/releases/latest')) return { tag_name: 'v2.5.0', html_url: 'u' };
    return [{ name: 'v2.5.0' }];
  };

  // 节流窗口内的自动检查：不应发请求
  await vc.checkForUpdates();
  assert.equal(calls, 0, '自动检查应被节流');

  // 手动检查：必须真的去查
  const info = await vc.checkForUpdates(true);
  assert.ok(calls > 0, 'force 必须绕过节流');
  assert.equal(info.latestVersion, '2.5.0');
  assert.equal(info.hasUpdate, true);
});

test('忽略某个版本后 hasUpdate 为 false，但 isNewer 仍为 true', async () => {
  const vc = makeChecker('2.4.0');
  vc.fetchJson = async (url) =>
    url.includes('/releases/latest')
      ? { tag_name: 'v2.5.0', html_url: 'u' }
      : [{ name: 'v2.5.0' }];

  await vc.checkForUpdates(true);
  assert.equal(vc.getUpdateInfo().hasUpdate, true);

  await vc.dismissUpdate();
  const info = vc.getUpdateInfo();
  assert.equal(info.hasUpdate, false, '横幅不再弹出');
  assert.equal(info.isNewer, true, '卡片仍要显示可更新');
  assert.equal(info.dismissed, true);
});

test('检查失败时记录 error 且不覆盖缓存版本', async () => {
  const vc = makeChecker('2.4.0', {
    'devin-byok-plus.cachedLatestVersion': '2.5.0',
  });
  vc.fetchJson = async () => {
    throw new Error('GitHub API 速率限制，请稍后重试');
  };

  const info = await vc.checkForUpdates(true);
  assert.equal(info.error, 'GitHub API 速率限制，请稍后重试');
  assert.equal(info.latestVersion, '2.5.0', '保留上次缓存结果');
});

test('getUpdateInfo 总是给出可用的仓库与 releases 链接', () => {
  const info = makeChecker('2.4.0').getUpdateInfo();
  assert.match(info.repoUrl, /^https:\/\/github\.com\//);
  assert.match(info.releasesUrl, /\/releases$/);
  assert.match(info.releaseUrl, /^https:\/\//, '没查到版本时也要有兜底链接');
});

test('检查完成后触发 onDidChange', async () => {
  const vc = makeChecker('2.4.0');
  vc.fetchJson = async (url) =>
    url.includes('/releases/latest')
      ? { tag_name: 'v2.5.0', html_url: 'u' }
      : [{ name: 'v2.5.0' }];

  let received = null;
  vc.onDidChange = (info) => {
    received = info;
  };
  await vc.checkForUpdates(true);
  assert.ok(received, 'onDidChange 应被调用');
  assert.equal(received.latestVersion, '2.5.0');
});
