/**
 * UI 重构功能集成测试
 * 测试新增的 UI 功能是否正常工作
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');
const require = createRequire(import.meta.url);

// 渲染侧栏 HTML（模块化后 HTML 在 templates/partials，需渲染后校验）
function renderSidebarHtmlWith(over = {}) {
  const { renderSidebarHtml } = require(join(projectRoot, 'src/views/sidebarTemplate.js'));
  return renderSidebarHtml({
    nonce: 'n', cspSource: 'c', scriptUri: 's.js', cssUri: 'c.css',
    tmp02: { hybridPort: 3006, inferencePort: 3001, running: false, uptime: 0, requestCount: 0 },
    tmp2: {}, tmp8: '', tmp9: false, tmp10: 'n', tmp11: 'c', tmp12: 's.js', tmp12a: 't.css',
    tmp16: '#888', tmp17: '#888', tmp21: '#444',
    tmp25: '', tmp26: '', tmp27: '', tmp28: '', tmp29: '', tmp30: '', tmp31: '', tmp32: '',
    tmp3: '', tmp4: '', tmp5: false, tmp6: '', tmp34: 'badge-warning', tmp35: '未安装', tmp36: '等待日志...',
    ...over,
  });
}

function renderHtml() {
  return renderSidebarHtmlWith();
}

test('CSS 文件完整性', async (t) => {
  await t.test('sidebar.css 应该存在', () => {
    const cssPath = join(projectRoot, 'src/views/styles/sidebar.css');
    const css = readFileSync(cssPath, 'utf-8');
    assert.ok(css.length > 0, 'CSS 文件应该有内容');
  });

  await t.test('应该包含关键 CSS 类', () => {
    const cssPath = join(projectRoot, 'src/views/styles/sidebar.css');
    const css = readFileSync(cssPath, 'utf-8');

    const criticalClasses = [
      '.card', '.card-head',
      '.btn', '.btn-p', '.btn-d', '.btn-s',
      '.tabs', '.tab-btn', '.tab-content',
      '.log-box', '.log-line',
      '.fg', '.btns'
    ];

    criticalClasses.forEach(className => {
      assert.ok(css.includes(className), `CSS 应该包含 ${className}`);
    });
  });

  await t.test('应该包含 Tailwind 指令', () => {
    const cssPath = join(projectRoot, 'src/views/styles/sidebar.css');
    const css = readFileSync(cssPath, 'utf-8');

    assert.ok(css.includes('@tailwind base'), '应该包含 @tailwind base');
    assert.ok(css.includes('@tailwind components'), '应该包含 @tailwind components');
    assert.ok(css.includes('@tailwind utilities'), '应该包含 @tailwind utilities');
  });
});

test('Tailwind 配置', async (t) => {
  await t.test('tailwind.config.js 应该存在', () => {
    const configPath = join(projectRoot, 'tailwind.config.js');
    const config = readFileSync(configPath, 'utf-8');
    assert.ok(config.length > 0, 'Tailwind 配置应该有内容');
  });

  await t.test('应该配置正确的内容路径', () => {
    const configPath = join(projectRoot, 'tailwind.config.js');
    const config = readFileSync(configPath, 'utf-8');
    // 模块化后模板含 .html，content 应覆盖 views 下 js 与 html
    assert.ok(config.includes('src/views/**/*.{js,html}'), '应该扫描 views 下 js 与 html');
    assert.ok(config.includes('resources/webviews/**/*.js'), '应该包含 webviews 目录');
  });
});

test('sidebarTemplate.js 模块导出', async (t) => {
  await t.test('应该导出 renderSidebarHtml 函数', async () => {
    const templatePath = join(projectRoot, 'src/views/sidebarTemplate.js');
    const templateCode = readFileSync(templatePath, 'utf-8');

    assert.ok(templateCode.includes('renderSidebarHtml'), '应该定义 renderSidebarHtml 函数');
    assert.ok(templateCode.includes('module.exports'), '应该导出函数');
    assert.ok(templateCode.includes('renderSidebarHtml'), '应该导出 renderSidebarHtml');
  });

  await t.test('应该引入必要的依赖', async () => {
    const templatePath = join(projectRoot, 'src/views/sidebarTemplate.js');
    const templateCode = readFileSync(templatePath, 'utf-8');

    assert.ok(templateCode.includes('sidebarHtml'), '应该引入 sidebarHtml 模块');
    assert.ok(templateCode.includes('thinkingEffort'), '应该引入 thinkingEffort 模块');
  });
});

