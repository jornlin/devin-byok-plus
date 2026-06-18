/**
 * 侧栏 WebView HTML 模板渲染（模块化版本）
 * 使用独立的 HTML 模板文件，提升可维护性
 */

const { esc, formatUptime } = require('./sidebarHtml');
const thinkingEffort = require('../services/thinkingEffort');
const { renderSidebar } = require('./templates');

/**
 * 渲染侧栏 HTML
 * @param {Object} ctx - 渲染上下文（包含所有 tmp 变量）
 * @returns {string} 完整的 HTML 字符串
 */
function renderSidebarHtml(ctx) {
  // 解构常用变量
  const {
    nonce, cspSource, scriptUri, cssUri,
    tmp02, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, tmp9, tmp10, tmp11, tmp12, tmp12a,
    tmp13, tmp14, tmp15, tmp16, tmp17, tmp18, tmp19, tmp20, tmp21, tmp22, tmp23, tmp24,
    tmp25, tmp26, tmp27, tmp28, tmp29, tmp30, tmp31, tmp32, tmp33, tmp34, tmp35, tmp36,
  } = ctx;

  // BYOK 卡片折叠/状态：#1 主槽位始终展开；#2 可选槽位未配置时折叠
  const byok1Configured = !!(tmp25 || tmp26);
  const byok2Configured = !!(tmp28 || tmp29);
  const byok2Collapsed = !byok2Configured;

  // 准备模板数据
  const templateData = {
    // CSP 和资源
    nonce: tmp10,
    cspSource: tmp11,
    cssUri: cssUri,
    tailwindCssUri: tmp12a,
    scriptUri: tmp12,

    // 全局状态栏数据
    statusDotClass: tmp02.running ? 'running' : 'stopped',
    statusText: tmp02.running ? '运行中' : '已停止',
    statusInfo: tmp02.running ? `
      <span class="status-info">
        Hybrid: <span class="status-value">${tmp02.hybridPort}</span>
      </span>
      <span class="status-info">
        Inference: <span class="status-value">${tmp02.inferencePort}</span>
      </span>
      <span class="status-info">
        请求: <span class="status-value">${tmp02.requestCount}</span>
      </span>
      <span class="status-info">
        运行: <span class="status-value">${formatUptime(tmp02.uptime)}</span>
      </span>
    ` : '',
    statusBarButton: tmp02.running ? `
      <button type="button" class="btn btn-d"
              data-ws-action="stopProxy"
              style="min-height: 24px; padding: 4px 12px; font-size: 10px;">
        停止
      </button>
    ` : `
      <button type="button" class="btn btn-p"
              data-ws-action="startProxy" data-ws-mode="both"
              style="min-height: 24px; padding: 4px 12px; font-size: 10px;">
        启动
      </button>
    `,

    // 隐藏配置字段
    sysPromptOverride: tmp9 ? 'true' : '',
    sysPromptPath: esc(tmp8),

    // BYOK #1 配置数据（转义在此统一处理，getHtml 传入原始值）
    byok1Host: esc(tmp25),
    byok1Key: esc(tmp26),
    byok1ModelOption: tmp27 ? `<option value="${esc(tmp27)}" selected>${esc(tmp27)}</option>` : '<option value="" disabled selected>请先加载模型</option>',
    byok1ThinkingLabel: esc(thinkingEffort.getThinkingIntensityHint(thinkingEffort.detectModelProvider(tmp27))),
    byok1ThinkingOptions: thinkingEffort.buildThinkingEffortOptionsHtml(tmp27, tmp31),
    // BYOK #1 卡片状态（主槽位始终展开）
    byok1HeadCollapsed: '',
    byok1BodyHidden: '',
    byok1BadgeClass: byok1Configured ? 'badge-ok' : 'badge-warn',
    byok1BadgeText: byok1Configured ? '已配置' : '未配置',

    // BYOK #2 配置数据
    byok2Host: esc(tmp28),
    byok2Key: esc(tmp29),
    byok2ModelOption: tmp30 ? `<option value="${esc(tmp30)}" selected>${esc(tmp30)}</option>` : '<option value="" disabled selected>请先加载模型</option>',
    byok2ThinkingLabel: esc(thinkingEffort.getThinkingIntensityHint(thinkingEffort.detectModelProvider(tmp30))),
    byok2ThinkingOptions: thinkingEffort.buildThinkingEffortOptionsHtml(tmp30, tmp32),
    // BYOK #2 卡片状态（可选槽位未配置时折叠）
    byok2HeadCollapsed: byok2Collapsed ? 'collapsed' : '',
    byok2BodyHidden: byok2Collapsed ? 'hidden' : '',
    byok2BadgeClass: byok2Configured ? 'badge-ok' : 'badge-warn',
    byok2BadgeText: byok2Configured ? '已配置' : '未配置',

    // 提示词状态
    promptStatus: tmp9 ? '已启用 ' + esc(tmp8) : '未启用 · 使用 Devin Desktop 原始提示词',
    promptBadgeClass: tmp9 ? 'badge-ok' : 'badge-warn',
    promptBadgeText: tmp9 ? '已启用' : '未启用',

    // 高级路由配置
    anthropicPath: esc(tmp2.ANTHROPIC_API_PATH || '/v1/messages'),
    openaiPath: esc(tmp2.OPENAI_API_PATH || '/v1/responses'),
    maxTokens: esc(tmp2.MAX_TOKENS || '16384'),
    completionTimeout: esc(tmp2.COMPLETION_TIMEOUT_MS || '12000'),

    // 颜色变量
    textColor: tmp17,
    borderColor: tmp21,
    inputFgColor: tmp16,

    // 补丁管理数据
    patchBadgeClass: tmp34,
    patchBadgeText: tmp35,
    patchApiUrl: esc(tmp3),
    patchInferenceUrl: esc(tmp4),
    patchPathDisplay: tmp6 ? '<b>补丁路径</b> ' + esc(tmp6) : '<b>补丁路径</b> 自动检测；非默认安装请点"选择路径"',

    // 流程可视化数据
    flowStep1Class: (tmp26 || tmp29) ? 'completed' : 'active',
    flowStep1Icon: (tmp26 || tmp29) ? '✓' : '1',
    flowStep1LabelClass: (tmp26 || tmp29) ? 'completed' : 'active',

    flowDivider1Class: (tmp26 || tmp29) ? 'completed' : 'pending',

    flowStep2Class: tmp34 === 'badge-ok' ? 'completed' : (tmp26 || tmp29) ? 'active' : 'pending',
    flowStep2Icon: tmp34 === 'badge-ok' ? '✓' : '2',
    flowStep2LabelClass: tmp34 === 'badge-ok' ? 'completed' : (tmp26 || tmp29) ? 'active' : 'pending',

    flowDivider2Class: tmp34 === 'badge-ok' ? 'completed' : 'pending',

    flowStep3Class: tmp02.running ? 'completed' : tmp34 === 'badge-ok' ? 'active' : 'pending',
    flowStep3Icon: tmp02.running ? '✓' : '3',
    flowStep3LabelClass: tmp02.running ? 'completed' : tmp34 === 'badge-ok' ? 'active' : 'pending',

    flowHintText: !(tmp26 || tmp29) ? '💡 请先在「⚙️ 配置连接」页配置 BYOK #1 或 #2 的 API Key' :
      tmp34 !== 'badge-ok' ? '💡 配置完成！请在「🔧 系统补丁」页点击「安装补丁」' :
      !tmp02.running ? '💡 补丁已就绪，点击下方「一键启动」按钮开始使用' :
      '✅ 全部完成！代理正在运行中，可在 Windsurf 中使用 BYOK 模型',

    // 控制状态数据
    hybridPort: esc(String(tmp02.hybridPort)),
    inferencePort: esc(String(tmp02.inferencePort)),
    proxyControlButtons: tmp02.running ? '<button type="button" class="btn btn-d" data-ws-action="stopProxy">停止代理</button>' : '<button type="button" class="btn btn-p" data-ws-action="startProxy" data-ws-mode="both">一键启动</button>',
    autoStartChecked: tmp5 ? 'checked' : '',

    // 统计数据
    statPort: tmp02.hybridPort,
    statUptime: tmp02.running ? formatUptime(tmp02.uptime) : '--',
    statRequests: tmp02.requestCount,

    // 日志内容
    logContent: tmp36,
  };

  // 使用模板加载器渲染
  return renderSidebar(templateData);
}

module.exports = { renderSidebarHtml };
