import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mt = require('../../src/services/maxTokens.js');

test('formatTokens 按 1024 与 1000 两种口径给出易读结果', () => {
  const cases = [
    [4096, '4K'],
    [8192, '8K'],
    [16384, '16K'],
    [32768, '32K'],
    [65536, '64K'],
    [131072, '128K'],
    [1048576, '1M'],
    // 用户手填的十进制整数不该显示成 97.7K
    [100000, '100K'],
    [200000, '200K'],
    [60000, '60K'],
    [1000000, '1M'],
    [1024, '1K'],
    [999, '999'],
    [1, '1'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(mt.formatTokens(input), expected, `${input} 应显示为 ${expected}`);
  }
});

test('formatTokens 对非法值返回空串（调用方据此不显示）', () => {
  for (const v of [0, -1, null, undefined, '', '   ', 'abc', 1.5, NaN, Infinity, {}]) {
    assert.equal(mt.formatTokens(v), '', `${JSON.stringify(v)} 应返回空串`);
  }
});

test('formatTokens 接受字符串数字', () => {
  assert.equal(mt.formatTokens('32768'), '32K');
  assert.equal(mt.formatTokens(' 65536 '), '64K');
});

test('sanitizeMaxTokens 清洗与边界', () => {
  assert.equal(mt.sanitizeMaxTokens('32768'), 32768);
  assert.equal(mt.sanitizeMaxTokens(65536), 65536);
  // 非法 / 越界回落
  assert.equal(mt.sanitizeMaxTokens('abc'), mt.DEFAULT_MAX_TOKENS);
  assert.equal(mt.sanitizeMaxTokens(''), mt.DEFAULT_MAX_TOKENS);
  assert.equal(mt.sanitizeMaxTokens(null), mt.DEFAULT_MAX_TOKENS);
  assert.equal(mt.sanitizeMaxTokens(0), mt.DEFAULT_MAX_TOKENS);
  assert.equal(mt.sanitizeMaxTokens(-100), mt.DEFAULT_MAX_TOKENS);
  // 上限截断
  assert.equal(mt.sanitizeMaxTokens(99999999), mt.MAX_MAX_TOKENS);
  // 自定义 fallback
  assert.equal(mt.sanitizeMaxTokens('bad', -1), -1);
});

test('默认值与 proxy 侧兜底一致（32768），避免超上限截断', () => {
  // models.js 的 _runtimeConfig.maxTokens 与 chat.js 的 _ENV_MAX_TOKENS 都是 32768。
  // 历史上默认值被误改为 64000 曾导致 claude-opus 经中转生成被确定性截断。
  assert.equal(mt.DEFAULT_MAX_TOKENS, 32768);

  const models = readFileSyncSafe('src/proxy/handlers/models.js');
  const chat = readFileSyncSafe('src/proxy/handlers/chat.js');
  assert.ok(
    models.includes('process.env.MAX_TOKENS || "32768"'),
    'models.js 的兜底应与 DEFAULT_MAX_TOKENS 一致'
  );
  assert.ok(
    chat.includes("process.env.MAX_TOKENS || '32768'"),
    'chat.js 的兜底应与 DEFAULT_MAX_TOKENS 一致'
  );
});

function readFileSyncSafe(rel) {
  const fs = require('node:fs');
  const path = require('node:path');
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
}

test('预设档位覆盖真实输出上限区间且含推荐标注', () => {
  const values = mt.MAX_TOKENS_PRESETS.map((p) => p.value);
  // 升序且无重复
  assert.deepEqual(values, [...values].sort((a, b) => a - b), '档位应升序');
  assert.equal(new Set(values).size, values.length, '档位不应重复');
  // 默认值必须是其中一档，否则 UI 一打开就落到「自定义」
  assert.ok(values.includes(mt.DEFAULT_MAX_TOKENS), '默认值应命中某一档位');
  // 推荐标注只有一处
  const recommended = mt.MAX_TOKENS_PRESETS.filter((p) => p.label.includes('推荐'));
  assert.equal(recommended.length, 1, '应只有一个推荐档位');
  assert.equal(recommended[0].value, mt.DEFAULT_MAX_TOKENS, '推荐档位应为默认值');
  // label 里应带可读缩写，便于快速识别
  for (const p of mt.MAX_TOKENS_PRESETS) {
    assert.ok(
      p.label.startsWith(mt.formatTokens(p.value)),
      `${p.value} 的 label 应以 ${mt.formatTokens(p.value)} 开头`
    );
  }
});

test('isPresetMaxTokens 区分预设与自定义', () => {
  for (const p of mt.MAX_TOKENS_PRESETS) {
    assert.equal(mt.isPresetMaxTokens(p.value), true, `${p.value} 应识别为预设`);
    assert.equal(mt.isPresetMaxTokens(String(p.value)), true, '应接受字符串');
  }
  for (const v of [50000, 1, 999999, 'abc', null, 0]) {
    assert.equal(mt.isPresetMaxTokens(v), false, `${JSON.stringify(v)} 不应识别为预设`);
  }
});

test('告警阈值高于推荐值但不高于最大档位', () => {
  // 阈值用于提示「可能超出模型输出上限」，须落在合理区间
  assert.ok(mt.SAFE_MAX_TOKENS_HINT_THRESHOLD >= mt.DEFAULT_MAX_TOKENS);
  const maxPreset = Math.max(...mt.MAX_TOKENS_PRESETS.map((p) => p.value));
  assert.ok(mt.SAFE_MAX_TOKENS_HINT_THRESHOLD < maxPreset, '最高档位应触发告警');
});

test('webview 侧的预设常量与格式化逻辑与本模块保持一致', () => {
  // webview 无法 require 扩展侧模块，只能复制一份；两边漂移会导致回填错档
  const sidebarJs = readFileSyncSafe('resources/webviews/sidebar.js');
  const m = sidebarJs.match(/MAX_TOKENS_PRESET_VALUES = \[([^\]]+)\]/);
  assert.ok(m, 'sidebar.js 应定义 MAX_TOKENS_PRESET_VALUES');
  const webviewValues = m[1].split(',').map((s) => Number.parseInt(s.trim(), 10));
  assert.deepEqual(
    webviewValues,
    mt.MAX_TOKENS_PRESETS.map((p) => p.value),
    'webview 的预设值列表必须与 maxTokens.js 一致'
  );
  const t = sidebarJs.match(/MAX_TOKENS_WARN_THRESHOLD = (\d+)/);
  assert.ok(t, 'sidebar.js 应定义 MAX_TOKENS_WARN_THRESHOLD');
  assert.equal(
    Number.parseInt(t[1], 10),
    mt.SAFE_MAX_TOKENS_HINT_THRESHOLD,
    'webview 的告警阈值必须与 maxTokens.js 一致'
  );
});