test('sidebar.js 事件处理', async (t) => {
  await t.test('应该包含 saveConfig 处理', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    assert.ok(sidebarCode.includes('saveConfig'), '应该有 saveConfig 处理');
  });

  await t.test('应该包含 clearLogs 处理', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    assert.ok(sidebarCode.includes('clearLogs'), '应该有 clearLogs 处理');
  });

  await t.test('应该包含 toggleLogPause 处理', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    assert.ok(sidebarCode.includes('toggleLogPause'), '应该有 toggleLogPause 处理');
  });

  await t.test('应该检查日志暂停状态', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    assert.ok(sidebarCode.includes('paused'), '应该检查暂停状态');
  });
});

test('Tab 顺序配置', async (t) => {
  await t.test('默认 tab 应该是 tab-config', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    // 需求：配置优先，默认进入配置连接页
    assert.ok(sidebarCode.includes('"tab-config"'), '默认 tab 应该是 tab-config');
  });

  await t.test('快捷键应该映射到正确的 tab', () => {
    const sidebarPath = join(projectRoot, 'resources/webviews/sidebar.js');
    const sidebarCode = readFileSync(sidebarPath, 'utf-8');
    // Cmd+1 → tab-config, Cmd+2 → tab-system, Cmd+3 → tab-control
    assert.ok(sidebarCode.includes('tab-config') && sidebarCode.includes('tab-system') && sidebarCode.includes('tab-control'), '快捷键应该映射到所有 tab');
  });
});

test('HTML 模板标签顺序', async (t) => {
  const html = renderHtml();

  await t.test('配置连接应该是第一个 tab', () => {
    const configTabIndex = html.indexOf('data-tab="tab-config"');
    const systemTabIndex = html.indexOf('data-tab="tab-system"');
    const controlTabIndex = html.indexOf('data-tab="tab-control"');

    assert.ok(configTabIndex > 0, '应该有配置连接 tab');
    assert.ok(configTabIndex < systemTabIndex, '配置连接应该在系统补丁之前');
    assert.ok(systemTabIndex < controlTabIndex, '系统补丁应该在控制状态之前');
  });

  await t.test('配置连接 tab 应该有 active 类', () => {
    const configTabMatch = html.match(/data-tab="tab-config"[^>]*>/);
    assert.ok(configTabMatch, '应该找到配置连接 tab');
    const buttonTag = html.substring(
      html.lastIndexOf('<button', configTabMatch.index),
      configTabMatch.index + configTabMatch[0].length
    );
    assert.ok(buttonTag.includes('active'), '配置连接 tab 应该有 active 类');
  });
});

test('使用教程默认折叠', async (t) => {
  const html = renderHtml();

  await t.test('使用教程应该有图标', () => {
    assert.ok(html.includes('📖 使用教程'), '应该有书本图标');
  });

  await t.test('使用教程应该有 collapsed 类（默认折叠）', () => {
    const tutorialToggle = html.match(/data-ws-toggle="tutorialBody"[^>]*>/);
    assert.ok(tutorialToggle, '应该找到使用教程切换按钮');
    // 从匹配位置向前找最近的 <div 标签起点
    const divStart = html.lastIndexOf('<div', tutorialToggle.index);
    const headDiv = html.substring(divStart, tutorialToggle.index + tutorialToggle[0].length);
    assert.ok(headDiv.includes('collapsed'), '使用教程 head 应该有 collapsed 类');
  });

  await t.test('tutorialBody 应该有 hidden 类（默认折叠）', () => {
    const tutorialBodyMatch = html.match(/id="tutorialBody"[^>]*>/);
    assert.ok(tutorialBodyMatch, '应该找到 tutorialBody');
    const bodyDiv = html.substring(
      html.lastIndexOf('<div', tutorialBodyMatch.index),
      tutorialBodyMatch.index + tutorialBodyMatch[0].length
    );
    assert.ok(bodyDiv.includes('hidden'), 'tutorialBody 应该有 hidden 类');
  });
});

