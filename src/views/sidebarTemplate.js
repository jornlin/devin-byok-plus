/**
 * 侧栏 WebView HTML 模板渲染
 * 从 sidebarProvider.js 抽离，保持纯渲染职责
 */

const { esc, formatUptime } = require('./sidebarHtml');
const thinkingEffort = require('../services/thinkingEffort');

/**
 * 渲染侧栏 HTML
 * @param {Object} ctx - 渲染上下文（包含所有 tmp 变量）
 * @returns {string} 完整的 HTML 字符串
 */
function renderSidebarHtml(ctx) {
  // 解构常用变量（向后兼容）
  const {
    nonce, cspSource, scriptUri, cssUri,
    tmp02, tmp1, tmp2, tmp3, tmp4, tmp5, tmp6, tmp7, tmp8, tmp9, tmp10, tmp11, tmp12, tmp12a,
    tmp13, tmp14, tmp15, tmp16, tmp17, tmp18, tmp19, tmp20, tmp21, tmp22, tmp23, tmp24,
    tmp25, tmp26, tmp27, tmp28, tmp29, tmp30, tmp31, tmp32, tmp33, tmp34, tmp35, tmp36,
  } = ctx;

    return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${tmp11} 'unsafe-inline'; img-src ${tmp11} https: data:; script-src 'nonce-${tmp10}' ${tmp11};">
<link rel="stylesheet" href="${cssUri}"><link rel="stylesheet" href="${tmp12a}">
</head>
<body>

<div class="card">
    <div class="card-head between">
        <span class="toggle-section collapsed" data-ws-toggle="tutorialBody">使用教程</span>
        <span class="badge badge-ok">内置</span>
    </div>
    <div id="tutorialBody" class="guide-body hidden">
        <div class="guide-block">
            <b>快速使用</b>
            <ol>
                <li>分别为 BYOK #1 / #2 填写 Base URL、API Key，加载模型并选择模型；Claude/GPT 可设置思考强度。</li>
                <li>配置完成后点击一键启动。</li>
                <li>补丁就绪后重载窗口；Windsurf 里分别使用 <code>Claude Opus 4 BYOK</code> 与 <code>Claude Opus 4 Thinking BYOK</code>。</li>
            </ol>
        </div>
        <div class="guide-block">
            <b>日常使用</b>
            <ul>
                <li>只换 API Key 或模型：修改后会自动保存。</li>
                <li>聊天没有走代理：重新安装补丁并重载窗口。</li>
                <li>模型列表加载失败：检查 API Key、余额、网络和日志错误。</li>
            </ul>
        </div>
        <div class="guide-note">BYOK #1 对应 Windsurf 的 <code>Claude Opus 4 BYOK</code>；BYOK #2 对应 <code>Claude Opus 4 Thinking BYOK</code>。两套 API / 模型完全独立。</div>
    </div>
</div>

<div class="tabs">
    <button type="button" class="tab-btn active" data-tab="tab-system">
        系统补丁
        <span class="tab-badge hidden" id="systemBadge">!</span>
    </button>
    <button type="button" class="tab-btn" data-tab="tab-config">
        配置连接
        <span class="tab-badge hidden" id="configBadge">!</span>
    </button>
    <button type="button" class="tab-btn" data-tab="tab-control">
        控制状态
        <span class="tab-badge hidden" id="controlBadge">●</span>
    </button>
</div>

<div id="mainPanel" class="">
    <!-- hidden config fields, always active in the background -->
    <input type="hidden" id="cfgApiMode" value="unified_custom">
    <input type="hidden" id="cfgAnthropicPath" value="${esc(tmp2.ANTHROPIC_API_PATH || '/v1/messages')}">
    <input type="hidden" id="cfgOpenaiPath" value="${esc(tmp2.OPENAI_API_PATH || '/v1/responses')}">
    <input type="hidden" id="cfgMaxTokens" value="${esc(tmp2.MAX_TOKENS || '16384')}">
    <input type="hidden" id="cfgCompletionTimeoutMs" value="${esc(tmp2.COMPLETION_TIMEOUT_MS || '12000')}">
    <input type="hidden" id="cfgSysPromptOverride" value="${tmp9 ? 'true' : ''}">
    <input type="hidden" id="cfgSysPromptPath" value="${esc(tmp8)}">
    <input type="hidden" id="cfgDefaultModelCustom" value="">
    <div id="environmentCheckResult" class="env-check hidden"></div>
    <div id="proxyActionState" class="action-state hidden">
        <div id="proxyActionText" class="action-text"></div>
        <div class="action-progress"><div class="action-progress-bar"></div></div>
    </div>
    <div id="configActionState" class="action-state hidden">
        <div id="configActionText" class="action-text"></div>
        <div class="action-progress"><div class="action-progress-bar"></div></div>
    </div>

    <!-- TAB 1: Config -->
    <div class="tab-content active" id="tab-system">
        <div class="card" style="margin-bottom:12px">
            <div class="card-head between">
                <span>补丁管理</span>
                <span id="patchBadge" class="badge ${tmp34}">${tmp35}</span>
            </div>
            <input type="hidden" id="patchApiUrl" value="${esc(tmp3)}">
            <input type="hidden" id="patchInferenceUrl" value="${esc(tmp4)}">
            <div id="patchPathDisplay" class="patch-path">${tmp6 ? '<b>补丁路径</b> ' + esc(tmp6) : '<b>补丁路径</b> 自动检测；非默认安装请点"选择路径"'}</div>
    <div class="tab-content" id="tab-config">
        <div class="guide-block byok1-stripe" style="margin-bottom:10px">
            <b>BYOK #1 · Claude Opus 4 BYOK</b>
            <div class="fg"><label>Base URL（可选）</label><input type="text" id="cfgByok1Host" value="${tmp25}" placeholder="例如 api-a.example.com"></div>
            <div class="fg"><label>API Key</label><input type="password" id="cfgByok1Key" value="${tmp26}" placeholder="BYOK #1 API Key" autocomplete="off"></div>
            <div class="btns" style="margin-bottom:6px">
                <button type="button" class="btn btn-s sm" data-ws-action="importExternalConfig" data-ws-source="claude" data-ws-slot="1">导入 Claude 配置</button>
                <button type="button" class="btn btn-s sm" data-ws-action="importExternalConfig" data-ws-source="codex" data-ws-slot="1">导入 GPT 配置</button>
            </div>
            <div class="row" style="gap:6px;margin-bottom:6px">
                <select id="cfgByok1Model" style="flex:1;font-size:12px;padding:5px 8px">${tmp27 ? `<option value="${tmp27}" selected>${tmp27}</option>` : '<option value="" disabled selected>请先加载模型</option>'}</select>
                <button type="button" class="btn btn-s sm" data-ws-action="fetchModels" data-ws-slot="1" style="padding:4px 8px">加载模型</button>
            </div>
            <div class="fg" id="cfgByok1ThinkingEffortRow"><label id="cfgByok1ThinkingLabel">${esc(thinkingEffort.getThinkingIntensityHint(thinkingEffort.detectModelProvider(tmp27)))}</label><select id="cfgByok1ThinkingEffort">${thinkingEffort.buildThinkingEffortOptionsHtml(tmp27, tmp31)}</select></div>
            <div id="modelFetchStatus1" style="font-size:10px;color:${tmp17}"></div>
        </div>
        <div class="guide-block byok2-stripe" style="margin-bottom:10px">
            <b>BYOK #2 · Claude Opus 4 Thinking BYOK</b>
            <div class="fg"><label>Base URL（可选）</label><input type="text" id="cfgByok2Host" value="${tmp28}" placeholder="例如 api-b.example.com"></div>
            <div class="fg"><label>API Key</label><input type="password" id="cfgByok2Key" value="${tmp29}" placeholder="BYOK #2 API Key" autocomplete="off"></div>
            <div class="btns" style="margin-bottom:6px">
                <button type="button" class="btn btn-s sm" data-ws-action="importExternalConfig" data-ws-source="claude" data-ws-slot="2">导入 Claude 配置</button>
                <button type="button" class="btn btn-s sm" data-ws-action="importExternalConfig" data-ws-source="codex" data-ws-slot="2">导入 GPT 配置</button>
            </div>
            <div class="row" style="gap:6px;margin-bottom:6px">
                <select id="cfgByok2Model" style="flex:1;font-size:12px;padding:5px 8px">${tmp30 ? `<option value="${tmp30}" selected>${tmp30}</option>` : '<option value="" disabled selected>请先加载模型</option>'}</select>
                <button type="button" class="btn btn-s sm" data-ws-action="fetchModels" data-ws-slot="2" style="padding:4px 8px">加载模型</button>
            </div>
            <div class="fg" id="cfgByok2ThinkingEffortRow"><label id="cfgByok2ThinkingLabel">${esc(thinkingEffort.getThinkingIntensityHint(thinkingEffort.detectModelProvider(tmp30)))}</label><select id="cfgByok2ThinkingEffort">${thinkingEffort.buildThinkingEffortOptionsHtml(tmp30, tmp32)}</select></div>
            <div id="modelFetchStatus2" style="font-size:10px;color:${tmp17}"></div>
        </div>
        <div class="row between" style="margin-bottom:8px;padding:6px 8px;border:1px solid ${tmp21};border-radius:8px;background:rgba(255,255,255,.02)">
            <div style="min-width:0">
                <div style="font-size:10px;color:#a1a1aa;font-weight:600">提示词</div>
                <div style="font-size:9px;color:${tmp17};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tmp9 ? '已启用 · ' + esc(tmp8) : '未启用 · 使用 Devin Desktop 原始提示词'}</div>
            </div>
            <div class="row" style="gap:4px;flex-shrink:0">
                <button type="button" class="btn btn-s sm" data-ws-action="openPromptTemplates" style="padding:4px 8px">模板</button>
                <button type="button" class="btn btn-s sm" data-ws-action="openSystemPrompt" style="padding:4px 8px">自定义</button>
            </div>
        </div>
    </div>

    <!-- TAB 2: Control -->
    <div class="tab-content" id="tab-control">
        <div class="row" style="gap:6px;margin-bottom:12px">
            <div class="fg" style="flex:1;margin-bottom:0">
                <label>Hybrid 端口</label>
                <input type="number" id="cfgHybridPort" value="${esc(String(tmp02.hybridPort))}" placeholder="3006" min="1" max="65535">
            </div>
            <div class="fg" style="flex:1;margin-bottom:0">
                <label>Inference 端口</label>
                <input type="number" id="cfgInferencePort" value="${esc(String(tmp02.inferencePort))}" placeholder="3001" min="1" max="65535">
            </div>
        </div>
        <div class="btns" style="margin-bottom:12px" id="proxyControlButtons">
            ${tmp02.running ? '<button type="button" class="btn btn-d" data-ws-action="stopProxy">停止代理</button>' : '<button type="button" class="btn btn-p" data-ws-action="startProxy" data-ws-mode="both">一键启动</button>'}
            <button type="button" class="btn btn-s sm" data-ws-action="maintenanceTools">维护工具</button>
        </div>
        <div class="row between" style="margin-bottom:12px;padding:4px 0">
            <div class="row">
                <span style="font-size:11px;color:${tmp16}">自动启动</span>
                <label class="tog"><input type="checkbox" id="cfgAutoStartProxy" ${tmp5 ? 'checked' : ''}><span></span></label>
            </div>
            <button type="button" class="btn btn-s sm" data-ws-action="newWindow" style="font-size:10px;padding:3px 8px">新窗口</button>
        </div>
        <div class="card" style="margin-bottom:0">
            <div class="card-head" id="proxyStatusTitle">运行状态</div>
            <div class="stats">
                <div class="st"><b id="statPort">${tmp02.hybridPort}</b><small>端口</small></div>
                <div class="st"><b id="statUptime">${tmp02.running ? formatUptime(tmp02.uptime) : '--'}</b><small>时长</small></div>
                <div class="st"><b id="statRequests">${tmp02.requestCount}</b><small>请求</small></div>
            </div>
        </div>
    </div>

    <!-- TAB 3: System -->
            <div class="btns" style="margin-bottom:8px">
                <button type="button" class="btn btn-s sm" data-ws-action="locateExtJs">选择路径</button>
                <button type="button" class="btn btn-s sm" data-ws-action="clearExtJsPath">自动检测</button>
                <button type="button" class="btn btn-s sm" data-ws-action="refreshPatchStatus">刷新状态</button>
            </div>
            <div class="btns" id="patchActionButtons">
                <button type="button" class="btn btn-p sm" data-ws-action="applyPatch">安装补丁</button>
                <button type="button" class="btn btn-s sm" data-ws-action="revertPatch">还原</button>
            </div>
            <div id="patchActionState" class="action-state hidden">
                <div id="patchActionText" class="action-text"></div>
                <div class="action-progress"><div class="action-progress-bar"></div></div>
            </div>
        </div>
        <div class="card" style="margin-bottom:0">
            <div class="card-head between">
                <span class="toggle-section" data-ws-toggle="logBody">日志</span>
                <button type="button" class="btn btn-s sm" data-ws-action="copyLogs" style="font-size:10px;padding:3px 6px">复制</button>
            </div>
            <div id="logBody">
                <div class="log-box" id="logBox">${tmp36}</div>
                <div id="copyToast" style="display:none;text-align:center;color:#34d399;font-size:10px;margin-top:4px">已复制</div>
            </div>
        </div>
    </div>
</div>

<script nonce="${tmp10}" src="${tmp12}"></script>
</body>
</html>`;
}

module.exports = { renderSidebarHtml };
