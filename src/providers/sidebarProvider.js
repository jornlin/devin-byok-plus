'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.SidebarProvider = undefined;
let vscode;
try {
  vscode = require('vscode');
} catch {
  vscode = {
    window: {
      showInformationMessage: () => undefined,
      showWarningMessage: () => undefined,
      showErrorMessage: () => undefined,
      showQuickPick: () => undefined,
      showOpenDialog: () => undefined,
      createStatusBarItem: () => ({
        text: '',
        tooltip: '',
        command: '',
        show: () => undefined,
        dispose: () => undefined,
      }),
    },
    workspace: {
      openTextDocument: () => undefined,
    },
    env: {
      clipboard: {
        writeText: () => undefined,
      },
    },
    Uri: {
      joinPath: () => ({}),
    },
    StatusBarAlignment: {
      Left: 1,
    },
  };
}
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const os = require('os');
const child_process_1 = require('child_process');
const patchManager_1 = require('../managers/patchManager');
const reloadWorkbench_1 = require('../utils/reloadWorkbench');
const thinkingEffort_1 = require('../services/thinkingEffort');
const externalConfigImporter_1 = require('../services/externalConfigImporter');
const sidebarHtml_1 = require('../views/sidebarHtml');
const gatewayUrl_1 = require('../utils/gatewayUrl');
const KEY_AUTO_START_PROXY = 'devin-byok-plus.autoStartProxy';
const KEY_PATCH_EXTENSION_PATH = 'devin-byok-plus.patchExtensionPath';
const LEGACY_KEY_PATCH_EXTENSION_PATH = 'windsurf-byok-plus.patchExtensionPath';
const LEGACY_KEY_PATCH_EXTENSION_PATH_2 = 'devin-byok-plus.patchExtensionPath';
const DEFAULT_SYSTEM_PROMPT = [
  "You are Devin Local, Devin Desktop's software engineering assistant.",
  'Help the user solve coding tasks through implementation, debugging, code review, and repository-aware reasoning.',
  'Prioritize correctness, low-risk changes, and forward progress.',
].join('\n');
const tmp0 = {
  id: 'default',
  label: '默认工程助手',
  description: '通用编码、调试、代码审查',
  content: DEFAULT_SYSTEM_PROMPT,
};
const BUILT_IN_PROMPT_TEMPLATES = [
  tmp0,
  {
    id: 'code-review',
    label: '代码审查增强',
    description: '优先发现逻辑风险、配置污染和回归点',
    content: [
      DEFAULT_SYSTEM_PROMPT,
      '',
      'Focus on code review before making changes.',
      'Identify root causes, config pollution, runtime mapping mistakes, compatibility risks, and regression paths.',
      'Prefer small, low-risk fixes and verify behavior with compile or targeted tests.',
      'When reporting findings, clearly separate confirmed issues from hypotheses.',
    ].join('\n'),
  },
  {
    id: 'slow-request',
    label: '慢请求诊断',
    description: '定位代理、模型加载、上游首包和网络耗时',
    content: [
      DEFAULT_SYSTEM_PROMPT,
      '',
      'When debugging slow requests, map the full request path first.',
      'Separate local proxy delay from upstream/network/model first-token latency using timing logs.',
      'Check model loading, runtime hot reload, provider host/key mapping, cache invalidation, and request forwarding.',
      'Avoid masking latency symptoms; fix wrong routing or config causes first.',
    ].join('\n'),
  },
  {
    id: 'frontend-ui',
    label: '前端 UI 实现',
    description: '侧重交互、布局、状态反馈和可用性',
    content: [
      DEFAULT_SYSTEM_PROMPT,
      '',
      'When building UI, prioritize clarity, responsive layout, accessible controls, and immediate state feedback.',
      'Keep user flows simple, avoid surprising destructive actions, and preserve existing styling conventions.',
      'Verify UI data flow from controls to persisted config and runtime behavior.',
    ].join('\n'),
  },
  {
    id: 'backend-debug',
    label: '后端接口调试',
    description: '侧重接口链路、错误处理和运行时状态',
    content: [
      DEFAULT_SYSTEM_PROMPT,
      '',
      'When debugging backend or proxy code, trace inputs, normalized config, runtime config, network calls, and error propagation.',
      'Add or use targeted diagnostics instead of guessing.',
      'Prefer fixes that address the authoritative state and all relevant call sites.',
    ].join('\n'),
  },
  {
    id: 'zh-concise',
    label: '中文简洁模式',
    description: '中文回复，直接给结论和执行结果',
    content: [
      DEFAULT_SYSTEM_PROMPT,
      '',
      'Respond in Chinese unless the user asks otherwise.',
      'Be concise and direct. Start with the conclusion, then list actions and verification results.',
      'Use short Markdown sections and avoid unnecessary background explanation.',
    ].join('\n'),
  },
];
const DIAGNOSTIC_OPENAI_PREFIXES = ['gpt-', 'MODEL_GPT'];
const DIAGNOSTIC_MODEL_MAP = {
  'gpt-5-4-low': 'gpt-5.4',
  'gpt-5-4-high': 'gpt-5.4',
  'gpt-5-4-xhigh': 'gpt-5.4',
  'gpt-5-4-xhigh-priority': 'gpt-5.4',
  MODEL_GPT_4O: 'gpt-4o',
  MODEL_GPT_4O_MINI: 'gpt-4o-mini',
  MODEL_CLAUDE_3_5_SONNET: 'claude-sonnet-4-20250514',
  MODEL_CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-20241022',
  MODEL_CLAUDE_3_OPUS: '__DEFAULT__',
  MODEL_CLAUDE_4_OPUS: '__DEFAULT__',
  MODEL_CLAUDE_4_OPUS_BYOK: '__DEFAULT__',
  MODEL_CLAUDE_4_OPUS_THINKING_BYOK: '__DEFAULT__',
  MODEL_CLAUDE_OPUS_4: '__DEFAULT__',
  MODEL_CLAUDE_OPUS_4_1: '__DEFAULT__',
  MODEL_CLAUDE_SONNET_4: 'claude-sonnet-4-20250514',
  MODEL_SWE_1: 'claude-sonnet-4-20250514',
  MODEL_SWE_1_5: 'claude-sonnet-4-20250514',
  MODEL_SWE_1_5_SLOW: 'claude-sonnet-4-20250514',
  MODEL_CHAT_11121: '__DEFAULT__',
  'claude-opus-4-6-thinking': 'claude-opus-4-6-thinking',
  'claude-opus-4-7-thinking': 'claude-opus-4-7-thinking',
  'claude-opus-4-8-thinking': 'claude-opus-4-8-thinking',
  'claude-opus-4-6': 'claude-opus-4-6',
  'claude-opus-4-7': 'claude-opus-4-7',
  'claude-opus-4-8': 'claude-opus-4-8',
  'claude-sonnet-4-6-thinking': 'claude-sonnet-4-20250514-thinking',
  MODEL_GOOGLE_GEMINI_2_5_FLASH: '__DEFAULT__',
  MODEL_GOOGLE_GEMINI_2_5_PRO: '__DEFAULT__',
  MODEL_CHAT: '__DEFAULT__',
};
function getWebviewNonce() {
  let tmp02 = '';
  const tmp1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let tmp03 = 0; tmp03 < 32; tmp03++) {
    tmp02 += tmp1.charAt(Math.floor(Math.random() * tmp1.length));
  }
  return tmp02;
}
class SidebarProvider {
  constructor(tmp02, tmp1) {
    this.context = tmp02;
    this.logLines = [];
    this.lastStatusPostMs = 0;
    this.proxyManager = tmp1;
    this.proxyManager.onLog((arg0) => {
      this.logLines.push(arg0);
      if (this.logLines.length > 200) {
        this.logLines = this.logLines.slice(-100);
      }
      if (this.view) {
        const tmp03 = {
          type: 'log',
          line: arg0,
        };
        this.view.webview.postMessage(tmp03);
        const tmp12 = Date.now();
        if (tmp12 - this.lastStatusPostMs > 500) {
          this.lastStatusPostMs = tmp12;
          this.view.webview.postMessage({
            type: 'status',
            proxy: this.proxyManager.getStatus(),
          });
        }
      }
    });
  }
  renderFallbackHtml(tmp02) {
    const tmp1 = esc(tmp02 instanceof Error ? tmp02.message : String(tmp02));
    return (
      '<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>body{font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',system-ui,sans-serif;padding:12px;color:var(--vscode-foreground);background:var(--vscode-sideBar-background,var(--vscode-editor-background));font-size:12px;line-height:1.5}.box{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:12px;background:var(--vscode-editorWidget-background)}b{display:block;margin-bottom:6px;color:var(--vscode-errorForeground,#f87171)}code{word-break:break-all}</style></head><body><div class="box"><b>控制面板加载失败</b><div><code>' +
      tmp1 +
      '</code></div><div style="margin-top:8px">请重载窗口或重新打开侧栏。</div></div></body></html>'
    );
  }
  resolveWebviewView(tmp02) {
    this.view = tmp02;
    const tmp1 = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };
    tmp02.webview.options = tmp1;
    try {
      tmp02.webview.html = this.getHtml();
    } catch (tmp03) {
      const tmp12 = tmp03 instanceof Error ? tmp03.stack || tmp03.message : String(tmp03);
      this.logLines.push('侧栏加载失败: ' + tmp12);
      if (this.logLines.length > 200) {
        this.logLines = this.logLines.slice(-100);
      }
      tmp02.webview.html = this.renderFallbackHtml(tmp03);
      vscode.window.showErrorMessage(
        'Devin BYOK Bridge 控制面板加载失败：' +
          (tmp03 instanceof Error ? tmp03.message : String(tmp03))
      );
    }
    tmp02.webview.onDidReceiveMessage((arg0) => this.handleMessage(arg0));
    if (this.proxyManager.getStatus().running) {
      this.refresh();
    }
  }
  async measureTcpLatency(tmp02, tmp1 = 443, tmp2 = 3000) {
    const tmp3 = Date.now();
    return new Promise((fn) => {
      let tmp12 = false;
      const tmp22 = {
        host: tmp02,
        port: tmp1,
      };
      const tmp32 = net.createConnection(tmp22);
      const fn2 = (arg0, arg1) => {
        if (tmp12) {
          return;
        }
        tmp12 = true;
        tmp32.destroy();
        fn({
          ok: arg0,
          latencyMs: Date.now() - tmp3,
          error: arg1,
        });
      };
      tmp32.setTimeout(tmp2);
      tmp32.once('connect', () => fn2(true));
      tmp32.once('timeout', () => fn2(false, 'timeout'));
      tmp32.once('error', (arg0) => fn2(false, arg0.message));
    });
  }
  async checkHttpHealth(tmp02, tmp1 = 5000) {
    const tmp2 = Date.now();
    return new Promise((fn) => {
      let tmp12 = false;
      const fn2 = (arg0) => {
        if (tmp12) {
          return;
        }
        tmp12 = true;
        fn({
          ...arg0,
          elapsedMs: Date.now() - tmp2,
        });
      };
      const tmp3 = new URL(tmp02);
      const tmp4 = tmp3.protocol === 'http:' ? http : https;
      const tmp5 = {
        method: 'GET',
        timeout: tmp1,
        agent: false,
      };
      const tmp6 = tmp4.request(tmp3, tmp5, (arg0) => {
        arg0.resume();
        arg0.on('end', () =>
          fn2({
            ok: !!arg0.statusCode && arg0.statusCode >= 200 && arg0.statusCode < 400,
            statusCode: arg0.statusCode,
          })
        );
      });
      tmp6.on('error', (arg0) =>
        fn2({
          ok: false,
          error: arg0.message,
        })
      );
      tmp6.on('timeout', () => {
        tmp6.destroy();
        fn2({
          ok: false,
          error: 'timeout',
        });
      });
      tmp6.end();
    });
  }
  refresh() {
    if (!this.view) {
      return;
    }
    this.postStatusSnapshot();
  }
  async postStatusSnapshot() {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: 'status',
      proxy: this.proxyManager.getStatus(),
      patch: this.getPatchStatus(),
      config: this.getModeScopedConfig(),
      logs: this.logLines.slice(-50),
    });
  }
  getStoredPatchExtensionPath() {
    let tmp02 = this.context.globalState.get(KEY_PATCH_EXTENSION_PATH);
    if (!tmp02) {
      tmp02 = this.context.globalState.get(LEGACY_KEY_PATCH_EXTENSION_PATH_2);
      if (tmp02) {
        this.context.globalState.update(KEY_PATCH_EXTENSION_PATH, tmp02);
      }
    }
    if (!tmp02) {
      tmp02 = this.context.globalState.get(LEGACY_KEY_PATCH_EXTENSION_PATH);
      if (tmp02) {
        this.context.globalState.update(KEY_PATCH_EXTENSION_PATH, tmp02);
      }
    }
    if (typeof tmp02 === 'string' && tmp02.trim()) {
      return tmp02.trim();
    } else {
      return undefined;
    }
  }
  getModeScopedConfig(tmp02 = this.proxyManager.readEnvConfig()) {
    const tmp1 = this.normalizeProviderBaseUrl({
      ...tmp02,
    });
    if (!String(tmp1.BYOK1_MODEL || '').trim()) {
      tmp1.BYOK1_ANTHROPIC_API_HOST =
        tmp1.BYOK1_ANTHROPIC_API_HOST || tmp1.ANTHROPIC_API_HOST || '';
      tmp1.BYOK1_ANTHROPIC_API_KEY = tmp1.BYOK1_ANTHROPIC_API_KEY || tmp1.ANTHROPIC_API_KEY || '';
      tmp1.BYOK1_OPENAI_API_HOST =
        tmp1.BYOK1_OPENAI_API_HOST || tmp1.OPENAI_API_HOST || tmp1.BYOK1_ANTHROPIC_API_HOST || '';
      tmp1.BYOK1_OPENAI_API_KEY =
        tmp1.BYOK1_OPENAI_API_KEY || tmp1.OPENAI_API_KEY || tmp1.BYOK1_ANTHROPIC_API_KEY || '';
      tmp1.BYOK1_MODEL = tmp1.DEFAULT_MODEL || '';
    }
    if (!String(tmp1.BYOK1_THINKING_EFFORT || '').trim()) {
      tmp1.BYOK1_THINKING_EFFORT = tmp1.OPENAI_REASONING_EFFORT || '';
    }
    return tmp1;
  }
  validateByokSlots(tmp02) {
    const tmp1 = [];
    if (!String(tmp02.BYOK1_ANTHROPIC_API_KEY || '').trim()) {
      tmp1.push('BYOK #1 未填写 API Key');
    }
    if (!String(tmp02.BYOK1_MODEL || '').trim()) {
      tmp1.push('BYOK #1 未选择模型');
    }
    if (!String(tmp02.BYOK2_ANTHROPIC_API_KEY || '').trim()) {
      tmp1.push('BYOK #2 未填写 API Key');
    }
    if (!String(tmp02.BYOK2_MODEL || '').trim()) {
      tmp1.push('BYOK #2 未选择模型');
    }
    return tmp1;
  }
  getRuntimeConfigForCurrentMode(tmp02 = this.proxyManager.readEnvConfig()) {
    return this.getModeScopedConfig(tmp02);
  }
  writeModeScopedConfig(tmp02) {
    const merged = this.normalizeProviderBaseUrl({
      ...this.proxyManager.readEnvConfig(),
      ...tmp02,
    });
    this.proxyManager.writeEnvConfig(merged);
    return merged;
  }
  normalizeModelsResponse(tmp02) {
    if (tmp02?.data && Array.isArray(tmp02.data)) {
      const tmp03 = tmp02.data.map((arg0) => ({
        id: arg0.id,
        provider: /claude|anthropic/i.test(arg0.id) ? 'anthropic' : 'openai',
      }));
      const tmp1 = tmp03.filter((arg0) => arg0.provider === 'anthropic');
      const tmp2 = tmp03.filter((arg0) => arg0.provider === 'openai');
      const tmp3 = {
        models: tmp1,
      };
      const tmp4 = {
        models: tmp2,
      };
      const tmp5 = {
        anthropic: tmp3,
        openai: tmp4,
      };
      const tmp6 = {
        providers: tmp5,
      };
      return tmp6;
    }
    if (tmp02?.providers) {
      return tmp02;
    }
    throw new Error('未知的模型列表格式');
  }
  httpGetModels(tmp02, tmp1, tmp2 = 5000) {
    return new Promise((fn, fn2) => {
      const tmp22 = new URL(tmp02);
      const tmp3 = tmp22.protocol === 'http:' ? http : https;
      const tmp4 = {};
      if (tmp1) {
        tmp4['x-api-key'] = tmp1;
        tmp4.authorization = 'Bearer ' + tmp1;
      }
      const tmp5 = tmp3.request(
        {
          hostname: tmp22.hostname,
          port: tmp22.port ? Number(tmp22.port) : tmp22.protocol === 'http:' ? 80 : 443,
          path: '' + tmp22.pathname + tmp22.search,
          method: 'GET',
          timeout: tmp2,
          agent:
            tmp22.hostname === '127.0.0.1' || tmp22.hostname === 'localhost' ? undefined : false,
          headers: tmp4,
        },
        (arg0) => {
          let tmp12 = '';
          arg0.setEncoding('utf8');
          arg0.on('data', (arg02) => (tmp12 += arg02));
          arg0.on('end', () => {
            if (arg0.statusCode !== 200) {
              fn2(new Error('HTTP ' + arg0.statusCode + ': ' + tmp12.slice(0, 200)));
              return;
            }
            try {
              fn(this.normalizeModelsResponse(JSON.parse(tmp12)));
            } catch (tmp03) {
              fn2(new Error('JSON 解析失败: ' + tmp03.message));
            }
          });
        }
      );
      tmp5.on('error', (arg0) => fn2(arg0));
      tmp5.on('timeout', () => {
        tmp5.destroy();
        fn2(new Error('请求超时'));
      });
      tmp5.end();
    });
  }
  getModelListUrl(tmp02) {
    const tmp1 = String(tmp02 || '').trim();
    if (!tmp1) {
      throw new Error('请先填写 Base URL');
    }
    const tmp2 = ensureGatewayUrl(tmp1);
    const tmp3 = new URL(tmp2);
    const tmp4 = tmp3.pathname.replace(/\/+$/, '');
    if (/\/models$/i.test(tmp4)) {
      tmp3.pathname = tmp4;
    } else {
      const tmp03 = tmp4.replace(/\/(messages|responses)$/i, '') || '/v1';
      tmp3.pathname = tmp03 + '/models';
    }
    tmp3.search = '';
    return tmp3.toString();
  }
  normalizeProviderBaseUrl(tmp02) {
    const tmp1 = {
      ...tmp02,
    };
    const tmp2 = tmp1;
    for (const tmp03 of ['', 'BYOK1_', 'BYOK2_']) {
      for (const tmp04 of ['ANTHROPIC_API_HOST', 'OPENAI_API_HOST']) {
        const tmp05 = String(tmp2[tmp03 + tmp04] || '').trim();
        if (!tmp05) {
          continue;
        }
        const tmp12 = /^https?:\/\//i.test(tmp05) ? tmp05 : 'https://' + tmp05;
        let tmp22;
        try {
          tmp22 = new URL(tmp12);
        } catch {
          tmp2[tmp03 + tmp04] = stripProtoServer(tmp05);
          continue;
        }
        const tmp3 = tmp22.pathname.replace(/\/+$/, '');
        tmp2[tmp03 + tmp04] = tmp22.host;
        if (tmp3 && tmp3 !== '/') {
          const tmp06 =
            tmp03 + (tmp04 === 'ANTHROPIC_API_HOST' ? 'ANTHROPIC_API_PATH' : 'OPENAI_API_PATH');
          if (!tmp2[tmp06] || tmp2[tmp06] === '/v1/messages' || tmp2[tmp06] === '/v1/responses') {
            const tmp07 = tmp04 === 'ANTHROPIC_API_HOST' ? '/messages' : '/responses';
            let tmp13 = tmp3.replace(/\/models$/i, '');
            if (/\/(messages|responses)$/i.test(tmp13)) {
              tmp13 = tmp13.replace(/\/(messages|responses)$/i, '');
            }
            tmp2[tmp06] = '' + (tmp13 || '/v1') + tmp07;
          }
        }
      }
    }
    return tmp2;
  }
  resolveModelFetchCredentials(tmp02, tmp1) {
    return {
      apiKey: String(tmp02 || '').trim(),
      baseUrl: String(tmp1 || '').trim(),
    };
  }
  async fetchModelsFromGateway(tmp02, tmp1) {
    const tmp2 = String(tmp1 || '').trim();
    if (tmp2) {
      const tmp3 = this.getModelListUrl(tmp2);
      try {
        return await this.httpGetModels(tmp3, tmp02, 8000);
      } catch (tmp4) {
        if (this.isSslProtocolMismatch(tmp4)) {
          const tmp5 = this.toggleGatewayProtocol(tmp3);
          if (tmp5 !== tmp3) {
            return await this.httpGetModels(tmp5, tmp02, 8000);
          }
        }
        throw tmp4;
      }
    }
    const tmp3 = this.proxyManager.getStatus();
    if (tmp3.running) {
      try {
        return await this.httpGetModels(
          'http://127.0.0.1:' + tmp3.hybridPort + '/api/models',
          undefined,
          3000
        );
      } catch {}
    }
    throw new Error('请先填写 Base URL 和 API Key，或启动代理后加载模型');
  }
  formatModelFetchError(tmp02) {
    const tmp1 = tmp02 instanceof Error ? tmp02.message : String(tmp02 || '');
    if (/EPROTO|WRONG_VERSION_NUMBER|SSL routines/i.test(tmp1)) {
      return '加载模型失败：Base URL 的 HTTP/HTTPS 协议不匹配。本地或非 443 端口网关请使用 http://，公网 API 请使用 https://。';
    }
    if (/convert_request_failed|not implemented|new_api_error|responses api/i.test(tmp1)) {
      return '加载模型失败：当前网关可能不支持 OpenAI Responses API；如使用 GPT 网关，请在高级路由中尝试 /v1/chat/completions。';
    }
    if (/signature.*field required|field required.*signature|ValidationException/i.test(tmp1)) {
      return '加载模型失败：上游 Bedrock/Anthropic thinking 历史缺少 signature；请新开对话或关闭思考强度后重试。';
    }
    if (
      /HTTP\s*403/i.test(tmp1) ||
      /not assigned to any group|permission_error|分组|权限/i.test(tmp1)
    ) {
      return '加载模型失败：API Key 没有模型权限或服务拒绝访问，请检查 Base URL 和 API Key。';
    }
    if (/HTTP\s*401/i.test(tmp1) || /invalid.*key|unauthorized|鉴权/i.test(tmp1)) {
      return '加载模型失败：API Key 无效或已过期，请检查 Base URL 和 API Key。';
    }
    return tmp1 || '加载模型失败，请检查 API Key、Base URL 和网络连接';
  }
  isSslProtocolMismatch(tmp02) {
    const tmp1 = tmp02 instanceof Error ? tmp02.message : String(tmp02 || '');
    return /EPROTO|WRONG_VERSION_NUMBER|SSL routines/i.test(tmp1);
  }
  toggleGatewayProtocol(tmp02) {
    const tmp1 = new URL(tmp02);
    if (tmp1.protocol === 'https:') {
      tmp1.protocol = 'http:';
      return tmp1.toString();
    }
    if (tmp1.protocol === 'http:') {
      tmp1.protocol = 'https:';
      return tmp1.toString();
    }
    return tmp02;
  }
  flattenModelIds(tmp02) {
    const tmp1 = tmp02?.providers || {};
    const tmp2 = [
      ...(Array.isArray(tmp1.anthropic?.models) ? tmp1.anthropic.models : []),
      ...(Array.isArray(tmp1.openai?.models) ? tmp1.openai.models : []),
      ...(Array.isArray(tmp02?.data) ? tmp02.data : []),
      ...(Array.isArray(tmp02?.models) ? tmp02.models : []),
    ];
    const tmp3 = tmp2
      .map((arg0) => String(arg0?.id || arg0?.name || arg0 || '').trim())
      .filter(Boolean);
    return Array.from(new Set(tmp3));
  }
  modelIdMatches(tmp02, tmp1) {
    const tmp2 = String(tmp1 || '')
      .trim()
      .replace(/-thinking$/i, '');
    if (!tmp2) {
      return true;
    }
    return tmp02.some((arg0) => arg0 === tmp2 || arg0.replace(/-thinking$/i, '') === tmp2);
  }
  stripDiagnosticThinkingSuffix(tmp02) {
    return String(tmp02 || '')
      .trim()
      .replace(/-thinking$/i, '');
  }
  isDiagnosticOpenAIModel(tmp02) {
    const tmp1 = this.stripDiagnosticThinkingSuffix(tmp02);
    return DIAGNOSTIC_OPENAI_PREFIXES.some((arg0) => tmp1.startsWith(arg0));
  }
  resolveDiagnosticModelRoute(tmp02, tmp1) {
    const tmp2 = String(tmp02 || '').trim();
    const tmp3 = String(tmp1.DEFAULT_MODEL || '').trim();
    const tmp4 = DIAGNOSTIC_MODEL_MAP[tmp2];
    const tmp5 =
      tmp4 === '__DEFAULT__'
        ? tmp3
        : tmp4 || tmp3 || (tmp2 && !tmp2.startsWith('MODEL_') ? tmp2 : '');
    const tmp6 = this.stripDiagnosticThinkingSuffix(tmp5);
    const tmp7 = tmp6 ? (this.isDiagnosticOpenAIModel(tmp6) ? 'OpenAI' : 'Anthropic') : '未解析';
    const tmp8 = tmp2.endsWith('-priority') ? 'fast' : undefined;
    return {
      requested: tmp2,
      resolved: tmp5,
      upstream: tmp6,
      provider: tmp7,
      serviceTier: tmp8,
      usesDefault: tmp4 === '__DEFAULT__' || (!tmp4 && !!tmp3),
      thinking: /-thinking$/i.test(tmp5),
    };
  }
  checkModelRoutingDiagnostic(tmp02) {
    const tmp1 = String(tmp02.DEFAULT_MODEL || '').trim();
    const tmp2 = Array.from(
      new Set(
        [
          tmp1,
          'MODEL_CLAUDE_3_OPUS',
          'MODEL_CLAUDE_4_OPUS_BYOK',
          'MODEL_CLAUDE_4_OPUS_THINKING_BYOK',
          'claude-opus-4-8',
          'MODEL_SWE_1_5',
          'MODEL_CHAT',
          'MODEL_CLAUDE_SONNET_4',
          'MODEL_GPT_4O',
          'gpt-5-4-xhigh-priority',
        ].filter(Boolean)
      )
    );
    const tmp3 = tmp2.map((arg0) => this.resolveDiagnosticModelRoute(arg0, tmp02));
    const tmp4 = tmp3
      .map((arg0) => {
        const tmp12 = [
          arg0.provider,
          arg0.serviceTier,
          arg0.thinking ? 'thinking' : '',
          arg0.usesDefault ? 'default' : '',
        ]
          .filter(Boolean)
          .join(', ');
        return (
          arg0.requested + ' → ' + (arg0.upstream || '未解析') + (tmp12 ? ' (' + tmp12 + ')' : '')
        );
      })
      .join('；');
    return this.envCheckItem(
      'model-routing',
      '模型最终路由',
      tmp1 ? 'ok' : 'warning',
      tmp1 ? 'DEFAULT_MODEL=' + tmp1 + '；' + tmp4 : '未设置 DEFAULT_MODEL；' + tmp4,
      false
    );
  }
  checkInlineFastTimeoutRisk(tmp02) {
    const tmp1 = String(tmp02.DEFAULT_MODEL || '').trim();
    const tmp2 = tmp1.replace(/-thinking$/i, '');
    const tmp3 = /^(gpt-)/i.test(tmp2) || /^MODEL_GPT/i.test(tmp1);
    const tmp4 = String(tmp02.OPENAI_REASONING_EFFORT || '').trim();
    const tmp5 = Number.parseInt(String(tmp02.MAX_TOKENS || '0'), 10);
    const tmp6 = [];
    if (/opus/i.test(tmp1)) {
      tmp6.push('Opus 首包通常更慢');
    }
    if (/-thinking$/i.test(tmp1) || (tmp3 && tmp02.OPENAI_THINKING_ENABLED === 'true')) {
      tmp6.push('thinking 会增加首包等待');
    }
    if (tmp3 && (tmp4 === 'high' || tmp4 === 'xhigh' || tmp4 === 'max')) {
      tmp6.push('推理强度 ' + tmp4);
    }
    if (Number.isFinite(tmp5) && tmp5 > 8192) {
      tmp6.push('MAX_TOKENS=' + tmp5);
    }
    const tmp7 = Number.parseInt(String(tmp02.COMPLETION_TIMEOUT_MS || '12000'), 10);
    if (Number.isFinite(tmp7) && tmp7 < 10000) {
      tmp6.push('补全超时 ' + tmp7 + 'ms 偏短');
    }
    if (!tmp1) {
      tmp6.push('未设置默认模型');
    }
    const tmp8 =
      tmp6.length > 0
        ? 'Inline/Fast 首包窗口较紧（当前补全超时约 ' +
          (Number.isFinite(tmp7) ? tmp7 : 12000) +
          'ms）；风险：' +
          tmp6.join('、') +
          '。如频繁空返回，优先降低模型/Token' +
          (tmp3 ? '/推理强度' : '') +
          ' 或改用普通 Chat。'
        : '当前默认模型未命中明显慢首包风险；Inline/Fast 仍受上游首包延迟影响。';
    return this.envCheckItem(
      'inline-fast-timeout',
      'Inline/Fast 超时风险',
      tmp6.length > 0 ? 'warning' : 'ok',
      tmp8,
      false
    );
  }
  execFileText(tmp02, tmp1, tmp2) {
    return new Promise((fn, fn2) => {
      (0, child_process_1.execFile)(
        tmp02,
        tmp1,
        {
          timeout: tmp2,
          windowsHide: true,
          maxBuffer: 1048576,
        },
        (arg0, arg1, arg2) => {
          if (arg0) {
            const tmp03 = arg2 ? arg0.message + ': ' + arg2 : arg0.message;
            fn2(new Error(tmp03));
            return;
          }
          fn(String(arg1 || ''));
        }
      );
    });
  }
  async readWindsurfProcessCommandLines() {
    let tmp02 = '';
    if (process.platform === 'win32') {
      const tmp03 =
        "$self=$PID; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $self -and $_.CommandLine -match '(?i)(devin|windsurf|codeium|language_server)' } | ForEach-Object { $_.CommandLine }";
      try {
        tmp02 = await this.execFileText(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', tmp03],
          3500
        );
      } catch {
        tmp02 = await this.execFileText('wmic.exe', ['process', 'get', 'CommandLine'], 3500);
      }
    } else {
      tmp02 = await this.execFileText('ps', ['-ax', '-o', 'command='], 3500);
    }
    return tmp02
      .split(/\r?\n/)
      .map((arg0) => arg0.trim())
      .filter((arg0) =>
        /(devin|windsurf|codeium|language_server|devin-server|windsurf-server)/i.test(arg0)
      )
      .filter(
        (arg0) => !/Get-CimInstance Win32_Process|wmic\.exe process get CommandLine/i.test(arg0)
      );
  }
  async checkWindsurfProcessRouting(tmp02) {
    const { hybridPort: tmp1, inferencePort: tmp2 } = this.proxyManager.portsFromConfig(tmp02);
    const tmp3 = ['localhost:' + tmp1, '127.0.0.1:' + tmp1];
    const tmp4 = ['localhost:' + tmp2, '127.0.0.1:' + tmp2];
    let tmp5 = [];
    try {
      tmp5 = await this.readWindsurfProcessCommandLines();
    } catch (tmp03) {
      const tmp12 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
      return this.envCheckItem(
        'devin-process-routing',
        '进程路由参数',
        'warning',
        '无法读取 Devin Desktop/Codeium 进程命令行：' + tmp12,
        false
      );
    }
    if (tmp5.length === 0) {
      return this.envCheckItem(
        'devin-process-routing',
        '进程路由参数',
        'ok',
        '未检测到运行中的 Devin Desktop/Codeium/language_server 进程；启动后可再次验证',
        false
      );
    }
    const tmp6 = tmp5.some((arg0) => tmp3.some((arg02) => arg0.includes(arg02)));
    const tmp7 = tmp5.some((arg0) => tmp4.some((arg02) => arg0.includes(arg02)));
    const tmp8 = this.getPatchStatus();
    const tmp9 = !!tmp8.path && tmp8.patches.every((arg0) => arg0.status === 'applied');
    if (tmp6 && tmp7) {
      return this.envCheckItem(
        'devin-process-routing',
        '进程路由参数',
        'ok',
        '检测到 ' +
          tmp5.length +
          ' 个相关进程，命令行包含 Hybrid ' +
          tmp1 +
          ' 与 Inference ' +
          tmp2,
        false
      );
    }
    const tmp10 =
      [tmp6 ? 'Hybrid ' + tmp1 : '', tmp7 ? 'Inference ' + tmp2 : ''].filter(Boolean).join('、') ||
      '未发现本地代理端口';
    const tmp11 = tmp9
      ? '补丁已就绪但当前进程命令行未完整体现本地端口，建议重载/重启 Devin Desktop 后复查'
      : '补丁未完全就绪，建议先安装补丁并重载 Devin Desktop';
    return this.envCheckItem(
      'devin-process-routing',
      '进程路由参数',
      'warning',
      '检测到 ' + tmp5.length + ' 个相关进程；' + tmp10 + '；' + tmp11,
      false
    );
  }
  async checkGatewayModelCatalog(tmp02) {
    const tmp1 = tmp02.ANTHROPIC_API_KEY || tmp02.OPENAI_API_KEY || '';
    const tmp2 = String(tmp02.DEFAULT_MODEL || '').trim();
    if (!tmp1) {
      return this.envCheckItem(
        'model-catalog',
        '模型权限',
        'warning',
        '未配置 API Key，无法检查模型列表权限',
        false
      );
    }
    try {
      const tmp03 = await this.fetchModelsFromGateway(tmp1);
      const tmp12 = this.flattenModelIds(tmp03);
      const tmp22 = tmp12.filter((arg0) => /opus/i.test(arg0));
      const tmp3 = this.modelIdMatches(tmp12, tmp2);
      if (tmp12.length === 0) {
        return this.envCheckItem(
          'model-catalog',
          '模型权限',
          'warning',
          '模型列表为空；本地环境正常不代表模型可调用',
          false
        );
      }
      const tmp4 = tmp2
        ? '默认模型 ' + (tmp3 ? '可见' : '未在列表中') + '：' + tmp2
        : '未设置默认模型';
      const tmp5 =
        tmp22.length > 0
          ? 'Opus 可见：' + tmp22.slice(0, 3).join(', ')
          : 'Opus 未在模型列表中，选择 Opus 可能失败或无可用返回';
      return this.envCheckItem(
        'model-catalog',
        '模型权限',
        !tmp3 || tmp22.length === 0 ? 'warning' : 'ok',
        '可见模型 ' + tmp12.length + ' 个；' + tmp4 + '；' + tmp5,
        false
      );
    } catch (tmp03) {
      const tmp12 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
      return this.envCheckItem(
        'model-catalog',
        '模型权限',
        'warning',
        '模型列表检查失败：' + tmp12,
        false
      );
    }
  }
  classifyProbeBody(tmp02) {
    const tmp1 = String(tmp02 || '').trim();
    if (!tmp1) {
      return '无响应体';
    }
    const tmp2 = tmp1
      .split(/\r?\n/)
      .map((arg0) => arg0.trim())
      .find((arg0) => arg0.startsWith('data:') && !/^data:\s*\[DONE\]/i.test(arg0));
    const tmp3 = (tmp2 ? tmp2.replace(/^data:\s*/i, '') : tmp1).trim();
    try {
      const tmp03 = JSON.parse(tmp3);
      const tmp12 = tmp03?.error || tmp03;
      const tmp22 = tmp12?.type || tmp12?.code || tmp03?.code || '';
      const tmp32 = tmp12?.message || tmp03?.message || tmp03?.error_description || '';
      const tmp4 = [tmp22, tmp32].filter(Boolean).join('：');
      if (tmp4) {
        return tmp4.slice(0, 360);
      }
    } catch {}
    return tmp1.replace(/\s+/g, ' ').slice(0, 360);
  }
  classifyProbeHttpStatus(tmp02, tmp1) {
    const tmp2 = tmp02 || 0;
    const tmp3 = this.classifyProbeBody(tmp1);
    if (tmp2 === 400) {
      return 'HTTP 400 请求格式/模型参数错误：' + tmp3;
    }
    if (tmp2 === 401) {
      return 'HTTP 401 鉴权失败，API Key 无效或已过期：' + tmp3;
    }
    if (tmp2 === 403 || tmp2 === 404) {
      return 'HTTP ' + tmp2 + ' 模型无权限、不可用或不存在：' + tmp3;
    }
    if (tmp2 === 408 || tmp2 === 504) {
      return 'HTTP ' + tmp2 + ' 上游超时：' + tmp3;
    }
    if (tmp2 === 429) {
      return 'HTTP 429 额度/限流/并发限制：' + tmp3;
    }
    if (tmp2 >= 500) {
      return 'HTTP ' + tmp2 + ' 上游服务错误：' + tmp3;
    }
    return 'HTTP ' + tmp2 + ': ' + tmp3;
  }
  classifyProbeSseError(tmp02) {
    if (!/event:\s*error|data:\s*\{[^\n]*(error|message)/i.test(tmp02)) {
      return undefined;
    }
    const tmp1 = this.classifyProbeBody(tmp02);
    if (/auth|api.?key|unauthor|invalid.?key/i.test(tmp1)) {
      return 'HTTP 200 SSE 错误：鉴权失败：' + tmp1;
    }
    if (/permission|not.?found|model|access/i.test(tmp1)) {
      return 'HTTP 200 SSE 错误：模型权限/模型不存在：' + tmp1;
    }
    if (/rate|quota|credit|limit|insufficient/i.test(tmp1)) {
      return 'HTTP 200 SSE 错误：额度/限流：' + tmp1;
    }
    return 'HTTP 200 SSE 错误：' + tmp1;
  }
  classifyProbeNetworkError(tmp02) {
    const tmp1 = tmp02;
    const tmp2 = String(tmp1.code || '').toUpperCase();
    const tmp3 = tmp02.message || String(tmp02);
    if (['ENOTFOUND', 'EAI_AGAIN'].includes(tmp2)) {
      return 'DNS 解析失败：' + tmp3;
    }
    if (['ECONNREFUSED', 'ECONNRESET', 'EPIPE'].includes(tmp2)) {
      return '连接失败/被重置：' + tmp3;
    }
    if (['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(tmp2)) {
      return '网络连接超时：' + tmp3;
    }
    if (/certificate|tls|ssl|self signed|unable to verify/i.test(tmp3)) {
      return 'TLS/证书错误：' + tmp3;
    }
    if (tmp2) {
      return tmp2 + ': ' + tmp3;
    } else {
      return tmp3;
    }
  }
  async probeConfiguredModelStream(tmp02) {
    const tmp1 = String(tmp02.DEFAULT_MODEL || '').trim();
    const tmp2 = tmp1.replace(/-thinking$/i, '');
    const tmp3 = tmp02.ANTHROPIC_API_KEY || tmp02.OPENAI_API_KEY || '';
    if (!tmp2) {
      return {
        ok: false,
        model: tmp1 || '--',
        detail: '未设置默认模型',
      };
    }
    const tmp4 = {
      ok: false,
      model: tmp2,
      detail: '未配置 API Key',
    };
    if (!tmp3) {
      return tmp4;
    }
    if (/^(gpt-|MODEL_GPT)/i.test(tmp2)) {
      return {
        ok: false,
        model: tmp2,
        detail: '当前探测先覆盖 Claude/Opus 流式链路，请切换默认模型后再测',
      };
    }
    const tmp5 = tmp02.ANTHROPIC_API_HOST || '';
    const tmp6 = ensureGatewayUrl(tmp5).replace(/\/+$/, '');
    const tmp7 = new URL(tmp6);
    const tmp8 = tmp7.protocol === 'http:';
    const tmp9 = tmp02.ANTHROPIC_API_PATH || '/v1/messages';
    const tmp10 = {
      model: tmp2,
      messages: [
        {
          role: 'user',
          content: 'ping',
        },
      ],
      stream: true,
      max_tokens: 1,
    };
    const tmp11 = JSON.stringify(tmp10);
    const tmp12 = Date.now();
    return new Promise((fn) => {
      let tmp13 = false;
      let tmp22;
      let tmp32 = '';
      const fn2 = (arg0, arg1) => {
        if (tmp13) {
          return;
        }
        tmp13 = true;
        tmp62.destroy();
        const tmp23 = {
          ok: arg0,
          model: tmp2,
          detail: arg1,
        };
        fn(tmp23);
      };
      const tmp52 = tmp8 ? http : https;
      const tmp62 = tmp52.request(
        {
          hostname: tmp7.hostname,
          port: tmp7.port ? Number(tmp7.port) : tmp8 ? 80 : 443,
          path: tmp9,
          method: 'POST',
          timeout: 25000,
          rejectUnauthorized: !tmp8 && (!tmp7.port || tmp7.port === '443'),
          headers: {
            'content-type': 'application/json',
            accept: 'text/event-stream',
            'anthropic-version': '2023-06-01',
            'x-api-key': tmp3,
            'content-length': Buffer.byteLength(tmp11),
          },
        },
        (arg0) => {
          arg0.setEncoding('utf8');
          arg0.on('data', (arg02) => {
            if (tmp22 === undefined) {
              tmp22 = Date.now() - tmp12;
            }
            tmp32 += arg02;
            if (tmp32.length > 4000) {
              tmp32 = tmp32.slice(-4000);
            }
            if (arg0.statusCode && arg0.statusCode !== 200) {
              return;
            }
            const tmp14 = this.classifyProbeSseError(tmp32);
            if (tmp14) {
              fn2(false, tmp14 + '；首包 ' + tmp22 + 'ms，总耗时 ' + (Date.now() - tmp12) + 'ms');
              return;
            }
            if (
              /event:\s*message_stop|event:\s*content_block_delta|data:\s*\[DONE\]/i.test(tmp32)
            ) {
              fn2(true, 'HTTP 200，首包 ' + tmp22 + 'ms，总耗时 ' + (Date.now() - tmp12) + 'ms');
            }
          });
          arg0.on('end', () => {
            if (arg0.statusCode && arg0.statusCode !== 200) {
              fn2(false, this.classifyProbeHttpStatus(arg0.statusCode, tmp32));
              return;
            }
            const tmp03 = this.classifyProbeSseError(tmp32);
            if (tmp03) {
              fn2(false, tmp03);
              return;
            }
            fn2(
              tmp22 !== undefined,
              tmp22 !== undefined
                ? 'HTTP 200，首包 ' + tmp22 + 'ms，流已结束'
                : 'HTTP 200，但未收到流式数据，可能被网关转成非 SSE 响应或上游无首包'
            );
          });
        }
      );
      tmp62.on('error', (arg0) => {
        if (!tmp13) {
          fn2(false, this.classifyProbeNetworkError(arg0));
        }
      });
      tmp62.on('timeout', () =>
        fn2(
          false,
          '请求超时，' +
            (Date.now() - tmp12) +
            'ms 内未完成；可能是上游首包过慢、模型排队或网络链路阻塞'
        )
      );
      tmp62.end(tmp11);
    });
  }
  async setStoredPatchExtensionPath(tmp02) {
    const tmp1 = typeof tmp02 === 'string' && tmp02.trim() ? tmp02.trim() : undefined;
    await this.context.globalState.update(KEY_PATCH_EXTENSION_PATH, tmp1);
  }
  getPatchStatus() {
    const tmp02 = this.proxyManager.getStatus();
    return patchManager_1.PatchManager.getStatus(
      this.getStoredPatchExtensionPath(),
      patchManager_1.PatchManager.loopbackApiUrl(tmp02.hybridPort),
      patchManager_1.PatchManager.loopbackApiUrl(tmp02.inferencePort)
    );
  }
  envCheckItem(tmp02, tmp1, tmp2, tmp3, tmp4) {
    const tmp5 = {
      id: tmp02,
      name: tmp1,
      status: tmp2,
      detail: tmp3,
      fixable: tmp4,
    };
    return tmp5;
  }
  isValidPortValue(tmp02) {
    if (!tmp02) {
      return true;
    }
    const tmp1 = Number.parseInt(tmp02, 10);
    return Number.isInteger(tmp1) && tmp1 > 0 && tmp1 <= 65535;
  }
  isValidCompletionTimeoutValue(tmp02) {
    if (!tmp02) {
      return true;
    }
    const tmp1 = Number.parseInt(tmp02, 10);
    return Number.isInteger(tmp1) && tmp1 >= 2000 && tmp1 <= 60000;
  }
  async isPortFree(tmp02) {
    return new Promise((fn) => {
      const tmp1 = net.createServer();
      tmp1.once('error', () => fn(false));
      tmp1.once('listening', () => tmp1.close(() => fn(true)));
      tmp1.listen(tmp02, '127.0.0.1');
    });
  }
  readProxyDependencyKeys() {
    const tmp02 = path.join(this.proxyManager.getProxyRootPath(), 'package.json');
    if (!fs.existsSync(tmp02)) {
      return undefined;
    }
    try {
      const tmp03 = JSON.parse(fs.readFileSync(tmp02, 'utf-8'));
      const tmp1 = {
        ...tmp03.dependencies,
        ...tmp03.devDependencies,
        ...tmp03.optionalDependencies,
      };
      return Object.keys(tmp1);
    } catch {
      return undefined;
    }
  }
  async checkManagedEnvironment() {
    const tmp02 = [];
    const tmp1 = this.proxyManager.getProxyRootPath();
    const tmp2 = this.proxyManager.getEnvFilePath();
    const tmp3 = this.proxyManager.readEnvConfig();
    const requiredFiles = ['package.json', 'src/hybrid-server.js', 'src/inference-proxy.js'];
    const tmp4 = requiredFiles.filter((arg0) => !fs.existsSync(path.join(tmp1, arg0)));
    tmp02.push(
      this.envCheckItem(
        'proxy-root',
        '内置代理目录',
        tmp4.length === 0 ? 'ok' : 'error',
        tmp4.length === 0 ? tmp1 : '缺少 ' + tmp4.join(', '),
        false
      )
    );
    tmp02.push(
      this.envCheckItem(
        'env-file',
        '配置文件',
        fs.existsSync(tmp2) ? 'ok' : 'warning',
        fs.existsSync(tmp2) ? tmp2 : '缺少 .env，将使用默认配置生成',
        !fs.existsSync(tmp2)
      )
    );
    const tmp5 = ['HYBRID_PORT', 'INFERENCE_PORT'].filter(
      (arg0) => !this.isValidPortValue(tmp3[arg0])
    );
    const tmp6 = !this.isValidCompletionTimeoutValue(tmp3.COMPLETION_TIMEOUT_MS);
    const tmp7 = this.proxyManager.portsFromConfig(tmp3);
    const tmp8 = this.proxyManager.getStatus().running;
    const tmp9 = tmp8 ? true : await this.isPortFree(tmp7.hybridPort);
    const tmp10 = tmp8 ? true : await this.isPortFree(tmp7.inferencePort);
    const tmp11 = [
      !tmp9 ? 'Hybrid ' + tmp7.hybridPort : '',
      !tmp10 ? 'Inference ' + tmp7.inferencePort : '',
    ].filter(Boolean);
    tmp02.push(
      this.envCheckItem(
        'ports',
        '代理端口',
        tmp5.length > 0 || tmp11.length > 0 ? 'warning' : 'ok',
        tmp5.length > 0
          ? '端口值异常：' + tmp5.join(', ')
          : tmp11.length > 0
            ? '端口已占用：' + tmp11.join(', ') + '；请手动关闭占用进程或更换端口'
            : 'Hybrid ' + tmp7.hybridPort + ' / Inference ' + tmp7.inferencePort,
        tmp5.length > 0
      )
    );
    tmp02.push(
      this.envCheckItem(
        'completion-timeout',
        '补全超时配置',
        tmp6 ? 'warning' : 'ok',
        tmp6
          ? 'COMPLETION_TIMEOUT_MS 需在 2000-60000ms；将修复为 12000ms'
          : 'COMPLETION_TIMEOUT_MS=' + (tmp3.COMPLETION_TIMEOUT_MS || '12000') + 'ms',
        tmp6
      )
    );
    const tmp12 = this.readProxyDependencyKeys();
    const tmp13 = path.join(tmp1, 'node_modules');
    tmp02.push(
      this.envCheckItem(
        'runtime-deps',
        '运行依赖',
        tmp12 === undefined
          ? 'warning'
          : tmp12.length === 0 || fs.existsSync(tmp13)
            ? 'ok'
            : 'warning',
        tmp12 === undefined
          ? 'package.json 无法解析'
          : tmp12.length === 0
            ? '当前标准环境无 npm 依赖，node_modules 非必需'
            : fs.existsSync(tmp13)
              ? '已安装 ' + tmp12.length + ' 个依赖声明'
              : '缺少 node_modules，启动代理时会尝试安装 ' + tmp12.length + ' 个依赖',
        false
      )
    );
    const tmp14 = String(tmp3.DEFAULT_MODEL || '').trim();
    const tmp15 = tmp14.replace(/-thinking$/i, '');
    const tmp16 = /^(gpt-)/i.test(tmp15) || /^MODEL_GPT/i.test(tmp14);
    const tmp17 = String(tmp3.BYOK1_THINKING_EFFORT || tmp3.OPENAI_REASONING_EFFORT || '').trim();
    const tmp18 = String(tmp3.BYOK2_THINKING_EFFORT || '').trim();
    const tmp19 =
      ['', 'low', 'medium', 'high', 'xhigh', 'max'].includes(tmp17) &&
      ['', 'low', 'medium', 'high', 'xhigh', 'max'].includes(tmp18);
    const tmp20 =
      tmp17 || tmp18 || tmp3.OPENAI_THINKING_ENABLED === 'true' || /-thinking$/i.test(tmp14);
    tmp02.push(
      this.envCheckItem(
        'reasoning',
        '思考强度',
        tmp19 ? 'ok' : 'warning',
        tmp20
          ? 'BYOK #1=' +
              (tmp17 || '关闭') +
              '；BYOK #2=' +
              (tmp18 || '关闭') +
              '（Claude→adaptive/budget，GPT→reasoning.effort，Gemini→thinking_level）'
          : '未配置思考强度；将按模型名决定是否思考',
        !tmp19
      )
    );
    tmp02.push(
      this.envCheckItem(
        'api-key',
        'API Key',
        tmp3.ANTHROPIC_API_KEY || tmp3.OPENAI_API_KEY ? 'ok' : 'warning',
        tmp3.ANTHROPIC_API_KEY || tmp3.OPENAI_API_KEY ? '已配置' : '未配置，请手动填写 API Key',
        false
      )
    );
    tmp02.push(this.checkModelRoutingDiagnostic(tmp3));
    tmp02.push(this.checkInlineFastTimeoutRisk(tmp3));
    tmp02.push(await this.checkWindsurfProcessRouting(tmp3));
    tmp02.push(await this.checkGatewayModelCatalog(tmp3));
    const tmp21 = this.proxyManager.getDefaultSystemPromptFilePath();
    tmp02.push(
      this.envCheckItem(
        'system-prompt',
        '默认提示词',
        fs.existsSync(tmp21) ? 'ok' : 'warning',
        fs.existsSync(tmp21) ? tmp21 : '缺少默认 system-prompt.md',
        !fs.existsSync(tmp21)
      )
    );
    const tmp22 = this.getPatchStatus();
    const tmp23 = tmp22.patches.filter((arg0) => arg0.status !== 'applied');
    const tmp24 = !!tmp22.path && tmp23.length > 0;
    const tmp25 = tmp23.map((arg0) => arg0.name + '=' + arg0.status).join('；');
    tmp02.push(
      this.envCheckItem(
        'devin-patch',
        'Devin Desktop 补丁',
        tmp23.length === 0 ? 'ok' : 'warning',
        !tmp22.path
          ? '未找到 Devin Desktop extension.js'
          : tmp23.length === 0
            ? '已安装'
            : '未就绪 ' +
              tmp23.length +
              '/' +
              tmp22.patches.length +
              '；可能是端口变更或 Devin 版本不兼容；' +
              tmp25,
        tmp24
      )
    );
    return {
      ok: tmp02.every((arg0) => arg0.status === 'ok'),
      checkedAt: new Date().toLocaleString(),
      items: tmp02,
    };
  }
  redactSecret(tmp02) {
    const tmp1 = String(tmp02 || '').trim();
    if (!tmp1) {
      return '';
    }
    if (tmp1.length <= 8) {
      return tmp1.slice(0, 2) + '***(' + tmp1.length + ')';
    }
    return tmp1.slice(0, 4) + '...' + tmp1.slice(-4) + '(' + tmp1.length + ')';
  }
  sanitizeDiagnosticText(tmp02) {
    return String(tmp02 || '')
      .replace(
        /((?:api[_-]?key|authorization|bearer|token|password|secret)[^\r\n:=]*[:=\s]+)([^\s"'&]+)/gi,
        '$1***'
      )
      .replace(/(sk-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/g, '$1***');
  }
  sanitizeEnvConfig(tmp02) {
    const tmp1 = {};
    for (const [tmp03, tmp12] of Object.entries(tmp02)) {
      tmp1[tmp03] = /KEY|TOKEN|SECRET|PASSWORD/i.test(tmp03) ? this.redactSecret(tmp12) : tmp12;
    }
    return tmp1;
  }
  readJsonObject(tmp02) {
    if (!fs.existsSync(tmp02)) {
      return undefined;
    }
    try {
      const tmp03 = fs.readFileSync(tmp02, 'utf-8').replace(/^\uFEFF/, '');
      const tmp1 = JSON.parse(tmp03);
      if (tmp1 && typeof tmp1 === 'object') {
        return tmp1;
      } else {
        return undefined;
      }
    } catch {
      return undefined;
    }
  }
  readExtensionPackageInfo() {
    const tmp02 = this.readJsonObject(path.join(this.context.extensionPath, 'package.json')) || {};
    return {
      name: String(tmp02.name || ''),
      displayName: String(tmp02.displayName || ''),
      version: String(tmp02.version || ''),
      publisher: String(tmp02.publisher || ''),
    };
  }
  readWindsurfProductInfo() {
    const tmp02 = vscode.env.appRoot || '';
    if (!tmp02) {
      const tmp03 = {
        path: '',
        nameShort: vscode.env.appName || '',
        version: vscode.version || '',
        commit: '',
        quality: '',
      };
      return tmp03;
    }
    const tmp1 = [
      path.join(tmp02, 'product.json'),
      path.join(path.dirname(tmp02), 'product.json'),
      path.join(path.dirname(path.dirname(tmp02)), 'product.json'),
    ];
    const tmp2 = new Set();
    for (const tmp03 of tmp1) {
      const tmp04 = path.normalize(tmp03);
      if (tmp2.has(tmp04)) {
        continue;
      }
      tmp2.add(tmp04);
      const tmp12 = this.readJsonObject(tmp04);
      if (tmp12) {
        return {
          path: tmp04,
          nameShort: String(tmp12.nameShort || tmp12.nameLong || ''),
          version: String(tmp12.version || tmp12.codeVersion || vscode.version || ''),
          commit: String(tmp12.commit || ''),
          quality: String(tmp12.quality || ''),
        };
      }
    }
    const tmp3 = {
      path: '',
      nameShort: vscode.env.appName || '',
      version: vscode.version || '',
      commit: '',
      quality: '',
    };
    return tmp3;
  }
  async getPortListeners(tmp02) {
    if (!tmp02) {
      return [];
    }
    try {
      if (process.platform === 'win32') {
        const tmp04 =
          '$ids=Get-NetTCPConnection -LocalPort ' +
          tmp02 +
          ' -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($ownerPid in $ids) { $proc=Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid"; if ($proc) { "$ownerPid $($proc.Name) $($proc.CommandLine)" } else { "$ownerPid" } }';
        const tmp1 = await this.execFileText(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', tmp04],
          3500
        );
        return tmp1
          .split(/\r?\n/)
          .map((arg0) => this.sanitizeDiagnosticText(arg0.trim()))
          .filter(Boolean);
      }
      const tmp03 = await this.execFileText(
        'lsof',
        ['-nP', '-iTCP:' + tmp02, '-sTCP:LISTEN'],
        3500
      );
      return tmp03
        .split(/\r?\n/)
        .map((arg0) => this.sanitizeDiagnosticText(arg0.trim()))
        .filter(Boolean);
    } catch (tmp03) {
      const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
      return ['读取监听进程失败：' + this.sanitizeDiagnosticText(tmp1)];
    }
  }
  jsonBlock(tmp02) {
    return '```json\n' + JSON.stringify(tmp02, null, 2) + '\n```';
  }
  textBlock(tmp02) {
    return '```text\n' + (tmp02 || '无') + '\n```';
  }
  async createDiagnosticReport() {
    const tmp02 = this.proxyManager.readEnvConfig();
    const tmp1 = this.proxyManager.getStatus();
    const tmp2 = this.proxyManager.portsFromConfig(tmp02);
    const tmp3 = this.getPatchStatus();
    const tmp4 = this.readExtensionPackageInfo();
    const tmp5 = this.readWindsurfProductInfo();
    const tmp6 = undefined;
    const tmp7 = [];
    let tmp8;
    try {
      tmp8 = await this.checkManagedEnvironment();
    } catch (tmp03) {
      const tmp19 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
      tmp8 = {
        ok: false,
        checkedAt: new Date().toLocaleString(),
        items: [this.envCheckItem('environment-check', '环境检测', 'error', tmp19, false)],
      };
    }
    let processLines = [];
    let processError = '';
    try {
      processLines = (await this.readWindsurfProcessCommandLines())
        .slice(0, 25)
        .map((arg0) =>
          this.sanitizeDiagnosticText(arg0.length > 800 ? arg0.slice(0, 800) + '...' : arg0)
        );
    } catch (tmp03) {
      processError = tmp03 instanceof Error ? tmp03.message : String(tmp03);
    }
    const tmp9 = await this.checkHttpHealth('' + '/health', 5000).catch((arg0) => ({
      ok: false,
      elapsedMs: 0,
      error: arg0 instanceof Error ? arg0.message : String(arg0),
    }));
    const tmp10 = await this.getPortListeners(tmp2.hybridPort);
    const tmp11 = await this.getPortListeners(tmp2.inferencePort);
    const tmp12 = this.logLines
      .slice(-100)
      .map((arg0) => this.sanitizeDiagnosticText(arg0))
      .join('\n');
    const tmp13 = tmp8.items
      .map((arg0) => '- [' + arg0.status + '] ' + arg0.name + ': ' + arg0.detail)
      .join('\n');
    const tmp14 = {
      loggedIn: !!tmp6,
      username: tmp6?.username || '',
      email: tmp6?.email ? tmp6.email.replace(/^(.{2}).*(@.*)$/, '$1***$2') : '',
      balance: typeof tmp6?.balance === 'number' ? tmp6.balance : null,
      status: tmp6?.status || '',
      apiKeyCount: tmp7.length,
      selectedKey: this.redactSecret(tmp02.ANTHROPIC_API_KEY || tmp02.OPENAI_API_KEY || ''),
    };
    const tmp15 = {
      appName: vscode.env.appName,
      vscodeVersion: vscode.version,
      appRoot: vscode.env.appRoot,
      execPath: process.execPath,
    };
    const tmp16 = {
      port: tmp2.hybridPort,
      listeners: tmp10,
    };
    const tmp17 = {
      port: tmp2.inferencePort,
      listeners: tmp11,
    };
    const tmp18 = {
      hybrid: tmp16,
      inference: tmp17,
    };
    return [
      '# Devin BYOK Bridge 诊断报告',
      '',
      '生成时间：' + new Date().toLocaleString(),
      '',
      '## 版本与宿主',
      this.jsonBlock({
        extension: tmp4,
        host: tmp15,
        devinProduct: tmp5,
        os: {
          platform: process.platform,
          release: os.release(),
          arch: os.arch(),
        },
      }),
      '',
      '## 代理状态',
      this.jsonBlock({
        status: tmp1,
        lastStartError: this.proxyManager.getLastStartError(),
        lastStartWarning: this.proxyManager.getLastStartWarning(),
      }),
      '',
      '## 配置快照（已脱敏）',
      this.jsonBlock(this.sanitizeEnvConfig(tmp02)),
      '',
      '## API Key 配置',
      this.jsonBlock(tmp14),
      '',
      '## 补丁状态',
      this.jsonBlock(tmp3),
      '',
      '## 端口监听',
      this.jsonBlock(tmp18),
      '',
      '## 网关连通',
      this.jsonBlock({
        host: '',
        health: tmp9,
      }),
      '',
      '## 环境检测',
      tmp13 || '无检测项',
      '',
      '## Devin Desktop / Codeium 进程',
      processError ? this.textBlock(processError) : this.textBlock(processLines.join('\n')),
      '## 最近 100 行日志',
      this.textBlock(tmp12),
      '',
    ].join('\n');
  }
  async exportDiagnosticReport() {
    const tmp02 = await this.createDiagnosticReport();
    await vscode.env.clipboard.writeText(tmp02);
    const tmp1 = {
      content: tmp02,
      language: 'markdown',
    };
    const tmp2 = await vscode.workspace.openTextDocument(tmp1);
    await vscode.window.showTextDocument(tmp2, {
      preview: false,
    });
  }
  async repairManagedEnvironment() {
    const tmp02 = this.proxyManager.readEnvConfig();
    const tmp1 = {
      ...tmp02,
    };
    const tmp2 = tmp1;
    tmp2.ANTHROPIC_API_HOST = tmp2.ANTHROPIC_API_HOST || '';
    tmp2.ANTHROPIC_API_PATH = tmp2.ANTHROPIC_API_PATH || '/v1/messages';
    tmp2.OPENAI_API_PATH = tmp2.OPENAI_API_PATH || '/v1/responses';
    if (!this.isValidPortValue(tmp2.HYBRID_PORT)) {
      tmp2.HYBRID_PORT = '3006';
    }
    if (!this.isValidPortValue(tmp2.INFERENCE_PORT)) {
      tmp2.INFERENCE_PORT = '3001';
    }
    tmp2.MAX_TOKENS = tmp2.MAX_TOKENS || '16384';
    if (
      !['', 'low', 'medium', 'high', 'xhigh', 'max'].includes(tmp2.OPENAI_REASONING_EFFORT || '')
    ) {
      tmp2.OPENAI_REASONING_EFFORT = '';
    }
    if (
      !['', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(
        tmp2.BYOK1_THINKING_EFFORT || ''
      )
    ) {
      tmp2.BYOK1_THINKING_EFFORT = '';
    }
    if (
      !['', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'].includes(
        tmp2.BYOK2_THINKING_EFFORT || ''
      )
    ) {
      tmp2.BYOK2_THINKING_EFFORT = '';
    }
    if (!['true', 'false'].includes(tmp2.OPENAI_THINKING_ENABLED || 'false')) {
      tmp2.OPENAI_THINKING_ENABLED = 'false';
    }
    if (!this.isValidCompletionTimeoutValue(tmp2.COMPLETION_TIMEOUT_MS)) {
      tmp2.COMPLETION_TIMEOUT_MS = '12000';
    }
    this.proxyManager.writeEnvConfig(tmp2);
    const tmp3 = this.proxyManager.getDefaultSystemPromptFilePath();
    if (!fs.existsSync(tmp3)) {
      fs.mkdirSync(path.dirname(tmp3), {
        recursive: true,
      });
      fs.writeFileSync(tmp3, DEFAULT_SYSTEM_PROMPT.trim() + '\n', 'utf-8');
    }
    const tmp4 = this.proxyManager.getStatus();
    const tmp5 = this.getPatchStatus();
    if (tmp5.path && tmp5.patches.some((arg0) => arg0.status !== 'applied')) {
      patchManager_1.PatchManager.applyWithCustomUrls(
        patchManager_1.PatchManager.loopbackApiUrl(tmp4.hybridPort),
        patchManager_1.PatchManager.loopbackApiUrl(tmp4.inferencePort),
        this.getStoredPatchExtensionPath() || undefined
      );
    }
    return await this.checkManagedEnvironment();
  }
  postActionState(tmp02, tmp1, tmp2) {
    const tmp3 = {
      type: 'actionState',
      section: tmp02,
      state: tmp1,
      message: tmp2,
    };
    this.view?.webview.postMessage(tmp3);
  }
  async ensurePatchAppliedAfterProxyStart(tmp02 = true) {
    const tmp1 = this.getPatchStatus();
    const tmp2 = tmp1.patches.some((arg0) => arg0.status !== 'applied');
    if (!tmp2 || !tmp1.path) {
      return;
    }
    const tmp3 = this.proxyManager.getStatus();
    const tmp4 = patchManager_1.PatchManager.loopbackApiUrl(tmp3.hybridPort);
    const tmp5 = patchManager_1.PatchManager.loopbackApiUrl(tmp3.inferencePort);
    const tmp6 = this.getStoredPatchExtensionPath();
    const tmp7 = patchManager_1.PatchManager.applyWithCustomUrls(tmp4, tmp5, tmp6);
    if (tmp7.applied <= 0) {
      return;
    }
    const tmp8 =
      '检测到 Devin Desktop 补丁丢失，已自动恢复 ' + tmp7.applied + ' 个，需重载窗口生效';
    this.logLines.push(tmp8);
    if (this.logLines.length > 200) {
      this.logLines = this.logLines.slice(-100);
    }
    const tmp9 = {
      type: 'log',
      line: tmp8,
    };
    this.view?.webview.postMessage(tmp9);
    this.postActionState('patch', 'success', tmp8);
    if (!tmp02) {
      return;
    }
    const tmp10 = await vscode.window.showInformationMessage(tmp8, '重载窗口');
    if (tmp10 === '重载窗口') {
      await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
    }
  }
  shellQuote(tmp02) {
    return "'" + tmp02.replace(/'/g, "'\\''") + "'";
  }
  runDetachedCacheCleaner(tmp02) {
    if (process.platform === 'win32') {
      (0, child_process_1.spawn)('cmd.exe', ['/c', 'start', '', tmp02], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      }).unref();
      return;
    }
    if (process.platform === 'darwin') {
      (0, child_process_1.spawn)(
        'osascript',
        [
          '-e',
          'tell application "Terminal" to do script "sh ' +
            this.shellQuote(tmp02).replace(/"/g, '\\"') +
            '"',
        ],
        {
          detached: true,
          stdio: 'ignore',
        }
      ).unref();
      return;
    }
    (0, child_process_1.spawn)('sh', [tmp02], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
  async forceRestartLanguageServer() {
    if (process.platform !== 'win32') {
      return {
        restarted: 0,
        message:
          '当前仅支持 Windows 下强制重启 LS；请手动结束 Codeium/language_server 进程后重载窗口',
      };
    }
    const tmp02 = await vscode.window.showWarningMessage(
      '将强制结束 Devin Desktop/Codeium 的 language_server/Codeium 子进程，Devin Desktop 会自动拉起新的 LS。是否继续？',
      {
        modal: true,
      },
      '强制重启 LS'
    );
    if (tmp02 !== '强制重启 LS') {
      return {
        restarted: 0,
        message: '已取消强制重启 LS',
      };
    }
    const tmp1 =
      "\n$targets = Get-CimInstance Win32_Process | Where-Object {\n  $_.ProcessId -ne $PID -and (\n    $_.Name -match '(?i)(language_server|codeium)' -or\n    $_.CommandLine -match '(?i)(language_server|codeium)'\n  ) -and $_.Name -notmatch '(?i)^(Devin|Windsurf|Code|Code - Insiders).exe$'\n}\n$targets | Select-Object -ExpandProperty ProcessId -Unique\n".trim();
    const tmp2 = await this.execFileText(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', tmp1],
      5000
    );
    const tmp3 = Array.from(
      new Set(
        tmp2
          .split(/\r?\n/)
          .map((arg0) => Number.parseInt(arg0.trim(), 10))
          .filter((arg0) => Number.isInteger(arg0) && arg0 > 0)
      )
    );
    if (tmp3.length === 0) {
      return {
        restarted: 0,
        message: '未发现正在运行的 Codeium/language_server 进程',
      };
    }
    for (const tmp03 of tmp3) {
      await this.execFileText('taskkill.exe', ['/PID', String(tmp03), '/T', '/F'], 5000);
    }
    const tmp4 =
      '已结束 ' +
      tmp3.length +
      ' 个 LS/Codeium 进程，Devin Desktop 会自动重启 LS；如未恢复请点"重载窗口"';
    this.logLines.push(tmp4);
    if (this.logLines.length > 200) {
      this.logLines = this.logLines.slice(-100);
    }
    const tmp5 = {
      type: 'log',
      line: tmp4,
    };
    this.view?.webview.postMessage(tmp5);
    const tmp6 = {
      restarted: tmp3.length,
      message: tmp4,
    };
    return tmp6;
  }
  async clearWindsurfCache() {
    const tmp02 = await vscode.window.showWarningMessage(
      '将关闭 Devin Desktop/Codeium，只清理运行缓存目录；不会删除 Devin Desktop 历史记录、工作区数据、聊天记录或配置。是否继续？',
      {
        modal: true,
      },
      '安全清理缓存'
    );
    if (tmp02 !== '安全清理缓存') {
      return;
    }
    const tmp1 = path.join(
      os.tmpdir(),
      'devin-byok-plus-clear-cache-' + Date.now() + (process.platform === 'win32' ? '.cmd' : '.sh')
    );
    if (process.platform === 'win32') {
      fs.writeFileSync(
        tmp1,
        [
          '@echo off',
          'timeout /t 1 /nobreak >nul 2>&1',
          'taskkill /f /im Devin.exe >nul 2>&1',
          'taskkill /f /im Windsurf.exe >nul 2>&1',
          'taskkill /f /im language_server.exe >nul 2>&1',
          'taskkill /f /im codeium.exe >nul 2>&1',
          'taskkill /f /im Codeium.exe >nul 2>&1',
          'timeout /t 2 /nobreak >nul 2>&1',
          'echo 正在安全清除运行缓存...',
          'rd /s /q "%APPDATA%\\Devin\\Cache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\Cache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Devin\\CachedData" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\CachedData" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Devin\\CachedExtensionVSIXs" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\CachedExtensionVSIXs" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Devin\\Code Cache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\Code Cache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Devin\\DawnCache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\DawnCache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Devin\\GPUCache" >nul 2>&1',
          'rd /s /q "%APPDATA%\\Windsurf\\GPUCache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Devin\\Cache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Windsurf\\Cache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Devin\\CachedData" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Windsurf\\CachedData" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Devin\\Code Cache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Windsurf\\Code Cache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Devin\\DawnCache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Windsurf\\DawnCache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Devin\\GPUCache" >nul 2>&1',
          'rd /s /q "%LOCALAPPDATA%\\Windsurf\\GPUCache" >nul 2>&1',
          'rd /s /q "%TEMP%\\codeium" >nul 2>&1',
          'echo 运行缓存已清除完毕，Devin Desktop 历史记录已保留，请重新打开 Devin Desktop',
          'pause',
          '',
        ].join('\r\n'),
        'utf-8'
      );
    } else {
      fs.writeFileSync(
        tmp1,
        [
          '#!/bin/sh',
          'sleep 1',
          'pkill -f "Devin" >/dev/null 2>&1 || true',
          'pkill -f "Windsurf" >/dev/null 2>&1 || true',
          'pkill -f "Codeium" >/dev/null 2>&1 || true',
          'pkill -f "codeium" >/dev/null 2>&1 || true',
          'sleep 1',
          'echo 正在安全清除运行缓存...',
          'rm -rf "$HOME/Library/Caches/Devin"',
          'rm -rf "$HOME/Library/Caches/Windsurf"',
          'rm -rf "$HOME/Library/Caches/Codeium"',
          'rm -rf "$HOME/.cache/Devin"',
          'rm -rf "$HOME/.cache/Windsurf"',
          'rm -rf "$HOME/.cache/Codeium"',
          'rm -rf "${TMPDIR:-/tmp}/codeium"',
          'rm -rf "/tmp/codeium"',
          'echo 运行缓存已清除完毕，Devin Desktop 历史记录已保留，请重新打开 Devin Desktop',
          'printf "Press Enter to close..."',
          'read _',
          '',
        ].join('\n'),
        'utf-8'
      );
      fs.chmodSync(tmp1, 493);
    }
    this.runDetachedCacheCleaner(tmp1);
    this.postActionState(
      'config',
      'success',
      '安全清理缓存脚本已启动，历史记录会保留，Devin Desktop 即将关闭'
    );
  }
  async openMaintenanceTools() {
    const tmp02 = await vscode.window.showQuickPick(
      [
        {
          label: '提示词模板',
          description: '选择内置模板或自定义系统提示词',
          action: 'promptTemplates',
        },
        {
          label: '环境检测',
          description: '检查代理、补丁、运行环境',
          action: 'checkEnvironment',
        },
        {
          label: '强制重启 LS',
          description: '结束 Codeium/language_server 子进程',
          action: 'restartLs',
        },
        {
          label: '安全清理缓存',
          description: '只清理缓存，保留历史记录和工作区数据',
          action: 'clearCache',
        },
        {
          label: '导出诊断',
          description: '复制并打开诊断报告',
          action: 'exportDiagnostics',
        },
      ],
      {
        placeHolder: '选择维护操作',
      }
    );
    if (!tmp02) {
      this.postActionState('config', 'success', '已取消维护操作');
      return;
    }
    if (tmp02.action === 'promptTemplates') {
      await this.openPromptTemplatePicker();
      return;
    }
    if (tmp02.action === 'checkEnvironment') {
      const tmp03 = await this.checkManagedEnvironment();
      const tmp1 = {
        type: 'environmentCheck',
        result: tmp03,
      };
      this.view?.webview.postMessage(tmp1);
      this.postActionState(
        'config',
        tmp03.ok ? 'success' : 'error',
        tmp03.ok ? '环境检测通过' : '检测到异常项'
      );
      return;
    }
    if (tmp02.action === 'restartLs') {
      const tmp03 = await this.forceRestartLanguageServer();
      this.postActionState('config', tmp03.restarted > 0 ? 'success' : 'error', tmp03.message);
      return;
    }
    if (tmp02.action === 'clearCache') {
      await this.clearWindsurfCache();
      return;
    }
    await this.exportDiagnosticReport();
    this.postActionState('config', 'success', '诊断报告已复制并打开');
  }
  getSystemPromptTargetPath(tmp02, tmp1) {
    const tmp2 = {
      ...tmp02,
    };
    const tmp3 = tmp2;
    if (typeof tmp1 === 'string') {
      tmp3.SYSTEM_PROMPT_PATH = tmp1.trim() || './prompts/system-prompt.md';
    }
    return this.proxyManager.getResolvedSystemPromptPath(tmp3);
  }
  async restartProxyForPromptConfigIfRunning() {
    const tmp02 = this.proxyManager.getStatus();
    if (!tmp02.running) {
      return false;
    }
    const tmp1 = await vscode.window.showInformationMessage(
      '提示词配置已更新，需要重启代理后生效。是否立即重启？',
      '立即重启',
      '稍后手动重启'
    );
    if (tmp1 !== '立即重启') {
      return false;
    }
    this.proxyManager.stop();
    await new Promise((arg0) => setTimeout(arg0, 500));
    const tmp2 = await this.proxyManager.start('both', this.getRuntimeConfigForCurrentMode());
    this.postActionState(
      'proxy',
      tmp2 ? 'success' : 'error',
      tmp2 ? '代理已重启，提示词已生效' : this.proxyManager.getLastStartError() || '代理重启失败'
    );
    return tmp2;
  }
  async applySystemPromptContent(tmp02, tmp1, tmp2) {
    const tmp3 = this.proxyManager.readEnvConfig();
    const tmp4 = tmp2?.trim() || './prompts/system-prompt.md';
    const tmp5 = this.getSystemPromptTargetPath(tmp3, tmp4);
    if (fs.existsSync(tmp5)) {
      const tmp03 = fs.readFileSync(tmp5, 'utf-8').trim();
      if (tmp03 && tmp03 !== tmp02.trim()) {
        const tmp04 = await vscode.window.showWarningMessage(
          '将覆盖当前提示词文件：' + tmp5,
          {
            modal: true,
          },
          '覆盖'
        );
        if (tmp04 !== '覆盖') {
          this.postActionState('config', 'success', '已取消应用提示词模板');
          return;
        }
      }
    }
    fs.mkdirSync(path.dirname(tmp5), {
      recursive: true,
    });
    fs.writeFileSync(tmp5, tmp02.trim() + '\n', 'utf-8');
    const tmp6 = {
      ...tmp3,
    };
    tmp6.SYSTEM_PROMPT_OVERRIDE = 'true';
    tmp6.SYSTEM_PROMPT_PATH = tmp4;
    const tmp7 = tmp6;
    this.proxyManager.writeEnvConfig(tmp7);
    this.postActionState('config', 'success', '已应用提示词：' + tmp1);
    await this.restartProxyForPromptConfigIfRunning();
    this.refresh();
  }
  async openPromptTemplatePicker() {
    const tmp02 = {
      label: '自定义提示词',
      description: '打开并编辑 system-prompt.md',
      action: 'custom',
    };
    const tmp1 = {
      label: '关闭提示词覆盖',
      description: '恢复使用 Devin Desktop 原始系统提示词',
      action: 'disable',
    };
    const tmp2 = [
      ...BUILT_IN_PROMPT_TEMPLATES.map((arg0) => ({
        label: arg0.label,
        description: arg0.description,
        action: 'template',
        template: arg0,
      })),
      tmp02,
      tmp1,
    ];
    const tmp3 = await vscode.window.showQuickPick(tmp2, {
      placeHolder: '选择内置提示词模板，或打开自定义提示词文件',
    });
    if (!tmp3) {
      this.postActionState('config', 'success', '已取消提示词操作');
      return;
    }
    if (tmp3.action === 'custom') {
      const tmp03 = this.proxyManager.readEnvConfig();
      const tmp12 = {
        ...tmp03,
      };
      tmp12.SYSTEM_PROMPT_OVERRIDE = 'true';
      tmp12.SYSTEM_PROMPT_PATH = tmp03.SYSTEM_PROMPT_PATH || './prompts/system-prompt.md';
      const tmp22 = tmp12;
      this.proxyManager.writeEnvConfig(tmp22);
      await this.openSystemPromptEditor(tmp22.SYSTEM_PROMPT_PATH);
      this.postActionState('config', 'success', '已启用并打开自定义提示词文件');
      await this.restartProxyForPromptConfigIfRunning();
      this.refresh();
      return;
    }
    if (tmp3.action === 'disable') {
      const tmp03 = this.proxyManager.readEnvConfig();
      const tmp12 = {
        ...tmp03,
      };
      tmp12.SYSTEM_PROMPT_OVERRIDE = '';
      this.proxyManager.writeEnvConfig(tmp12);
      this.postActionState('config', 'success', '已关闭提示词覆盖');
      await this.restartProxyForPromptConfigIfRunning();
      this.refresh();
      return;
    }
    await this.applySystemPromptContent(tmp3.template.content, tmp3.template.label);
  }
  async openSystemPromptEditor(tmp02) {
    const tmp1 = this.proxyManager.readEnvConfig();
    const tmp2 = this.getSystemPromptTargetPath(tmp1, tmp02);
    if (!fs.existsSync(tmp2)) {
      fs.mkdirSync(path.dirname(tmp2), {
        recursive: true,
      });
      const tmp03 = {
        ...tmp1,
      };
      tmp03.SYSTEM_PROMPT_PATH = './prompts/system-prompt.md';
      const tmp12 = this.proxyManager.getResolvedSystemPromptPath(tmp03);
      if (fs.existsSync(tmp12) && path.normalize(tmp12) !== path.normalize(tmp2)) {
        fs.copyFileSync(tmp12, tmp2);
      } else {
        fs.writeFileSync(tmp2, '', 'utf-8');
      }
    }
    const tmp3 = await vscode.workspace.openTextDocument(vscode.Uri.file(tmp2));
    await vscode.window.showTextDocument(tmp3, {
      preview: false,
    });
  }
  async handleMessage(tmp02) {
    switch (tmp02.command) {
      case 'startProxy': {
        const tmp03 = tmp02.config;
        if (tmp03) {
          const tmp04 = this.validateByokSlots(tmp03).join('；');
          if (tmp04) {
            this.postActionState('proxy', 'error', tmp04);
            await vscode.window.showErrorMessage(tmp04);
            break;
          }
        }
        let tmp1;
        if (tmp03) {
          tmp1 = this.writeModeScopedConfig(tmp03);
        }
        const tmp2 = this.getRuntimeConfigForCurrentMode(tmp1);
        const tmp3 = await this.proxyManager.start(tmp02.mode || 'both', tmp2);
        if (!tmp3) {
          this.postActionState(
            'proxy',
            'error',
            this.proxyManager.getLastStartError() || '启动失败，请查看通知或日志'
          );
          break;
        }
        const tmp4 = this.proxyManager.getLastStartWarning();
        this.postActionState('proxy', 'success', tmp4 ? '代理已启动；' + tmp4 : '代理已启动');
        await this.ensurePatchAppliedAfterProxyStart(true);
        this.refresh();
        break;
      }
      case 'stopProxy':
        this.proxyManager.stop();
        this.postActionState('proxy', 'success', '代理已停止');
        this.refresh();
        break;
      case 'saveConfig': {
        const tmp03 = tmp02.config;
        const silent = tmp02.silent === true;
        const tmp1 = this.validateByokSlots(tmp03).join('；');
        if (tmp1) {
          this.postActionState('config', 'error', tmp1);
          if (!silent) {
            await vscode.window.showErrorMessage(tmp1);
          }
          break;
        }
        const tmp2 = this.writeModeScopedConfig(tmp03);
        const tmp3 = this.getRuntimeConfigForCurrentMode(tmp2);
        const tmp4 = this.proxyManager.getStatus();
        let tmp5 = '配置已保存；代理未运行，下次启动生效';
        if (tmp4.running) {
          const { hybridPort: tmp04, inferencePort: tmp12 } =
            this.proxyManager.portsFromConfig(tmp2);
          const tmp22 = tmp4.hybridPort !== tmp04 || tmp4.inferencePort !== tmp12;
          if (tmp22) {
            this.proxyManager.stop();
            const tmp32 = await this.proxyManager.start('both', tmp3);
            tmp5 = tmp32
              ? '配置已保存；端口变更，代理已重启并使用新配置'
              : '配置已保存；端口变更但代理重启失败：' +
                (this.proxyManager.getLastStartError() || '未知错误');
            this.postActionState(
              'patch',
              'success',
              '端口已变更；如需让 Devin Desktop 使用新端口，请手动点击"安装补丁"并重载窗口'
            );
          } else {
            const tmp05 = {
              hybridPort: tmp04,
              inferencePort: tmp12,
            };
            const tmp32 = await this.proxyManager.reloadRuntimeConfig(tmp3, tmp05);
            if (tmp32.ok) {
              tmp5 = '配置已保存，并已热更新到运行中的代理';
            } else {
              const tmp42 = tmp32.errors.join('；') || '未知错误';
              this.logLines.push('配置热更新失败，准备自动重启代理：' + tmp42);
              this.proxyManager.stop();
              await new Promise((arg0) => setTimeout(arg0, 500));
              const tmp52 = await this.proxyManager.start('both', tmp3);
              tmp5 = tmp52
                ? '配置已保存；热更新失败但已自动重启代理生效（' + tmp42 + '）'
                : '配置已保存；热更新失败且代理重启失败：' +
                  (this.proxyManager.getLastStartError() || tmp42);
            }
          }
        }
        if (!silent) {
          this.postActionState('config', tmp5.includes('失败') ? 'error' : 'success', tmp5);
        }
        this.refresh();
        break;
      }
      case 'reloadIdeWindow': {
        await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
        break;
      }
      case 'newWindow': {
        await vscode.commands.executeCommand('workbench.action.newWindow');
        break;
      }
      case 'openPromptTemplates': {
        try {
          await this.openPromptTemplatePicker();
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '提示词操作失败：' + tmp1);
        }
        break;
      }
      case 'openSystemPrompt': {
        try {
          const tmp03 = this.proxyManager.readEnvConfig();
          const tmp1 =
            typeof tmp02.path === 'string' && tmp02.path.trim()
              ? tmp02.path.trim()
              : './prompts/system-prompt.md';
          const tmp2 = {
            ...tmp03,
          };
          tmp2.SYSTEM_PROMPT_OVERRIDE = 'true';
          tmp2.SYSTEM_PROMPT_PATH = tmp1;
          this.proxyManager.writeEnvConfig(tmp2);
          await this.openSystemPromptEditor(tmp1);
          this.postActionState('config', 'success', '已启用并打开自定义提示词文件');
          await this.restartProxyForPromptConfigIfRunning();
          this.refresh();
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '打开提示词失败：' + tmp1);
        }
        break;
      }
      case 'setAutoStartProxy': {
        await this.context.globalState.update(KEY_AUTO_START_PROXY, tmp02.value === true);
        break;
      }
      case 'maintenanceTools': {
        try {
          await this.openMaintenanceTools();
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '维护操作失败：' + tmp1);
        }
        break;
      }
      case 'clearCache': {
        try {
          await this.clearWindsurfCache();
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '清理缓存失败：' + tmp1);
        }
        break;
      }
      case 'forceRestartLanguageServer': {
        try {
          const tmp03 = await this.forceRestartLanguageServer();
          this.postActionState('config', tmp03.restarted > 0 ? 'success' : 'error', tmp03.message);
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '强制重启 LS 失败：' + tmp1);
        }
        break;
      }
      case 'checkEnvironment': {
        try {
          const tmp03 = await this.checkManagedEnvironment();
          const tmp1 = {
            type: 'environmentCheck',
            result: tmp03,
          };
          this.view?.webview.postMessage(tmp1);
          this.postActionState(
            'config',
            tmp03.ok ? 'success' : 'error',
            tmp03.ok ? '环境检测通过' : '检测到异常项'
          );
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '环境检测失败：' + tmp1);
        }
        break;
      }
      case 'exportDiagnostics': {
        try {
          await this.exportDiagnosticReport();
          this.postActionState('config', 'success', '诊断报告已复制并打开');
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '导出诊断失败：' + tmp1);
        }
        break;
      }
      case 'repairEnvironment': {
        try {
          const tmp03 = await this.repairManagedEnvironment();
          const tmp1 = {
            type: 'environmentCheck',
            result: tmp03,
          };
          this.view?.webview.postMessage(tmp1);
          this.postActionState(
            'config',
            tmp03.ok ? 'success' : 'error',
            tmp03.ok ? '环境修复完成' : '已修复可处理项，仍有异常需手动处理'
          );
          this.refresh();
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.postActionState('config', 'error', '环境修复失败：' + tmp1);
        }
        break;
      }
      case 'probeModelLink': {
        try {
          const tmp03 = {
            ...this.proxyManager.readEnvConfig(),
            ...(tmp02.config && typeof tmp02.config === 'object' ? tmp02.config : {}),
          };
          const tmp1 = this.normalizeProviderBaseUrl(tmp03);
          const tmp2 = await this.probeConfiguredModelStream(tmp1);
          const tmp3 = {
            type: 'modelProbeResult',
            result: tmp2,
          };
          this.view?.webview.postMessage(tmp3);
          this.postActionState(
            'config',
            tmp2.ok ? 'success' : 'error',
            tmp2.ok ? '模型链路探测通过' : '模型链路探测失败'
          );
        } catch (tmp03) {
          const tmp1 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          const tmp2 = {
            ok: false,
            model: '--',
            detail: tmp1,
          };
          const tmp3 = {
            type: 'modelProbeResult',
            result: tmp2,
          };
          this.view?.webview.postMessage(tmp3);
          this.postActionState('config', 'error', '模型链路探测失败：' + tmp1);
        }
        break;
      }
      case 'importExternalConfig': {
        const tmp03 = tmp02.slot === 2 ? 2 : 1;
        const tmp04 = String(tmp02.source || 'claude')
          .trim()
          .toLowerCase();
        const tmp1 = externalConfigImporter_1.readExternalUserConfig(tmp04);
        if (!tmp1.ok) {
          const tmp2 = tmp1.error || '导入失败';
          this.postActionState('config', 'error', tmp2);
          await vscode.window.showErrorMessage(tmp2);
          break;
        }
        const tmp5 = 'BYOK' + tmp03 + '_';
        const tmp6 = {
          [tmp5 + 'ANTHROPIC_API_HOST']: tmp1.host || '',
          [tmp5 + 'ANTHROPIC_API_KEY']: tmp1.apiKey || '',
          [tmp5 + 'OPENAI_API_HOST']: tmp1.host || '',
          [tmp5 + 'OPENAI_API_KEY']: tmp1.apiKey || '',
          [tmp5 + 'MODEL']: tmp1.model || '',
          [tmp5 + 'THINKING_EFFORT']: tmp1.thinkingEffort || '',
        };
        const tmp7 = this.writeModeScopedConfig(tmp6);
        const tmp8 = this.getRuntimeConfigForCurrentMode(tmp7);
        const tmp9 = this.proxyManager.getStatus();
        let tmp10 = '';
        if (tmp9.running) {
          const tmp11 = await this.proxyManager.reloadRuntimeConfig(tmp8, {
            hybridPort: tmp9.hybridPort,
            inferencePort: tmp9.inferencePort,
          });
          if (!tmp11.ok) {
            tmp10 = '；代理热更新失败：' + tmp11.errors.join('；');
          }
        }
        const tmp3 =
          '已从 ' +
          tmp1.label +
          ' 导入并保存到 BYOK #' +
          tmp03 +
          '（' +
          tmp1.filePath +
          '）' +
          (tmp1.model ? '' : '；正在加载模型列表') +
          tmp10;
        this.view?.webview.postMessage({
          type: 'externalConfigImported',
          slot: tmp03,
          host: tmp1.host || '',
          apiKey: tmp1.apiKey || '',
          model: tmp1.model || '',
          thinkingEffort: tmp1.thinkingEffort || '',
          message: tmp3,
        });
        if (tmp1.apiKey && tmp1.host) {
          this.view?.webview.postMessage({
            type: 'modelList',
            slot: tmp03,
            loading: true,
          });
          try {
            const tmp11 = await this.fetchModelsFromGateway(tmp1.apiKey, tmp1.host);
            this.view?.webview.postMessage({
              type: 'modelList',
              slot: tmp03,
              data: tmp11,
            });
          } catch (tmp11) {
            this.view?.webview.postMessage({
              type: 'modelList',
              slot: tmp03,
              error: this.formatModelFetchError(tmp11),
            });
          }
        }
        this.postActionState('config', 'success', tmp3);
        break;
      }
      case 'fetchModels': {
        const tmp03 = tmp02.slot === 2 ? 2 : 1;
        this.view?.webview.postMessage({
          type: 'modelList',
          slot: tmp03,
          loading: true,
        });
        try {
          const tmp04 = this.resolveModelFetchCredentials(tmp02.apiKey, tmp02.baseUrl);
          const tmp1 = await this.fetchModelsFromGateway(tmp04.apiKey, tmp04.baseUrl);
          const tmp2 = {
            type: 'modelList',
            slot: tmp03,
            data: tmp1,
          };
          this.view?.webview.postMessage(tmp2);
        } catch (tmp04) {
          const tmp1 = this.formatModelFetchError(tmp04);
          const tmp2 = {
            type: 'modelList',
            slot: tmp03,
            error: tmp1,
          };
          this.view?.webview.postMessage(tmp2);
          await vscode.window.showErrorMessage(tmp1);
        }
        break;
      }
      case 'applyPatch': {
        const tmp03 = this.proxyManager.getStatus();
        const tmp1 = patchManager_1.PatchManager.loopbackApiUrl(tmp03.hybridPort);
        const tmp2 = patchManager_1.PatchManager.loopbackApiUrl(tmp03.inferencePort);
        const tmp3 = tmp02.apiUrl || tmp1;
        const tmp4 = tmp02.inferenceUrl || tmp2;
        const tmp5 = tmp02.extJsPath || this.getStoredPatchExtensionPath() || undefined;
        const tmp6 = patchManager_1.PatchManager.applyWithCustomUrls(tmp3, tmp4, tmp5);
        const tmp7 =
          tmp6.applied > 0
            ? '补丁已应用 ' +
              tmp6.applied +
              '/' +
              (tmp6.applied + tmp6.skipped + tmp6.failed) +
              '，需重载窗口生效'
            : tmp6.skipped > 0
              ? '所有补丁已是最新'
              : '未找到可应用的补丁';
        const tmp8 = '重载窗口';
        if (tmp6.applied > 0) {
          this.postActionState('patch', 'success', tmp7);
          const tmp04 = await vscode.window.showInformationMessage(tmp7, tmp8);
          if (tmp04 === tmp8) {
            await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
          }
        } else {
          this.postActionState('patch', tmp6.skipped > 0 ? 'success' : 'error', tmp7);
          await vscode.window.showInformationMessage(tmp7);
        }
        this.refresh();
        break;
      }
      case 'refreshPatchStatus':
        this.postActionState('patch', 'success', '补丁状态已刷新');
        this.refresh();
        break;
      case 'locateExtJs': {
        const tmp03 = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          filters: {
            JavaScript: ['js'],
          },
          title: '选择 Devin Desktop extension.js',
        });
        if (tmp03 && tmp03.length > 0) {
          await this.setStoredPatchExtensionPath(tmp03[0].fsPath);
          this.postActionState('patch', 'success', '已选择 extension.js');
          this.refresh();
        } else {
          this.postActionState('patch', 'success', '已取消选择');
        }
        break;
      }
      case 'clearExtJsPath':
        await this.setStoredPatchExtensionPath(undefined);
        this.postActionState('patch', 'success', '已切回自动检测');
        this.refresh();
        break;
      case 'revertPatch': {
        const tmp03 = patchManager_1.PatchManager.revert(
          tmp02.extJsPath || this.getStoredPatchExtensionPath() || undefined
        );
        const tmp1 = '重载窗口';
        if (tmp03) {
          this.postActionState('patch', 'success', '补丁已还原，需重载窗口生效');
          const tmp04 = await vscode.window.showInformationMessage(
            '补丁已还原，需重载窗口生效',
            tmp1
          );
          if (tmp04 === tmp1) {
            await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
          }
        } else {
          this.postActionState('patch', 'error', '未找到备份文件');
          await vscode.window.showInformationMessage('未找到备份文件');
        }
        this.refresh();
        break;
      }
      case 'getStatus': {
        await this.postStatusSnapshot();
        break;
      }
    }
  }
  getHtml() {
    const tmp02 = this.proxyManager.getStatus();
    const tmp1 = this.getPatchStatus();
    const tmp2 = this.getModeScopedConfig(this.proxyManager.readEnvConfig());
    const tmp3 = patchManager_1.PatchManager.loopbackApiUrl(tmp02.hybridPort);
    const tmp4 = patchManager_1.PatchManager.loopbackApiUrl(tmp02.inferencePort);
    const tmp5 = this.context.globalState.get(KEY_AUTO_START_PROXY) === true;
    const tmp6 = tmp1.path
      ? tmp1.path.replace(/\\/g, '/').split('/').slice(-4).join('/')
      : '未找到';
    const tmp7 = tmp1.patches.filter((arg0) => arg0.status === 'applied').length;
    const tmp8 = this.proxyManager.getSystemPromptConfigPath(tmp2);
    const tmp9 = tmp2.SYSTEM_PROMPT_OVERRIDE === 'true';
    const tmp10 = getWebviewNonce();
    const tmp11 = this.view?.webview.cspSource ?? '';
    const tmp12 = this.view.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webviews', 'sidebar.js')
    );
    const tmp12a = this.view.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'resources', 'webviews', 'dist', 'sidebar.css')
    );
    const tmp13 = 'var(--vscode-button-background,#0d9488)';
    const tmp14 = 'var(--vscode-button-hoverBackground,#0f766e)';
    const tmp15 = 'var(--vscode-textLink-foreground,#5eead4)';
    const tmp16 = 'var(--vscode-descriptionForeground,#71717a)';
    const tmp17 = 'var(--vscode-disabledForeground,#52525b)';
    const tmp18 = 'var(--vscode-sideBar-background,var(--vscode-editor-background,#1a1a2e))';
    const tmp19 = 'var(--vscode-editorWidget-background,var(--vscode-sideBar-background,#16162a))';
    const tmp20 = 'var(--vscode-input-background,var(--vscode-editor-background,#0f0f1e))';
    const tmp21 = 'var(--vscode-panel-border,var(--vscode-widget-border,#2a2a4a))';
    const tmp22 = 'var(--vscode-foreground,#d4d4d8)';
    const tmp23 = 'var(--vscode-input-foreground,var(--vscode-foreground,#e4e4e7))';
    const tmp24 = "'Cascadia Code','Fira Code',monospace";
    const tmp25 = esc(tmp2.BYOK1_ANTHROPIC_API_HOST || tmp2.ANTHROPIC_API_HOST || '');
    const tmp26 = esc(tmp2.BYOK1_ANTHROPIC_API_KEY || tmp2.ANTHROPIC_API_KEY || '');
    const tmp27 = esc(tmp2.BYOK1_MODEL || tmp2.DEFAULT_MODEL || '');
    const tmp28 = esc(tmp2.BYOK2_ANTHROPIC_API_HOST || '');
    const tmp29 = esc(tmp2.BYOK2_ANTHROPIC_API_KEY || '');
    const tmp30 = esc(tmp2.BYOK2_MODEL || '');
    const tmp31 = esc(tmp2.BYOK1_THINKING_EFFORT || tmp2.OPENAI_REASONING_EFFORT || '');
    const tmp32 = esc(tmp2.BYOK2_THINKING_EFFORT || '');
    const tmp33 = Object.prototype.hasOwnProperty.call(tmp2, 'OPENAI_REASONING_EFFORT')
      ? tmp2.OPENAI_REASONING_EFFORT
      : '';
    const tmp34 = tmp7 === tmp1.patches.length ? 'badge-ok' : 'badge-warn';
    const tmp35 = tmp7 === tmp1.patches.length ? '已就绪' : '需安装';
    const tmp36 =
      this.logLines.length === 0
        ? '<div class="log-line dim">等待日志...</div>'
        : this.logLines
            .slice(-30)
            .map((arg0) => {
              const tmp110 = /→.*GetChatMessage|GetStreamingCompletions|GetEmbeddings/.test(arg0)
                ? ' hi'
                : /err|stderr/i.test(arg0)
                  ? ' err'
                  : '';
              return '<div class="log-line' + tmp110 + '">' + esc(arg0) + '</div>';
            })
            .join('');

    return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${tmp11} 'unsafe-inline'; img-src ${tmp11} https: data:; script-src 'nonce-${tmp10}' ${tmp11};">