test('高级路由配置可见性', async (t) => {
  const html = renderHtml();

  await t.test('应该有高级路由配置折叠区域', () => {
    assert.ok(html.includes('高级路由配置'), '应该有高级路由标题');
    assert.ok(html.includes('advancedRouteBody'), '应该有折叠区域 id');
  });

  await t.test('应该有 4 个配置项', () => {
    assert.ok(html.includes('cfgAnthropicPath'), '应该有 Anthropic 路径');
    assert.ok(html.includes('cfgOpenaiPath'), '应该有 OpenAI 路径');
    assert.ok(html.includes('cfgMaxTokens'), '应该有最大 Token');
    assert.ok(html.includes('cfgCompletionTimeoutMs'), '应该有超时配置');
  });

  await t.test('配置项应该是 input 而不是 hidden', () => {
    const anthropicMatch = html.match(/id="cfgAnthropicPath"[^>]*>/);
    assert.ok(anthropicMatch, '应该找到 cfgAnthropicPath');
    const inputTag = html.substring(
      html.lastIndexOf('<input', anthropicMatch.index),
      anthropicMatch.index + anthropicMatch[0].length
    );
    assert.ok(inputTag.includes('type="text"'), 'cfgAnthropicPath 应该是 text input');
  });
});

test('模型列表模式开关可见性', async (t) => {
  const html = renderHtml();
  const controlTab = readFileSync(
    join(projectRoot, 'src/views/templates/partials/control-tab.html'),
    'utf-8'
  );
  const configTab = readFileSync(
    join(projectRoot, 'src/views/templates/partials/config-tab.html'),
    'utf-8'
  );

  await t.test('必须在「控制状态」Tab 的代理控制卡片内', () => {
    // 放进方案编辑器会被三层折叠容器藏住（方案卡默认 hidden + 高级路由默认 collapsed），
    // 用户根本找不到；这里锁死它的位置
    assert.ok(
      controlTab.includes('cfgModelListMode'),
      '模型列表模式开关必须在 control-tab（常驻可见）'
    );
    assert.ok(
      !configTab.includes('cfgModelListMode'),
      '不应留在 config-tab 的折叠区域内'
    );
  });

  await t.test('不能被 hidden / collapsed 容器包裹', () => {
    const idx = controlTab.indexOf('cfgModelListMode');
    const before = controlTab.slice(0, idx);
    // 该控件之前最近的一个 div 不应带 hidden 类
    const lastDiv = before.lastIndexOf('<div');
    const enclosing = before.slice(lastDiv);
    assert.ok(
      !/class="[^"]*\bhidden\b/.test(enclosing),
      '所在容器不应带 hidden 类，否则默认不可见'
    );
  });

  await t.test('select 含三档且默认选中 replace', () => {
    const match = html.match(/<select id="cfgModelListMode"[^>]*>([\s\S]*?)<\/select>/);
    assert.ok(match, '应该渲染出 cfgModelListMode 的 select');
    const options = match[1];
    for (const value of ['inject', 'replace', 'off']) {
      assert.ok(options.includes(`value="${value}"`), `应该有 ${value} 选项`);
    }
    assert.ok(
      /value="replace" selected/.test(options),
      '未配置时应默认选中 replace（只显示 BYOK 槽位）'
    );
    // 替换是默认项，应排在第一个
    assert.ok(
      options.indexOf('value="replace"') < options.indexOf('value="inject"'),
      'replace 应作为默认项排在最前'
    );
  });

  await t.test('切换时走独立的立即落盘消息', () => {
    const sidebarJs = readFileSync(
      join(projectRoot, 'resources/webviews/sidebar.js'),
      'utf-8'
    );
    // 该控件不在方案编辑器内，自动保存（依赖 currentEditingProfile）不会触发，
    // 必须有专用的 setModelListMode 消息，否则选了没反应
    assert.ok(
      sidebarJs.includes('cfgModelListMode'),
      'sidebar.js 应监听 cfgModelListMode 的 change'
    );
    assert.ok(
      sidebarJs.includes('setModelListMode'),
      '应发送 setModelListMode 消息以立即落盘'
    );
    const provider = readFileSync(
      join(projectRoot, 'src/providers/sidebarProvider.js'),
      'utf-8'
    );
    assert.ok(
      provider.includes("case 'setModelListMode'"),
      'sidebarProvider 应处理 setModelListMode'
    );
  });
});

