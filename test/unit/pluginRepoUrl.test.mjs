import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import Module from 'node:module';

const require = createRequire(import.meta.url);

// sidebarProvider 依赖 vscode，测试里桩掉
const originalLoad = Module._load;
Module._load = function (request) {
  if (request === 'vscode') {
    return {
      window: {},
      env: {},
      Uri: { parse: (s) => s },
      workspace: { getConfiguration: () => ({ get: () => undefined }) },
      ConfigurationTarget: { Global: 1 },
    };
  }
  return originalLoad.apply(this, arguments);
};

const { SidebarProvider } = require('../../src/providers/sidebarProvider.js');
const normalize = (url) => SidebarProvider.prototype.normalizeGitUrl.call(null, url);

test('normalizeGitUrl 把各种 git 远端形式转成可打开的网页地址', () => {
  const expected = 'https://github.com/jornlin/devin-byok-plus';
  const inputs = [
    'git@github.com:jornlin/devin-byok-plus.git',
    'https://github.com/jornlin/devin-byok-plus.git',
    'git+https://github.com/jornlin/devin-byok-plus.git',
    'ssh://git@github.com/jornlin/devin-byok-plus.git',
    'git://github.com/jornlin/devin-byok-plus.git',
    'https://github.com/jornlin/devin-byok-plus/',
  ];
  for (const input of inputs) {
    assert.equal(normalize(input), expected, `失败输入: ${input}`);
  }
});

test('ssh.github.com（SSH over 443）要换回 github.com 才能在浏览器打开', () => {
  assert.equal(
    normalize('git@ssh.github.com:jornlin/devin-byok-plus.git'),
    'https://github.com/jornlin/devin-byok-plus'
  );
});

test('normalizeGitUrl 拒绝非仓库地址', () => {
  assert.equal(normalize('未配置'), '');
  assert.equal(normalize(''), '');
  assert.equal(normalize('https://github.com'), '', '缺少 owner/repo 应被拒绝');
});