test('profileStore 用统一清洗，方案往返不丢值', () => {
  const ps = require('../../src/services/profileStore.js');
  for (const v of ['4096', '32768', '131072']) {
    const p = ps.createDefaultProfile({ MAX_TOKENS: v });
    assert.equal(p.advanced.maxTokens, v, `profile 应捕获 ${v}`);
    assert.equal(ps.projectToEnvConfig(p).MAX_TOKENS, v, `应还原 ${v}`);
  }
  // 非法值统一回落，而非写入脏数据
  assert.equal(
    ps.createDefaultProfile({ MAX_TOKENS: 'abc' }).advanced.maxTokens,
    String(mt.DEFAULT_MAX_TOKENS)
  );
  // 老方案缺该字段
  const legacy = ps.createDefaultProfile({ MAX_TOKENS: '65536' });
  delete legacy.advanced.maxTokens;
  assert.equal(
    ps.projectToEnvConfig(legacy).MAX_TOKENS,
    String(mt.DEFAULT_MAX_TOKENS),
    '老方案应回落默认值'
  );
});

test('listProfiles 投影 maxTokens 供列表显示', () => {
  const ps = require('../../src/services/profileStore.js');
  const dir = require('node:fs').mkdtempSync(
    require('node:path').join(require('node:os').tmpdir(), 'byok-mt-')
  );
  const prev = process.env.DEVIN_BYOK_CONFIG_DIR;
  process.env.DEVIN_BYOK_CONFIG_DIR = dir;
  try {
    const list = ps.listProfiles({ MAX_TOKENS: '65536', BYOK1_MODEL: 'm', BYOK1_ANTHROPIC_API_KEY: 'k' });
    assert.ok(list.profiles.length > 0);
    assert.equal(typeof list.profiles[0].maxTokens, 'number', 'maxTokens 应为数字供格式化');
    assert.equal(list.profiles[0].maxTokens, 65536);
    assert.equal(mt.formatTokens(list.profiles[0].maxTokens), '64K');
  } finally {
    if (prev === undefined) delete process.env.DEVIN_BYOK_CONFIG_DIR;
    else process.env.DEVIN_BYOK_CONFIG_DIR = prev;
    require('node:fs').rmSync(dir, { recursive: true, force: true });
  }
});
