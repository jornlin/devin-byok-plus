/**
 * sidebar-utils.js 单元测试
 * 锁定从 sidebarProvider 抽离的纯工具函数行为
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const utils = require(join(__dirname, '../../src/providers/sidebar-utils.js'));

test('redactSecret', async (t) => {
  await t.test('空值返回空字符串', () => {
    assert.strictEqual(utils.redactSecret(''), '');
    assert.strictEqual(utils.redactSecret(null), '');
    assert.strictEqual(utils.redactSecret(undefined), '');
  });
  await t.test('短密钥（<=8）保留前2位并标注长度', () => {
    assert.strictEqual(utils.redactSecret('abc'), 'ab***(3)');
    assert.strictEqual(utils.redactSecret('12345678'), '12***(8)');
  });
  await t.test('长密钥保留首尾4位并标注长度', () => {
    assert.strictEqual(utils.redactSecret('sk-1234567890abcdef'), 'sk-1...cdef(19)');
  });
  await t.test('去除首尾空白', () => {
    assert.strictEqual(utils.redactSecret('  abc  '), 'ab***(3)');
  });
});

test('shellQuote', async (t) => {
  await t.test('普通字符串包裹单引号', () => {
    assert.strictEqual(utils.shellQuote('hello'), "'hello'");
  });
  await t.test('转义内部单引号', () => {
    assert.strictEqual(utils.shellQuote("a'b"), "'a'\\''b'");
  });
});

test('isValidPortValue', async (t) => {
  await t.test('空值视为合法', () => {
    assert.strictEqual(utils.isValidPortValue(''), true);
    assert.strictEqual(utils.isValidPortValue(0), true);
  });
  await t.test('合法端口范围 1-65535', () => {
    assert.strictEqual(utils.isValidPortValue('3006'), true);
    assert.strictEqual(utils.isValidPortValue('1'), true);
    assert.strictEqual(utils.isValidPortValue('65535'), true);
  });
  await t.test('越界端口非法', () => {
    assert.strictEqual(utils.isValidPortValue('65536'), false);
    assert.strictEqual(utils.isValidPortValue('-1'), false);
  });
});

test('isValidCompletionTimeoutValue', async (t) => {
  await t.test('空值视为合法', () => {
    assert.strictEqual(utils.isValidCompletionTimeoutValue(''), true);
  });
  await t.test('合法范围 2000-60000', () => {
    assert.strictEqual(utils.isValidCompletionTimeoutValue('2000'), true);
    assert.strictEqual(utils.isValidCompletionTimeoutValue('12000'), true);
    assert.strictEqual(utils.isValidCompletionTimeoutValue('60000'), true);
  });
  await t.test('越界非法', () => {
    assert.strictEqual(utils.isValidCompletionTimeoutValue('1999'), false);
    assert.strictEqual(utils.isValidCompletionTimeoutValue('60001'), false);
  });
});

test('envCheckItem', async (t) => {
  await t.test('构造检查项对象', () => {
    assert.deepStrictEqual(
      utils.envCheckItem('id1', '名称', 'ok', '详情', true),
      { id: 'id1', name: '名称', status: 'ok', detail: '详情', fixable: true }
    );
  });
});

test('jsonBlock / textBlock', async (t) => {
  await t.test('jsonBlock 生成 json 代码块', () => {
    assert.strictEqual(utils.jsonBlock({ a: 1 }), '```json\n{\n  "a": 1\n}\n```');
  });
  await t.test('textBlock 生成 text 代码块', () => {
    assert.strictEqual(utils.textBlock('hi'), '```text\nhi\n```');
  });
  await t.test('textBlock 空值回退为「无」', () => {
    assert.strictEqual(utils.textBlock(''), '```text\n无\n```');
  });
});
