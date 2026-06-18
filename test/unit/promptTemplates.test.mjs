/**
 * promptTemplates.js 单元测试
 * 锁定从 sidebarProvider 抽离的提示词模板数据
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pt = require(join(__dirname, '../../src/services/promptTemplates.js'));

test('DEFAULT_SYSTEM_PROMPT', async (t) => {
  await t.test('包含三行核心定义', () => {
    assert.match(pt.DEFAULT_SYSTEM_PROMPT, /You are Devin Local/);
    assert.match(pt.DEFAULT_SYSTEM_PROMPT, /Prioritize correctness/);
    assert.strictEqual(pt.DEFAULT_SYSTEM_PROMPT.split('\n').length, 3);
  });
});

test('BUILT_IN_PROMPT_TEMPLATES', async (t) => {
  await t.test('共 6 个模板', () => {
    assert.strictEqual(pt.BUILT_IN_PROMPT_TEMPLATES.length, 6);
  });
  await t.test('默认模板内容等于 DEFAULT_SYSTEM_PROMPT', () => {
    const def = pt.BUILT_IN_PROMPT_TEMPLATES.find((t) => t.id === 'default');
    assert.strictEqual(def.content, pt.DEFAULT_SYSTEM_PROMPT);
  });
  await t.test('每个模板含 id/label/description/content', () => {
    for (const tpl of pt.BUILT_IN_PROMPT_TEMPLATES) {
      assert.ok(tpl.id && tpl.label && tpl.description && tpl.content, `模板 ${tpl.id} 字段完整`);
    }
  });
  await t.test('id 唯一', () => {
    const ids = pt.BUILT_IN_PROMPT_TEMPLATES.map((t) => t.id);
    assert.strictEqual(ids.length, new Set(ids).size);
  });
  await t.test('非默认模板均以默认提示词为前缀', () => {
    for (const tpl of pt.BUILT_IN_PROMPT_TEMPLATES.filter((t) => t.id !== 'default')) {
      assert.ok(tpl.content.startsWith(pt.DEFAULT_SYSTEM_PROMPT), `模板 ${tpl.id} 应以默认提示词开头`);
    }
  });
});