test('最大 Token 预设下拉 + 自定义', async (t) => {
  const configTab = readFileSync(
    join(projectRoot, 'src/views/templates/partials/config-tab.html'),
    'utf-8'
  );
  const mt = require(join(projectRoot, 'src/services/maxTokens.js'));

  await t.test('渲染为预设 select + 自定义输入框', () => {
    assert.ok(configTab.includes('id="cfgMaxTokensPreset"'), '应有预设下拉');
    assert.ok(configTab.includes('id="cfgMaxTokens"'), '应保留自定义输入框');
    assert.ok(configTab.includes('id="cfgMaxTokensHint"'), '应有当前值/告警提示');
  });

  await t.test('命中预设时选中该档并隐藏自定义框', () => {
    for (const p of mt.MAX_TOKENS_PRESETS) {
      const html = renderSidebarHtmlWith({ tmp2: { MAX_TOKENS: String(p.value) } });
      const sel = html.match(/<select id="cfgMaxTokensPreset"[^>]*>([\s\S]*?)<\/select>/)[1];
      assert.ok(
        new RegExp(`value="${p.value}" selected`).test(sel),
        `${p.value} 应被选中`
      );
      assert.ok(
        /id="cfgMaxTokens" class="hidden"/.test(html),
        `${p.value} 命中预设时应隐藏自定义框`
      );
    }
  });

  await t.test('非预设值落到自定义并展开输入框', () => {
    const html = renderSidebarHtmlWith({ tmp2: { MAX_TOKENS: '50000' } });
    const sel = html.match(/<select id="cfgMaxTokensPreset"[^>]*>([\s\S]*?)<\/select>/)[1];
    assert.ok(/value="custom" selected/.test(sel), '应选中「自定义」');
    assert.ok(!/id="cfgMaxTokens" class="hidden"/.test(html), '自定义框应可见');
    assert.ok(/id="cfgMaxTokens"[^>]*value="50000"/.test(html), '应回填实际值');
  });

  await t.test('缺省为推荐值 32K', () => {
    const html = renderSidebarHtmlWith({ tmp2: {} });
    const sel = html.match(/<select id="cfgMaxTokensPreset"[^>]*>([\s\S]*?)<\/select>/)[1];
    assert.ok(/value="32768" selected/.test(sel));
    assert.ok(sel.includes('推荐'), '32K 档位应标注推荐');
  });

  await t.test('高于阈值时提示可能被截断', () => {
    const high = renderSidebarHtmlWith({ tmp2: { MAX_TOKENS: '131072' } });
    assert.ok(high.includes('偏高'), '应提示偏高');
    assert.ok(/class="set-row-hint warn"/.test(high), '应带告警样式');
    const safe = renderSidebarHtmlWith({ tmp2: { MAX_TOKENS: '32768' } });
    assert.ok(!safe.includes('偏高'), '推荐值不应告警');
  });

  await t.test('webview 侧有联动与读取逻辑', () => {
    const sidebarJs = readFileSync(join(projectRoot, 'resources/webviews/sidebar.js'), 'utf-8');
    assert.ok(sidebarJs.includes('syncMaxTokensUI'), '应有预设/自定义联动');
    assert.ok(sidebarJs.includes('readMaxTokens'), '应有生效值读取');
    assert.ok(sidebarJs.includes('applyMaxTokensValue'), '应有回填逻辑');
    assert.ok(
      /MAX_TOKENS: readMaxTokens\(\)/.test(sidebarJs),
      '收集配置时应走 readMaxTokens（选预设时取下拉值）'
    );
    assert.ok(
      sidebarJs.includes("'cfgMaxTokensPreset'"),
      '预设下拉应加入自动保存白名单，否则切档不落盘'
    );
  });

  await t.test('方案列表显示格式化后的 Token 值', () => {
    const sidebarJs = readFileSync(join(projectRoot, 'resources/webviews/sidebar.js'), 'utf-8');
    assert.ok(sidebarJs.includes('formatTokensShort(p.maxTokens)'), '列表项应显示该值');
    assert.ok(sidebarJs.includes('profile-desc-tok'), '应有对应徽标样式');
    const css = readFileSync(join(projectRoot, 'resources/webviews/dist/sidebar.css'), 'utf-8');
    assert.ok(css.includes('.profile-desc-tok'), '构建产物应包含徽标样式');
  });
});

