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
const sidebarTemplate_1 = require('../views/sidebarTemplate');
const sidebarUtils_1 = require('./sidebar-utils');
const modelFetcher_1 = require('../services/modelFetcher');
const diagnostics_1 = require('../services/diagnostics');
const promptTemplates_1 = require('../services/promptTemplates');
const environmentProbe_1 = require('../services/environmentProbe');
const KEY_AUTO_START_PROXY = 'devin-byok-plus.autoStartProxy';
const KEY_PATCH_EXTENSION_PATH = 'devin-byok-plus.patchExtensionPath';
const LEGACY_KEY_PATCH_EXTENSION_PATH = 'windsurf-byok-plus.patchExtensionPath';
const LEGACY_KEY_PATCH_EXTENSION_PATH_2 = 'devin-byok-plus.patchExtensionPath';
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
    const tmp1 = modelFetcher_1.normalizeProviderBaseUrl({
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
    const merged = modelFetcher_1.normalizeProviderBaseUrl({
      ...this.proxyManager.readEnvConfig(),
      ...tmp02,
    });
    this.proxyManager.writeEnvConfig(merged);
    return merged;
  }
  async checkWindsurfProcessRouting(tmp02) {
    const { hybridPort: tmp1, inferencePort: tmp2 } = this.proxyManager.portsFromConfig(tmp02);
    const tmp3 = ['localhost:' + tmp1, '127.0.0.1:' + tmp1];
    const tmp4 = ['localhost:' + tmp2, '127.0.0.1:' + tmp2];
    let tmp5 = [];
    try {
      tmp5 = await environmentProbe_1.readWindsurfProcessCommandLines();
    } catch (tmp03) {
      const tmp12 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
      return sidebarUtils_1.envCheckItem(
        'devin-process-routing',
        '进程路由参数',
        'warning',
        '无法读取 Devin Desktop/Codeium 进程命令行：' + tmp12,
        false
      );
    }
    if (tmp5.length === 0) {
      return sidebarUtils_1.envCheckItem(
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
      return sidebarUtils_1.envCheckItem(
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
    return sidebarUtils_1.envCheckItem(
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
      return sidebarUtils_1.envCheckItem(
        'model-catalog',
        '模型权限',
        'warning',
        '未配置 API Key，无法检查模型列表权限',
        false
      );
    }
    try {
      const tmp03 = await modelFetcher_1.fetchModelsFromGateway(tmp1, undefined, this.proxyManager);
      const tmp12 = modelFetcher_1.flattenModelIds(tmp03);
      const tmp22 = tmp12.filter((arg0) => /opus/i.test(arg0));
      const tmp3 = modelFetcher_1.modelIdMatches(tmp12, tmp2);
      if (tmp12.length === 0) {
        return sidebarUtils_1.envCheckItem(
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
      return sidebarUtils_1.envCheckItem(
        'model-catalog',
        '模型权限',
        !tmp3 || tmp22.length === 0 ? 'warning' : 'ok',
        '可见模型 ' + tmp12.length + ' 个；' + tmp4 + '；' + tmp5,
        false
      );
    } catch (tmp03) {
      const tmp12 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
      return sidebarUtils_1.envCheckItem(
        'model-catalog',
        '模型权限',
        'warning',
        '模型列表检查失败：' + tmp12,
        false
      );
    }
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
      sidebarUtils_1.envCheckItem(
        'proxy-root',
        '内置代理目录',
        tmp4.length === 0 ? 'ok' : 'error',
        tmp4.length === 0 ? tmp1 : '缺少 ' + tmp4.join(', '),
        false
      )
    );
    tmp02.push(
      sidebarUtils_1.envCheckItem(
        'env-file',
        '配置文件',
        fs.existsSync(tmp2) ? 'ok' : 'warning',
        fs.existsSync(tmp2) ? tmp2 : '缺少 .env，将使用默认配置生成',
        !fs.existsSync(tmp2)
      )
    );
    const tmp5 = ['HYBRID_PORT', 'INFERENCE_PORT'].filter(
      (arg0) => !sidebarUtils_1.isValidPortValue(tmp3[arg0])
    );
    const tmp6 = !sidebarUtils_1.isValidCompletionTimeoutValue(tmp3.COMPLETION_TIMEOUT_MS);
    const tmp7 = this.proxyManager.portsFromConfig(tmp3);
    const tmp8 = this.proxyManager.getStatus().running;
    const tmp9 = tmp8 ? true : await environmentProbe_1.isPortFree(tmp7.hybridPort);
    const tmp10 = tmp8 ? true : await environmentProbe_1.isPortFree(tmp7.inferencePort);
    const tmp11 = [
      !tmp9 ? 'Hybrid ' + tmp7.hybridPort : '',
      !tmp10 ? 'Inference ' + tmp7.inferencePort : '',
    ].filter(Boolean);
    tmp02.push(
      sidebarUtils_1.envCheckItem(
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
      sidebarUtils_1.envCheckItem(
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
      sidebarUtils_1.envCheckItem(
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
      sidebarUtils_1.envCheckItem(
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
      sidebarUtils_1.envCheckItem(
        'api-key',
        'API Key',
        tmp3.ANTHROPIC_API_KEY || tmp3.OPENAI_API_KEY ? 'ok' : 'warning',
        tmp3.ANTHROPIC_API_KEY || tmp3.OPENAI_API_KEY ? '已配置' : '未配置，请手动填写 API Key',
        false
      )
    );
    tmp02.push(diagnostics_1.checkModelRoutingDiagnostic(tmp3));
    tmp02.push(diagnostics_1.checkInlineFastTimeoutRisk(tmp3));
    tmp02.push(await this.checkWindsurfProcessRouting(tmp3));
    tmp02.push(await this.checkGatewayModelCatalog(tmp3));
    const tmp21 = this.proxyManager.getDefaultSystemPromptFilePath();
    tmp02.push(
      sidebarUtils_1.envCheckItem(
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
      sidebarUtils_1.envCheckItem(
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
  readExtensionPackageInfo() {
    const tmp02 = diagnostics_1.readJsonObject(path.join(this.context.extensionPath, 'package.json')) || {};
    return {
      name: String(tmp02.name || ''),
      displayName: String(tmp02.displayName || ''),
      version: String(tmp02.version || ''),
      publisher: String(tmp02.publisher || ''),
    };
  }
  async createDiagnosticReport() {
    const tmp02 = this.proxyManager.readEnvConfig();
    const tmp1 = this.proxyManager.getStatus();
    const tmp2 = this.proxyManager.portsFromConfig(tmp02);
    const tmp3 = this.getPatchStatus();
    const tmp4 = this.readExtensionPackageInfo();
    const tmp5 = environmentProbe_1.readWindsurfProductInfo(vscode);
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
        items: [
          sidebarUtils_1.envCheckItem('environment-check', '环境检测', 'error', tmp19, false),
        ],
      };
    }
    let processLines = [];
    let processError = '';
    try {
      processLines = (await environmentProbe_1.readWindsurfProcessCommandLines())
        .slice(0, 25)
        .map((arg0) =>
          diagnostics_1.sanitizeDiagnosticText(arg0.length > 800 ? arg0.slice(0, 800) + '...' : arg0)
        );
    } catch (tmp03) {
      processError = tmp03 instanceof Error ? tmp03.message : String(tmp03);
    }
    const tmp9 = await this.checkHttpHealth('' + '/health', 5000).catch((arg0) => ({
      ok: false,
      elapsedMs: 0,
      error: arg0 instanceof Error ? arg0.message : String(arg0),
    }));
    const tmp10 = await environmentProbe_1.getPortListeners(tmp2.hybridPort);
    const tmp11 = await environmentProbe_1.getPortListeners(tmp2.inferencePort);
    const tmp12 = this.logLines
      .slice(-100)
      .map((arg0) => diagnostics_1.sanitizeDiagnosticText(arg0))
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
      selectedKey: sidebarUtils_1.redactSecret(
        tmp02.ANTHROPIC_API_KEY || tmp02.OPENAI_API_KEY || ''
      ),
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
      sidebarUtils_1.jsonBlock({
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
      sidebarUtils_1.jsonBlock({
        status: tmp1,
        lastStartError: this.proxyManager.getLastStartError(),
        lastStartWarning: this.proxyManager.getLastStartWarning(),
      }),
      '',
      '## 配置快照（已脱敏）',
      sidebarUtils_1.jsonBlock(diagnostics_1.sanitizeEnvConfig(tmp02)),
      '',
      '## API Key 配置',
      sidebarUtils_1.jsonBlock(tmp14),
      '',
      '## 补丁状态',
      sidebarUtils_1.jsonBlock(tmp3),
      '',
      '## 端口监听',
      sidebarUtils_1.jsonBlock(tmp18),
      '',
      '## 网关连通',
      sidebarUtils_1.jsonBlock({
        host: '',
        health: tmp9,
      }),
      '',
      '## 环境检测',
      tmp13 || '无检测项',
      '',
      '## Devin Desktop / Codeium 进程',
      processError
        ? sidebarUtils_1.textBlock(processError)
        : sidebarUtils_1.textBlock(processLines.join('\n')),
      '## 最近 100 行日志',
      sidebarUtils_1.textBlock(tmp12),
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
    if (!sidebarUtils_1.isValidPortValue(tmp2.HYBRID_PORT)) {
      tmp2.HYBRID_PORT = '3006';
    }
    if (!sidebarUtils_1.isValidPortValue(tmp2.INFERENCE_PORT)) {
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
    if (!sidebarUtils_1.isValidCompletionTimeoutValue(tmp2.COMPLETION_TIMEOUT_MS)) {
      tmp2.COMPLETION_TIMEOUT_MS = '12000';
    }
    this.proxyManager.writeEnvConfig(tmp2);
    const tmp3 = this.proxyManager.getDefaultSystemPromptFilePath();
    if (!fs.existsSync(tmp3)) {
      fs.mkdirSync(path.dirname(tmp3), {
        recursive: true,
      });
      fs.writeFileSync(tmp3, promptTemplates_1.DEFAULT_SYSTEM_PROMPT.trim() + '\n', 'utf-8');
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
            sidebarUtils_1.shellQuote(tmp02).replace(/"/g, '\\"') +
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
    const tmp2 = await environmentProbe_1.execFileText(
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
      await environmentProbe_1.execFileText('taskkill.exe', ['/PID', String(tmp03), '/T', '/F'], 5000);
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
      ...promptTemplates_1.BUILT_IN_PROMPT_TEMPLATES.map((arg0) => ({
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
          const tmp1 = modelFetcher_1.normalizeProviderBaseUrl(tmp03);
          const tmp2 = await environmentProbe_1.probeConfiguredModelStream(tmp1);
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
            const tmp11 = await modelFetcher_1.fetchModelsFromGateway(
              tmp1.apiKey,
              tmp1.host,
              this.proxyManager
            );
            this.view?.webview.postMessage({
              type: 'modelList',
              slot: tmp03,
              data: tmp11,
            });
          } catch (tmp11) {
            this.view?.webview.postMessage({
              type: 'modelList',
              slot: tmp03,
              error: modelFetcher_1.formatModelFetchError(tmp11),
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
          const tmp04 = modelFetcher_1.resolveModelFetchCredentials(tmp02.apiKey, tmp02.baseUrl);
          const tmp1 = await modelFetcher_1.fetchModelsFromGateway(
            tmp04.apiKey,
            tmp04.baseUrl,
            this.proxyManager
          );
          const tmp2 = {
            type: 'modelList',
            slot: tmp03,
            data: tmp1,
          };
          this.view?.webview.postMessage(tmp2);
        } catch (tmp04) {
          const tmp1 = modelFetcher_1.formatModelFetchError(tmp04);
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
    // 注意：以下 BYOK 字段传入原始值，转义统一由 sidebarTemplate 数据准备层处理，避免双重转义
    const tmp25 = tmp2.BYOK1_ANTHROPIC_API_HOST || tmp2.ANTHROPIC_API_HOST || '';
    const tmp26 = tmp2.BYOK1_ANTHROPIC_API_KEY || tmp2.ANTHROPIC_API_KEY || '';
    const tmp27 = tmp2.BYOK1_MODEL || tmp2.DEFAULT_MODEL || '';
    const tmp28 = tmp2.BYOK2_ANTHROPIC_API_HOST || '';
    const tmp29 = tmp2.BYOK2_ANTHROPIC_API_KEY || '';
    const tmp30 = tmp2.BYOK2_MODEL || '';
    const tmp31 = tmp2.BYOK1_THINKING_EFFORT || tmp2.OPENAI_REASONING_EFFORT || '';
    const tmp32 = tmp2.BYOK2_THINKING_EFFORT || '';
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

    return sidebarTemplate_1.renderSidebarHtml({
      nonce: tmp10,
      cspSource: tmp11,
      scriptUri: tmp12,
      cssUri: tmp12a,
      // 原始 tmp 变量（保持向后兼容）
      tmp02,
      tmp1,
      tmp2,
      tmp3,
      tmp4,
      tmp5,
      tmp6,
      tmp7,
      tmp8,
      tmp9,
      tmp10,
      tmp11,
      tmp12,
      tmp13,
      tmp14,
      tmp15,
      tmp16,
      tmp17,
      tmp18,
      tmp19,
      tmp20,
      tmp21,
      tmp22,
      tmp23,
      tmp24,
      tmp25,
      tmp26,
      tmp27,
      tmp28,
      tmp29,
      tmp30,
      tmp31,
      tmp32,
      tmp33,
      tmp34,
      tmp35,
      tmp36,
    });
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