<link rel="stylesheet" href="${tmp12a}">
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
    <button type="button" class="tab-btn active" data-tab="tab-config">
        配置连接
        <span class="tab-badge hidden" id="configBadge">!</span>
    </button>
    <button type="button" class="tab-btn" data-tab="tab-control">
        控制状态
        <span class="tab-badge hidden" id="controlBadge">●</span>
    </button>
    <button type="button" class="tab-btn" data-tab="tab-system">
        系统补丁
        <span class="tab-badge hidden" id="systemBadge">!</span>
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
    <div class="tab-content active" id="tab-config">
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
            <div class="fg" id="cfgByok1ThinkingEffortRow"><label id="cfgByok1ThinkingLabel">${esc(thinkingEffort_1.getThinkingIntensityHint(thinkingEffort_1.detectModelProvider(tmp27)))}</label><select id="cfgByok1ThinkingEffort">${buildThinkingEffortOptions(tmp27, tmp31)}</select></div>
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
            <div class="fg" id="cfgByok2ThinkingEffortRow"><label id="cfgByok2ThinkingLabel">${esc(thinkingEffort_1.getThinkingIntensityHint(thinkingEffort_1.detectModelProvider(tmp30)))}</label><select id="cfgByok2ThinkingEffort">${buildThinkingEffortOptions(tmp30, tmp32)}</select></div>
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
    <div class="tab-content" id="tab-system">
        <div class="card" style="margin-bottom:12px">
            <div class="card-head between">
                <span>补丁管理</span>
                <span id="patchBadge" class="badge ${tmp34}">${tmp35}</span>
            </div>
            <input type="hidden" id="patchApiUrl" value="${esc(tmp3)}">
            <input type="hidden" id="patchInferenceUrl" value="${esc(tmp4)}">
            <div id="patchPathDisplay" class="patch-path">${tmp6 ? '<b>补丁路径</b> ' + esc(tmp6) : '<b>补丁路径</b> 自动检测；非默认安装请点"选择路径"'}</div>
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
}
exports.SidebarProvider = SidebarProvider;
function buildThinkingEffortOptions(arg0, arg1) {
  return thinkingEffort_1.buildThinkingEffortOptionsHtml(arg0, arg1);
}
function esc(arg0) {
  return sidebarHtml_1.esc(arg0);
}
function stripProtoServer(arg0) {
  return gatewayUrl_1.stripProtoServer(arg0);
}
function shouldUseHttpGateway(arg0) {
  return gatewayUrl_1.shouldUseHttpGateway(arg0);
}
function ensureGatewayUrl(arg0) {
  return gatewayUrl_1.ensureGatewayUrl(arg0);
}
function formatUptime(arg0) {
  return sidebarHtml_1.formatUptime(arg0);
}
