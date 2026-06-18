/**
 * environmentProbe.js 单元测试
 * 覆盖可安全验证的无状态 I/O 行为（不触发真实上游网络）
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ep = require(join(__dirname, '../../src/services/environmentProbe.js'));

test('execFileText', async (t) => {
  await t.test('执行命令返回 stdout', async () => {
    const out = await ep.execFileText('node', ['-e', "process.stdout.write('hello')"], 5000);
    assert.strictEqual(out, 'hello');
  });
  await t.test('命令失败时 reject', async () => {
    await assert.rejects(ep.execFileText('node', ['-e', 'process.exit(1)'], 5000));
  });
});

test('isPortFree', async (t) => {
  await t.test('未占用端口返回 true', async () => {
    assert.strictEqual(await ep.isPortFree(0), true);
  });
  await t.test('被占用端口返回 false', async () => {
    const server = net.createServer();
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const free = await ep.isPortFree(port);
    server.close();
    assert.strictEqual(free, false);
  });
});

test('getPortListeners', async (t) => {
  await t.test('端口为空返回空数组', async () => {
    assert.deepStrictEqual(await ep.getPortListeners(0), []);
  });
});

test('readWindsurfProductInfo（注入 vscode）', async (t) => {
  await t.test('无 appRoot 时回退到 env 信息', () => {
    const info = ep.readWindsurfProductInfo({
      env: { appRoot: '', appName: 'TestIDE' },
      version: '1.2.3',
    });
    assert.strictEqual(info.nameShort, 'TestIDE');
    assert.strictEqual(info.version, '1.2.3');
    assert.strictEqual(info.path, '');
  });
});

test('probeConfiguredModelStream 前置校验', async (t) => {
  await t.test('未设置默认模型', async () => {
    const r = await ep.probeConfiguredModelStream({ DEFAULT_MODEL: '' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.detail, '未设置默认模型');
  });
  await t.test('未配置 API Key', async () => {
    const r = await ep.probeConfiguredModelStream({ DEFAULT_MODEL: 'claude-opus-4-8' });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.detail, '未配置 API Key');
  });
  await t.test('GPT 模型暂不覆盖', async () => {
    const r = await ep.probeConfiguredModelStream({
      DEFAULT_MODEL: 'gpt-5.4',
      ANTHROPIC_API_KEY: 'sk-x',
    });
    assert.strictEqual(r.ok, false);
    assert.match(r.detail, /先覆盖 Claude\/Opus/);
  });
});
