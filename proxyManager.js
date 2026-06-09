'use strict';

var __createBinding = this && this.__createBinding || (Object.create ? function (_0x3502e1, _0x31adb8, _0x42ebe5, _0x52c843 = _0x42ebe5) {
  var _0x1da70d = Object.getOwnPropertyDescriptor(_0x31adb8, _0x42ebe5);
  if (!_0x1da70d || ("get" in _0x1da70d ? !_0x31adb8.__esModule : _0x1da70d.writable || _0x1da70d.configurable)) {
    const _0x5479eb = {
      enumerable: true,
      get: function () {
        return _0x31adb8[_0x42ebe5];
      }
    };
    _0x1da70d = _0x5479eb;
  }
  Object.defineProperty(_0x3502e1, _0x52c843, _0x1da70d);
} : function (_0x2e3a08, _0x571153, _0x1e8293, _0x1a3d5f = _0x1e8293) {
  _0x2e3a08[_0x1a3d5f] = _0x571153[_0x1e8293];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function (_0x508ac7, _0x1ea8ab) {
  const _0xede601 = {
    enumerable: true,
    value: _0x1ea8ab
  };
  Object.defineProperty(_0x508ac7, "default", _0xede601);
} : function (_0x54f7c8, _0x102e10) {
  _0x54f7c8.default = _0x102e10;
});
var __importStar = this && this.__importStar || function () {
  function _0x182794(_0x480b2d) {
    _0x182794 = Object.getOwnPropertyNames || function (_0x22e2c1) {
      var _0x12f494 = [];
      for (var _0x3835e5 in _0x22e2c1) {
        if (Object.prototype.hasOwnProperty.call(_0x22e2c1, _0x3835e5)) {
          _0x12f494[_0x12f494.length] = _0x3835e5;
        }
      }
      return _0x12f494;
    };
    return _0x182794(_0x480b2d);
  }
  return function (_0x5c7bfe) {
    if (_0x5c7bfe && _0x5c7bfe.__esModule) {
      return _0x5c7bfe;
    }
    var _0x137bc7 = {};
    if (_0x5c7bfe != null) {
      for (var _0x48956b = _0x182794(_0x5c7bfe), _0x103a32 = 0; _0x103a32 < _0x48956b.length; _0x103a32++) {
        if (_0x48956b[_0x103a32] !== "default") {
          __createBinding(_0x137bc7, _0x5c7bfe, _0x48956b[_0x103a32]);
        }
      }
    }
    __setModuleDefault(_0x137bc7, _0x5c7bfe);
    return _0x137bc7;
  };
}();
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProxyManager = undefined;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
const http = __importStar(require("http"));
const http2 = __importStar(require("http2"));
const KEY_HTTP_PROXY_BACKUP = "windsurf-byok-bridge.httpProxyBackup";
class ProxyManager {
  parsePort(_0x36321f, _0x5b0ff5) {
    const _0x5de7bc = Number.parseInt(String(_0x36321f || ""), 10);
    if (Number.isInteger(_0x5de7bc) && _0x5de7bc > 0 && _0x5de7bc <= 65535) {
      return _0x5de7bc;
    } else {
      return _0x5b0ff5;
    }
  }
  getHybridPort(_0x3acb94) {
    return this.parsePort(_0x3acb94?.HYBRID_PORT, 3006);
  }
  getInferencePort(_0x4a52e1) {
    return this.parsePort(_0x4a52e1?.INFERENCE_PORT, 3001);
  }
  async ensureWindsurfHttpProxySettings(_0x1f217e) {
    await this.restoreWindsurfHttpProxySettings();
    this.log("已跳过全局 http.proxy 同步；Windsurf API 请求仅通过补丁指向 http://localhost:" + _0x1f217e);
  }
  async restoreWindsurfHttpProxySettings() {
    const _0x34e78b = this.context.globalState.get(KEY_HTTP_PROXY_BACKUP);
    if (!_0x34e78b) {
      return;
    }
    const _0x3a7e95 = vscode.workspace.getConfiguration("http");
    const _0x3b4c5d = _0x3a7e95.get("proxy") || "";
    if (_0x3b4c5d !== _0x34e78b.managedProxy) {
      return;
    }
    await _0x3a7e95.update("proxy", _0x34e78b.hadProxy ? _0x34e78b.proxy : undefined, vscode.ConfigurationTarget.Global);
    await _0x3a7e95.update("proxyStrictSSL", _0x34e78b.hadProxyStrictSSL ? _0x34e78b.proxyStrictSSL : undefined, vscode.ConfigurationTarget.Global);
    await this.context.globalState.update(KEY_HTTP_PROXY_BACKUP, undefined);
    this.log("已恢复 Windsurf HTTP 代理设置");
  }
  portsFromConfig(_0x1950b6) {
    return {
      hybridPort: this.getHybridPort(_0x1950b6),
      inferencePort: this.getInferencePort(_0x1950b6)
    };
  }
  constructor(_0x387ead, _0x1a7347 = "", _0x401e1b = "0.0.0") {
    this.context = _0x387ead;
    this.hybridProcess = null;
    this.inferenceProcess = null;
    this.startTime = 0;
    this.requestCount = 0;
    this.logCallback = null;
    this.autoRestart = true;
    this.restartCount = 0;
    this.externalProxy = false;
    this.lastStartError = "";
    this.lastStartWarning = "";
    this.deviceId = _0x1a7347;
    this.clientVersion = _0x401e1b;
    this.proxyRoot = this.findProxyRoot();
    this.migrateLegacyEnvIfNeeded();
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = "windsurf-byok-bridge.startProxy";
    this.updateStatusBar();
    this.statusBar.show();
    _0x387ead.subscriptions.push(this.statusBar);
    this.refreshExternalProxyStatus();
  }
  updateStatusBar() {
    const _0x5df649 = this.readEnvConfig();
    const _0x38820f = this.getHybridPort(_0x5df649);
    if (this.hybridProcess || this.externalProxy) {
      const _0xcf2ece = this.externalProxy ? "(共享)" : "";
      this.statusBar.text = "$(cloud) BYOK Bridge: 运行中" + _0xcf2ece;
      this.statusBar.tooltip = this.externalProxy ? "代理运行中 | 端口 " + _0x38820f + " | 来自其他窗口" : "Port " + _0x38820f + " | PID " + this.hybridProcess?.pid + " | " + this.requestCount + " 请求";
      this.statusBar.command = "windsurf-byok-bridge.stopProxy";
    } else {
      this.statusBar.text = "$(cloud) BYOK Bridge: 已停止";
      this.statusBar.tooltip = "点击启动代理 (Port " + _0x38820f + ")";
      this.statusBar.command = "windsurf-byok-bridge.startProxy";
    }
  }
  findProxyRoot() {
    const _0x59b784 = this.context.extensionPath;
    const _0x499912 = path.dirname(_0x59b784);
    if (fs.existsSync(path.join(_0x499912, "src", "hybrid-server.js"))) {
      return _0x499912;
    }
    const _0x4d7773 = this.getBundledProxyRoot();
    if (_0x4d7773) {
      return _0x4d7773;
    }
    const _0x25482e = this.findWorkspaceProxyRoot();
    if (_0x25482e) {
      return _0x25482e;
    }
    return _0x59b784;
  }
  findWorkspaceProxyRoot() {
    for (const _0x198c80 of vscode.workspace.workspaceFolders || []) {
      const _0x2060c0 = path.join(_0x198c80.uri.fsPath, "src", "hybrid-server.js");
      if (fs.existsSync(_0x2060c0)) {
        return _0x198c80.uri.fsPath;
      }
      const _0x5a1c2b = path.join(_0x198c80.uri.fsPath, "proxy-scripts", "src", "hybrid-server.js");
      if (fs.existsSync(_0x5a1c2b)) {
        return path.join(_0x198c80.uri.fsPath, "proxy-scripts");
      }
      for (const _0x4f8e1d of ["windsurf-byok-bridge", "windsurf-proxy"]) {
        const _0x374bd9 = path.join(_0x198c80.uri.fsPath, _0x4f8e1d, "proxy-scripts", "src", "hybrid-server.js");
        if (fs.existsSync(_0x374bd9)) {
          return path.join(_0x198c80.uri.fsPath, _0x4f8e1d, "proxy-scripts");
        }
        const _0x2c9f11 = path.join(_0x198c80.uri.fsPath, _0x4f8e1d, "src", "hybrid-server.js");
        if (fs.existsSync(_0x2c9f11)) {
          return path.join(_0x198c80.uri.fsPath, _0x4f8e1d);
        }
      }
    }
    return undefined;
  }
  getBundledProxyRoot() {
    const _0x41a7d7 = this.context.extensionPath;
    const _0x2c6b0c = path.join(_0x41a7d7, "proxy-scripts", "src", "hybrid-server.js");
    if (fs.existsSync(_0x2c6b0c)) {
      return path.join(_0x41a7d7, "proxy-scripts");
    }
    return undefined;
  }
  migrateLegacyEnvIfNeeded() {
    const _0x3c29da = this.getBundledProxyRoot();
    if (!_0x3c29da || this.proxyRoot !== _0x3c29da) {
      return;
    }
    const _0xf8b751 = path.join(_0x3c29da, ".env");
    if (fs.existsSync(_0xf8b751)) {
      return;
    }
    const _0x3b8285 = this.findWorkspaceProxyRoot();
    if (!_0x3b8285 || _0x3b8285 === _0x3c29da) {
      return;
    }
    const _0x53af75 = path.join(_0x3b8285, ".env");
    if (!fs.existsSync(_0x53af75)) {
      return;
    }
    try {
      fs.copyFileSync(_0x53af75, _0xf8b751);
      console.log("[Windsurf BYOK Bridge] 已迁移旧配置: " + _0x53af75 + " -> " + _0xf8b751);
    } catch (_0x25561d) {
      const _0x319444 = _0x25561d instanceof Error ? _0x25561d.message : String(_0x25561d);
      console.log("[Windsurf BYOK Bridge] 迁移旧配置失败: " + _0x319444);
    }
  }
  onLog(_0x13fec2) {
    this.logCallback = _0x13fec2;
  }
  log(_0x1650ed) {
    console.log("[Windsurf BYOK Bridge] " + _0x1650ed);
    this.logCallback?.("[" + new Date().toLocaleTimeString() + "] " + _0x1650ed);
  }
  getLastStartError() {
    return this.lastStartError;
  }
  getLastStartWarning() {
    return this.lastStartWarning;
  }
  clearStartMessages() {
    this.lastStartError = "";
    this.lastStartWarning = "";
  }
  setStartError(_0x5ec2b) {
    this.lastStartError = _0x5ec2b;
    this.log(_0x5ec2b);
    vscode.window.showWarningMessage(_0x5ec2b);
  }
  setStartWarning(_0x45a4fd) {
    this.lastStartWarning = _0x45a4fd;
    this.log(_0x45a4fd);
    vscode.window.showWarningMessage(_0x45a4fd);
  }
  async isPortAvailable(_0x328ef8) {
    return new Promise(_0x476d85 => {
      const _0x186bf2 = net.createServer();
      _0x186bf2.once("error", () => _0x476d85(false));
      _0x186bf2.once("listening", () => {
        _0x186bf2.close();
        _0x476d85(true);
      });
      _0x186bf2.listen(_0x328ef8, "127.0.0.1");
    });
  }
  async findAvailablePort(_0x58ac84, _0x592b3a = []) {
    const _0xbdb8b8 = new Set(_0x592b3a);
    for (let _0x3bc87e = 0; _0x3bc87e < 100; _0x3bc87e++) {
      const _0x47fb80 = _0x58ac84 + _0x3bc87e;
      if (_0x47fb80 > 65535) {
        return undefined;
      }
      if (_0xbdb8b8.has(_0x47fb80)) {
        continue;
      }
      if (await this.isPortAvailable(_0x47fb80)) {
        return _0x47fb80;
      }
    }
    return undefined;
  }
  async canConnectToPort(_0x47aefb, _0x4162ca) {
    return new Promise(_0x32b2c7 => {
      const _0x52f42b = {
        port: _0x47aefb,
        host: _0x4162ca
      };
      const _0x54be5d = net.connect(_0x52f42b);
      const _0x4fd5c2 = _0x314eaf => {
        _0x54be5d.removeAllListeners();
        if (!_0x54be5d.destroyed) {
          _0x54be5d.destroy();
        }
        _0x32b2c7(_0x314eaf);
      };
      _0x54be5d.setTimeout(300);
      _0x54be5d.once("connect", () => _0x4fd5c2(true));
      _0x54be5d.once("timeout", () => _0x4fd5c2(false));
      _0x54be5d.once("error", () => _0x4fd5c2(false));
    });
  }
  async isPortReachable(_0x5e677c) {
    for (const _0x1fa67e of ["localhost", "127.0.0.1", "::1"]) {
      if (await this.canConnectToPort(_0x5e677c, _0x1fa67e)) {
        return true;
      }
    }
    return false;
  }
  getListeningPids(_0x2c6568) {
    if (process.platform !== "win32") {
      return [];
    }
    try {
      const _0x58ecb4 = (0, child_process_1.execFileSync)("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-NetTCPConnection -LocalPort " + _0x2c6568 + " -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 2500
      });
      return Array.from(new Set(_0x58ecb4.split(/\r?\n/).map(_0x51d9ae => Number.parseInt(_0x51d9ae.trim(), 10)).filter(_0x522ee0 => Number.isInteger(_0x522ee0) && _0x522ee0 > 0)));
    } catch {
      return [];
    }
  }
  getPortOccupantDetail(_0x2a28aa) {
    const _0x4d8252 = this.getListeningPids(_0x2a28aa);
    if (_0x4d8252.length === 0) {
      return "";
    }
    if (process.platform !== "win32") {
      return _0x4d8252.map(_0x10b581 => "PID " + _0x10b581).join(", ");
    }
    try {
      const _0x4b32dd = (0, child_process_1.execFileSync)("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "$pids=@(" + _0x4d8252.join(",") + "); Get-CimInstance Win32_Process | Where-Object { $pids -contains $_.ProcessId } | ForEach-Object { \"$($_.ProcessId) $($_.Name)\" }"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 2500
      });
      const _0x18f56c = _0x4b32dd.split(/\r?\n/).map(_0x54553b => _0x54553b.trim()).filter(Boolean);
      if (_0x18f56c.length > 0) {
        return _0x18f56c.join("; ");
      }
    } catch {}
    return _0x4d8252.map(_0x28d021 => "PID " + _0x28d021).join(", ");
  }
  killProcessTree(_0x5ebae8, _0xb7601d) {
    if (!_0x5ebae8) {
      return;
    }
    try {
      if (process.platform === "win32") {
        (0, child_process_1.execFileSync)("taskkill.exe", ["/PID", String(_0x5ebae8), "/T", "/F"], {
          windowsHide: true,
          timeout: 3000,
          stdio: "ignore"
        });
      } else {
        process.kill(_0x5ebae8, "SIGTERM");
      }
      this.log(_0xb7601d + " 进程已结束 (PID " + _0x5ebae8 + ")");
    } catch (_0x58d58e) {
      const _0x79242d = _0x58d58e instanceof Error ? _0x58d58e.message : String(_0x58d58e);
      this.log(_0xb7601d + " 进程结束失败 (PID " + _0x5ebae8 + "): " + _0x79242d);
    }
  }
  killListeningPort(_0x4e4f6e, _0x3dedcd) {
    const _0x599888 = this.getListeningPids(_0x4e4f6e);
    for (const _0x20ae47 of _0x599888) {
      this.killProcessTree(_0x20ae47, _0x3dedcd + " 端口 " + _0x4e4f6e);
    }
    if (_0x599888.length === 0) {
      this.log(_0x3dedcd + " 端口 " + _0x4e4f6e + " 未发现监听进程");
    }
  }
  async waitForPortBound(_0x4afc92, _0x58fdaf, _0x2c0d8f, _0x29c904 = 5000, _0x16dd44) {
    const _0x251696 = {
      RxkxA: function (_0x4a801d, _0x1e4e5a) {
        return _0x4a801d(_0x1e4e5a);
      },
      YLyYE: function (_0xc0c8f6, _0x11141f) {
        return _0xc0c8f6 instanceof _0x11141f;
      },
      mMOXw: function (_0x29401c, _0x3b8a65) {
        return _0x29401c < _0x3b8a65;
      },
      Lrati: function (_0x514cdd, _0x24f248) {
        return _0x514cdd !== _0x24f248;
      },
      gMUYr: "Etnfl",
      sZyIR: function (_0x9ea6fe) {
        return _0x9ea6fe?.();
      },
      uFDKW: "uwmfT",
      EgtfX: "argXt"
    };
    const _0x3d27e3 = Date.now();
    while (_0x251696.mMOXw(Date.now() - _0x3d27e3, _0x29c904)) {
      if (_0x251696.Lrati(_0x58fdaf.exitCode, null)) {
        if (_0x251696.gMUYr === "Etnfl") {
          this.log(_0x2c0d8f + " 启动失败，进程已退出 (code: " + _0x58fdaf.exitCode + ")");
          return false;
        } else {
          _0x251696.RxkxA(_0x37080e, new _0x2b75e5("HTTP " + _0x34f96d + ": " + _0x18a908.slice(0, 200)));
          return;
        }
      }
      if (_0x251696.sZyIR(_0x16dd44)) {
        return true;
      }
      if (await this.isPortReachable(_0x4afc92)) {
        return true;
      }
      await new Promise(_0x21c69a => setTimeout(_0x21c69a, 150));
    }
    if (_0x16dd44?.()) {
      if (_0x251696.uFDKW === _0x251696.EgtfX) {
        const _0x4327f7 = _0x251696.YLyYE(_0x5a3013, _0x4ef8bd) ? _0x3d8e87.message : _0x251696.RxkxA(_0x28291d, _0x2a58b7);
        _0x129e2b.errors.push("inference: " + _0x4327f7);
      } else {
        return true;
      }
    }
    this.log(_0x2c0d8f + " 启动超时，端口 " + _0x4afc92 + " 未就绪");
    return false;
  }
  getEnvFilePath() {
    return path.join(this.proxyRoot, ".env");
  }
  getProxyRootPath() {
    return this.proxyRoot;
  }
  readEnvConfig() {
    const _0x32e276 = this.getEnvFilePath();
    const _0x182145 = {};
    if (!fs.existsSync(_0x32e276)) {
      return _0x182145;
    }
    const _0x59b6cb = fs.readFileSync(_0x32e276, "utf-8").split("\n");
    for (const _0x2962ab of _0x59b6cb) {
      const _0xc50ad2 = _0x2962ab.trim();
      if (!_0xc50ad2 || _0xc50ad2.startsWith("#")) {
        continue;
      }
      const _0x325df2 = _0xc50ad2.indexOf("=");
      if (_0x325df2 <= 0) {
        continue;
      }
      const _0x472f92 = _0xc50ad2.slice(0, _0x325df2).trim();
      const _0x1b6e3d = _0xc50ad2.slice(_0x325df2 + 1).trim();
      _0x182145[_0x472f92] = _0x1b6e3d;
    }
    if (_0x182145.SYSTEM_PROMPT_PATH !== undefined) {
      _0x182145.SYSTEM_PROMPT_PATH = this.getSystemPromptConfigPath(_0x182145);
    }
    const _legacy = String.fromCharCode(90, 87, 72, 95);
    for (const _k of Object.keys(_0x182145)) {
      if (_k.startsWith(_legacy)) {
        delete _0x182145[_k];
      }
    }
    return _0x182145;
  }
  stripProtocol(_0x427c33) {
    return _0x427c33.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }
  normalizeSystemPromptPathValue(_0x3cf4f0) {
    const _0x5dc79d = _0x3cf4f0.trim();
    if (!_0x5dc79d) {
      return "./prompts/system-prompt.md";
    }
    if (!path.isAbsolute(_0x5dc79d)) {
      return _0x5dc79d;
    }
    const _0x32ddbe = path.normalize(_0x5dc79d);
    const _0xcb9406 = path.normalize(path.join(this.proxyRoot, "prompts", "system-prompt.md"));
    if (_0x32ddbe === _0xcb9406) {
      return "./prompts/system-prompt.md";
    }
    const _0x1fb93c = this.findWorkspaceProxyRoot();
    if (_0x1fb93c) {
      const _0xe30a68 = path.normalize(path.join(_0x1fb93c, "prompts", "system-prompt.md"));
      if (_0x32ddbe === _0xe30a68) {
        return "./prompts/system-prompt.md";
      }
    }
    return _0x5dc79d;
  }
  getCompletionTimeoutMs(_0x5cb2c8) {
    const _0x1b2c28 = Number.parseInt(String(_0x5cb2c8.COMPLETION_TIMEOUT_MS || ""), 10);
    if (!Number.isInteger(_0x1b2c28) || _0x1b2c28 < 2000) {
      return 12000;
    }
    return Math.min(_0x1b2c28, 60000);
  }
  getSystemPromptConfigPath(_0x275659) {
    const _0x25b638 = (_0x275659?.SYSTEM_PROMPT_PATH || "").trim();
    return this.normalizeSystemPromptPathValue(_0x25b638);
  }
  getResolvedSystemPromptPath(_0x392b7a) {
    const _0x2fb5d3 = this.getSystemPromptConfigPath(_0x392b7a);
    if (path.isAbsolute(_0x2fb5d3)) {
      return _0x2fb5d3;
    }
    return path.normalize(path.join(this.proxyRoot, _0x2fb5d3));
  }
  writeEnvConfig(_0x10f933) {
    const _0x21ad5b = this.getEnvFilePath();
    const _0x8b3570 = this.readEnvConfig();
    const _0x5bca7d = new Set(["ANTHROPIC_API_HOST", "ANTHROPIC_API_KEY", "ANTHROPIC_API_PATH", "OPENAI_API_HOST", "OPENAI_API_KEY", "OPENAI_API_PATH", "HYBRID_PORT", "INFERENCE_PORT", "DEFAULT_MODEL", "MAX_TOKENS", "OPENAI_REASONING_EFFORT", "OPENAI_THINKING_ENABLED", "COMPLETION_TIMEOUT_MS", "SYSTEM_PROMPT_OVERRIDE", "SYSTEM_PROMPT_PATH", "BYOK1_ANTHROPIC_API_HOST", "BYOK1_ANTHROPIC_API_KEY", "BYOK1_ANTHROPIC_API_PATH", "BYOK1_OPENAI_API_HOST", "BYOK1_OPENAI_API_KEY", "BYOK1_OPENAI_API_PATH", "BYOK1_MODEL", "BYOK1_THINKING_EFFORT", "BYOK2_ANTHROPIC_API_HOST", "BYOK2_ANTHROPIC_API_KEY", "BYOK2_ANTHROPIC_API_PATH", "BYOK2_OPENAI_API_HOST", "BYOK2_OPENAI_API_KEY", "BYOK2_OPENAI_API_PATH", "BYOK2_MODEL", "BYOK2_THINKING_EFFORT"]);
    const _0x22e545 = Object.entries(_0x8b3570).filter(([_0x1fbc86]) => !_0x5bca7d.has(_0x1fbc86) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(_0x1fbc86)).map(([_0x548624, _0xf5e4e2]) => _0x548624 + "=" + _0xf5e4e2);
    const _0x35a380 = this.getSystemPromptConfigPath(_0x10f933);
    const _0x11e587 = ["# Windsurf BYOK Bridge 配置（由扩展管理）"];
    const _0xappendByok = (_0x736c12, _0x4e7f21) => {
      const _0x1e8039 = _0x10f933[_0x736c12 + "ANTHROPIC_API_HOST"] ? this.stripProtocol(_0x10f933[_0x736c12 + "ANTHROPIC_API_HOST"]) : "";
      _0x11e587.push("", "# ─── " + _0x4e7f21 + " ───");
      _0x11e587.push(_0x736c12 + "ANTHROPIC_API_HOST=" + _0x1e8039);
      _0x11e587.push(_0x736c12 + "ANTHROPIC_API_KEY=" + (_0x10f933[_0x736c12 + "ANTHROPIC_API_KEY"] || ""));
      if (_0x10f933[_0x736c12 + "ANTHROPIC_API_PATH"]) {
        _0x11e587.push(_0x736c12 + "ANTHROPIC_API_PATH=" + _0x10f933[_0x736c12 + "ANTHROPIC_API_PATH"]);
      }
      const _0x29301d = _0x10f933[_0x736c12 + "OPENAI_API_HOST"] ? this.stripProtocol(_0x10f933[_0x736c12 + "OPENAI_API_HOST"]) : _0x1e8039;
      _0x11e587.push(_0x736c12 + "OPENAI_API_HOST=" + _0x29301d);
      _0x11e587.push(_0x736c12 + "OPENAI_API_KEY=" + (_0x10f933[_0x736c12 + "OPENAI_API_KEY"] || _0x10f933[_0x736c12 + "ANTHROPIC_API_KEY"] || ""));
      if (_0x10f933[_0x736c12 + "OPENAI_API_PATH"]) {
        _0x11e587.push(_0x736c12 + "OPENAI_API_PATH=" + _0x10f933[_0x736c12 + "OPENAI_API_PATH"]);
      }
      _0x11e587.push(_0x736c12 + "MODEL=" + (_0x10f933[_0x736c12 + "MODEL"] || ""));
      _0x11e587.push(_0x736c12 + "THINKING_EFFORT=" + (_0x10f933[_0x736c12 + "THINKING_EFFORT"] || ""));
    };
    _0xappendByok("BYOK1_", "BYOK #1 · Claude Opus 4 BYOK");
    _0xappendByok("BYOK2_", "BYOK #2 · Claude Opus 4 Thinking BYOK");
    const _0x1e8039 = _0x10f933.BYOK1_ANTHROPIC_API_HOST ? this.stripProtocol(_0x10f933.BYOK1_ANTHROPIC_API_HOST) : _0x10f933.ANTHROPIC_API_HOST ? this.stripProtocol(_0x10f933.ANTHROPIC_API_HOST) : "";
    const _0x29301d = _0x10f933.BYOK1_OPENAI_API_HOST ? this.stripProtocol(_0x10f933.BYOK1_OPENAI_API_HOST) : _0x10f933.OPENAI_API_HOST ? this.stripProtocol(_0x10f933.OPENAI_API_HOST) : _0x1e8039;
    const _0x4f8c12 = _0x10f933.BYOK1_MODEL || _0x10f933.DEFAULT_MODEL || "";
    _0x11e587.push("", "# ─── 兼容 / 补全（镜像 BYOK #1）───", "ANTHROPIC_API_HOST=" + _0x1e8039, "ANTHROPIC_API_KEY=" + (_0x10f933.BYOK1_ANTHROPIC_API_KEY || _0x10f933.ANTHROPIC_API_KEY || ""));
    if (_0x10f933.BYOK1_ANTHROPIC_API_PATH || _0x10f933.ANTHROPIC_API_PATH) {
      _0x11e587.push("ANTHROPIC_API_PATH=" + (_0x10f933.BYOK1_ANTHROPIC_API_PATH || _0x10f933.ANTHROPIC_API_PATH));
    }
    _0x11e587.push("OPENAI_API_HOST=" + _0x29301d, "OPENAI_API_KEY=" + (_0x10f933.BYOK1_OPENAI_API_KEY || _0x10f933.BYOK1_ANTHROPIC_API_KEY || _0x10f933.OPENAI_API_KEY || _0x10f933.ANTHROPIC_API_KEY || ""));
    if (_0x10f933.BYOK1_OPENAI_API_PATH || _0x10f933.OPENAI_API_PATH) {
      _0x11e587.push("OPENAI_API_PATH=" + (_0x10f933.BYOK1_OPENAI_API_PATH || _0x10f933.OPENAI_API_PATH));
    }
    _0x11e587.push("", "# ─── 通用 ───");
    _0x11e587.push("HYBRID_PORT=" + this.getHybridPort(_0x10f933).toString());
    _0x11e587.push("INFERENCE_PORT=" + this.getInferencePort(_0x10f933).toString());
    if (_0x4f8c12) {
      _0x11e587.push("DEFAULT_MODEL=" + _0x4f8c12);
    }
    if (_0x10f933.MAX_TOKENS) {
      _0x11e587.push("MAX_TOKENS=" + _0x10f933.MAX_TOKENS);
    }
    const _0xb1effort = _0x10f933.BYOK1_THINKING_EFFORT || _0x10f933.OPENAI_REASONING_EFFORT || "";
    const _0x5391b0 = Object.prototype.hasOwnProperty.call(_0x10f933, "OPENAI_REASONING_EFFORT") ? _0x10f933.OPENAI_REASONING_EFFORT : _0xb1effort;
    _0x11e587.push("OPENAI_REASONING_EFFORT=" + (_0x5391b0 || ""));
    _0x11e587.push("OPENAI_THINKING_ENABLED=" + (_0x10f933.OPENAI_THINKING_ENABLED === "true" || !!_0xb1effort ? "true" : "false"));
    _0x11e587.push("COMPLETION_TIMEOUT_MS=" + this.getCompletionTimeoutMs(_0x10f933).toString());
    if (_0x10f933.SYSTEM_PROMPT_OVERRIDE) {
      _0x11e587.push("SYSTEM_PROMPT_OVERRIDE=" + _0x10f933.SYSTEM_PROMPT_OVERRIDE);
      _0x11e587.push("SYSTEM_PROMPT_PATH=" + _0x35a380);
    }
    if (_0x22e545.length > 0) {
      _0x11e587.push("", ..._0x22e545);
    }
    _0x11e587.push("");
    fs.writeFileSync(_0x21ad5b, _0x11e587.join("\n"), "utf-8");
  }
  buildRuntimeConfigPatch(_0x28f58c) {
    const _0x1feff9 = {
      defaultModel: _0x28f58c.BYOK1_MODEL || _0x28f58c.DEFAULT_MODEL || undefined,
      DEFAULT_MODEL: _0x28f58c.BYOK1_MODEL || _0x28f58c.DEFAULT_MODEL || "",
      BYOK1_ANTHROPIC_API_HOST: _0x28f58c.BYOK1_ANTHROPIC_API_HOST ? this.stripProtocol(_0x28f58c.BYOK1_ANTHROPIC_API_HOST) : "",
      BYOK1_ANTHROPIC_API_KEY: _0x28f58c.BYOK1_ANTHROPIC_API_KEY || "",
      BYOK1_ANTHROPIC_API_PATH: _0x28f58c.BYOK1_ANTHROPIC_API_PATH || "",
      BYOK1_OPENAI_API_HOST: _0x28f58c.BYOK1_OPENAI_API_HOST ? this.stripProtocol(_0x28f58c.BYOK1_OPENAI_API_HOST) : "",
      BYOK1_OPENAI_API_KEY: _0x28f58c.BYOK1_OPENAI_API_KEY || "",
      BYOK1_OPENAI_API_PATH: _0x28f58c.BYOK1_OPENAI_API_PATH || "",
      BYOK1_MODEL: _0x28f58c.BYOK1_MODEL || "",
      BYOK1_THINKING_EFFORT: _0x28f58c.BYOK1_THINKING_EFFORT || "",
      BYOK2_ANTHROPIC_API_HOST: _0x28f58c.BYOK2_ANTHROPIC_API_HOST ? this.stripProtocol(_0x28f58c.BYOK2_ANTHROPIC_API_HOST) : "",
      BYOK2_ANTHROPIC_API_KEY: _0x28f58c.BYOK2_ANTHROPIC_API_KEY || "",
      BYOK2_ANTHROPIC_API_PATH: _0x28f58c.BYOK2_ANTHROPIC_API_PATH || "",
      BYOK2_OPENAI_API_HOST: _0x28f58c.BYOK2_OPENAI_API_HOST ? this.stripProtocol(_0x28f58c.BYOK2_OPENAI_API_HOST) : "",
      BYOK2_OPENAI_API_KEY: _0x28f58c.BYOK2_OPENAI_API_KEY || "",
      BYOK2_OPENAI_API_PATH: _0x28f58c.BYOK2_OPENAI_API_PATH || "",
      BYOK2_MODEL: _0x28f58c.BYOK2_MODEL || "",
      BYOK2_THINKING_EFFORT: _0x28f58c.BYOK2_THINKING_EFFORT || "",
      ANTHROPIC_API_HOST: _0x28f58c.BYOK1_ANTHROPIC_API_HOST ? this.stripProtocol(_0x28f58c.BYOK1_ANTHROPIC_API_HOST) : _0x28f58c.ANTHROPIC_API_HOST ? this.stripProtocol(_0x28f58c.ANTHROPIC_API_HOST) : "",
      ANTHROPIC_API_KEY: _0x28f58c.BYOK1_ANTHROPIC_API_KEY || _0x28f58c.ANTHROPIC_API_KEY || "",
      ANTHROPIC_API_PATH: _0x28f58c.BYOK1_ANTHROPIC_API_PATH || _0x28f58c.ANTHROPIC_API_PATH || "",
      OPENAI_API_HOST: _0x28f58c.BYOK1_OPENAI_API_HOST ? this.stripProtocol(_0x28f58c.BYOK1_OPENAI_API_HOST) : _0x28f58c.OPENAI_API_HOST ? this.stripProtocol(_0x28f58c.OPENAI_API_HOST) : "",
      OPENAI_API_KEY: _0x28f58c.BYOK1_OPENAI_API_KEY || _0x28f58c.BYOK1_ANTHROPIC_API_KEY || _0x28f58c.OPENAI_API_KEY || _0x28f58c.ANTHROPIC_API_KEY || "",
      OPENAI_API_PATH: _0x28f58c.BYOK1_OPENAI_API_PATH || _0x28f58c.OPENAI_API_PATH || "",
      OPENAI_REASONING_EFFORT: Object.prototype.hasOwnProperty.call(_0x28f58c, "OPENAI_REASONING_EFFORT") ? _0x28f58c.OPENAI_REASONING_EFFORT : _0x28f58c.BYOK1_THINKING_EFFORT || "",
      OPENAI_THINKING_ENABLED: _0x28f58c.OPENAI_THINKING_ENABLED === "true" || !!_0x28f58c.BYOK1_THINKING_EFFORT,
      COMPLETION_TIMEOUT_MS: this.getCompletionTimeoutMs(_0x28f58c)
    };
    const _0x21ea5c = Number.parseInt(String(_0x28f58c.MAX_TOKENS || ""), 10);
    if (Number.isInteger(_0x21ea5c) && _0x21ea5c > 0) {
      _0x1feff9.maxTokens = _0x21ea5c;
    }
    return _0x1feff9;
  }
  postHttpJson(_0x1f0f27, _0x29ada3, _0x507ec3, _0x160031 = "") {
    const _0x3ac815 = JSON.stringify(_0x507ec3);
    const _0x30e79b = {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(_0x3ac815)
    };
    if (_0x160031) {
      _0x30e79b.authorization = "Bearer " + _0x160031;
    }
    return new Promise((_0x4d48f2, _0x47bf60) => {
      const _0x4257d3 = {
        hostname: "127.0.0.1",
        port: _0x1f0f27,
        path: _0x29ada3,
        method: "POST",
        headers: _0x30e79b
      };
      const _0xd61708 = http.request(_0x4257d3, _0x379392 => {
        const _0x376fd4 = [];
        _0x379392.on("data", _0x1a045e => _0x376fd4.push(Buffer.from(_0x1a045e)));
        _0x379392.on("end", () => {
          const _0x4d5eb2 = Buffer.concat(_0x376fd4).toString("utf8");
          if ((_0x379392.statusCode || 0) < 200 || (_0x379392.statusCode || 0) >= 300) {
            _0x47bf60(new Error("HTTP " + _0x379392.statusCode + ": " + _0x4d5eb2.slice(0, 200)));
            return;
          }
          _0x4d48f2();
        });
      });
      _0xd61708.setTimeout(2000, () => _0xd61708.destroy(new Error("timeout")));
      _0xd61708.on("error", _0x47bf60);
      _0xd61708.end(_0x3ac815);
    });
  }
  postHttp2Json(_0x2d5a1c, _0x1185dd, _0x5cd7dc, _0x295120 = "") {
    const _0x1a07d2 = JSON.stringify(_0x5cd7dc);
    return new Promise((_0x2cfa2e, _0x4bd58b) => {
      const _0x380e21 = http2.connect("http://127.0.0.1:" + _0x2d5a1c);
      let _0x43e48e = false;
      let _0x2b078c = 0;
      const _0x3cb74b = [];
      let _0x5951ee;
      const _0x158437 = _0x8bc966 => {
        if (_0x43e48e) {
          return;
        }
        _0x43e48e = true;
        clearTimeout(_0x5951ee);
        _0x380e21.close();
        if (_0x8bc966) {
          _0x4bd58b(_0x8bc966);
        } else {
          _0x2cfa2e();
        }
      };
      _0x5951ee = setTimeout(() => _0x158437(new Error("timeout")), 2000);
      _0x380e21.on("error", _0x158437);
      const _0x244291 = {
        ":method": "POST",
        ":path": _0x1185dd,
        "content-type": "application/json",
        "content-length": Buffer.byteLength(_0x1a07d2)
      };
      if (_0x295120) {
        _0x244291.authorization = "Bearer " + _0x295120;
      }
      const _0x267c05 = _0x380e21.request(_0x244291);
      _0x267c05.on("response", _0x348204 => {
        const _0x51a0bc = _0x348204[":status"];
        _0x2b078c = typeof _0x51a0bc === "number" ? _0x51a0bc : Number(_0x51a0bc || 0);
      });
      _0x267c05.on("data", _0x361a12 => _0x3cb74b.push(Buffer.from(_0x361a12)));
      _0x267c05.on("end", () => {
        const _0x32ff37 = Buffer.concat(_0x3cb74b).toString("utf8");
        if (_0x2b078c < 200 || _0x2b078c >= 300) {
          _0x158437(new Error("HTTP " + _0x2b078c + ": " + _0x32ff37.slice(0, 200)));
          return;
        }
        _0x158437();
      });
      _0x267c05.on("error", _0x158437);
      _0x267c05.end(_0x1a07d2);
    });
  }
  async reloadRuntimeConfig(_0x4e6585, _0x5cdfd9) {
    const _0x593404 = _0x5cdfd9 || this.portsFromConfig(_0x4e6585);
    const _0x3193da = this.buildRuntimeConfigPatch(_0x4e6585);
    const _0x2d973d = _0x4e6585.ADMIN_TOKEN || this.readEnvConfig().ADMIN_TOKEN || "";
    const _0x5a9290 = {
      ok: false,
      hybrid: false,
      inference: false,
      errors: []
    };
    if (this.hybridProcess || this.externalProxy) {
      try {
        await this.postHttpJson(_0x593404.hybridPort, "/api/config", _0x3193da, _0x2d973d);
        _0x5a9290.hybrid = true;
      } catch (_0x49e6bd) {
        const _0x3cde19 = _0x49e6bd instanceof Error ? _0x49e6bd.message : String(_0x49e6bd);
        _0x5a9290.errors.push("hybrid: " + _0x3cde19);
      }
    }
    if (this.inferenceProcess) {
      try {
        await this.postHttp2Json(_0x593404.inferencePort, "/api/config", _0x3193da, _0x2d973d);
        _0x5a9290.inference = true;
      } catch (_0x24c6e2) {
        const _0x933ed0 = _0x24c6e2 instanceof Error ? _0x24c6e2.message : String(_0x24c6e2);
        _0x5a9290.errors.push("inference: " + _0x933ed0);
      }
    }
    const _0x40b9f2 = !this.hybridProcess && !this.externalProxy || _0x5a9290.hybrid;
    const _0x508465 = !this.inferenceProcess || _0x5a9290.inference;
    _0x5a9290.ok = _0x40b9f2 && _0x508465 && _0x5a9290.errors.length === 0;
    return _0x5a9290;
  }
  async ensureDependencies() {
    const _0xbf3eec = path.join(this.proxyRoot, "node_modules");
    const _0x5529e8 = path.join(this.proxyRoot, "package.json");
    if (!fs.existsSync(_0x5529e8)) {
      return true;
    }
    try {
      const _0x46d003 = fs.readFileSync(_0x5529e8, "utf-8");
      const _0x2fed47 = JSON.parse(_0x46d003);
      const _0x4578bc = {
        ..._0x2fed47.dependencies,
        ..._0x2fed47.devDependencies,
        ..._0x2fed47.optionalDependencies
      };
      const _0x43164c = Object.keys(_0x4578bc);
      if (_0x43164c.length === 0) {
        return true;
      }
    } catch {}
    if (fs.existsSync(_0xbf3eec)) {
      return true;
    }
    this.log("首次启动，安装代理依赖...");
    return new Promise(_0x2d36b4 => {
      const _0x55da62 = (0, child_process_1.spawn)("npm", ["install", "--production", "--no-optional"], {
        cwd: this.proxyRoot,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      _0x55da62.stdout?.on("data", _0x3f8eb9 => this.log(_0x3f8eb9.toString().trim()));
      _0x55da62.stderr?.on("data", _0x16fbd1 => this.log("[npm] " + _0x16fbd1.toString().trim()));
      _0x55da62.on("exit", _0xdc4c64 => {
        if (_0xdc4c64 === 0) {
          this.log("依赖安装完成");
          _0x2d36b4(true);
        } else {
          this.log("依赖安装失败 (code: " + _0xdc4c64 + ")");
          vscode.window.showErrorMessage("代理依赖安装失败，请手动在代理目录执行 npm install");
          _0x2d36b4(false);
        }
      });
    });
  }
  async isOurProxyRunning(_0x47b3b8) {
    return new Promise(_0x27a32f => {
      const _0x4a6582 = {
        hostname: "127.0.0.1",
        port: _0x47b3b8,
        path: "/api/config",
        method: "GET",
        timeout: 1500
      };
      const _0x4edefb = http.request(_0x4a6582, _0x450845 => {
        let _0x57ba04 = "";
        _0x450845.on("data", _0x1ec7aa => _0x57ba04 += _0x1ec7aa.toString());
        _0x450845.on("end", () => {
          try {
            const _0xae748b = JSON.parse(_0x57ba04);
            _0x27a32f(_0xae748b && typeof _0xae748b.defaultModel === "string");
          } catch {
            _0x27a32f(false);
          }
        });
      });
      _0x4edefb.on("error", () => _0x27a32f(false));
      _0x4edefb.on("timeout", () => {
        _0x4edefb.destroy();
        _0x27a32f(false);
      });
      _0x4edefb.end();
    });
  }
  async refreshExternalProxyStatus() {
    if (this.hybridProcess) {
      return;
    }
    const _0x46eafa = this.readEnvConfig();
    const _0x498c35 = this.getHybridPort(_0x46eafa);
    this.externalProxy = await this.isOurProxyRunning(_0x498c35);
    if (this.externalProxy) {
      this.startTime = Date.now();
    }
    this.updateStatusBar();
  }
  async start(_0xf81a6c = "both", _0xffdbba) {
    this.clearStartMessages();
    if (this.hybridProcess) {
      this.log("代理已在运行中");
      return true;
    }
    const _0x381570 = path.join(this.proxyRoot, "src", "hybrid-server.js");
    if (!fs.existsSync(_0x381570)) {
      const _0x358638 = "错误: 找不到 hybrid-server.js: " + _0x381570;
      this.setStartError(_0x358638);
      this.log("查找路径: " + this.proxyRoot);
      vscode.window.showErrorMessage("找不到代理脚本。如果是 VSIX 安装，请确保打包时包含了 proxy-scripts 目录。");
      return false;
    }
    if (!(await this.ensureDependencies())) {
      return false;
    }
    const _0x36c905 = this.readEnvConfig();
    const _0xac180e = _0xffdbba ? {
      ..._0x36c905,
      ..._0xffdbba
    } : _0x36c905;
    const _0x1888fa = this.getHybridPort(_0xac180e);
    let _0x1c61f3 = this.getInferencePort(_0xac180e);
    if (!(await this.isPortAvailable(_0x1888fa))) {
      if (await this.isOurProxyRunning(_0x1888fa)) {
        this.log("端口 " + _0x1888fa + " 已有代理运行（来自其他窗口），复用中");
        this.externalProxy = true;
        this.activeHybridPort = _0x1888fa;
        this.activeInferencePort = _0x1c61f3;
        this.startTime = Date.now();
        const _0x260c3c = {
          hybridPort: _0x1888fa,
          inferencePort: _0x1c61f3
        };
        const _0x2ae5cb = await this.reloadRuntimeConfig(_0xac180e, _0x260c3c);
        if (_0x2ae5cb.hybrid) {
          this.log("已同步配置到共享代理: model=" + (_0xac180e.DEFAULT_MODEL || "default") + ", key=" + (_0xac180e.ANTHROPIC_API_KEY ? "set" : "empty"));
        } else if (_0x2ae5cb.errors.length > 0) {
          this.log("共享代理配置同步失败: " + _0x2ae5cb.errors.join("; "));
        }
        this.updateStatusBar();
        await this.ensureWindsurfHttpProxySettings(_0x1888fa);
        return true;
      }
      const _0x420ff4 = this.getPortOccupantDetail(_0x1888fa);
      const _0x18c8bf = "代理启动失败：Hybrid 端口 " + _0x1888fa + " 已被占用" + (_0x420ff4 ? "（" + _0x420ff4 + "）" : "") + "。请关闭占用进程、修改端口，或先强制重启 LS 后再启动。";
      this.setStartError(_0x18c8bf);
      return false;
    }
    if (!_0xac180e.ANTHROPIC_API_KEY) {
      this.log("警告: 未配置 ANTHROPIC_API_KEY");
      vscode.window.showWarningMessage("未配置 API Key，请先在控制面板中设置");
    }
    let _0x10a9aa = false;
    this.hybridProcess = (0, child_process_1.spawn)("node", [_0x381570], {
      cwd: this.proxyRoot,
      env: {
        ...process.env,
        ..._0xac180e,
        PROXY_DEVICE_ID: this.deviceId,
        PROXY_CLIENT_VERSION: this.clientVersion
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    const _0x14c5c5 = this.hybridProcess;
    this.hybridProcess.stdout?.on("data", _0x595e34 => {
      const _0x4b5706 = _0x595e34.toString().trim();
      if (_0x4b5706) {
        if (_0x4b5706.includes("⚡ Windsurf BYOK Bridge hybrid on http://localhost:" + _0x1888fa)) {
          _0x10a9aa = true;
        }
        if (/⚡\s*(MITM\s+)?GetChatMessage\b/.test(_0x4b5706) || _0x4b5706.includes("GetStreamingCompletions") || _0x4b5706.includes("GetWebSearchResults") || _0x4b5706.includes("GetEmbeddings")) {
          this.requestCount++;
          this.updateStatusBar();
        }
        this.log(_0x4b5706);
      }
    });
    this.hybridProcess.stderr?.on("data", _0x16b5e1 => {
      const _0x4d3314 = _0x16b5e1.toString().trim();
      if (_0x4d3314) {
        this.log("[stderr] " + _0x4d3314);
      }
    });
    this.hybridProcess.on("error", _0x20c0a4 => {
      this.log("hybrid-server 启动错误: " + _0x20c0a4.message);
    });
    this.hybridProcess.on("exit", _0x2addae => {
      this.log("hybrid-server 退出 (code: " + _0x2addae + ")");
      if (this.hybridProcess !== _0x14c5c5) {
        return;
      }
      this.hybridProcess = null;
      this.updateStatusBar();
      if (this.autoRestart && _0x2addae !== null && _0x2addae !== 0 && this.restartCount < 3) {
        this.restartCount++;
        this.log("自动重启 (" + this.restartCount + "/3)...");
        setTimeout(() => this.start("both", _0xac180e), 2000);
      }
    });
    if (!(await this.waitForPortBound(_0x1888fa, this.hybridProcess, "hybrid-server", 5000, () => _0x10a9aa))) {
      this.autoRestart = false;
      this.hybridProcess.kill("SIGTERM");
      this.hybridProcess = null;
      this.updateStatusBar();
      setTimeout(() => {
        this.autoRestart = true;
      }, 1000);
      const _0x4dec42 = "代理启动失败：Hybrid 端口 " + _0x1888fa + " 未成功监听，请查看日志";
      this.setStartError(_0x4dec42);
      return false;
    }
    this.activeHybridPort = _0x1888fa;
    this.activeInferencePort = _0x1c61f3;
    this.startTime = Date.now();
    this.requestCount = 0;
    this.restartCount = 0;
    this.log("hybrid-server 已启动 (port " + _0x1888fa + ")");
    if (_0x1888fa !== 3006 || _0xf81a6c === "both" && _0x1c61f3 !== 3001) {
      this.log("提示: 非默认端口；侧栏「保存配置」会按端口同步 Windsurf 补丁，修改后请重启 IDE。");
    }
    this.updateStatusBar();
    await this.ensureWindsurfHttpProxySettings(_0x1888fa);
    if (_0xf81a6c === "both") {
      const _0x51b450 = path.join(this.proxyRoot, "src", "inference-proxy.js");
      if (!fs.existsSync(_0x51b450)) {
        this.log("警告: 找不到 inference-proxy.js，已跳过内联补全代理");
      } else {
        let _0xf9c6d3 = _0x1c61f3;
        if (!(await this.isPortAvailable(_0xf9c6d3))) {
          const _0x2173cb = _0xf9c6d3;
          const _0x2e852c = this.getPortOccupantDetail(_0x2173cb);
          const _0x497868 = await this.findAvailablePort(_0x2173cb + 1, [_0x1888fa]);
          if (!_0x497868) {
            this.setStartWarning("Inference 端口 " + _0x2173cb + " 已被占用" + (_0x2e852c ? "（" + _0x2e852c + "）" : "") + "，未找到可用备用端口，仅启动 Chat 代理");
            return true;
          }
          _0xac180e.INFERENCE_PORT = String(_0x497868);
          _0x1c61f3 = _0x497868;
          _0xf9c6d3 = _0x497868;
          this.activeInferencePort = _0x497868;
          const _0x438d1b = {
            ..._0x36c905,
            INFERENCE_PORT: String(_0x497868)
          };
          this.writeEnvConfig(_0x438d1b);
          this.setStartWarning("Inference 端口 " + _0x2173cb + " 已被占用" + (_0x2e852c ? "（" + _0x2e852c + "）" : "") + "，已自动切换到 " + _0x497868 + " 并继续启动内联补全代理");
        }
        let _0x2dcf98 = false;
        this.inferenceProcess = (0, child_process_1.spawn)("node", [_0x51b450], {
          cwd: this.proxyRoot,
          env: {
            ...process.env,
            ..._0xac180e,
            INFERENCE_PORT: String(_0xf9c6d3),
            PROXY_DEVICE_ID: this.deviceId,
            PROXY_CLIENT_VERSION: this.clientVersion
          },
          stdio: ["ignore", "pipe", "pipe"]
        });
        const _0x5f6a7a = this.inferenceProcess;
        this.inferenceProcess.stdout?.on("data", _0x24a35a => {
          const _0x569eaa = _0x24a35a.toString().trim();
          if (_0x569eaa.includes("⚡ Windsurf BYOK Bridge inference on http://localhost:" + _0xf9c6d3)) {
            _0x2dcf98 = true;
          }
          if (_0x569eaa) {
            this.log("[inference] " + _0x569eaa);
          }
        });
        this.inferenceProcess.stderr?.on("data", _0x5618ac => {
          const _0x5ccecc = _0x5618ac.toString().trim();
          if (_0x5ccecc) {
            this.log("[inference-err] " + _0x5ccecc);
          }
        });
        this.inferenceProcess.on("error", _0x4de060 => {
          this.log("inference-proxy 启动错误: " + _0x4de060.message);
        });
        this.inferenceProcess.on("exit", _0x3ba18c => {
          this.log("inference-proxy 退出 (code: " + _0x3ba18c + ")");
          if (this.inferenceProcess !== _0x5f6a7a) {
            return;
          }
          this.inferenceProcess = null;
          if (this.activeInferencePort === _0xf9c6d3) {
            this.activeInferencePort = undefined;
          }
        });
        if (!(await this.waitForPortBound(_0xf9c6d3, this.inferenceProcess, "inference-proxy", 5000, () => _0x2dcf98))) {
          this.inferenceProcess.kill("SIGTERM");
          this.inferenceProcess = null;
          if (this.activeInferencePort === _0xf9c6d3) {
            this.activeInferencePort = undefined;
          }
          vscode.window.showWarningMessage("Inference 代理启动失败：端口 " + _0xf9c6d3 + " 未成功监听，仅启动了 Chat 代理");
        } else {
          this.activeInferencePort = _0xf9c6d3;
          this.log("inference-proxy 已启动 (port " + _0xf9c6d3 + ")");
        }
      }
    }
    return true;
  }
  stop() {
    this.autoRestart = false;
    const _0x149415 = this.readEnvConfig();
    const _0x1e5435 = this.getHybridPort(_0x149415);
    const _0x24d85d = this.getInferencePort(_0x149415);
    if (this.externalProxy) {
      this.externalProxy = false;
      this.activeHybridPort = undefined;
      this.activeInferencePort = undefined;
      this.killListeningPort(_0x1e5435, "hybrid-server");
      this.killListeningPort(_0x24d85d, "inference-proxy");
      this.log("已停止共享代理");
      this.restoreWindsurfHttpProxySettings();
      this.updateStatusBar();
      setTimeout(() => {
        this.autoRestart = true;
      }, 1000);
      return;
    }
    if (this.hybridProcess) {
      const _0xd70222 = this.hybridProcess.pid;
      this.hybridProcess.removeAllListeners("exit");
      this.killProcessTree(_0xd70222, "hybrid-server");
      this.hybridProcess = null;
      this.activeHybridPort = undefined;
      this.restoreWindsurfHttpProxySettings();
    }
    if (this.inferenceProcess) {
      const _0x159669 = this.inferenceProcess.pid;
      this.inferenceProcess.removeAllListeners("exit");
      this.killProcessTree(_0x159669, "inference-proxy");
      this.inferenceProcess = null;
      this.activeInferencePort = undefined;
    }
    this.activeHybridPort = undefined;
    this.activeInferencePort = undefined;
    setTimeout(() => {
      this.autoRestart = true;
    }, 1000);
    this.updateStatusBar();
  }
  getStatus() {
    const _0x38870f = this.readEnvConfig();
    const _0x30c826 = this.hybridProcess !== null || this.externalProxy;
    return {
      running: _0x30c826,
      hybridPid: this.hybridProcess?.pid ?? null,
      inferencePid: this.inferenceProcess?.pid ?? null,
      hybridPort: this.activeHybridPort ?? this.getHybridPort(_0x38870f),
      inferencePort: this.activeInferencePort ?? this.getInferencePort(_0x38870f),
      uptime: _0x30c826 ? Date.now() - this.startTime : 0,
      requestCount: this.requestCount
    };
  }
  dispose() {
    this.stop();
  }
}
exports.ProxyManager = ProxyManager;
