'use strict';

var __createBinding = this && this.__createBinding || (Object.create ? function (_0x3332b3, _0x3f8994, _0x3bfc63, _0x5278a6 = _0x3bfc63) {
  var _0x25a0d2 = Object.getOwnPropertyDescriptor(_0x3f8994, _0x3bfc63);
  if (!_0x25a0d2 || ("get" in _0x25a0d2 ? !_0x3f8994.__esModule : _0x25a0d2.writable || _0x25a0d2.configurable)) {
    const _0x8b8867 = {
      enumerable: true,
      get: function () {
        return _0x3f8994[_0x3bfc63];
      }
    };
    _0x25a0d2 = _0x8b8867;
  }
  Object.defineProperty(_0x3332b3, _0x5278a6, _0x25a0d2);
} : function (_0x58a76c, _0x591af3, _0x9e53cf, _0x351eb6 = _0x9e53cf) {
  _0x58a76c[_0x351eb6] = _0x591af3[_0x9e53cf];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function (_0x2852f4, _0x33cb03) {
  const _0x19e7bd = {
    enumerable: true,
    value: _0x33cb03
  };
  Object.defineProperty(_0x2852f4, "default", _0x19e7bd);
} : function (_0x5961bd, _0x571a4e) {
  _0x5961bd.default = _0x571a4e;
});
var __importStar = this && this.__importStar || function () {
  function _0x224ebd(_0x503539) {
    _0x224ebd = Object.getOwnPropertyNames || function (_0x330369) {
      var _0x929026 = [];
      for (var _0x190e65 in _0x330369) {
        if (Object.prototype.hasOwnProperty.call(_0x330369, _0x190e65)) {
          _0x929026[_0x929026.length] = _0x190e65;
        }
      }
      return _0x929026;
    };
    return _0x224ebd(_0x503539);
  }
  return function (_0x7bdcac) {
    if (_0x7bdcac && _0x7bdcac.__esModule) {
      return _0x7bdcac;
    }
    var _0x319bbd = {};
    if (_0x7bdcac != null) {
      for (var _0x4349b0 = _0x224ebd(_0x7bdcac), _0xbd7659 = 0; _0xbd7659 < _0x4349b0.length; _0xbd7659++) {
        if (_0x4349b0[_0xbd7659] !== "default") {
          __createBinding(_0x319bbd, _0x7bdcac, _0x4349b0[_0xbd7659]);
        }
      }
    }
    __setModuleDefault(_0x319bbd, _0x7bdcac);
    return _0x319bbd;
  };
}();
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SidebarProvider = undefined;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const net = __importStar(require("net"));
const crypto = __importStar(require("crypto"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const patchManager_1 = require("./patchManager");
const reloadWorkbench_1 = require("./reloadWorkbench");
const thinkingEffort_1 = require("./thinkingEffort");
const KEY_AUTO_START_PROXY = "devin-byok-bridge.autoStartProxy";
const LEGACY_KEY_AUTO_START_PROXY = "windsurf-byok-bridge.autoStartProxy";
const KEY_PATCH_EXTENSION_PATH = "devin-byok-bridge.patchExtensionPath";
const LEGACY_KEY_PATCH_EXTENSION_PATH = "windsurf-byok-bridge.patchExtensionPath";
const DEFAULT_SYSTEM_PROMPT = ["You are Devin Local, Devin Desktop's software engineering assistant.", "Help the user solve coding tasks through implementation, debugging, code review, and repository-aware reasoning.", "Prioritize correctness, low-risk changes, and forward progress."].join("\n");
const _0x5a96b6 = {
  id: "default",
  label: "默认工程助手",
  description: "通用编码、调试、代码审查",
  content: DEFAULT_SYSTEM_PROMPT
};
const BUILT_IN_PROMPT_TEMPLATES = [_0x5a96b6, {
  id: "code-review",
  label: "代码审查增强",
  description: "优先发现逻辑风险、配置污染和回归点",
  content: [DEFAULT_SYSTEM_PROMPT, "", "Focus on code review before making changes.", "Identify root causes, config pollution, runtime mapping mistakes, compatibility risks, and regression paths.", "Prefer small, low-risk fixes and verify behavior with compile or targeted tests.", "When reporting findings, clearly separate confirmed issues from hypotheses."].join("\n")
}, {
  id: "slow-request",
  label: "慢请求诊断",
  description: "定位代理、模型加载、上游首包和网络耗时",
  content: [DEFAULT_SYSTEM_PROMPT, "", "When debugging slow requests, map the full request path first.", "Separate local proxy delay from upstream/network/model first-token latency using timing logs.", "Check model loading, runtime hot reload, provider host/key mapping, cache invalidation, and request forwarding.", "Avoid masking latency symptoms; fix wrong routing or config causes first."].join("\n")
}, {
  id: "frontend-ui",
  label: "前端 UI 实现",
  description: "侧重交互、布局、状态反馈和可用性",
  content: [DEFAULT_SYSTEM_PROMPT, "", "When building UI, prioritize clarity, responsive layout, accessible controls, and immediate state feedback.", "Keep user flows simple, avoid surprising destructive actions, and preserve existing styling conventions.", "Verify UI data flow from controls to persisted config and runtime behavior."].join("\n")
}, {
  id: "backend-debug",
  label: "后端接口调试",
  description: "侧重接口链路、错误处理和运行时状态",
  content: [DEFAULT_SYSTEM_PROMPT, "", "When debugging backend or proxy code, trace inputs, normalized config, runtime config, network calls, and error propagation.", "Add or use targeted diagnostics instead of guessing.", "Prefer fixes that address the authoritative state and all relevant call sites."].join("\n")
}, {
  id: "zh-concise",
  label: "中文简洁模式",
  description: "中文回复，直接给结论和执行结果",
  content: [DEFAULT_SYSTEM_PROMPT, "", "Respond in Chinese unless the user asks otherwise.", "Be concise and direct. Start with the conclusion, then list actions and verification results.", "Use short Markdown sections and avoid unnecessary background explanation."].join("\n")
}];
const DIAGNOSTIC_OPENAI_PREFIXES = ["gpt-", "MODEL_GPT"];
const DIAGNOSTIC_MODEL_MAP = {
  "gpt-5-4-low": "gpt-5.4",
  "gpt-5-4-high": "gpt-5.4",
  "gpt-5-4-xhigh": "gpt-5.4",
  "gpt-5-4-xhigh-priority": "gpt-5.4",
  MODEL_GPT_4O: "gpt-4o",
  MODEL_GPT_4O_MINI: "gpt-4o-mini",
  MODEL_CLAUDE_3_5_SONNET: "claude-sonnet-4-20250514",
  MODEL_CLAUDE_3_5_HAIKU: "claude-3-5-haiku-20241022",
  MODEL_CLAUDE_3_OPUS: "__DEFAULT__",
  MODEL_CLAUDE_4_OPUS: "__DEFAULT__",
  MODEL_CLAUDE_4_OPUS_BYOK: "__DEFAULT__",
  MODEL_CLAUDE_4_OPUS_THINKING_BYOK: "__DEFAULT__",
  MODEL_CLAUDE_OPUS_4: "__DEFAULT__",
  MODEL_CLAUDE_OPUS_4_1: "__DEFAULT__",
  MODEL_CLAUDE_SONNET_4: "claude-sonnet-4-20250514",
  MODEL_SWE_1: "claude-sonnet-4-20250514",
  MODEL_SWE_1_5: "claude-sonnet-4-20250514",
  MODEL_SWE_1_5_SLOW: "claude-sonnet-4-20250514",
  MODEL_CHAT_11121: "__DEFAULT__",
  "claude-opus-4-6-thinking": "claude-opus-4-6-thinking",
  "claude-opus-4-7-thinking": "claude-opus-4-7-thinking",
  "claude-opus-4-8-thinking": "claude-opus-4-8-thinking",
  "claude-opus-4-6": "claude-opus-4-6",
  "claude-opus-4-7": "claude-opus-4-7",
  "claude-opus-4-8": "claude-opus-4-8",
  "claude-sonnet-4-6-thinking": "claude-sonnet-4-20250514-thinking",
  MODEL_GOOGLE_GEMINI_2_5_FLASH: "__DEFAULT__",
  MODEL_GOOGLE_GEMINI_2_5_PRO: "__DEFAULT__",
  MODEL_CHAT: "__DEFAULT__"
};
function getWebviewNonce() {
  let _0x346af3 = "";
  const _0x4ac833 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let _0x2616e9 = 0; _0x2616e9 < 32; _0x2616e9++) {
    _0x346af3 += _0x4ac833.charAt(Math.floor(Math.random() * _0x4ac833.length));
  }
  return _0x346af3;
}
class SidebarProvider {
  constructor(_0x51bbb3, _0x32e27d) {
    this.context = _0x51bbb3;
    this.logLines = [];
    this.lastStatusPostMs = 0;
    this.proxyManager = _0x32e27d;
    this.proxyManager.onLog(_0x3f3764 => {
      this.logLines.push(_0x3f3764);
      if (this.logLines.length > 200) {
        this.logLines = this.logLines.slice(-100);
      }
      if (this.view) {
        const _0x1943a1 = {
          type: "log",
          line: _0x3f3764
        };
        this.view.webview.postMessage(_0x1943a1);
        const _0x33ae35 = Date.now();
        if (_0x33ae35 - this.lastStatusPostMs > 500) {
          this.lastStatusPostMs = _0x33ae35;
          this.view.webview.postMessage({
            type: "status",
            proxy: this.proxyManager.getStatus()
          });
        }
      }
    });
    
  }
  renderFallbackHtml(_0x32f9e6) {
    const _0x1df17b = esc(_0x32f9e6 instanceof Error ? _0x32f9e6.message : String(_0x32f9e6));
    return "<!DOCTYPE html><html lang=\"zh\"><head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;padding:12px;color:var(--vscode-foreground);background:var(--vscode-sideBar-background,var(--vscode-editor-background));font-size:12px;line-height:1.5}.box{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:12px;background:var(--vscode-editorWidget-background)}b{display:block;margin-bottom:6px;color:var(--vscode-errorForeground,#f87171)}code{word-break:break-all}</style></head><body><div class=\"box\"><b>控制面板加载失败</b><div><code>" + _0x1df17b + "</code></div><div style=\"margin-top:8px\">请重载窗口或重新打开侧栏。</div></div></body></html>";
  }
  resolveWebviewView(_0x10e606) {
    this.view = _0x10e606;
    const _0x2cbb8f = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };
    _0x10e606.webview.options = _0x2cbb8f;
    try {
      _0x10e606.webview.html = this.getHtml();
    } catch (_0x31934e) {
      const _0x165b64 = _0x31934e instanceof Error ? _0x31934e.stack || _0x31934e.message : String(_0x31934e);
      this.logLines.push("侧栏加载失败: " + _0x165b64);
      if (this.logLines.length > 200) {
        this.logLines = this.logLines.slice(-100);
      }
      _0x10e606.webview.html = this.renderFallbackHtml(_0x31934e);
      vscode.window.showErrorMessage("Devin BYOK Bridge 控制面板加载失败：" + (_0x31934e instanceof Error ? _0x31934e.message : String(_0x31934e)));
    }
    _0x10e606.webview.onDidReceiveMessage(_0x312608 => this.handleMessage(_0x312608));
    
    if (this.proxyManager.getStatus().running) {
      this.refresh();
    }
    
  }
  async measureTcpLatency(_0x33f102, _0x100fd7 = 443, _0x3dda6c = 3000) {
    const _0x4390dd = Date.now();
    return new Promise(_0x437d68 => {
      let _0x449cfd = false;
      const _0x452346 = {
        host: _0x33f102,
        port: _0x100fd7
      };
      const _0x5e7f21 = net.createConnection(_0x452346);
      const _0x54b96a = (_0x169c89, _0x8e6a1a) => {
        if (_0x449cfd) {
          return;
        }
        _0x449cfd = true;
        _0x5e7f21.destroy();
        _0x437d68({
          ok: _0x169c89,
          latencyMs: Date.now() - _0x4390dd,
          error: _0x8e6a1a
        });
      };
      _0x5e7f21.setTimeout(_0x3dda6c);
      _0x5e7f21.once("connect", () => _0x54b96a(true));
      _0x5e7f21.once("timeout", () => _0x54b96a(false, "timeout"));
      _0x5e7f21.once("error", _0x279da7 => _0x54b96a(false, _0x279da7.message));
    });
  }
  async checkHttpHealth(_0x523efb, _0x6b2df5 = 5000) {
    const _0x212f3b = Date.now();
    return new Promise(_0x10e9db => {
      let _0x15faf8 = false;
      const _0x52489c = _0x35351e => {
        if (_0x15faf8) {
          return;
        }
        _0x15faf8 = true;
        _0x10e9db({
          ..._0x35351e,
          elapsedMs: Date.now() - _0x212f3b
        });
      };
      const _0x146cf8 = new URL(_0x523efb);
      const _0x22d818 = _0x146cf8.protocol === "http:" ? http : https;
      const _0x3b869c = {
        method: "GET",
        timeout: _0x6b2df5,
        agent: false
      };
      const _0x3b1eaf = _0x22d818.request(_0x146cf8, _0x3b869c, _0xb8ebce => {
        _0xb8ebce.resume();
        _0xb8ebce.on("end", () => _0x52489c({
          ok: !!_0xb8ebce.statusCode && _0xb8ebce.statusCode >= 200 && _0xb8ebce.statusCode < 400,
          statusCode: _0xb8ebce.statusCode
        }));
      });
      _0x3b1eaf.on("error", _0x419ff1 => _0x52489c({
        ok: false,
        error: _0x419ff1.message
      }));
      _0x3b1eaf.on("timeout", () => {
        _0x3b1eaf.destroy();
        _0x52489c({
          ok: false,
          error: "timeout"
        });
      });
      _0x3b1eaf.end();
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
      type: "status",
      proxy: this.proxyManager.getStatus(),
      patch: this.getPatchStatus(),
      config: this.getModeScopedConfig(),
      logs: this.logLines.slice(-50)
    });
  }
  getStoredPatchExtensionPath() {
    let _0x197f2a = this.context.globalState.get(KEY_PATCH_EXTENSION_PATH);
    if (!_0x197f2a) {
      _0x197f2a = this.context.globalState.get(LEGACY_KEY_PATCH_EXTENSION_PATH);
      if (_0x197f2a) {
        this.context.globalState.update(KEY_PATCH_EXTENSION_PATH, _0x197f2a);
      }
    }
    if (typeof _0x197f2a === "string" && _0x197f2a.trim()) {
      return _0x197f2a.trim();
    } else {
      return undefined;
    }
  }
  getModeScopedConfig(_0xd7ebac = this.proxyManager.readEnvConfig()) {
    const _0x31be1d = this.normalizeProviderBaseUrl({
      ..._0xd7ebac
    });
    if (!String(_0x31be1d.BYOK1_MODEL || "").trim()) {
      _0x31be1d.BYOK1_ANTHROPIC_API_HOST = _0x31be1d.BYOK1_ANTHROPIC_API_HOST || _0x31be1d.ANTHROPIC_API_HOST || "";
      _0x31be1d.BYOK1_ANTHROPIC_API_KEY = _0x31be1d.BYOK1_ANTHROPIC_API_KEY || _0x31be1d.ANTHROPIC_API_KEY || "";
      _0x31be1d.BYOK1_OPENAI_API_HOST = _0x31be1d.BYOK1_OPENAI_API_HOST || _0x31be1d.OPENAI_API_HOST || _0x31be1d.BYOK1_ANTHROPIC_API_HOST || "";
      _0x31be1d.BYOK1_OPENAI_API_KEY = _0x31be1d.BYOK1_OPENAI_API_KEY || _0x31be1d.OPENAI_API_KEY || _0x31be1d.BYOK1_ANTHROPIC_API_KEY || "";
      _0x31be1d.BYOK1_MODEL = _0x31be1d.DEFAULT_MODEL || "";
    }
    if (!String(_0x31be1d.BYOK1_THINKING_EFFORT || "").trim()) {
      _0x31be1d.BYOK1_THINKING_EFFORT = _0x31be1d.OPENAI_REASONING_EFFORT || "";
    }
    return _0x31be1d;
  }
  validateByokSlots(_0x4a8ca3) {
    const _0x115860 = [];
    if (!String(_0x4a8ca3.BYOK1_ANTHROPIC_API_KEY || "").trim()) {
      _0x115860.push("BYOK #1 未填写 API Key");
    }
    if (!String(_0x4a8ca3.BYOK1_MODEL || "").trim()) {
      _0x115860.push("BYOK #1 未选择模型");
    }
    if (!String(_0x4a8ca3.BYOK2_ANTHROPIC_API_KEY || "").trim()) {
      _0x115860.push("BYOK #2 未填写 API Key");
    }
    if (!String(_0x4a8ca3.BYOK2_MODEL || "").trim()) {
      _0x115860.push("BYOK #2 未选择模型");
    }
    return _0x115860;
  }
  getRuntimeConfigForCurrentMode(_0x802f7f = this.proxyManager.readEnvConfig()) {
    return this.getModeScopedConfig(_0x802f7f);
  }
  writeModeScopedConfig(_0x37061e) {
    const merged = this.normalizeProviderBaseUrl({ ...this.proxyManager.readEnvConfig(), ..._0x37061e });
    this.proxyManager.writeEnvConfig(merged);
    return merged;
  }
  normalizeModelsResponse(_0x384ec8) {
    if (_0x384ec8?.data && Array.isArray(_0x384ec8.data)) {
      const _0x6901e3 = _0x384ec8.data.map(_0x32b786 => ({
        id: _0x32b786.id,
        provider: /claude|anthropic/i.test(_0x32b786.id) ? "anthropic" : "openai"
      }));
      const _0x2328a6 = _0x6901e3.filter(_0x3afee5 => _0x3afee5.provider === "anthropic");
      const _0x2adbd4 = _0x6901e3.filter(_0x305894 => _0x305894.provider === "openai");
      const _0x561bee = {
        models: _0x2328a6
      };
      const _0x84e569 = {
        models: _0x2adbd4
      };
      const _0x34f833 = {
        anthropic: _0x561bee,
        openai: _0x84e569
      };
      const _0x1dae17 = {
        providers: _0x34f833
      };
      return _0x1dae17;
    }
    if (_0x384ec8?.providers) {
      return _0x384ec8;
    }
    throw new Error("未知的模型列表格式");
  }
  httpGetModels(_0x4b7a8d, _0x2e2bc9, _0x4afa2e = 5000) {
    return new Promise((_0xdda2d1, _0x459573) => {
      const _0x429540 = new URL(_0x4b7a8d);
      const _0x2f8512 = _0x429540.protocol === "http:" ? http : https;
      const _0x41cb5b = {};
      if (_0x2e2bc9) {
        _0x41cb5b["x-api-key"] = _0x2e2bc9;
        _0x41cb5b.authorization = "Bearer " + _0x2e2bc9;
      }
      const _0xc99804 = _0x2f8512.request({
        hostname: _0x429540.hostname,
        port: _0x429540.port ? Number(_0x429540.port) : _0x429540.protocol === "http:" ? 80 : 443,
        path: "" + _0x429540.pathname + _0x429540.search,
        method: "GET",
        timeout: _0x4afa2e,
        agent: _0x429540.hostname === "127.0.0.1" || _0x429540.hostname === "localhost" ? undefined : false,
        headers: _0x41cb5b
      }, _0x5a792a => {
        let _0x1dfbd9 = "";
        _0x5a792a.setEncoding("utf8");
        _0x5a792a.on("data", _0x4e5ed5 => _0x1dfbd9 += _0x4e5ed5);
        _0x5a792a.on("end", () => {
          if (_0x5a792a.statusCode !== 200) {
            _0x459573(new Error("HTTP " + _0x5a792a.statusCode + ": " + _0x1dfbd9.slice(0, 200)));
            return;
          }
          try {
            _0xdda2d1(this.normalizeModelsResponse(JSON.parse(_0x1dfbd9)));
          } catch (_0x30e174) {
            _0x459573(new Error("JSON 解析失败: " + _0x30e174.message));
          }
        });
      });
      _0xc99804.on("error", _0x195257 => _0x459573(_0x195257));
      _0xc99804.on("timeout", () => {
        _0xc99804.destroy();
        _0x459573(new Error("请求超时"));
      });
      _0xc99804.end();
    });
  }
  getModelListUrl(_0x437cd6) {
    const _0x29e3a2 = String(_0x437cd6 || "").trim();
    if (!_0x29e3a2) {
      throw new Error("请先填写 Base URL");
    }
    const _0x5141d1 = /^https?:\/\//i.test(_0x29e3a2) ? _0x29e3a2 : "https://" + _0x29e3a2;
    const _0x2d3c11 = new URL(_0x5141d1);
    const _0x3f8531 = _0x2d3c11.pathname.replace(/\/+$/, "");
    if (/\/models$/i.test(_0x3f8531)) {
      _0x2d3c11.pathname = _0x3f8531;
    } else {
      const _0x4ddbc0 = _0x3f8531.replace(/\/(messages|responses)$/i, "") || "/v1";
      _0x2d3c11.pathname = _0x4ddbc0 + "/models";
    }
    _0x2d3c11.search = "";
    return _0x2d3c11.toString();
  }
  normalizeProviderBaseUrl(_0x1c2c03) {
    const _0x31be1d = {
      ..._0x1c2c03
    };
    const _0x5d0d16 = _0x31be1d;
    for (const _0x736c12 of ["", "BYOK1_", "BYOK2_"]) {
      for (const _0x3ed4f0 of ["ANTHROPIC_API_HOST", "OPENAI_API_HOST"]) {
        const _0x4cabf1 = String(_0x5d0d16[_0x736c12 + _0x3ed4f0] || "").trim();
        if (!_0x4cabf1) {
          continue;
        }
        const _0x251523 = /^https?:\/\//i.test(_0x4cabf1) ? _0x4cabf1 : "https://" + _0x4cabf1;
        let _0x5d481b;
        try {
          _0x5d481b = new URL(_0x251523);
        } catch {
          _0x5d0d16[_0x736c12 + _0x3ed4f0] = stripProtoServer(_0x4cabf1);
          continue;
        }
        const _0x470210 = _0x5d481b.pathname.replace(/\/+$/, "");
        _0x5d0d16[_0x736c12 + _0x3ed4f0] = _0x5d481b.host;
        if (_0x470210 && _0x470210 !== "/") {
          const _0x1276d5 = _0x736c12 + (_0x3ed4f0 === "ANTHROPIC_API_HOST" ? "ANTHROPIC_API_PATH" : "OPENAI_API_PATH");
          if (!_0x5d0d16[_0x1276d5] || _0x5d0d16[_0x1276d5] === "/v1/messages" || _0x5d0d16[_0x1276d5] === "/v1/responses") {
            const _0x2575a3 = _0x3ed4f0 === "ANTHROPIC_API_HOST" ? "/messages" : "/responses";
            let _0xc4f2ba = _0x470210.replace(/\/models$/i, "");
            if (/\/(messages|responses)$/i.test(_0xc4f2ba)) {
              _0xc4f2ba = _0xc4f2ba.replace(/\/(messages|responses)$/i, "");
            }
            _0x5d0d16[_0x1276d5] = "" + (_0xc4f2ba || "/v1") + _0x2575a3;
          }
        }
      }
    }
    return _0x5d0d16;
  }
  resolveModelFetchCredentials(_0x3265df, _0x1e0e9a) {
    return { apiKey: String(_0x3265df || "").trim(), baseUrl: String(_0x1e0e9a || "").trim() };
  }
  async fetchModelsFromGateway(_0x565efc, _0x375464) {
    const _0xe014aa = String(_0x375464 || "").trim();
    if (_0xe014aa) {
      return this.httpGetModels(this.getModelListUrl(_0xe014aa), _0x565efc, 8000);
    }
    const _0x487f8f = this.proxyManager.getStatus();
    if (_0x487f8f.running) {
      try {
        return await this.httpGetModels("http://127.0.0.1:" + _0x487f8f.hybridPort + "/api/models", undefined, 3000);
      } catch {}
    }
    throw new Error("请先填写 Base URL 和 API Key，或启动代理后加载模型");
  }
  formatModelFetchError(_0x234642) {
    const _0x1a9a53 = _0x234642 instanceof Error ? _0x234642.message : String(_0x234642 || "");
    if (/HTTP\s*403/i.test(_0x1a9a53) || /not assigned to any group|permission_error|分组|权限/i.test(_0x1a9a53)) {
      return "加载模型失败：API Key 没有模型权限或服务拒绝访问，请检查 Base URL 和 API Key。";
    }
    if (/HTTP\s*401/i.test(_0x1a9a53) || /invalid.*key|unauthorized|鉴权/i.test(_0x1a9a53)) {
      return "加载模型失败：API Key 无效或已过期，请检查 Base URL 和 API Key。";
    }
    return _0x1a9a53 || "加载模型失败，请检查 API Key、Base URL 和网络连接";
  }
  flattenModelIds(_0x3f04ea) {
    const _0x5c63f7 = _0x3f04ea?.providers || {};
    const _0x3fb8a2 = [...(Array.isArray(_0x5c63f7.anthropic?.models) ? _0x5c63f7.anthropic.models : []), ...(Array.isArray(_0x5c63f7.openai?.models) ? _0x5c63f7.openai.models : []), ...(Array.isArray(_0x3f04ea?.data) ? _0x3f04ea.data : []), ...(Array.isArray(_0x3f04ea?.models) ? _0x3f04ea.models : [])];
    const _0x4ce238 = _0x3fb8a2.map(_0x50e821 => String(_0x50e821?.id || _0x50e821?.name || _0x50e821 || "").trim()).filter(Boolean);
    return Array.from(new Set(_0x4ce238));
  }
  modelIdMatches(_0x2d069e, _0x3f6386) {
    const _0x9f41b6 = String(_0x3f6386 || "").trim().replace(/-thinking$/i, "");
    if (!_0x9f41b6) {
      return true;
    }
    return _0x2d069e.some(_0x40050b => _0x40050b === _0x9f41b6 || _0x40050b.replace(/-thinking$/i, "") === _0x9f41b6);
  }
  stripDiagnosticThinkingSuffix(_0x3441b1) {
    return String(_0x3441b1 || "").trim().replace(/-thinking$/i, "");
  }
  isDiagnosticOpenAIModel(_0x24c094) {
    const _0x286c2f = this.stripDiagnosticThinkingSuffix(_0x24c094);
    return DIAGNOSTIC_OPENAI_PREFIXES.some(_0x465d91 => _0x286c2f.startsWith(_0x465d91));
  }
  resolveDiagnosticModelRoute(_0x310bda, _0xdfb758) {
    const _0x3fccc3 = String(_0x310bda || "").trim();
    const _0x4923a7 = String(_0xdfb758.DEFAULT_MODEL || "").trim();
    const _0x3f7d7c = DIAGNOSTIC_MODEL_MAP[_0x3fccc3];
    const _0x2b4c67 = _0x3f7d7c === "__DEFAULT__" ? _0x4923a7 : _0x3f7d7c || _0x4923a7 || (_0x3fccc3 && !_0x3fccc3.startsWith("MODEL_") ? _0x3fccc3 : "");
    const _0x1782c5 = this.stripDiagnosticThinkingSuffix(_0x2b4c67);
    const _0x5205f9 = _0x1782c5 ? this.isDiagnosticOpenAIModel(_0x1782c5) ? "OpenAI" : "Anthropic" : "未解析";
    const _0x34153a = _0x3fccc3.endsWith("-priority") ? "fast" : undefined;
    return {
      requested: _0x3fccc3,
      resolved: _0x2b4c67,
      upstream: _0x1782c5,
      provider: _0x5205f9,
      serviceTier: _0x34153a,
      usesDefault: _0x3f7d7c === "__DEFAULT__" || !_0x3f7d7c && !!_0x4923a7,
      thinking: /-thinking$/i.test(_0x2b4c67)
    };
  }
  checkModelRoutingDiagnostic(_0x591f20) {
    const _0x9e4ec6 = String(_0x591f20.DEFAULT_MODEL || "").trim();
    const _0x3da998 = Array.from(new Set([_0x9e4ec6, "MODEL_CLAUDE_3_OPUS", "MODEL_CLAUDE_4_OPUS_BYOK", "MODEL_CLAUDE_4_OPUS_THINKING_BYOK", "claude-opus-4-8", "MODEL_SWE_1_5", "MODEL_CHAT", "MODEL_CLAUDE_SONNET_4", "MODEL_GPT_4O", "gpt-5-4-xhigh-priority"].filter(Boolean)));
    const _0x32d1d2 = _0x3da998.map(_0x4e4c2b => this.resolveDiagnosticModelRoute(_0x4e4c2b, _0x591f20));
    const _0x46e0f1 = _0x32d1d2.map(_0x52eb70 => {
      const _0x5f3bee = [_0x52eb70.provider, _0x52eb70.serviceTier, _0x52eb70.thinking ? "thinking" : "", _0x52eb70.usesDefault ? "default" : ""].filter(Boolean).join(", ");
      return _0x52eb70.requested + " → " + (_0x52eb70.upstream || "未解析") + (_0x5f3bee ? " (" + _0x5f3bee + ")" : "");
    }).join("；");
    return this.envCheckItem("model-routing", "模型最终路由", _0x9e4ec6 ? "ok" : "warning", _0x9e4ec6 ? "DEFAULT_MODEL=" + _0x9e4ec6 + "；" + _0x46e0f1 : "未设置 DEFAULT_MODEL；" + _0x46e0f1, false);
  }
  checkInlineFastTimeoutRisk(_0x20c053) {
    const _0x564206 = String(_0x20c053.DEFAULT_MODEL || "").trim();
    const _0x50fd96 = _0x564206.replace(/-thinking$/i, "");
    const _0x3bb5f5 = /^(gpt-)/i.test(_0x50fd96) || /^MODEL_GPT/i.test(_0x564206);
    const _0x35fb59 = String(_0x20c053.OPENAI_REASONING_EFFORT || "").trim();
    const _0xd1741 = Number.parseInt(String(_0x20c053.MAX_TOKENS || "0"), 10);
    const _0x115860 = [];
    if (/opus/i.test(_0x564206)) {
      _0x115860.push("Opus 首包通常更慢");
    }
    if (/-thinking$/i.test(_0x564206) || _0x3bb5f5 && _0x20c053.OPENAI_THINKING_ENABLED === "true") {
      _0x115860.push("thinking 会增加首包等待");
    }
    if (_0x3bb5f5 && (_0x35fb59 === "high" || _0x35fb59 === "xhigh" || _0x35fb59 === "max")) {
      _0x115860.push("推理强度 " + _0x35fb59);
    }
    if (Number.isFinite(_0xd1741) && _0xd1741 > 8192) {
      _0x115860.push("MAX_TOKENS=" + _0xd1741);
    }
    const _0x870ec4 = Number.parseInt(String(_0x20c053.COMPLETION_TIMEOUT_MS || "12000"), 10);
    if (Number.isFinite(_0x870ec4) && _0x870ec4 < 10000) {
      _0x115860.push("补全超时 " + _0x870ec4 + "ms 偏短");
    }
    if (!_0x564206) {
      _0x115860.push("未设置默认模型");
    }
    const _0x15aa0f = _0x115860.length > 0 ? "Inline/Fast 首包窗口较紧（当前补全超时约 " + (Number.isFinite(_0x870ec4) ? _0x870ec4 : 12000) + "ms）；风险：" + _0x115860.join("、") + "。如频繁空返回，优先降低模型/Token" + (_0x3bb5f5 ? "/推理强度" : "") + " 或改用普通 Chat。" : "当前默认模型未命中明显慢首包风险；Inline/Fast 仍受上游首包延迟影响。";
    return this.envCheckItem("inline-fast-timeout", "Inline/Fast 超时风险", _0x115860.length > 0 ? "warning" : "ok", _0x15aa0f, false);
  }
  execFileText(_0x2e6742, _0xd6abc5, _0x391e3f) {
    return new Promise((_0x46a6b1, _0x5e67ec) => {
      (0, child_process_1.execFile)(_0x2e6742, _0xd6abc5, {
        timeout: _0x391e3f,
        windowsHide: true,
        maxBuffer: 1048576
      }, (_0x4e2dc7, _0x1d0a05, _0x3fb91d) => {
        if (_0x4e2dc7) {
          const _0x231ff3 = _0x3fb91d ? _0x4e2dc7.message + ": " + _0x3fb91d : _0x4e2dc7.message;
          _0x5e67ec(new Error(_0x231ff3));
          return;
        }
        _0x46a6b1(String(_0x1d0a05 || ""));
      });
    });
  }
  async readWindsurfProcessCommandLines() {
    let _0x2264d8 = "";
    if (process.platform === "win32") {
      const _0x9e9f2 = "$self=$PID; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $self -and $_.CommandLine -match '(?i)(devin|windsurf|codeium|language_server)' } | ForEach-Object { $_.CommandLine }";
      try {
        _0x2264d8 = await this.execFileText("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", _0x9e9f2], 3500);
      } catch {
        _0x2264d8 = await this.execFileText("wmic.exe", ["process", "get", "CommandLine"], 3500);
      }
    } else {
      _0x2264d8 = await this.execFileText("ps", ["-ax", "-o", "command="], 3500);
    }
    return _0x2264d8.split(/\r?\n/).map(_0x438a34 => _0x438a34.trim()).filter(_0x50a4dc => /(devin|windsurf|codeium|language_server|devin-server|windsurf-server)/i.test(_0x50a4dc)).filter(_0x2fc16a => !/Get-CimInstance Win32_Process|wmic\.exe process get CommandLine/i.test(_0x2fc16a));
  }
  async checkWindsurfProcessRouting(_0x3c0348) {
    const {
      hybridPort: _0x5df13c,
      inferencePort: _0xc74133
    } = this.proxyManager.portsFromConfig(_0x3c0348);
    const _0x210f2a = ["localhost:" + _0x5df13c, "127.0.0.1:" + _0x5df13c];
    const _0x3e6b47 = ["localhost:" + _0xc74133, "127.0.0.1:" + _0xc74133];
    let _0xb0cce = [];
    try {
      _0xb0cce = await this.readWindsurfProcessCommandLines();
    } catch (_0x1ec5a6) {
      const _0x4a3ba6 = _0x1ec5a6 instanceof Error ? _0x1ec5a6.message : String(_0x1ec5a6);
      return this.envCheckItem("devin-process-routing", "进程路由参数", "warning", "无法读取 Devin Desktop/Codeium 进程命令行：" + _0x4a3ba6, false);
    }
    if (_0xb0cce.length === 0) {
      return this.envCheckItem("devin-process-routing", "进程路由参数", "ok", "未检测到运行中的 Devin Desktop/Codeium/language_server 进程；启动后可再次验证", false);
    }
    const _0x3cd4f7 = _0xb0cce.some(_0x2cdeb4 => _0x210f2a.some(_0x511dfe => _0x2cdeb4.includes(_0x511dfe)));
    const _0x4d87f2 = _0xb0cce.some(_0x3b600b => _0x3e6b47.some(_0x92a86 => _0x3b600b.includes(_0x92a86)));
    const _0x2a4c7b = this.getPatchStatus();
    const _0x18c29b = !!_0x2a4c7b.path && _0x2a4c7b.patches.every(_0x594987 => _0x594987.status === "applied");
    if (_0x3cd4f7 && _0x4d87f2) {
      return this.envCheckItem("devin-process-routing", "进程路由参数", "ok", "检测到 " + _0xb0cce.length + " 个相关进程，命令行包含 Hybrid " + _0x5df13c + " 与 Inference " + _0xc74133, false);
    }
    const _0x5f1972 = [_0x3cd4f7 ? "Hybrid " + _0x5df13c : "", _0x4d87f2 ? "Inference " + _0xc74133 : ""].filter(Boolean).join("、") || "未发现本地代理端口";
    const _0x1fd7b8 = _0x18c29b ? "补丁已就绪但当前进程命令行未完整体现本地端口，建议重载/重启 Devin Desktop 后复查" : "补丁未完全就绪，建议先安装补丁并重载 Devin Desktop";
    return this.envCheckItem("devin-process-routing", "进程路由参数", "warning", "检测到 " + _0xb0cce.length + " 个相关进程；" + _0x5f1972 + "；" + _0x1fd7b8, false);
  }
  async checkGatewayModelCatalog(_0x68f322) {
    const _0x423a02 = _0x68f322.ANTHROPIC_API_KEY || _0x68f322.OPENAI_API_KEY || "";
    const _0x39adff = String(_0x68f322.DEFAULT_MODEL || "").trim();
    if (!_0x423a02) {
      return this.envCheckItem("model-catalog", "模型权限", "warning", "未配置 API Key，无法检查模型列表权限", false);
    }
    try {
      const _0x44c881 = await this.fetchModelsFromGateway(_0x423a02);
      const _0x363959 = this.flattenModelIds(_0x44c881);
      const _0x294574 = _0x363959.filter(_0x36b5d1 => /opus/i.test(_0x36b5d1));
      const _0x41941c = this.modelIdMatches(_0x363959, _0x39adff);
      if (_0x363959.length === 0) {
        return this.envCheckItem("model-catalog", "模型权限", "warning", "模型列表为空；本地环境正常不代表模型可调用", false);
      }
      const _0x545636 = _0x39adff ? "默认模型 " + (_0x41941c ? "可见" : "未在列表中") + "：" + _0x39adff : "未设置默认模型";
      const _0x24df78 = _0x294574.length > 0 ? "Opus 可见：" + _0x294574.slice(0, 3).join(", ") : "Opus 未在模型列表中，选择 Opus 可能失败或无可用返回";
      return this.envCheckItem("model-catalog", "模型权限", !_0x41941c || _0x294574.length === 0 ? "warning" : "ok", "可见模型 " + _0x363959.length + " 个；" + _0x545636 + "；" + _0x24df78, false);
    } catch (_0x51472c) {
      const _0x3677ad = _0x51472c instanceof Error ? _0x51472c.message : String(_0x51472c);
      return this.envCheckItem("model-catalog", "模型权限", "warning", "模型列表检查失败：" + _0x3677ad, false);
    }
  }
  classifyProbeBody(_0x112763) {
    const _0x36ad67 = String(_0x112763 || "").trim();
    if (!_0x36ad67) {
      return "无响应体";
    }
    const _0x1ad516 = _0x36ad67.split(/\r?\n/).map(_0xebe7f9 => _0xebe7f9.trim()).find(_0x2b9721 => _0x2b9721.startsWith("data:") && !/^data:\s*\[DONE\]/i.test(_0x2b9721));
    const _0x1c224c = (_0x1ad516 ? _0x1ad516.replace(/^data:\s*/i, "") : _0x36ad67).trim();
    try {
      const _0x1b39c8 = JSON.parse(_0x1c224c);
      const _0x5e5c20 = _0x1b39c8?.error || _0x1b39c8;
      const _0x270b42 = _0x5e5c20?.type || _0x5e5c20?.code || _0x1b39c8?.code || "";
      const _0x2a4903 = _0x5e5c20?.message || _0x1b39c8?.message || _0x1b39c8?.error_description || "";
      const _0x2214de = [_0x270b42, _0x2a4903].filter(Boolean).join("：");
      if (_0x2214de) {
        return _0x2214de.slice(0, 360);
      }
    } catch {}
    return _0x36ad67.replace(/\s+/g, " ").slice(0, 360);
  }
  classifyProbeHttpStatus(_0x37bcc0, _0x1ed6d2) {
    const _0x23ebc3 = _0x37bcc0 || 0;
    const _0x20eab2 = this.classifyProbeBody(_0x1ed6d2);
    if (_0x23ebc3 === 400) {
      return "HTTP 400 请求格式/模型参数错误：" + _0x20eab2;
    }
    if (_0x23ebc3 === 401) {
      return "HTTP 401 鉴权失败，API Key 无效或已过期：" + _0x20eab2;
    }
    if (_0x23ebc3 === 403 || _0x23ebc3 === 404) {
      return "HTTP " + _0x23ebc3 + " 模型无权限、不可用或不存在：" + _0x20eab2;
    }
    if (_0x23ebc3 === 408 || _0x23ebc3 === 504) {
      return "HTTP " + _0x23ebc3 + " 上游超时：" + _0x20eab2;
    }
    if (_0x23ebc3 === 429) {
      return "HTTP 429 额度/限流/并发限制：" + _0x20eab2;
    }
    if (_0x23ebc3 >= 500) {
      return "HTTP " + _0x23ebc3 + " 上游服务错误：" + _0x20eab2;
    }
    return "HTTP " + _0x23ebc3 + ": " + _0x20eab2;
  }
  classifyProbeSseError(_0x2eb54b) {
    if (!/event:\s*error|data:\s*\{[^\n]*(error|message)/i.test(_0x2eb54b)) {
      return undefined;
    }
    const _0x597979 = this.classifyProbeBody(_0x2eb54b);
    if (/auth|api.?key|unauthor|invalid.?key/i.test(_0x597979)) {
      return "HTTP 200 SSE 错误：鉴权失败：" + _0x597979;
    }
    if (/permission|not.?found|model|access/i.test(_0x597979)) {
      return "HTTP 200 SSE 错误：模型权限/模型不存在：" + _0x597979;
    }
    if (/rate|quota|credit|limit|insufficient/i.test(_0x597979)) {
      return "HTTP 200 SSE 错误：额度/限流：" + _0x597979;
    }
    return "HTTP 200 SSE 错误：" + _0x597979;
  }
  classifyProbeNetworkError(_0x105052) {
    const _0xe08364 = _0x105052;
    const _0x2ec12d = String(_0xe08364.code || "").toUpperCase();
    const _0x3e9817 = _0x105052.message || String(_0x105052);
    if (["ENOTFOUND", "EAI_AGAIN"].includes(_0x2ec12d)) {
      return "DNS 解析失败：" + _0x3e9817;
    }
    if (["ECONNREFUSED", "ECONNRESET", "EPIPE"].includes(_0x2ec12d)) {
      return "连接失败/被重置：" + _0x3e9817;
    }
    if (["ETIMEDOUT", "ESOCKETTIMEDOUT"].includes(_0x2ec12d)) {
      return "网络连接超时：" + _0x3e9817;
    }
    if (/certificate|tls|ssl|self signed|unable to verify/i.test(_0x3e9817)) {
      return "TLS/证书错误：" + _0x3e9817;
    }
    if (_0x2ec12d) {
      return _0x2ec12d + ": " + _0x3e9817;
    } else {
      return _0x3e9817;
    }
  }
  async probeConfiguredModelStream(_0xa48a03) {
    const _0x46f05a = String(_0xa48a03.DEFAULT_MODEL || "").trim();
    const _0x153f62 = _0x46f05a.replace(/-thinking$/i, "");
    const _0x191a59 = _0xa48a03.ANTHROPIC_API_KEY || _0xa48a03.OPENAI_API_KEY || "";
    if (!_0x153f62) {
      return {
        ok: false,
        model: _0x46f05a || "--",
        detail: "未设置默认模型"
      };
    }
    const _0x248f77 = {
      ok: false,
      model: _0x153f62,
      detail: "未配置 API Key"
    };
    if (!_0x191a59) {
      return _0x248f77;
    }
    if (/^(gpt-|MODEL_GPT)/i.test(_0x153f62)) {
      return {
        ok: false,
        model: _0x153f62,
        detail: "当前探测先覆盖 Claude/Opus 流式链路，请切换默认模型后再测"
      };
    }
    const _0x5d4b24 = _0xa48a03.ANTHROPIC_API_HOST || "";
    const _0x5d8078 = /^https?:\/\//i.test(_0x5d4b24) ? _0x5d4b24.replace(/\/+$/, "") : "https://" + stripProtoServer(_0x5d4b24);
    const _0x393b6a = new URL(_0x5d8078);
    const _0x225630 = _0x393b6a.protocol === "http:";
    const _0x45c2d1 = _0xa48a03.ANTHROPIC_API_PATH || "/v1/messages";
    const _0x5072e5 = {
      model: _0x153f62,
      messages: [{
        role: "user",
        content: "ping"
      }],
      stream: true,
      max_tokens: 1
    };
    const _0x341031 = JSON.stringify(_0x5072e5);
    const _0xa2ee81 = Date.now();
    return new Promise(_0x4cbba6 => {
      let _0x50f611 = false;
      let _0x3f6d9f;
      let _0x2a1436 = "";
      const _0x40bd04 = (_0x431daf, _0xf3841d) => {
        if (_0x50f611) {
          return;
        }
        _0x50f611 = true;
        _0x421439.destroy();
        const _0x3d420a = {
          ok: _0x431daf,
          model: _0x153f62,
          detail: _0xf3841d
        };
        _0x4cbba6(_0x3d420a);
      };
      const _0x2b2bdf = _0x225630 ? http : https;
      const _0x421439 = _0x2b2bdf.request({
        hostname: _0x393b6a.hostname,
        port: _0x393b6a.port ? Number(_0x393b6a.port) : _0x225630 ? 80 : 443,
        path: _0x45c2d1,
        method: "POST",
        timeout: 25000,
        rejectUnauthorized: !_0x225630 && (!_0x393b6a.port || _0x393b6a.port === "443"),
        headers: {
          "content-type": "application/json",
          accept: "text/event-stream",
          "anthropic-version": "2023-06-01",
          "x-api-key": _0x191a59,
          "content-length": Buffer.byteLength(_0x341031)
        }
      }, _0x18231d => {
        _0x18231d.setEncoding("utf8");
        _0x18231d.on("data", _0x126654 => {
          if (_0x3f6d9f === undefined) {
            _0x3f6d9f = Date.now() - _0xa2ee81;
          }
          _0x2a1436 += _0x126654;
          if (_0x2a1436.length > 4000) {
            _0x2a1436 = _0x2a1436.slice(-4000);
          }
          if (_0x18231d.statusCode && _0x18231d.statusCode !== 200) {
            return;
          }
          const _0x4b9108 = this.classifyProbeSseError(_0x2a1436);
          if (_0x4b9108) {
            _0x40bd04(false, _0x4b9108 + "；首包 " + _0x3f6d9f + "ms，总耗时 " + (Date.now() - _0xa2ee81) + "ms");
            return;
          }
          if (/event:\s*message_stop|event:\s*content_block_delta|data:\s*\[DONE\]/i.test(_0x2a1436)) {
            _0x40bd04(true, "HTTP 200，首包 " + _0x3f6d9f + "ms，总耗时 " + (Date.now() - _0xa2ee81) + "ms");
          }
        });
        _0x18231d.on("end", () => {
          if (_0x18231d.statusCode && _0x18231d.statusCode !== 200) {
            _0x40bd04(false, this.classifyProbeHttpStatus(_0x18231d.statusCode, _0x2a1436));
            return;
          }
          const _0x56db0d = this.classifyProbeSseError(_0x2a1436);
          if (_0x56db0d) {
            _0x40bd04(false, _0x56db0d);
            return;
          }
          _0x40bd04(_0x3f6d9f !== undefined, _0x3f6d9f !== undefined ? "HTTP 200，首包 " + _0x3f6d9f + "ms，流已结束" : "HTTP 200，但未收到流式数据，可能被网关转成非 SSE 响应或上游无首包");
        });
      });
      _0x421439.on("error", _0x455ddd => {
        if (!_0x50f611) {
          _0x40bd04(false, this.classifyProbeNetworkError(_0x455ddd));
        }
      });
      _0x421439.on("timeout", () => _0x40bd04(false, "请求超时，" + (Date.now() - _0xa2ee81) + "ms 内未完成；可能是上游首包过慢、模型排队或网络链路阻塞"));
      _0x421439.end(_0x341031);
    });
  }
  async setStoredPatchExtensionPath(_0x3a19be) {
    const _0x2d0587 = typeof _0x3a19be === "string" && _0x3a19be.trim() ? _0x3a19be.trim() : undefined;
    await this.context.globalState.update(KEY_PATCH_EXTENSION_PATH, _0x2d0587);
  }
  getPatchStatus() {
    const _0x10973f = this.proxyManager.getStatus();
    return patchManager_1.PatchManager.getStatus(this.getStoredPatchExtensionPath(), patchManager_1.PatchManager.loopbackApiUrl(_0x10973f.hybridPort), patchManager_1.PatchManager.loopbackApiUrl(_0x10973f.inferencePort));
  }
  envCheckItem(_0x18a967, _0xa24f06, _0x161cca, _0x3e4b81, _0x4915ad) {
    const _0x7c025f = {
      id: _0x18a967,
      name: _0xa24f06,
      status: _0x161cca,
      detail: _0x3e4b81,
      fixable: _0x4915ad
    };
    return _0x7c025f;
  }
  isValidPortValue(_0x36750c) {
    if (!_0x36750c) {
      return true;
    }
    const _0x133781 = Number.parseInt(_0x36750c, 10);
    return Number.isInteger(_0x133781) && _0x133781 > 0 && _0x133781 <= 65535;
  }
  isValidCompletionTimeoutValue(_0x8225df) {
    if (!_0x8225df) {
      return true;
    }
    const _0x411ceb = Number.parseInt(_0x8225df, 10);
    return Number.isInteger(_0x411ceb) && _0x411ceb >= 2000 && _0x411ceb <= 60000;
  }
  async isPortFree(_0x27a0ff) {
    return new Promise(_0x1bbbf0 => {
      const _0x196c75 = net.createServer();
      _0x196c75.once("error", () => _0x1bbbf0(false));
      _0x196c75.once("listening", () => _0x196c75.close(() => _0x1bbbf0(true)));
      _0x196c75.listen(_0x27a0ff, "127.0.0.1");
    });
  }
  readProxyDependencyKeys() {
    const _0x5b55a2 = path.join(this.proxyManager.getProxyRootPath(), "package.json");
    if (!fs.existsSync(_0x5b55a2)) {
      return undefined;
    }
    try {
      const _0x5cbd1a = JSON.parse(fs.readFileSync(_0x5b55a2, "utf-8"));
      const _0x3ce33b = {
        ..._0x5cbd1a.dependencies,
        ..._0x5cbd1a.devDependencies,
        ..._0x5cbd1a.optionalDependencies
      };
      return Object.keys(_0x3ce33b);
    } catch {
      return undefined;
    }
  }
  async checkManagedEnvironment() {
    const _0x249fb8 = [];
    const _0xc4eb9 = this.proxyManager.getProxyRootPath();
    const _0x5b6f83 = this.proxyManager.getEnvFilePath();
    const _0x451a48 = this.proxyManager.readEnvConfig();
    const requiredFiles = ["package.json", "src/hybrid-server.js", "src/inference-proxy.js"];
    const _0x314ce3 = requiredFiles.filter(_0x16eb76 => !fs.existsSync(path.join(_0xc4eb9, _0x16eb76)));
    _0x249fb8.push(this.envCheckItem("proxy-root", "内置代理目录", _0x314ce3.length === 0 ? "ok" : "error", _0x314ce3.length === 0 ? _0xc4eb9 : "缺少 " + _0x314ce3.join(", "), false));
    _0x249fb8.push(this.envCheckItem("env-file", "配置文件", fs.existsSync(_0x5b6f83) ? "ok" : "warning", fs.existsSync(_0x5b6f83) ? _0x5b6f83 : "缺少 .env，将使用默认配置生成", !fs.existsSync(_0x5b6f83)));
    const _0x543e67 = ["HYBRID_PORT", "INFERENCE_PORT"].filter(_0x59ba97 => !this.isValidPortValue(_0x451a48[_0x59ba97]));
    const _0x3a0877 = !this.isValidCompletionTimeoutValue(_0x451a48.COMPLETION_TIMEOUT_MS);
    const _0x3feda5 = this.proxyManager.portsFromConfig(_0x451a48);
    const _0x439ad3 = this.proxyManager.getStatus().running;
    const _0x48b775 = _0x439ad3 ? true : await this.isPortFree(_0x3feda5.hybridPort);
    const _0xd894d7 = _0x439ad3 ? true : await this.isPortFree(_0x3feda5.inferencePort);
    const _0x78f1cd = [!_0x48b775 ? "Hybrid " + _0x3feda5.hybridPort : "", !_0xd894d7 ? "Inference " + _0x3feda5.inferencePort : ""].filter(Boolean);
    _0x249fb8.push(this.envCheckItem("ports", "代理端口", _0x543e67.length > 0 || _0x78f1cd.length > 0 ? "warning" : "ok", _0x543e67.length > 0 ? "端口值异常：" + _0x543e67.join(", ") : _0x78f1cd.length > 0 ? "端口已占用：" + _0x78f1cd.join(", ") + "；请手动关闭占用进程或更换端口" : "Hybrid " + _0x3feda5.hybridPort + " / Inference " + _0x3feda5.inferencePort, _0x543e67.length > 0));
    _0x249fb8.push(this.envCheckItem("completion-timeout", "补全超时配置", _0x3a0877 ? "warning" : "ok", _0x3a0877 ? "COMPLETION_TIMEOUT_MS 需在 2000-60000ms；将修复为 12000ms" : "COMPLETION_TIMEOUT_MS=" + (_0x451a48.COMPLETION_TIMEOUT_MS || "12000") + "ms", _0x3a0877));
    const _0x4d4e91 = this.readProxyDependencyKeys();
    const _0x12311b = path.join(_0xc4eb9, "node_modules");
    _0x249fb8.push(this.envCheckItem("runtime-deps", "运行依赖", _0x4d4e91 === undefined ? "warning" : _0x4d4e91.length === 0 || fs.existsSync(_0x12311b) ? "ok" : "warning", _0x4d4e91 === undefined ? "package.json 无法解析" : _0x4d4e91.length === 0 ? "当前标准环境无 npm 依赖，node_modules 非必需" : fs.existsSync(_0x12311b) ? "已安装 " + _0x4d4e91.length + " 个依赖声明" : "缺少 node_modules，启动代理时会尝试安装 " + _0x4d4e91.length + " 个依赖", false));
    const _0x320b18 = String(_0x451a48.DEFAULT_MODEL || "").trim();
    const _0x15df97 = _0x320b18.replace(/-thinking$/i, "");
    const _0x4c4023 = /^(gpt-)/i.test(_0x15df97) || /^MODEL_GPT/i.test(_0x320b18);
    const _0xb1eff = String(_0x451a48.BYOK1_THINKING_EFFORT || _0x451a48.OPENAI_REASONING_EFFORT || "").trim();
    const _0xb2eff = String(_0x451a48.BYOK2_THINKING_EFFORT || "").trim();
    const _0x432881 = ["", "low", "medium", "high", "xhigh", "max"].includes(_0xb1eff) && ["", "low", "medium", "high", "xhigh", "max"].includes(_0xb2eff);
    const _0x40588b = _0xb1eff || _0xb2eff || _0x451a48.OPENAI_THINKING_ENABLED === "true" || /-thinking$/i.test(_0x320b18);
    _0x249fb8.push(this.envCheckItem("reasoning", "思考强度", _0x432881 ? "ok" : "warning", _0x40588b ? "BYOK #1=" + (_0xb1eff || "关闭") + "；BYOK #2=" + (_0xb2eff || "关闭") + "（Claude→adaptive/budget，GPT→reasoning.effort，Gemini→thinking_level）" : "未配置思考强度；将按模型名决定是否思考", !_0x432881));
    _0x249fb8.push(this.envCheckItem("api-key", "API Key", _0x451a48.ANTHROPIC_API_KEY || _0x451a48.OPENAI_API_KEY ? "ok" : "warning", _0x451a48.ANTHROPIC_API_KEY || _0x451a48.OPENAI_API_KEY ? "已配置" : "未配置，请手动填写 API Key", false));
    _0x249fb8.push(this.checkModelRoutingDiagnostic(_0x451a48));
    _0x249fb8.push(this.checkInlineFastTimeoutRisk(_0x451a48));
    _0x249fb8.push(await this.checkWindsurfProcessRouting(_0x451a48));
    _0x249fb8.push(await this.checkGatewayModelCatalog(_0x451a48));
    const _0x151de0 = path.join(_0xc4eb9, "prompts", "system-prompt.md");
    _0x249fb8.push(this.envCheckItem("system-prompt", "默认提示词", fs.existsSync(_0x151de0) ? "ok" : "warning", fs.existsSync(_0x151de0) ? _0x151de0 : "缺少默认 system-prompt.md", !fs.existsSync(_0x151de0)));
    const _0x1e98a3 = this.getPatchStatus();
    const _0x34ba01 = _0x1e98a3.patches.filter(_0x77215e => _0x77215e.status !== "applied");
    const _0x1bf5e2 = !!_0x1e98a3.path && _0x34ba01.some(_0x3b56e4 => _0x3b56e4.status === "available");
    _0x249fb8.push(this.envCheckItem("devin-patch", "Devin Desktop 补丁", _0x34ba01.length === 0 ? "ok" : "warning", !_0x1e98a3.path ? "未找到 Devin Desktop extension.js" : _0x34ba01.length === 0 ? "已安装" : "未就绪 " + _0x34ba01.length + "/" + _0x1e98a3.patches.length, _0x1bf5e2));
    return {
      ok: _0x249fb8.every(_0x3a50f8 => _0x3a50f8.status === "ok"),
      checkedAt: new Date().toLocaleString(),
      items: _0x249fb8
    };
  }
  redactSecret(_0x430cb0) {
    const _0x303e5f = String(_0x430cb0 || "").trim();
    if (!_0x303e5f) {
      return "";
    }
    if (_0x303e5f.length <= 8) {
      return _0x303e5f.slice(0, 2) + "***(" + _0x303e5f.length + ")";
    }
    return _0x303e5f.slice(0, 4) + "..." + _0x303e5f.slice(-4) + "(" + _0x303e5f.length + ")";
  }
  sanitizeDiagnosticText(_0x3d6d0e) {
    return String(_0x3d6d0e || "").replace(/((?:api[_-]?key|authorization|bearer|token|password|secret)[^\r\n:=]*[:=\s]+)([^\s"'&]+)/ig, "$1***").replace(/(sk-[A-Za-z0-9_-]{8})[A-Za-z0-9_-]+/g, "$1***");
  }
  sanitizeEnvConfig(_0x209beb) {
    const _0x697c05 = {};
    for (const [_0x7bcb0f, _0x381cb9] of Object.entries(_0x209beb)) {
      _0x697c05[_0x7bcb0f] = /KEY|TOKEN|SECRET|PASSWORD/i.test(_0x7bcb0f) ? this.redactSecret(_0x381cb9) : _0x381cb9;
    }
    return _0x697c05;
  }
  readJsonObject(_0x55d1e2) {
    if (!fs.existsSync(_0x55d1e2)) {
      return undefined;
    }
    try {
      const _0x6b4535 = fs.readFileSync(_0x55d1e2, "utf-8").replace(/^\uFEFF/, "");
      const _0x489435 = JSON.parse(_0x6b4535);
      if (_0x489435 && typeof _0x489435 === "object") {
        return _0x489435;
      } else {
        return undefined;
      }
    } catch {
      return undefined;
    }
  }
  readExtensionPackageInfo() {
    const _0x4ceea6 = this.readJsonObject(path.join(this.context.extensionPath, "package.json")) || {};
    return {
      name: String(_0x4ceea6.name || ""),
      displayName: String(_0x4ceea6.displayName || ""),
      version: String(_0x4ceea6.version || ""),
      publisher: String(_0x4ceea6.publisher || "")
    };
  }
  readWindsurfProductInfo() {
    const _0x21fedd = vscode.env.appRoot || "";
    if (!_0x21fedd) {
      const _0x1e8072 = {
        path: "",
        nameShort: vscode.env.appName || "",
        version: vscode.version || "",
        commit: "",
        quality: ""
      };
      return _0x1e8072;
    }
    const _0x1a1998 = [path.join(_0x21fedd, "product.json"), path.join(path.dirname(_0x21fedd), "product.json"), path.join(path.dirname(path.dirname(_0x21fedd)), "product.json")];
    const _0x539f99 = new Set();
    for (const _0x16604c of _0x1a1998) {
      const _0x1bd1a7 = path.normalize(_0x16604c);
      if (_0x539f99.has(_0x1bd1a7)) {
        continue;
      }
      _0x539f99.add(_0x1bd1a7);
      const _0x1684b6 = this.readJsonObject(_0x1bd1a7);
      if (_0x1684b6) {
        return {
          path: _0x1bd1a7,
          nameShort: String(_0x1684b6.nameShort || _0x1684b6.nameLong || ""),
          version: String(_0x1684b6.version || _0x1684b6.codeVersion || vscode.version || ""),
          commit: String(_0x1684b6.commit || ""),
          quality: String(_0x1684b6.quality || "")
        };
      }
    }
    const _0x5c2202 = {
      path: "",
      nameShort: vscode.env.appName || "",
      version: vscode.version || "",
      commit: "",
      quality: ""
    };
    return _0x5c2202;
  }
  async getPortListeners(_0x144680) {
    if (!_0x144680) {
      return [];
    }
    try {
      if (process.platform === "win32") {
        const _0x2672fe = "$ids=Get-NetTCPConnection -LocalPort " + _0x144680 + " -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; foreach ($ownerPid in $ids) { $proc=Get-CimInstance Win32_Process -Filter \"ProcessId=$ownerPid\"; if ($proc) { \"$ownerPid $($proc.Name) $($proc.CommandLine)\" } else { \"$ownerPid\" } }";
        const _0x10bfeb = await this.execFileText("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", _0x2672fe], 3500);
        return _0x10bfeb.split(/\r?\n/).map(_0xa55e03 => this.sanitizeDiagnosticText(_0xa55e03.trim())).filter(Boolean);
      }
      const _0x49dd6b = await this.execFileText("lsof", ["-nP", "-iTCP:" + _0x144680, "-sTCP:LISTEN"], 3500);
      return _0x49dd6b.split(/\r?\n/).map(_0x4fe316 => this.sanitizeDiagnosticText(_0x4fe316.trim())).filter(Boolean);
    } catch (_0x225d51) {
      const _0x16f335 = _0x225d51 instanceof Error ? _0x225d51.message : String(_0x225d51);
      return ["读取监听进程失败：" + this.sanitizeDiagnosticText(_0x16f335)];
    }
  }
  jsonBlock(_0x8749d4) {
    return "```json\n" + JSON.stringify(_0x8749d4, null, 2) + "\n```";
  }
  textBlock(_0x5571d3) {
    return "```text\n" + (_0x5571d3 || "无") + "\n```";
  }
  async createDiagnosticReport() {
    const _0x393552 = this.proxyManager.readEnvConfig();
    const _0x1add1b = this.proxyManager.getStatus();
    const _0x38a1d5 = this.proxyManager.portsFromConfig(_0x393552);
    const _0x594508 = this.getPatchStatus();
    const _0x39db9b = this.readExtensionPackageInfo();
    const _0x2cb94a = this.readWindsurfProductInfo();
    const _0x131851 = undefined;
    const _0x3aa9e4 = [];
    let _0x119ad7;
    try {
      _0x119ad7 = await this.checkManagedEnvironment();
    } catch (_0x2d0b2c) {
      const _0x25b537 = _0x2d0b2c instanceof Error ? _0x2d0b2c.message : String(_0x2d0b2c);
      _0x119ad7 = {
        ok: false,
        checkedAt: new Date().toLocaleString(),
        items: [this.envCheckItem("environment-check", "环境检测", "error", _0x25b537, false)]
      };
    }
    let processLines = [];
    let processError = "";
    try {
      processLines = (await this.readWindsurfProcessCommandLines()).slice(0, 25).map(_0x1d7e2f => this.sanitizeDiagnosticText(_0x1d7e2f.length > 800 ? _0x1d7e2f.slice(0, 800) + "..." : _0x1d7e2f));
    } catch (_0x10fbf3) {
      processError = _0x10fbf3 instanceof Error ? _0x10fbf3.message : String(_0x10fbf3);
    }
    const _0x72ffb1 = await this.checkHttpHealth("" + "/health", 5000).catch(_0x440d59 => ({
      ok: false,
      elapsedMs: 0,
      error: _0x440d59 instanceof Error ? _0x440d59.message : String(_0x440d59)
    }));
    const _0x37d348 = await this.getPortListeners(_0x38a1d5.hybridPort);
    const _0x50b5e9 = await this.getPortListeners(_0x38a1d5.inferencePort);
    const _0x15bc4d = this.logLines.slice(-100).map(_0x3242a6 => this.sanitizeDiagnosticText(_0x3242a6)).join("\n");
    const _0x1cfa6d = _0x119ad7.items.map(_0x3944f5 => "- [" + _0x3944f5.status + "] " + _0x3944f5.name + ": " + _0x3944f5.detail).join("\n");
    const _0x47b7d3 = {
      loggedIn: !!_0x131851,
      username: _0x131851?.username || "",
      email: _0x131851?.email ? _0x131851.email.replace(/^(.{2}).*(@.*)$/, "$1***$2") : "",
      balance: typeof _0x131851?.balance === "number" ? _0x131851.balance : null,
      status: _0x131851?.status || "",
      apiKeyCount: _0x3aa9e4.length,
      selectedKey: this.redactSecret(_0x393552.ANTHROPIC_API_KEY || _0x393552.OPENAI_API_KEY || "")
    };
    const _0x1f9fe0 = {
      appName: vscode.env.appName,
      vscodeVersion: vscode.version,
      appRoot: vscode.env.appRoot,
      execPath: process.execPath
    };
    const _0x38950a = {
      port: _0x38a1d5.hybridPort,
      listeners: _0x37d348
    };
    const _0xfec91f = {
      port: _0x38a1d5.inferencePort,
      listeners: _0x50b5e9
    };
    const _0x1f5a48 = {
      hybrid: _0x38950a,
      inference: _0xfec91f
    };
    return ["# Devin BYOK Bridge 诊断报告", "", "生成时间：" + new Date().toLocaleString(), "", "## 版本与宿主", this.jsonBlock({
      extension: _0x39db9b,
      host: _0x1f9fe0,
      devinProduct: _0x2cb94a,
      os: {
        platform: process.platform,
        release: os.release(),
        arch: os.arch()
      }
    }), "", "## 代理状态", this.jsonBlock({
      status: _0x1add1b,
      lastStartError: this.proxyManager.getLastStartError(),
      lastStartWarning: this.proxyManager.getLastStartWarning()
    }), "", "## 配置快照（已脱敏）", this.jsonBlock(this.sanitizeEnvConfig(_0x393552)), "", "## API Key 配置", this.jsonBlock(_0x47b7d3), "", "## 补丁状态", this.jsonBlock(_0x594508), "", "## 端口监听", this.jsonBlock(_0x1f5a48), "", "## 网关连通", this.jsonBlock({
      host: "",
      health: _0x72ffb1
    }), "", "## 环境检测", _0x1cfa6d || "无检测项", "", "## Devin Desktop / Codeium 进程", processError ? this.textBlock(processError) : this.textBlock(processLines.join("\n")), "## 最近 100 行日志", this.textBlock(_0x15bc4d), ""].join("\n");
  }
  async exportDiagnosticReport() {
    const _0x453736 = await this.createDiagnosticReport();
    await vscode.env.clipboard.writeText(_0x453736);
    const _0x407ca6 = {
      content: _0x453736,
      language: "markdown"
    };
    const _0x5e2839 = await vscode.workspace.openTextDocument(_0x407ca6);
    await vscode.window.showTextDocument(_0x5e2839, {
      preview: false
    });
  }
  async repairManagedEnvironment() {
    const _0x59f88d = this.proxyManager.readEnvConfig();
    const _0x425783 = {
      ..._0x59f88d
    };
    const _0x5650a9 = _0x425783;
    _0x5650a9.ANTHROPIC_API_HOST = _0x5650a9.ANTHROPIC_API_HOST || "";
    _0x5650a9.ANTHROPIC_API_PATH = _0x5650a9.ANTHROPIC_API_PATH || "/v1/messages";
    _0x5650a9.OPENAI_API_PATH = _0x5650a9.OPENAI_API_PATH || "/v1/responses";
    if (!this.isValidPortValue(_0x5650a9.HYBRID_PORT)) {
      _0x5650a9.HYBRID_PORT = "3006";
    }
    if (!this.isValidPortValue(_0x5650a9.INFERENCE_PORT)) {
      _0x5650a9.INFERENCE_PORT = "3001";
    }
    _0x5650a9.MAX_TOKENS = _0x5650a9.MAX_TOKENS || "16384";
    if (!["", "low", "medium", "high", "xhigh", "max"].includes(_0x5650a9.OPENAI_REASONING_EFFORT || "")) {
      _0x5650a9.OPENAI_REASONING_EFFORT = "";
    }
    if (!["", "minimal", "low", "medium", "high", "xhigh", "max"].includes(_0x5650a9.BYOK1_THINKING_EFFORT || "")) {
      _0x5650a9.BYOK1_THINKING_EFFORT = "";
    }
    if (!["", "minimal", "low", "medium", "high", "xhigh", "max"].includes(_0x5650a9.BYOK2_THINKING_EFFORT || "")) {
      _0x5650a9.BYOK2_THINKING_EFFORT = "";
    }
    if (!["true", "false"].includes(_0x5650a9.OPENAI_THINKING_ENABLED || "false")) {
      _0x5650a9.OPENAI_THINKING_ENABLED = "false";
    }
    if (!this.isValidCompletionTimeoutValue(_0x5650a9.COMPLETION_TIMEOUT_MS)) {
      _0x5650a9.COMPLETION_TIMEOUT_MS = "12000";
    }
    this.proxyManager.writeEnvConfig(_0x5650a9);
    const _0x462b6d = path.join(this.proxyManager.getProxyRootPath(), "prompts", "system-prompt.md");
    if (!fs.existsSync(_0x462b6d)) {
      fs.mkdirSync(path.dirname(_0x462b6d), {
        recursive: true
      });
      fs.writeFileSync(_0x462b6d, DEFAULT_SYSTEM_PROMPT.trim() + "\n", "utf-8");
    }
    const _0x205cd2 = this.proxyManager.getStatus();
    const _0x4c2326 = this.getPatchStatus();
    if (_0x4c2326.path && _0x4c2326.patches.some(_0x5de18e => _0x5de18e.status === "available")) {
      patchManager_1.PatchManager.applyWithCustomUrls(patchManager_1.PatchManager.loopbackApiUrl(_0x205cd2.hybridPort), patchManager_1.PatchManager.loopbackApiUrl(_0x205cd2.inferencePort), this.getStoredPatchExtensionPath() || undefined);
    }
    return await this.checkManagedEnvironment();
  }
  postActionState(_0x3e57e1, _0x1f83f2, _0x3a57a4) {
    const _0x1cfc02 = {
      type: "actionState",
      section: _0x3e57e1,
      state: _0x1f83f2,
      message: _0x3a57a4
    };
    this.view?.webview.postMessage(_0x1cfc02);
  }
  async ensurePatchAppliedAfterProxyStart(_0x406fb2 = true) {
    const _0x197bd5 = this.getPatchStatus();
    const _0x2eddfc = _0x197bd5.patches.some(_0x59109d => _0x59109d.status !== "applied");
    if (!_0x2eddfc || !_0x197bd5.path) {
      return;
    }
    const _0x2b5ef9 = this.proxyManager.getStatus();
    const _0xf055c2 = patchManager_1.PatchManager.loopbackApiUrl(_0x2b5ef9.hybridPort);
    const _0x23a1bf = patchManager_1.PatchManager.loopbackApiUrl(_0x2b5ef9.inferencePort);
    const _0x58d015 = this.getStoredPatchExtensionPath();
    const _0x4157b5 = patchManager_1.PatchManager.applyWithCustomUrls(_0xf055c2, _0x23a1bf, _0x58d015);
    if (_0x4157b5.applied <= 0) {
      return;
    }
    const _0x250a94 = "检测到 Devin Desktop 补丁丢失，已自动恢复 " + _0x4157b5.applied + " 个，需重载窗口生效";
    this.logLines.push(_0x250a94);
    if (this.logLines.length > 200) {
      this.logLines = this.logLines.slice(-100);
    }
    const _0x568b89 = {
      type: "log",
      line: _0x250a94
    };
    this.view?.webview.postMessage(_0x568b89);
    this.postActionState("patch", "success", _0x250a94);
    if (!_0x406fb2) {
      return;
    }
    const _0x497d90 = await vscode.window.showInformationMessage(_0x250a94, "重载窗口");
    if (_0x497d90 === "重载窗口") {
      await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
    }
  }
  shellQuote(_0x1f8748) {
    return "'" + _0x1f8748.replace(/'/g, "'\\''") + "'";
  }
  runDetachedCacheCleaner(_0x36b353) {
    if (process.platform === "win32") {
      (0, child_process_1.spawn)("cmd.exe", ["/c", "start", "", _0x36b353], {
        detached: true,
        stdio: "ignore",
        windowsHide: false
      }).unref();
      return;
    }
    if (process.platform === "darwin") {
      (0, child_process_1.spawn)("osascript", ["-e", "tell application \"Terminal\" to do script \"sh " + this.shellQuote(_0x36b353).replace(/"/g, "\\\"") + "\""], {
        detached: true,
        stdio: "ignore"
      }).unref();
      return;
    }
    (0, child_process_1.spawn)("sh", [_0x36b353], {
      detached: true,
      stdio: "ignore"
    }).unref();
  }
  async forceRestartLanguageServer() {
    if (process.platform !== "win32") {
      return {
        restarted: 0,
        message: "当前仅支持 Windows 下强制重启 LS；请手动结束 Codeium/language_server 进程后重载窗口"
      };
    }
    const _0x3e0678 = await vscode.window.showWarningMessage("将强制结束 Devin Desktop/Codeium 的 language_server/Codeium 子进程，Devin Desktop 会自动拉起新的 LS。是否继续？", {
      modal: true
    }, "强制重启 LS");
    if (_0x3e0678 !== "强制重启 LS") {
      return {
        restarted: 0,
        message: "已取消强制重启 LS"
      };
    }
    const _0x5896bd = "\n$targets = Get-CimInstance Win32_Process | Where-Object {\n  $_.ProcessId -ne $PID -and (\n    $_.Name -match '(?i)(language_server|codeium)' -or\n    $_.CommandLine -match '(?i)(language_server|codeium)'\n  ) -and $_.Name -notmatch '(?i)^(Devin|Windsurf|Code|Code - Insiders).exe$'\n}\n$targets | Select-Object -ExpandProperty ProcessId -Unique\n".trim();
    const _0x40803d = await this.execFileText("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", _0x5896bd], 5000);
    const _0x30e9d0 = Array.from(new Set(_0x40803d.split(/\r?\n/).map(_0x3a0c25 => Number.parseInt(_0x3a0c25.trim(), 10)).filter(_0x14858f => Number.isInteger(_0x14858f) && _0x14858f > 0)));
    if (_0x30e9d0.length === 0) {
      return {
        restarted: 0,
        message: "未发现正在运行的 Codeium/language_server 进程"
      };
    }
    for (const _0x36e7ae of _0x30e9d0) {
      await this.execFileText("taskkill.exe", ["/PID", String(_0x36e7ae), "/T", "/F"], 5000);
    }
    const _0x4c0489 = "已结束 " + _0x30e9d0.length + " 个 LS/Codeium 进程，Devin Desktop 会自动重启 LS；如未恢复请点“重载窗口”";
    this.logLines.push(_0x4c0489);
    if (this.logLines.length > 200) {
      this.logLines = this.logLines.slice(-100);
    }
    const _0x19013b = {
      type: "log",
      line: _0x4c0489
    };
    this.view?.webview.postMessage(_0x19013b);
    const _0x4b57c5 = {
      restarted: _0x30e9d0.length,
      message: _0x4c0489
    };
    return _0x4b57c5;
  }
  async clearWindsurfCache() {
    const _0x1d6d10 = await vscode.window.showWarningMessage("将关闭 Devin Desktop/Codeium，只清理运行缓存目录；不会删除 Devin Desktop 历史记录、工作区数据、聊天记录或配置。是否继续？", {
      modal: true
    }, "安全清理缓存");
    if (_0x1d6d10 !== "安全清理缓存") {
      return;
    }
    const _0x1b5d1e = path.join(os.tmpdir(), "devin-byok-bridge-clear-cache-" + Date.now() + (process.platform === "win32" ? ".cmd" : ".sh"));
    if (process.platform === "win32") {
      fs.writeFileSync(_0x1b5d1e, ["@echo off", "timeout /t 1 /nobreak >nul 2>&1", "taskkill /f /im Devin.exe >nul 2>&1", "taskkill /f /im Windsurf.exe >nul 2>&1", "taskkill /f /im language_server.exe >nul 2>&1", "taskkill /f /im codeium.exe >nul 2>&1", "taskkill /f /im Codeium.exe >nul 2>&1", "timeout /t 2 /nobreak >nul 2>&1", "echo 正在安全清除运行缓存...", "rd /s /q \"%APPDATA%\\Devin\\Cache\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Windsurf\\Cache\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Devin\\CachedData\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Windsurf\\CachedData\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Devin\\CachedExtensionVSIXs\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Windsurf\\CachedExtensionVSIXs\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Devin\\Code Cache\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Windsurf\\Code Cache\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Devin\\DawnCache\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Windsurf\\DawnCache\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Devin\\GPUCache\" >nul 2>&1", "rd /s /q \"%APPDATA%\\Windsurf\\GPUCache\" >nul 2>&1", "rd /s /q \"%LOCALAPPDATA%\\Devin\\Cache\" >nul 2>&1", "rd /s /q \"%LOCALAPPDATA%\\Windsurf\\Cache\" >nul 2>&1", "rd /s /q \"%LOCALAPPDATA%\\Devin\\CachedData\" >nul 2>&1", "rd /s /q \"%LOCALAPPDATA%\\Windsurf\\CachedData\" >nul 2>&1", "rd /s /q \"%LOCALAPPDATA%\\Devin\\Code Cache\" >nul 2>&1", "rd /s /q \"%LOCALAPPDATA%\\Windsurf\\Code Cache\" >nul 2>&1", "rd /s /q \"%LOCALAPPDATA%\\Devin\\DawnCache\" >nul 2>&1", "rd /s /q \"%LOCALAPPDATA%\\Windsurf\\DawnCache\" >nul 2>&1", "rd /s /q \"%LOCALAPPDATA%\\Devin\\GPUCache\" >nul 2>&1", "rd /s /q \"%LOCALAPPDATA%\\Windsurf\\GPUCache\" >nul 2>&1", "rd /s /q \"%TEMP%\\codeium\" >nul 2>&1", "echo 运行缓存已清除完毕，Devin Desktop 历史记录已保留，请重新打开 Devin Desktop", "pause", ""].join("\r\n"), "utf-8");
    } else {
      fs.writeFileSync(_0x1b5d1e, ["#!/bin/sh", "sleep 1", "pkill -f \"Devin\" >/dev/null 2>&1 || true", "pkill -f \"Windsurf\" >/dev/null 2>&1 || true", "pkill -f \"Codeium\" >/dev/null 2>&1 || true", "pkill -f \"codeium\" >/dev/null 2>&1 || true", "sleep 1", "echo 正在安全清除运行缓存...", "rm -rf \"$HOME/Library/Caches/Devin\"", "rm -rf \"$HOME/Library/Caches/Windsurf\"", "rm -rf \"$HOME/Library/Caches/Codeium\"", "rm -rf \"$HOME/.cache/Devin\"", "rm -rf \"$HOME/.cache/Windsurf\"", "rm -rf \"$HOME/.cache/Codeium\"", "rm -rf \"${TMPDIR:-/tmp}/codeium\"", "rm -rf \"/tmp/codeium\"", "echo 运行缓存已清除完毕，Devin Desktop 历史记录已保留，请重新打开 Devin Desktop", "printf \"Press Enter to close...\"", "read _", ""].join("\n"), "utf-8");
      fs.chmodSync(_0x1b5d1e, 493);
    }
    this.runDetachedCacheCleaner(_0x1b5d1e);
    this.postActionState("config", "success", "安全清理缓存脚本已启动，历史记录会保留，Devin Desktop 即将关闭");
  }
  async openMaintenanceTools() {
    const _0x25381f = await vscode.window.showQuickPick([{
      label: "提示词模板",
      description: "选择内置模板或自定义系统提示词",
      action: "promptTemplates"
    }, {
      label: "环境检测",
      description: "检查代理、补丁、运行环境",
      action: "checkEnvironment"
    }, {
      label: "强制重启 LS",
      description: "结束 Codeium/language_server 子进程",
      action: "restartLs"
    }, {
      label: "安全清理缓存",
      description: "只清理缓存，保留历史记录和工作区数据",
      action: "clearCache"
    }, {
      label: "导出诊断",
      description: "复制并打开诊断报告",
      action: "exportDiagnostics"
    }], {
      placeHolder: "选择维护操作"
    });
    if (!_0x25381f) {
      this.postActionState("config", "success", "已取消维护操作");
      return;
    }
    if (_0x25381f.action === "promptTemplates") {
      await this.openPromptTemplatePicker();
      return;
    }
    if (_0x25381f.action === "checkEnvironment") {
      const _0x982463 = await this.checkManagedEnvironment();
      const _0x29c8bc = {
        type: "environmentCheck",
        result: _0x982463
      };
      this.view?.webview.postMessage(_0x29c8bc);
      this.postActionState("config", _0x982463.ok ? "success" : "error", _0x982463.ok ? "环境检测通过" : "检测到异常项");
      return;
    }
    if (_0x25381f.action === "restartLs") {
      
      const _0x39f1da = await this.forceRestartLanguageServer();
      this.postActionState("config", _0x39f1da.restarted > 0 ? "success" : "error", _0x39f1da.message);
      return;
    }
    if (_0x25381f.action === "clearCache") {
      
      await this.clearWindsurfCache();
      return;
    }
    await this.exportDiagnosticReport();
    this.postActionState("config", "success", "诊断报告已复制并打开");
  }
  getSystemPromptTargetPath(_0x3b397b, _0x2a18bf) {
    const _0x48741f = {
      ..._0x3b397b
    };
    const _0x32b8a2 = _0x48741f;
    if (typeof _0x2a18bf === "string") {
      _0x32b8a2.SYSTEM_PROMPT_PATH = _0x2a18bf.trim() || "./prompts/system-prompt.md";
    }
    return this.proxyManager.getResolvedSystemPromptPath(_0x32b8a2);
  }
  async restartProxyForPromptConfigIfRunning() {
    const _0x4a084b = this.proxyManager.getStatus();
    if (!_0x4a084b.running) {
      return false;
    }
    const _0x31a2b3 = await vscode.window.showInformationMessage("提示词配置已更新，需要重启代理后生效。是否立即重启？", "立即重启", "稍后手动重启");
    if (_0x31a2b3 !== "立即重启") {
      return false;
    }
    this.proxyManager.stop();
    await new Promise(_0x4c4b32 => setTimeout(_0x4c4b32, 500));
    const _0xb866ad = await this.proxyManager.start("both", this.getRuntimeConfigForCurrentMode());
    this.postActionState("proxy", _0xb866ad ? "success" : "error", _0xb866ad ? "代理已重启，提示词已生效" : this.proxyManager.getLastStartError() || "代理重启失败");
    return _0xb866ad;
  }
  async applySystemPromptContent(_0x49a8b8, _0x531f3, _0x3cb1d1) {
    const _0xb2b47e = this.proxyManager.readEnvConfig();
    const _0x4f5563 = _0x3cb1d1?.trim() || "./prompts/system-prompt.md";
    const _0x4c0c71 = this.getSystemPromptTargetPath(_0xb2b47e, _0x4f5563);
    if (fs.existsSync(_0x4c0c71)) {
      const _0x4749b0 = fs.readFileSync(_0x4c0c71, "utf-8").trim();
      if (_0x4749b0 && _0x4749b0 !== _0x49a8b8.trim()) {
        const _0x1de0fe = await vscode.window.showWarningMessage("将覆盖当前提示词文件：" + _0x4c0c71, {
          modal: true
        }, "覆盖");
        if (_0x1de0fe !== "覆盖") {
          this.postActionState("config", "success", "已取消应用提示词模板");
          return;
        }
      }
    }
    fs.mkdirSync(path.dirname(_0x4c0c71), {
      recursive: true
    });
    fs.writeFileSync(_0x4c0c71, _0x49a8b8.trim() + "\n", "utf-8");
    const _0x276d31 = {
      ..._0xb2b47e
    };
    _0x276d31.SYSTEM_PROMPT_OVERRIDE = "true";
    _0x276d31.SYSTEM_PROMPT_PATH = _0x4f5563;
    const _0x3c9603 = _0x276d31;
    this.proxyManager.writeEnvConfig(_0x3c9603);
    this.postActionState("config", "success", "已应用提示词：" + _0x531f3);
    await this.restartProxyForPromptConfigIfRunning();
    this.refresh();
  }
  async openPromptTemplatePicker() {
    const _0x1ea312 = {
      label: "自定义提示词",
      description: "打开并编辑 system-prompt.md",
      action: "custom"
    };
    const _0x528d3f = {
      label: "关闭提示词覆盖",
      description: "恢复使用 Devin Desktop 原始系统提示词",
      action: "disable"
    };
    const _0xc14a72 = [...BUILT_IN_PROMPT_TEMPLATES.map(_0x55f18a => ({
      label: _0x55f18a.label,
      description: _0x55f18a.description,
      action: "template",
      template: _0x55f18a
    })), _0x1ea312, _0x528d3f];
    const _0x3546c8 = await vscode.window.showQuickPick(_0xc14a72, {
      placeHolder: "选择内置提示词模板，或打开自定义提示词文件"
    });
    if (!_0x3546c8) {
      this.postActionState("config", "success", "已取消提示词操作");
      return;
    }
    if (_0x3546c8.action === "custom") {
      const _0x233442 = this.proxyManager.readEnvConfig();
      const _0xc68783 = {
        ..._0x233442
      };
      _0xc68783.SYSTEM_PROMPT_OVERRIDE = "true";
      _0xc68783.SYSTEM_PROMPT_PATH = _0x233442.SYSTEM_PROMPT_PATH || "./prompts/system-prompt.md";
      const _0x26e66a = _0xc68783;
      this.proxyManager.writeEnvConfig(_0x26e66a);
      await this.openSystemPromptEditor(_0x26e66a.SYSTEM_PROMPT_PATH);
      this.postActionState("config", "success", "已启用并打开自定义提示词文件");
      await this.restartProxyForPromptConfigIfRunning();
      this.refresh();
      return;
    }
    if (_0x3546c8.action === "disable") {
      const _0xa1f60a = this.proxyManager.readEnvConfig();
      const _0x3210ab = {
        ..._0xa1f60a
      };
      _0x3210ab.SYSTEM_PROMPT_OVERRIDE = "";
      this.proxyManager.writeEnvConfig(_0x3210ab);
      this.postActionState("config", "success", "已关闭提示词覆盖");
      await this.restartProxyForPromptConfigIfRunning();
      this.refresh();
      return;
    }
    await this.applySystemPromptContent(_0x3546c8.template.content, _0x3546c8.template.label);
  }
  async openSystemPromptEditor(_0x569281) {
    const _0x4732ad = this.proxyManager.readEnvConfig();
    const _0xe40085 = this.getSystemPromptTargetPath(_0x4732ad, _0x569281);
    if (!fs.existsSync(_0xe40085)) {
      fs.mkdirSync(path.dirname(_0xe40085), {
        recursive: true
      });
      const _0xceca8a = {
        ..._0x4732ad
      };
      _0xceca8a.SYSTEM_PROMPT_PATH = "./prompts/system-prompt.md";
      const _0x1975a9 = this.proxyManager.getResolvedSystemPromptPath(_0xceca8a);
      if (fs.existsSync(_0x1975a9) && path.normalize(_0x1975a9) !== path.normalize(_0xe40085)) {
        fs.copyFileSync(_0x1975a9, _0xe40085);
      } else {
        fs.writeFileSync(_0xe40085, "", "utf-8");
      }
    }
    const _0x5e470a = await vscode.workspace.openTextDocument(vscode.Uri.file(_0xe40085));
    await vscode.window.showTextDocument(_0x5e470a, {
      preview: false
    });
  }
  async handleMessage(_0x306b04) {
    switch (_0x306b04.command) {

      case "startProxy":
        {
          
          const _0x4a8ca3 = _0x306b04.config;
          if (_0x4a8ca3) {
            const _0x49b5c9 = this.validateByokSlots(_0x4a8ca3).join("；");
            if (_0x49b5c9) {
              this.postActionState("proxy", "error", _0x49b5c9);
              await vscode.window.showErrorMessage(_0x49b5c9);
              break;
            }
          }
          let _0x39517d;
          if (_0x4a8ca3) {
            
            _0x39517d = this.writeModeScopedConfig(_0x4a8ca3);
          }
          const _0x85717b = this.getRuntimeConfigForCurrentMode(_0x39517d);
          const _0x4f7d90 = await this.proxyManager.start(_0x306b04.mode || "both", _0x85717b);
          if (!_0x4f7d90) {
            this.postActionState("proxy", "error", this.proxyManager.getLastStartError() || "启动失败，请查看通知或日志");
            break;
          }
          const _0x4e7bb6 = this.proxyManager.getLastStartWarning();
          this.postActionState("proxy", "success", _0x4e7bb6 ? "代理已启动；" + _0x4e7bb6 : "代理已启动");
          await this.ensurePatchAppliedAfterProxyStart(true);
          this.refresh();
          break;
        }
      case "stopProxy":
        this.proxyManager.stop();
        this.postActionState("proxy", "success", "代理已停止");
        this.refresh();
        break;
      case "saveConfig":
        {
          const _0x6251a7 = _0x306b04.config;
          const _0x5e1b70 = this.validateByokSlots(_0x6251a7).join("；");
          if (_0x5e1b70) {
            this.postActionState("config", "error", _0x5e1b70);
            await vscode.window.showErrorMessage(_0x5e1b70);
            break;
          }
          
          const _0xf9c8d5 = this.writeModeScopedConfig(_0x6251a7);
          const _0x35a727 = this.getRuntimeConfigForCurrentMode(_0xf9c8d5);
          this.postActionState("config", "success", "配置已保存");
          const _0x1b9939 = this.proxyManager.getStatus();
          if (_0x1b9939.running) {
            const {
              hybridPort: _0x4a048f,
              inferencePort: _0x16f1f4
            } = this.proxyManager.portsFromConfig(_0xf9c8d5);
            const _0x22bb31 = _0x1b9939.hybridPort !== _0x4a048f || _0x1b9939.inferencePort !== _0x16f1f4;
            if (_0x22bb31) {
              this.proxyManager.stop();
              await this.proxyManager.start("both", _0x35a727);
              this.postActionState("patch", "success", "端口已变更；如需让 Devin Desktop 使用新端口，请手动点击“安装补丁”并重载窗口");
            } else {
              const _0x1a3d59 = {
                hybridPort: _0x4a048f,
                inferencePort: _0x16f1f4
              };
              await this.proxyManager.reloadRuntimeConfig(_0x35a727, _0x1a3d59);
            }
          }
          this.refresh();
          break;
        }
      case "reloadIdeWindow":
        {
          await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
          break;
        }
      case "newWindow":
        {
          await vscode.commands.executeCommand("workbench.action.newWindow");
          break;
        }
      case "openPromptTemplates":
        {
          try {
            await this.openPromptTemplatePicker();
          } catch (_0x2a7f4b) {
            const _0x5b02ad = _0x2a7f4b instanceof Error ? _0x2a7f4b.message : String(_0x2a7f4b);
            this.postActionState("config", "error", "提示词操作失败：" + _0x5b02ad);
          }
          break;
        }
      case "openSystemPrompt":
        {
          try {
            const _0x3ec1e0 = this.proxyManager.readEnvConfig();
            const _0x30fe0d = typeof _0x306b04.path === "string" && _0x306b04.path.trim() ? _0x306b04.path.trim() : "./prompts/system-prompt.md";
            const _0xe75ae3 = {
              ..._0x3ec1e0
            };
            _0xe75ae3.SYSTEM_PROMPT_OVERRIDE = "true";
            _0xe75ae3.SYSTEM_PROMPT_PATH = _0x30fe0d;
            this.proxyManager.writeEnvConfig(_0xe75ae3);
            await this.openSystemPromptEditor(_0x30fe0d);
            this.postActionState("config", "success", "已启用并打开自定义提示词文件");
            await this.restartProxyForPromptConfigIfRunning();
            this.refresh();
          } catch (_0x10e663) {
            const _0x5c6ec0 = _0x10e663 instanceof Error ? _0x10e663.message : String(_0x10e663);
            this.postActionState("config", "error", "打开提示词失败：" + _0x5c6ec0);
          }
          break;
        }
      case "setAutoStartProxy":
        {
          await this.context.globalState.update(KEY_AUTO_START_PROXY, _0x306b04.value === true);
          break;
        }
      case "maintenanceTools":
        {
          try {
            await this.openMaintenanceTools();
          } catch (_0x468d0f) {
            const _0x13565f = _0x468d0f instanceof Error ? _0x468d0f.message : String(_0x468d0f);
            this.postActionState("config", "error", "维护操作失败：" + _0x13565f);
          }
          break;
        }
      case "clearCache":
        {
          
          try {
            await this.clearWindsurfCache();
          } catch (_0x1ec00b) {
            const _0x980c6d = _0x1ec00b instanceof Error ? _0x1ec00b.message : String(_0x1ec00b);
            this.postActionState("config", "error", "清理缓存失败：" + _0x980c6d);
          }
          break;
        }
      case "forceRestartLanguageServer":
        {
          
          try {
            const _0xcd1bdb = await this.forceRestartLanguageServer();
            this.postActionState("config", _0xcd1bdb.restarted > 0 ? "success" : "error", _0xcd1bdb.message);
          } catch (_0x276c28) {
            const _0x1aa1fa = _0x276c28 instanceof Error ? _0x276c28.message : String(_0x276c28);
            this.postActionState("config", "error", "强制重启 LS 失败：" + _0x1aa1fa);
          }
          break;
        }
      case "checkEnvironment":
        {
          try {
            const _0x3e8fa9 = await this.checkManagedEnvironment();
            const _0x38a460 = {
              type: "environmentCheck",
              result: _0x3e8fa9
            };
            this.view?.webview.postMessage(_0x38a460);
            this.postActionState("config", _0x3e8fa9.ok ? "success" : "error", _0x3e8fa9.ok ? "环境检测通过" : "检测到异常项");
          } catch (_0x857502) {
            const _0x39223f = _0x857502 instanceof Error ? _0x857502.message : String(_0x857502);
            this.postActionState("config", "error", "环境检测失败：" + _0x39223f);
          }
          break;
        }
      case "exportDiagnostics":
        {
          try {
            await this.exportDiagnosticReport();
            this.postActionState("config", "success", "诊断报告已复制并打开");
          } catch (_0x5024e1) {
            const _0x43a41b = _0x5024e1 instanceof Error ? _0x5024e1.message : String(_0x5024e1);
            this.postActionState("config", "error", "导出诊断失败：" + _0x43a41b);
          }
          break;
        }
      case "repairEnvironment":
        {
          
          try {
            const _0x302dcd = await this.repairManagedEnvironment();
            const _0x304745 = {
              type: "environmentCheck",
              result: _0x302dcd
            };
            this.view?.webview.postMessage(_0x304745);
            this.postActionState("config", _0x302dcd.ok ? "success" : "error", _0x302dcd.ok ? "环境修复完成" : "已修复可处理项，仍有异常需手动处理");
            this.refresh();
          } catch (_0xe98bb7) {
            const _0x554137 = _0xe98bb7 instanceof Error ? _0xe98bb7.message : String(_0xe98bb7);
            this.postActionState("config", "error", "环境修复失败：" + _0x554137);
          }
          break;
        }
      case "probeModelLink":
        {
          try {
            const _0x4dbfb7 = {
              ...this.proxyManager.readEnvConfig(),
              ...(_0x306b04.config && typeof _0x306b04.config === "object" ? _0x306b04.config : {})
            };
            const _0xc2731a = this.normalizeProviderBaseUrl(_0x4dbfb7);
            const _0x1eae65 = await this.probeConfiguredModelStream(_0xc2731a);
            const _0x74897 = {
              type: "modelProbeResult",
              result: _0x1eae65
            };
            this.view?.webview.postMessage(_0x74897);
            this.postActionState("config", _0x1eae65.ok ? "success" : "error", _0x1eae65.ok ? "模型链路探测通过" : "模型链路探测失败");
          } catch (_0x42847b) {
            const _0x16bbf8 = _0x42847b instanceof Error ? _0x42847b.message : String(_0x42847b);
            const _0x1240d3 = {
              ok: false,
              model: "--",
              detail: _0x16bbf8
            };
            const _0x337581 = {
              type: "modelProbeResult",
              result: _0x1240d3
            };
            this.view?.webview.postMessage(_0x337581);
            this.postActionState("config", "error", "模型链路探测失败：" + _0x16bbf8);
          }
          break;
        }
      case "fetchModels":
        {
          const _0xfetchSlot = _0x306b04.slot === 2 ? 2 : 1;
          this.view?.webview.postMessage({
            type: "modelList",
            slot: _0xfetchSlot,
            loading: true
          });
          try {
            const _0x5d4fc3 = this.resolveModelFetchCredentials(_0x306b04.apiKey, _0x306b04.baseUrl);
            const _0x255369 = await this.fetchModelsFromGateway(_0x5d4fc3.apiKey, _0x5d4fc3.baseUrl);
            const _0x2740da = {
              type: "modelList",
              slot: _0xfetchSlot,
              data: _0x255369
            };
            this.view?.webview.postMessage(_0x2740da);
          } catch (_0xdde730) {
            const _0x3bf28e = this.formatModelFetchError(_0xdde730);
            const _0x52cff6 = {
              type: "modelList",
              slot: _0xfetchSlot,
              error: _0x3bf28e
            };
            this.view?.webview.postMessage(_0x52cff6);
            await vscode.window.showErrorMessage(_0x3bf28e);
          }
          break;
        }
      case "applyPatch":
        {
          
          const _0x44b0ff = this.proxyManager.getStatus();
          const _0x2ee770 = patchManager_1.PatchManager.loopbackApiUrl(_0x44b0ff.hybridPort);
          const _0xe74a9d = patchManager_1.PatchManager.loopbackApiUrl(_0x44b0ff.inferencePort);
          const _0x331886 = _0x306b04.apiUrl || _0x2ee770;
          const _0x359678 = _0x306b04.inferenceUrl || _0xe74a9d;
          const _0x1b63d2 = _0x306b04.extJsPath || this.getStoredPatchExtensionPath() || undefined;
          const _0x3d4695 = patchManager_1.PatchManager.applyWithCustomUrls(_0x331886, _0x359678, _0x1b63d2);
          const _0x4c2a0e = _0x3d4695.applied > 0 ? "补丁已应用 " + _0x3d4695.applied + "/" + (_0x3d4695.applied + _0x3d4695.skipped + _0x3d4695.failed) + "，需重载窗口生效" : _0x3d4695.skipped > 0 ? "所有补丁已是最新" : "未找到可应用的补丁";
          const _0x599668 = "重载窗口";
          if (_0x3d4695.applied > 0) {
            this.postActionState("patch", "success", _0x4c2a0e);
            const _0x27773a = await vscode.window.showInformationMessage(_0x4c2a0e, _0x599668);
            if (_0x27773a === _0x599668) {
              await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
            }
          } else {
            this.postActionState("patch", _0x3d4695.skipped > 0 ? "success" : "error", _0x4c2a0e);
            await vscode.window.showInformationMessage(_0x4c2a0e);
          }
          this.refresh();
          break;
        }
      case "refreshPatchStatus":
        this.postActionState("patch", "success", "补丁状态已刷新");
        this.refresh();
        break;
      case "locateExtJs":
        {
          const _0x4b52f0 = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            filters: {
              JavaScript: ["js"]
            },
            title: "选择 Devin Desktop extension.js"
          });
          if (_0x4b52f0 && _0x4b52f0.length > 0) {
            await this.setStoredPatchExtensionPath(_0x4b52f0[0].fsPath);
            this.postActionState("patch", "success", "已选择 extension.js");
            this.refresh();
          } else {
            this.postActionState("patch", "success", "已取消选择");
          }
          break;
        }
      case "clearExtJsPath":
        await this.setStoredPatchExtensionPath(undefined);
        this.postActionState("patch", "success", "已切回自动检测");
        this.refresh();
        break;
      case "revertPatch":
        {
          
          const _0x1bee23 = patchManager_1.PatchManager.revert(_0x306b04.extJsPath || this.getStoredPatchExtensionPath() || undefined);
          const _0xa1e7e5 = "重载窗口";
          if (_0x1bee23) {
            this.postActionState("patch", "success", "补丁已还原，需重载窗口生效");
            const _0x2a2a1d = await vscode.window.showInformationMessage("补丁已还原，需重载窗口生效", _0xa1e7e5);
            if (_0x2a2a1d === _0xa1e7e5) {
              await (0, reloadWorkbench_1.reloadWorkbenchWindow)();
            }
          } else {
            this.postActionState("patch", "error", "未找到备份文件");
            await vscode.window.showInformationMessage("未找到备份文件");
          }
          this.refresh();
          break;
        }

      case "getStatus":
        {
          await this.postStatusSnapshot();
          break;
        }
    }
  }
  getHtml() {
    const _0x50cb0e = this.proxyManager.getStatus();
    const _0x16840c = this.getPatchStatus();
    const _0x103996 = this.getModeScopedConfig(this.proxyManager.readEnvConfig());
    const _0x5af368 = patchManager_1.PatchManager.loopbackApiUrl(_0x50cb0e.hybridPort);
    const _0x261671 = patchManager_1.PatchManager.loopbackApiUrl(_0x50cb0e.inferencePort);
    const _0xf1598f = this.context.globalState.get(KEY_AUTO_START_PROXY) === true;
    const _0x117c6c = _0x16840c.path ? _0x16840c.path.replace(/\\/g, "/").split("/").slice(-4).join("/") : "未找到";
    const _0x58779c = _0x16840c.patches.filter(_0x391178 => _0x391178.status === "applied").length;
    const _0x1526d8 = this.proxyManager.getSystemPromptConfigPath(_0x103996);
    const _0x2d552d = _0x103996.SYSTEM_PROMPT_OVERRIDE === "true";
    const _0xce874c = getWebviewNonce();
    const _0x3b1456 = this.view?.webview.cspSource ?? "";
    const _0x404c7a = this.view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "sidebar.js"));
    const _0x372c2d = "var(--vscode-button-background,#0d9488)";
    const _0x583192 = "var(--vscode-button-hoverBackground,#0f766e)";
    const _0x11ee49 = "var(--vscode-textLink-foreground,#5eead4)";
    const _0x4d5f75 = "var(--vscode-descriptionForeground,#71717a)";
    const _0x560479 = "var(--vscode-disabledForeground,#52525b)";
    const _0x500046 = "var(--vscode-sideBar-background,var(--vscode-editor-background,#1a1a2e))";
    const _0x21f85c = "var(--vscode-editorWidget-background,var(--vscode-sideBar-background,#16162a))";
    const _0x5a2456 = "var(--vscode-input-background,var(--vscode-editor-background,#0f0f1e))";
    const _0x37f073 = "var(--vscode-panel-border,var(--vscode-widget-border,#2a2a4a))";
    const _0x30f8ac = "var(--vscode-foreground,#d4d4d8)";
    const _0x4e0e10 = "var(--vscode-input-foreground,var(--vscode-foreground,#e4e4e7))";
    const _0x3c142f = "'Cascadia Code','Fira Code',monospace";
    const _0xb1Host = esc(_0x103996.BYOK1_ANTHROPIC_API_HOST || _0x103996.ANTHROPIC_API_HOST || "");
    const _0xb1Key = esc(_0x103996.BYOK1_ANTHROPIC_API_KEY || _0x103996.ANTHROPIC_API_KEY || "");
    const _0xb1Model = esc(_0x103996.BYOK1_MODEL || _0x103996.DEFAULT_MODEL || "");
    const _0xb2Host = esc(_0x103996.BYOK2_ANTHROPIC_API_HOST || "");
    const _0xb2Key = esc(_0x103996.BYOK2_ANTHROPIC_API_KEY || "");
    const _0xb2Model = esc(_0x103996.BYOK2_MODEL || "");
    const _0xb1Effort = esc(_0x103996.BYOK1_THINKING_EFFORT || _0x103996.OPENAI_REASONING_EFFORT || "");
    const _0xb2Effort = esc(_0x103996.BYOK2_THINKING_EFFORT || "");
    const _0x9444e3 = Object.prototype.hasOwnProperty.call(_0x103996, "OPENAI_REASONING_EFFORT") ? _0x103996.OPENAI_REASONING_EFFORT : "";
    const _0x216d28 = _0x58779c === _0x16840c.patches.length ? "badge-ok" : "badge-warn";
    const _0x3a632d = _0x58779c === _0x16840c.patches.length ? "已就绪" : "需安装";
    const _0x4f6817 = this.logLines.length === 0 ? "<div class=\"log-line dim\">等待日志...</div>" : this.logLines.slice(-30).map(_0x54c79e => {
      const _0x38b132 = /→.*GetChatMessage|GetStreamingCompletions|GetEmbeddings/.test(_0x54c79e) ? " hi" : /err|stderr/i.test(_0x54c79e) ? " err" : "";
      return "<div class=\"log-line" + _0x38b132 + "\">" + esc(_0x54c79e) + "</div>";
    }).join("");
    return "<!DOCTYPE html>\n<html lang=\"zh\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">\n<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src " + _0x3b1456 + " 'unsafe-inline'; img-src " + _0x3b1456 + " https: data:; script-src 'nonce-" + _0xce874c + "' " + _0x3b1456 + ";\">\n<style>\n*{box-sizing:border-box;margin:0;padding:0}\nbody{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:" + _0x500046 + ";color:" + _0x30f8ac + ";padding:10px;font-size:12px;line-height:1.35;min-height:100vh;position:relative;overflow-x:hidden}\nbody::before,body::after{display:none}\n\n.card{background:" + _0x21f85c + ";border-radius:10px;padding:12px;margin-bottom:10px;border:1px solid " + _0x37f073 + ";box-shadow:0 1px 2px rgba(0,0,0,.12)}\n.card-head{font-size:12px;font-weight:700;color:" + _0x4e0e10 + ";margin-bottom:8px;display:flex;align-items:center;gap:6px;min-height:22px}\n\n.stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:0}\n.st{background:" + _0x5a2456 + ";border-radius:8px;padding:6px 4px;text-align:center;border:1px solid " + _0x37f073 + "}\n.st b{display:block;font-size:14px;font-weight:700;color:" + _0x11ee49 + ";line-height:1.1}\n.st small{font-size:9px;color:" + _0x4d5f75 + ";margin-top:2px;display:block}\n\n.btn{min-height:30px;padding:6px 12px;border:none;border-radius:8px;cursor:pointer;font-size:11px;font-weight:800;transition:all .18s ease;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;letter-spacing:0}\n.btn:disabled{opacity:.5;cursor:not-allowed}\n.btn-p{background:" + _0x372c2d + ";color:var(--vscode-button-foreground,#fff);box-shadow:0 1px 0 rgba(255,255,255,.08) inset}.btn-p:hover{background:" + _0x583192 + "}\n.btn-d{background:var(--vscode-errorForeground,#ef4444);color:#fff}.btn-d:hover{filter:brightness(.92)}\n.btn-s{background:var(--vscode-button-secondaryBackground," + _0x5a2456 + ");color:var(--vscode-button-secondaryForeground," + _0x30f8ac + ");border:1px solid " + _0x37f073 + ";box-shadow:none}.btn-s:hover{background:var(--vscode-button-secondaryHoverBackground," + _0x5a2456 + ");color:var(--vscode-button-secondaryForeground," + _0x30f8ac + ")}\n.sm{min-height:22px;padding:3px 8px;font-size:10px;border-radius:6px}\n.btns{display:flex;gap:5px;flex-wrap:wrap;align-items:center}\n\n.fg{margin-bottom:7px}\n.fg label{display:block;font-size:10px;color:" + _0x4d5f75 + ";margin-bottom:3px;font-weight:600}\ninput[type=\"text\"],input[type=\"email\"],input[type=\"password\"],input[type=\"number\"],select{width:100%;height:38px;padding:8px 11px;border:1px solid var(--vscode-input-border," + _0x37f073 + ");border-radius:8px;font-size:12px;background:" + _0x5a2456 + ";color:" + _0x4e0e10 + ";font-family:" + _0x3c142f + ";box-shadow:none;transition:all .18s ease}\ninput:focus,select:focus{outline:none;border-color:var(--vscode-focusBorder," + _0x372c2d + ");box-shadow:0 0 0 1px var(--vscode-focusBorder," + _0x372c2d + ")}\n.login-grid{display:grid;grid-template-columns:1fr;gap:9px}\n.login-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}\n.login-tab{min-height:28px}\n.login-pane.hidden{display:none!important}\n.remember-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:10px;color:" + _0x4d5f75 + ";line-height:1.3;padding:1px 2px 3px}\n.remember-row label{display:inline-flex;align-items:center;gap:5px;cursor:pointer}\n.remember-row input{accent-color:" + _0x372c2d + ";width:14px;height:14px}\n.inline-form{display:flex;gap:5px;align-items:center}.inline-form input{min-width:0;flex:1}\n\n/* ── Badge ── */\n.badge{display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:10px;font-weight:700;line-height:1.3}\n.badge-ok{background:#064e3b;color:#34d399}\n.badge-warn{background:#451a03;color:#fbbf24}\n\n/* ── Toggle ── */\n.tog{position:relative;width:32px;height:18px;flex-shrink:0}\n.tog input{opacity:0;width:0;height:0}\n.tog span{position:absolute;cursor:pointer;inset:0;background:#3f3f46;border-radius:20px;transition:all .2s}\n.tog span::before{content:'';position:absolute;width:12px;height:12px;left:3px;bottom:3px;background:" + _0x4d5f75 + ";border-radius:50%;transition:all .2s}\n.tog input:checked+span{background:" + _0x372c2d + "}\n.tog input:checked+span::before{transform:translateX(14px);background:#fff}\n\n/* ── Log ── */\n.log-box{background:" + _0x5a2456 + ";border:1px solid " + _0x37f073 + ";border-radius:7px;padding:7px;max-height:160px;overflow-y:auto;font-family:" + _0x3c142f + ";font-size:10px;line-height:1.45;color:" + _0x4d5f75 + "}\n.log-line{white-space:pre-wrap;word-break:break-all}\n.log-line.hi{color:" + _0x11ee49 + "}.log-line.err{color:#f87171}.log-line.dim{color:#3f3f46}\n\n/* ── Action feedback ── */\n.action-state{margin-top:7px;padding:7px 8px;border-radius:7px;background:" + _0x5a2456 + ";border:1px solid " + _0x37f073 + "}\n.action-text{font-size:10px;color:#a1a1aa;margin-bottom:4px;line-height:1.45;white-space:pre-wrap;word-break:break-word}\n.action-progress{height:3px;background:#1e1e3a;border-radius:999px;overflow:hidden}\n.action-progress-bar{width:35%;height:100%;background:" + _0x372c2d + ";border-radius:999px;animation:prog 1s ease-in-out infinite}\n.action-state.success .action-text{color:#34d399}\n.action-state.error .action-text{color:#f87171}\n.action-state.success .action-progress-bar,.action-state.error .action-progress-bar{width:100%;animation:none}\n@keyframes prog{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}\n\n/* ── Misc ── */\n.row{display:flex;align-items:center;gap:5px}\n.between{justify-content:space-between}\n.toggle-section{cursor:pointer;user-select:none}.toggle-section::after{content:'\\25BE';font-size:10px;margin-left:4px}.toggle-section.collapsed::after{content:'\\25B8'}\n.hidden{display:none!important}\n.info-strip{background:" + _0x21f85c + ";border:1px solid " + _0x37f073 + ";border-radius:10px;padding:9px 10px;margin-bottom:10px;display:flex;flex-direction:column;gap:5px;box-shadow:0 1px 2px rgba(0,0,0,.1)}\n.info-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;color:" + _0x4d5f75 + "}\n.info-row b,.info-link{font-size:11px;color:" + _0x11ee49 + ";font-family:" + _0x3c142f + ";letter-spacing:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.info-link{background:none;border:none;padding:0;cursor:pointer;max-width:100%;text-align:right}\n.info-link:hover{text-decoration:underline;color:" + _0x11ee49 + "}\n.info-actions{display:flex;gap:5px;margin-top:2px}.info-actions .btn{flex:1}\n.login-card{position:relative;overflow:hidden;padding:14px;border-color:var(--vscode-focusBorder," + _0x37f073 + ");background:" + _0x21f85c + ";box-shadow:0 1px 2px rgba(0,0,0,.12)}\n.login-card::before,.login-card::after{display:none}\n@keyframes shine{0%,100%{transform:none}}\n.login-hero{position:relative;margin-bottom:13px;z-index:1}\n.login-kicker{display:inline-flex;align-items:center;gap:6px;margin-bottom:7px;padding:3px 8px;border-radius:999px;background:" + _0x5a2456 + ";border:1px solid " + _0x37f073 + ";color:" + _0x11ee49 + ";font-size:9px;font-weight:800;letter-spacing:0;text-transform:uppercase}\n.login-kicker::before{content:'';width:5px;height:5px;border-radius:999px;background:" + _0x11ee49 + "}\n.login-title{font-size:20px;font-weight:900;color:" + _0x4e0e10 + ";margin-bottom:4px;letter-spacing:0;text-shadow:none}\n.login-subtitle{font-size:10px;color:" + _0x4d5f75 + ";line-height:1.55;max-width:28em}\n.login-hint{font-size:10px;color:" + _0x4d5f75 + ";line-height:1.55;margin-top:9px;position:relative;z-index:1}\n.login-actions{position:relative;z-index:1;display:flex;gap:7px;margin-top:9px}\n.login-actions .btn{flex:1}\n.login-submit{height:40px;margin-top:2px;font-size:13px}\n.account-card{border-color:var(--vscode-focusBorder," + _0x37f073 + ");background:linear-gradient(135deg,color-mix(in srgb,var(--vscode-button-background,#0d9488) 10%," + _0x21f85c + ")," + _0x21f85c + ")}\n.account{display:flex;align-items:center;justify-content:space-between;gap:8px}\n.account-main{min-width:0;display:flex;align-items:center;gap:8px}\n.account-dot{width:9px;height:9px;border-radius:999px;background:var(--vscode-testing-iconPassed,#34d399);box-shadow:0 0 0 3px color-mix(in srgb,var(--vscode-testing-iconPassed,#34d399) 16%,transparent);flex:none}\n.account-meta{min-width:0}\n.account-name{font-size:13px;font-weight:800;color:" + _0x4e0e10 + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.account-sub{font-size:10px;color:" + _0x4d5f75 + ";margin-top:2px}\n.account-state{font-size:10px;color:" + _0x11ee49 + ";font-weight:700;margin-bottom:2px}\n.login-steps li{margin-bottom:1px}\n.instance-entry{width:100%;justify-content:space-between;min-height:34px}\n.instance-entry small{font-size:10px;color:" + _0x4d5f75 + ";font-weight:500}\n.instance-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}\n.instance-panel-title{font-size:13px;font-weight:800;color:" + _0x4e0e10 + "}\n.instance-list{display:flex;flex-direction:column;gap:5px;margin-top:7px;max-height:calc(100vh - 145px);overflow-y:auto;padding-right:2px}\n.instance-card{background:" + _0x5a2456 + ";border:1px solid " + _0x37f073 + ";border-radius:8px;padding:7px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center}\n.instance-main{min-width:0;display:flex;align-items:center;gap:6px}\n.instance-meta{min-width:0;display:flex;flex-direction:column;gap:1px}\n.instance-name{font-size:12px;font-weight:700;color:" + _0x4e0e10 + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.instance-sub{font-size:9px;color:" + _0x4d5f75 + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.instance-actions{display:flex;align-items:center;gap:4px}\n.empty-text{font-size:10px;color:" + _0x4d5f75 + ";line-height:1.45;padding:3px 0}\n.env-check{display:flex;flex-direction:column;gap:6px;margin:0 0 8px}\n.env-check-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;color:" + _0x4d5f75 + "}\n.env-check-list{display:flex;flex-direction:column;gap:5px}\n.env-check-item{border:1px solid " + _0x37f073 + ";border-radius:8px;background:rgba(255,255,255,.035);padding:7px}\n.env-check-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;font-weight:700;color:" + _0x4e0e10 + "}\n.env-check-detail{margin-top:4px;font-size:9px;color:" + _0x4d5f75 + ";line-height:1.35;word-break:break-all}\n.env-check-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}\n.env-check-probe{font-size:9px;color:" + _0x4d5f75 + ";line-height:1.35;word-break:break-all;margin-top:4px}\n.badge-error{background:#450a0a;color:#f87171}\n.patch-path{margin:0 0 8px;padding:6px 7px;border-radius:8px;background:rgba(255,255,255,.05);border:1px dashed rgba(94,234,212,.24);color:" + _0x4d5f75 + ";font-size:9px;line-height:1.35;word-break:break-all}\n.patch-path b{color:" + _0x11ee49 + ";font-weight:700}\n.guide-body{display:flex;flex-direction:column;gap:8px;color:" + _0x4d5f75 + ";font-size:10px;line-height:1.55}\n.guide-block{border:1px solid " + _0x37f073 + ";border-radius:8px;background:rgba(255,255,255,.035);padding:8px}\n.guide-block b{display:block;color:" + _0x4e0e10 + ";font-size:11px;margin-bottom:5px}\n.guide-block ol,.guide-block ul{padding-left:18px;margin:0}\n.guide-block li{margin:3px 0}\n.guide-code{display:block;background:" + _0x5a2456 + ";border:1px solid " + _0x37f073 + ";border-radius:6px;padding:5px 6px;margin-top:4px;color:" + _0x11ee49 + ";font-family:" + _0x3c142f + ";font-size:9px;line-height:1.45;word-break:break-all}\n.guide-note{border-left:2px solid " + _0x372c2d + ";padding-left:7px;color:" + _0x4d5f75 + "}\n</style>\n</head>\n<body>\n\n<div class=\"card\">\n    <div class=\"card-head between\">\n        <span class=\"toggle-section collapsed\" data-ws-toggle=\"tutorialBody\">使用教程</span>\n        <span class=\"badge badge-ok\">内置</span>\n    </div>\n    <div id=\"tutorialBody\" class=\"guide-body hidden\">\n        <div class=\"guide-block\">\n            <b>快速使用</b>\n            <ol>\n                <li>分别为 BYOK #1 / #2 填写 Base URL、API Key，加载模型并选择模型；Claude/GPT 可设置思考强度。</li>\n                <li>配置完成后点击一键启动。</li>\n                <li>补丁就绪后重载窗口；Windsurf 里分别使用 <code>Claude Opus 4 BYOK</code> 与 <code>Claude Opus 4 Thinking BYOK</code>。</li>\n            </ol>\n        </div>\n        <div class=\"guide-block\">\n            <b>日常使用</b>\n            <ul>\n                <li>只换 API Key 或模型：改完后点仅保存配置。</li>\n                <li>聊天没有走代理：重新安装补丁并重载窗口。</li>\n                <li>模型列表加载失败：检查 API Key、余额、网络和日志错误。</li>\n            </ul>\n        </div>\n        <div class=\"guide-note\">BYOK #1 对应 Windsurf 的 <code>Claude Opus 4 BYOK</code>；BYOK #2 对应 <code>Claude Opus 4 Thinking BYOK</code>。两套 API / 模型完全独立。</div>\n    </div>\n</div>\n\n<div id=\"mainPanel\" class=\"\">\n<!-- 步骤 1: 配置 & 启动 -->\n<div class=\"card\">\n    <div class=\"card-head between\">\n        <span>① 配置 & 启动</span>\n        <span id=\"proxyRunBadge\" class=\"badge " + (_0x50cb0e.running ? "badge-ok" : "badge-warn") + "\">" + (_0x50cb0e.running ? "运行中" : "已停止") + "</span>\n    </div>\n    <div id=\"configBody\">\n        <div class=\"guide-block\" style=\"margin-bottom:10px\">\n            <b>BYOK #1 · Claude Opus 4 BYOK</b>\n            <div class=\"fg\"><label>Base URL（可选）</label><input type=\"text\" id=\"cfgByok1Host\" value=\"" + _0xb1Host + "\" placeholder=\"例如 api-a.example.com\"></div>\n            <div class=\"fg\"><label>API Key</label><input type=\"password\" id=\"cfgByok1Key\" value=\"" + _0xb1Key + "\" placeholder=\"BYOK #1 API Key\" autocomplete=\"off\"></div>\n            <div class=\"row\" style=\"gap:6px;margin-bottom:6px\">\n                <select id=\"cfgByok1Model\" style=\"flex:1;font-size:12px;padding:5px 8px\">" + (_0xb1Model ? "<option value=\"" + _0xb1Model + "\" selected>" + _0xb1Model + "</option>" : "<option value=\"\" disabled selected>请先加载模型</option>") + "</select>\n                <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"fetchModels\" data-ws-slot=\"1\" style=\"padding:4px 8px\">加载模型</button>\n            </div>\n            <div class=\"fg\" id=\"cfgByok1ThinkingEffortRow\"><label id=\"cfgByok1ThinkingLabel\">" + esc(thinkingEffort_1.getThinkingIntensityHint(thinkingEffort_1.detectModelProvider(_0xb1Model))) + "</label><select id=\"cfgByok1ThinkingEffort\">" + buildThinkingEffortOptions(_0xb1Model, _0xb1Effort) + "</select></div>\n            <div id=\"modelFetchStatus1\" style=\"font-size:10px;color:" + _0x560479 + "\"></div>\n        </div>\n        <div class=\"guide-block\" style=\"margin-bottom:10px\">\n            <b>BYOK #2 · Claude Opus 4 Thinking BYOK</b>\n            <div class=\"fg\"><label>Base URL（可选）</label><input type=\"text\" id=\"cfgByok2Host\" value=\"" + _0xb2Host + "\" placeholder=\"例如 api-b.example.com\"></div>\n            <div class=\"fg\"><label>API Key</label><input type=\"password\" id=\"cfgByok2Key\" value=\"" + _0xb2Key + "\" placeholder=\"BYOK #2 API Key\" autocomplete=\"off\"></div>\n            <div class=\"row\" style=\"gap:6px;margin-bottom:6px\">\n                <select id=\"cfgByok2Model\" style=\"flex:1;font-size:12px;padding:5px 8px\">" + (_0xb2Model ? "<option value=\"" + _0xb2Model + "\" selected>" + _0xb2Model + "</option>" : "<option value=\"\" disabled selected>请先加载模型</option>") + "</select>\n                <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"fetchModels\" data-ws-slot=\"2\" style=\"padding:4px 8px\">加载模型</button>\n            </div>\n            <div class=\"fg\" id=\"cfgByok2ThinkingEffortRow\"><label id=\"cfgByok2ThinkingLabel\">" + esc(thinkingEffort_1.getThinkingIntensityHint(thinkingEffort_1.detectModelProvider(_0xb2Model))) + "</label><select id=\"cfgByok2ThinkingEffort\">" + buildThinkingEffortOptions(_0xb2Model, _0xb2Effort) + "</select></div>\n            <div id=\"modelFetchStatus2\" style=\"font-size:10px;color:" + _0x560479 + "\"></div>\n        </div>\n        <!-- hidden config fields -->\n        <input type=\"hidden\" id=\"cfgApiMode\" value=\"unified_custom\">\n        <input type=\"hidden\" id=\"cfgAnthropicPath\" value=\"" + esc(_0x103996.ANTHROPIC_API_PATH || "/v1/messages") + "\">\n        <input type=\"hidden\" id=\"cfgOpenaiPath\" value=\"" + esc(_0x103996.OPENAI_API_PATH || "/v1/responses") + "\">\n        <input type=\"hidden\" id=\"cfgMaxTokens\" value=\"" + esc(_0x103996.MAX_TOKENS || "16384") + "\">\n        <input type=\"hidden\" id=\"cfgCompletionTimeoutMs\" value=\"" + esc(_0x103996.COMPLETION_TIMEOUT_MS || "12000") + "\">\n        <input type=\"hidden\" id=\"cfgSysPromptOverride\" value=\"" + (_0x2d552d ? "true" : "") + "\">\n        <input type=\"hidden\" id=\"cfgSysPromptPath\" value=\"" + esc(_0x1526d8) + "\">\n        <div class=\"row between\" style=\"margin-bottom:8px;padding:6px 8px;border:1px solid " + _0x37f073 + ";border-radius:8px;background:rgba(255,255,255,.02)\">\n            <div style=\"min-width:0\">\n                <div style=\"font-size:10px;color:#a1a1aa;font-weight:600\">提示词</div>\n                <div style=\"font-size:9px;color:" + _0x560479 + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">" + (_0x2d552d ? "已启用 · " + esc(_0x1526d8) : "未启用 · 使用 Devin Desktop 原始提示词") + "</div>\n            </div>\n            <div class=\"row\" style=\"gap:4px;flex-shrink:0\">\n                <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"openPromptTemplates\" style=\"padding:4px 8px\">模板</button>\n                <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"openSystemPrompt\" style=\"padding:4px 8px\">自定义</button>\n            </div>\n        </div>\n        <input type=\"hidden\" id=\"cfgDefaultModelCustom\" value=\"\">\n        <div class=\"row\" style=\"gap:6px;margin-bottom:10px\">\n            <div class=\"fg\" style=\"flex:1;margin-bottom:0\">\n                <label>Hybrid 端口</label>\n                <input type=\"number\" id=\"cfgHybridPort\" value=\"" + esc(String(_0x50cb0e.hybridPort)) + "\" placeholder=\"3006\" min=\"1\" max=\"65535\">\n            </div>\n            <div class=\"fg\" style=\"flex:1;margin-bottom:0\">\n                <label>Inference 端口</label>\n                <input type=\"number\" id=\"cfgInferencePort\" value=\"" + esc(String(_0x50cb0e.inferencePort)) + "\" placeholder=\"3001\" min=\"1\" max=\"65535\">\n            </div>\n        </div>\n        <div class=\"btns\" style=\"margin-bottom:8px\" id=\"proxyControlButtons\">\n            " + (_0x50cb0e.running ? "<button type=\"button\" class=\"btn btn-d\" data-ws-action=\"stopProxy\">停止代理</button>" : "<button type=\"button\" class=\"btn btn-p\" data-ws-action=\"startProxy\" data-ws-mode=\"both\">一键启动</button>") + "\n            <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"saveConfig\">仅保存配置</button>\n            <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"maintenanceTools\">维护工具</button>\n        </div>\n        <div id=\"environmentCheckResult\" class=\"env-check hidden\"></div>\n        <div class=\"row between\" style=\"margin-bottom:4px\">\n            <div class=\"row\">\n                <span style=\"font-size:11px;color:" + _0x4d5f75 + "\">自动启动</span>\n                <label class=\"tog\"><input type=\"checkbox\" id=\"cfgAutoStartProxy\" " + (_0xf1598f ? "checked" : "") + "><span></span></label>\n            </div>\n            <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"newWindow\" style=\"font-size:10px;padding:3px 8px\">新窗口</button>\n        </div>\n        <div id=\"proxyActionState\" class=\"action-state hidden\">\n            <div id=\"proxyActionText\" class=\"action-text\"></div>\n            <div class=\"action-progress\"><div class=\"action-progress-bar\"></div></div>\n        </div>\n        <div id=\"configActionState\" class=\"action-state hidden\">\n            <div id=\"configActionText\" class=\"action-text\"></div>\n            <div class=\"action-progress\"><div class=\"action-progress-bar\"></div></div>\n        </div>\n    </div>\n</div>\n\n<!-- 步骤 2: 运行状态 -->\n<div class=\"card\">\n    <div class=\"card-head\" id=\"proxyStatusTitle\">② 运行状态</div>\n    <div class=\"stats\">\n        <div class=\"st\"><b id=\"statPort\">" + _0x50cb0e.hybridPort + "</b><small>端口</small></div>\n        <div class=\"st\"><b id=\"statUptime\">" + (_0x50cb0e.running ? formatUptime(_0x50cb0e.uptime) : "--") + "</b><small>时长</small></div>\n        <div class=\"st\"><b id=\"statRequests\">" + _0x50cb0e.requestCount + "</b><small>请求</small></div>\n    </div>\n</div>\n\n<!-- 步骤 3: 补丁管理 -->\n<div class=\"card\">\n    <div class=\"card-head between\">\n        <span>③ 补丁管理</span>\n        <span id=\"patchBadge\" class=\"badge " + _0x216d28 + "\">" + _0x3a632d + "</span>\n    </div>\n    <input type=\"hidden\" id=\"patchApiUrl\" value=\"" + esc(_0x5af368) + "\">\n    <input type=\"hidden\" id=\"patchInferenceUrl\" value=\"" + esc(_0x261671) + "\">\n    <div id=\"patchPathDisplay\" class=\"patch-path\">" + (_0x117c6c ? "<b>补丁路径</b> " + esc(_0x117c6c) : "<b>补丁路径</b> 自动检测；非默认安装请点“选择路径”") + "</div>\n    <div class=\"btns\" style=\"margin-bottom:6px\">\n        <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"locateExtJs\">选择路径</button>\n        <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"clearExtJsPath\">自动检测</button>\n        <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"refreshPatchStatus\">刷新状态</button>\n    </div>\n    <div class=\"btns\" id=\"patchActionButtons\">\n        <button type=\"button\" class=\"btn btn-p sm\" data-ws-action=\"applyPatch\">安装补丁</button>\n        <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"revertPatch\">还原</button>\n    </div>\n    <div id=\"patchActionState\" class=\"action-state hidden\">\n        <div id=\"patchActionText\" class=\"action-text\"></div>\n        <div class=\"action-progress\"><div class=\"action-progress-bar\"></div></div>\n    </div>\n</div>\n\n<!-- 日志 -->\n<div class=\"card\">\n    <div class=\"card-head between\">\n        <span class=\"toggle-section\" data-ws-toggle=\"logBody\">日志</span>\n        <button type=\"button\" class=\"btn btn-s sm\" data-ws-action=\"copyLogs\" style=\"font-size:10px;padding:3px 6px\">复制</button>\n    </div>\n    <div id=\"logBody\">\n        <div class=\"log-box\" id=\"logBox\">" + _0x4f6817 + "</div>\n        <div id=\"copyToast\" style=\"display:none;text-align:center;color:#34d399;font-size:10px;margin-top:4px\">已复制</div>\n    </div>\n</div>\n\n</div>\n\n<script nonce=\"" + _0xce874c + "\" src=\"" + _0x404c7a + "\"></script>\n</body>\n</html>";
  }
}
exports.SidebarProvider = SidebarProvider;
function buildThinkingEffortOptions(_0xmodel, _0xcurrent) {
  return thinkingEffort_1.buildThinkingEffortOptionsHtml(_0xmodel, _0xcurrent);
}
function esc(_0x1d1cb3) {
  const _0x28705 = String(_0x1d1cb3 ?? "");
  return _0x28705.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function stripProtoServer(_0x142742) {
  return _0x142742.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
function formatUptime(_0x249208) {
  const _0x551749 = Math.floor(_0x249208 / 1000);
  if (_0x551749 < 60) {
    return _0x551749 + "s";
  }
  const _0x5bd319 = Math.floor(_0x551749 / 60);
  if (_0x5bd319 < 60) {
    return _0x5bd319 + "m";
  }
  return Math.floor(_0x5bd319 / 60) + "h" + _0x5bd319 % 60 + "m";
}