test('控制状态页排版与交互', async (t) => {
  const html = renderHtml();
  const controlTab = readFileSync(
    join(projectRoot, 'src/views/templates/partials/control-tab.html'),
    'utf-8'
  );

  await t.test('主操作占满整行且位于卡片顶部', () => {
    // 启动/停止是本页最主要的操作，必须先于次级操作出现并有最强视觉权重
    assert.ok(
      /btn btn-p btn-block" data-ws-action="startProxy"/.test(html),
      '主操作应带 btn-block 占满整行'
    );
    const iPrimary = html.indexOf('btn-block');
    const iMaint = html.indexOf('data-ws-action="maintenanceTools"');
    assert.ok(iPrimary < iMaint, '主操作应在次级操作之前');
  });

  await t.test('运行中时停止按钮同样占满整行', () => {
    const running = renderSidebarHtmlWith({
      tmp02: { hybridPort: 3006, inferencePort: 3001, running: true, uptime: 1000, requestCount: 5 },
    });
    assert.ok(/btn btn-d btn-block" data-ws-action="stopProxy"/.test(running));
  });

  await t.test('次级操作不与模板重复渲染', () => {
    // sidebar.js 的运行时渲染曾把 维护工具/仅保存配置 一并注入，导致页面出现两份
    const count = (s) =>
      (html.match(new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    assert.equal(count('data-ws-action="maintenanceTools"'), 1, '维护工具应只有一个');
    assert.equal(count('data-ws-action="newWindow"'), 1, '新窗口应只有一个');

    const sidebarJs = readFileSync(join(projectRoot, 'resources/webviews/sidebar.js'), 'utf-8');
    const rt = sidebarJs.match(/proxyControlButtons[\s\S]{0,900}?innerHTML = tmp02/);
    assert.ok(rt, '应找到运行时渲染逻辑');
    assert.ok(
      !/maintenanceTools|saveConfig/.test(rt[0]),
      '运行时渲染不应包含次级按钮，否则与模板重复'
    );
  });

  await t.test('端口默认折叠，收起时显示摘要', () => {
    // 端口是设置一次即长期不动的值，不该长期占据顶部空间
    assert.ok(
      /id="proxyPortsBody"[^>]*class="hidden"/.test(html),
      '端口区应默认折叠'
    );
    assert.ok(
      html.includes('id="proxyPortsSummary">3006 / 3001<'),
      '折叠时应在标题右侧显示当前端口'
    );
    const sidebarJs = readFileSync(join(projectRoot, 'resources/webviews/sidebar.js'), 'utf-8');
    assert.ok(
      sidebarJs.includes('proxyPortsSummary'),
      '端口摘要需随输入实时更新，否则会显示过期值'
    );
  });

  await t.test('两个开关使用统一的 set-row 结构', () => {
    // 此前两行分别是 label+toggle 左对齐、右侧一个按钮/一段文字，
    // 导致开关无法垂直对齐、右侧内容语义不一致
    assert.ok((controlTab.match(/class="set-row"/g) || []).length >= 2);
    for (const id of ['cfgAutoStartProxy', 'cfgPreferCascadeAgent']) {
      const i = controlTab.indexOf(id);
      const before = controlTab.slice(0, i);
      const rowStart = before.lastIndexOf('class="set-row"');
      assert.ok(rowStart > 0, `${id} 应位于 set-row 内`);
      assert.ok(
        before.slice(rowStart).includes('set-row-ctl'),
        `${id} 应放在 set-row-ctl 内以右对齐`
      );
    }
  });

  await t.test('说明文字在标签下方而非挤在控件旁', () => {
    assert.ok(
      /set-row-main[\s\S]{0,300}preferCascadeHintText/.test(controlTab),
      '提示应在 set-row-main 内占满宽度，长文案才不会挤压控件'
    );
  });

  await t.test('新增的 CSS 组件类已产出到构建产物', () => {
    const css = readFileSync(join(projectRoot, 'resources/webviews/dist/sidebar.css'), 'utf-8');
    for (const cls of ['set-row', 'set-row-main', 'set-row-ctl', 'set-row-hint', 'btn-block']) {
      assert.ok(css.includes('.' + cls), `构建产物应包含 .${cls}`);
    }
  });

  await t.test('不再声称切换模式需要重启代理', () => {
    // 已实现 reloadRuntimeConfig 热更新，旧文案是事实错误
    assert.ok(!html.includes('切换后需重启代理'));
    assert.ok(html.includes('即时生效'));
  });
});

test('默认 Cascade 开关', async (t) => {
  const controlTab = readFileSync(
    join(projectRoot, 'src/views/templates/partials/control-tab.html'),
    'utf-8'
  );

  await t.test('位于代理控制卡片且常驻可见', () => {
    assert.ok(controlTab.includes('cfgPreferCascadeAgent'), '开关应在 control-tab');
    const idx = controlTab.indexOf('cfgPreferCascadeAgent');
    const before = controlTab.slice(0, idx);
    const enclosing = before.slice(before.lastIndexOf('<div'));
    assert.ok(
      !/class="[^"]*\bhidden\b/.test(enclosing),
      '所在容器不应带 hidden 类'
    );
  });

  await t.test('默认渲染为开启状态', () => {
    const { renderSidebarHtml } = require(join(projectRoot, 'src/views/sidebarTemplate.js'));
    const html = renderSidebarHtml({
      nonce: 'n', cspSource: 'c', scriptUri: 's.js', cssUri: 'c.css',
      tmp02: { hybridPort: 3006, inferencePort: 3001, running: false, uptime: 0, requestCount: 0 },
      tmp2: {}, tmp8: '', tmp9: false, tmp10: 'n', tmp11: 'c', tmp12: 's.js', tmp12a: 't.css',
      tmp16: '#888', tmp17: '#888', tmp21: '#444',
      tmp25: '', tmp26: '', tmp27: '', tmp28: '', tmp29: '', tmp30: '', tmp31: '', tmp32: '',
      tmp3: '', tmp4: '', tmp5: false, tmp6: '',
      tmp34: 'badge-warning', tmp35: '未安装', tmp36: '…',
      preferCascadeChecked: true,
    });
    const match = html.match(/<input type="checkbox" id="cfgPreferCascadeAgent"([^>]*)>/);
    assert.ok(match, '应渲染出 cfgPreferCascadeAgent');
    assert.ok(/\bchecked\b/.test(match[1]), 'preferCascadeChecked=true 时应带 checked');
  });

  await t.test('关闭态不带 checked，且提示文案随外部偏好变化', () => {
    const { renderSidebarHtml } = require(join(projectRoot, 'src/views/sidebarTemplate.js'));
    const base = {
      nonce: 'n', cspSource: 'c', scriptUri: 's.js', cssUri: 'c.css',
      tmp02: { hybridPort: 3006, inferencePort: 3001, running: false, uptime: 0, requestCount: 0 },
      tmp2: {}, tmp8: '', tmp9: false, tmp10: 'n', tmp11: 'c', tmp12: 's.js', tmp12a: 't.css',
      tmp16: '#888', tmp17: '#888', tmp21: '#444',
      tmp25: '', tmp26: '', tmp27: '', tmp28: '', tmp29: '', tmp30: '', tmp31: '', tmp32: '',
      tmp3: '', tmp4: '', tmp5: false, tmp6: '',
      tmp34: 'badge-warning', tmp35: '未安装', tmp36: '…',
    };
    const off = renderSidebarHtml({ ...base, preferCascadeChecked: false });
    const m = off.match(/<input type="checkbox" id="cfgPreferCascadeAgent"([^>]*)>/);
    assert.ok(!/\bchecked\b/.test(m[1]), '关闭态不应带 checked');
    assert.ok(off.includes('避免新会话落到 Devin Local'), '默认提示文案');

    const foreign = renderSidebarHtml({
      ...base,
      preferCascadeChecked: false,
      preferCascadeForeign: 'claude-code',
    });
    assert.ok(
      foreign.includes('已手动指定为 claude-code'),
      '用户指定其他 agent 时应提示，避免误解为开关失灵'
    );
  });

  await t.test('模板占位符全部被解析（无残留 {{...}}）', () => {
    const { renderSidebarHtml } = require(join(projectRoot, 'src/views/sidebarTemplate.js'));
    const html = renderSidebarHtml({
      nonce: 'n', cspSource: 'c', scriptUri: 's.js', cssUri: 'c.css',
      tmp02: { hybridPort: 3006, inferencePort: 3001, running: false, uptime: 0, requestCount: 0 },
      tmp2: {}, tmp8: '', tmp9: false, tmp10: 'n', tmp11: 'c', tmp12: 's.js', tmp12a: 't.css',
      tmp16: '#888', tmp17: '#888', tmp21: '#444',
      tmp25: '', tmp26: '', tmp27: '', tmp28: '', tmp29: '', tmp30: '', tmp31: '', tmp32: '',
      tmp3: '', tmp4: '', tmp5: false, tmp6: '',
      tmp34: 'badge-warning', tmp35: '未安装', tmp36: '…',
      preferCascadeChecked: true,
    });
    // interpolate() 对未匹配的键会原样保留 {{key}}，会直接显示在 UI 上
    const leftovers = [...html.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    assert.deepEqual(leftovers, [], '不应有未解析的占位符: ' + leftovers.join(', '));
  });

  await t.test('与模型列表模式同处「模型接管」卡片', () => {
    // 两项都是「让 BYOK 槽位在 Devin 中可选」，归到一张卡片才能自解释
    const iModel = controlTab.indexOf('cfgModelListMode');
    const iCascade = controlTab.indexOf('cfgPreferCascadeAgent');
    const iCardHead = controlTab.indexOf('模型接管');
    assert.ok(iCardHead > 0, '应有「模型接管」卡片');
    assert.ok(iModel > iCardHead && iCascade > iCardHead, '两项都应在该卡片内');
  });

  await t.test('切换时发送 setPreferCascadeAgent 消息', () => {
    const sidebarJs = readFileSync(join(projectRoot, 'resources/webviews/sidebar.js'), 'utf-8');
    assert.ok(sidebarJs.includes('cfgPreferCascadeAgent'), 'sidebar.js 应监听该 change');
    assert.ok(sidebarJs.includes('setPreferCascadeAgent'), '应发送 setPreferCascadeAgent');
    const provider = readFileSync(join(projectRoot, 'src/providers/sidebarProvider.js'), 'utf-8');
    assert.ok(
      provider.includes("case 'setPreferCascadeAgent'"),
      'sidebarProvider 应处理该消息'
    );
  });

  await t.test('启动时应用默认开启（用户未显式关闭过）', () => {
    const ext = readFileSync(join(projectRoot, 'src/extension.js'), 'utf-8');
    assert.ok(ext.includes('preferCascadeAgentOnActivate'), 'activate 应调用应用逻辑');
    assert.ok(
      /KEY_PREFER_CASCADE\)\s*!==\s*false/.test(ext),
      '仅在未显式关闭时应用，避免覆盖用户的关闭意图'
    );
  });
});

test('日志功能完整性', async (t) => {
  const html = renderHtml();

  await t.test('日志应该在控制状态 tab', () => {
    const controlTabStart = html.indexOf('id="tab-control"');
    const logBoxIndex = html.indexOf('id="logBox"');
    assert.ok(controlTabStart > 0, '应该有控制状态 tab');
    assert.ok(logBoxIndex > controlTabStart, '日志应该在控制状态 tab 内');
  });

  await t.test('日志高度应该是 300px', () => {
    const logBoxMatch = html.match(/id="logBox"[^>]*>/);
    assert.ok(logBoxMatch, '应该找到 logBox');
    const logDiv = html.substring(
      html.lastIndexOf('<div', logBoxMatch.index),
      logBoxMatch.index + logBoxMatch[0].length
    );
    assert.ok(logDiv.includes('300px'), '日志高度应该是 300px');
  });

  await t.test('应该有日志控制按钮', () => {
    assert.ok(html.includes('data-ws-action="clearLogs"'), '应该有清空按钮');
    assert.ok(html.includes('data-ws-action="toggleLogPause"'), '应该有暂停按钮');
    assert.ok(html.includes('data-ws-action="copyLogs"'), '应该有复制按钮');
  });
});
