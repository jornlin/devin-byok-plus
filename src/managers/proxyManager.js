'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ProxyManager = undefined;
const vscode = require("vscode");
const path = require("path");
const child_process_1 = require("child_process");
const fs = require("fs");
const net = require("net");
const http = require("http");
const http2 = require("http2");

// 引入新的辅助模块
const proxyConfig = require("./proxy-config");
const proxyProcess = require("./proxy-process");
const proxyPaths = require("./proxy-paths");

const KEY_HTTP_PROXY_BACKUP = "devin-byok-plus.httpProxyBackup";
class ProxyManager {
  // 使用 proxy-config 模块的方法
  parsePort(tmp0, tmp1) {
    return proxyConfig.parsePort(tmp0, tmp1);
  }
  getHybridPort(tmp0) {
    return proxyConfig.getHybridPort(tmp0);
  }
  getInferencePort(tmp0) {
    return proxyConfig.getInferencePort(tmp0);
  }
  async ensureDevinDesktopHttpProxySettings(tmp0) {
    await this.restoreDevinDesktopHttpProxySettings();
    this.log("已跳过全局 http.proxy 同步；Devin Desktop API 请求仅通过补丁指向 http://127.0.0.1:" + tmp0);
  }
  async restoreDevinDesktopHttpProxySettings() {
    const tmp0 = this.context.globalState.get(KEY_HTTP_PROXY_BACKUP);
    if (!tmp0) {
      return;
    }
    const tmp1 = vscode.workspace.getConfiguration("http");
    const tmp2 = tmp1.get("proxy") || "";
    if (tmp2 !== tmp0.managedProxy) {
      return;
    }
    await tmp1.update("proxy", tmp0.hadProxy ? tmp0.proxy : undefined, vscode.ConfigurationTarget.Global);
    await tmp1.update("proxyStrictSSL", tmp0.hadProxyStrictSSL ? tmp0.proxyStrictSSL : undefined, vscode.ConfigurationTarget.Global);
    await this.context.globalState.update(KEY_HTTP_PROXY_BACKUP, undefined);
    this.log("已恢复 Devin Desktop HTTP 代理设置");
  }
  portsFromConfig(tmp0) {
    return proxyConfig.portsFromConfig(tmp0);
  }
  constructor(tmp0, tmp1 = "", tmp2 = "0.0.0") {
    this.context = tmp0;
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
    this.deviceId = tmp1;
    this.clientVersion = tmp2;
    this.proxyRoot = proxyPaths.findProxyRoot(tmp0.extensionPath);
    proxyPaths.migrateUserConfigIfNeeded(this.proxyRoot);
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = "devin-byok-plus.startProxy";
    this.updateStatusBar();
    this.statusBar.show();
    tmp0.subscriptions.push(this.statusBar);
    this.refreshExternalProxyStatus();
  }
  updateStatusBar() {
    const tmp0 = this.readEnvConfig();
    const tmp1 = this.getHybridPort(tmp0);
    if (this.hybridProcess || this.externalProxy) {
      const tmp02 = this.externalProxy ? "(共享)" : "";
      this.statusBar.text = "$(cloud) BYOK plus: 运行中" + tmp02;
      this.statusBar.tooltip = this.externalProxy ? "代理运行中 | 端口 " + tmp1 + " | 来自其他窗口" : "Port " + tmp1 + " | PID " + this.hybridProcess?.pid + " | " + this.requestCount + " 请求";
      this.statusBar.command = "devin-byok-plus.stopProxy";
    } else {
      this.statusBar.text = "$(cloud) BYOK plus: 已停止";
      this.statusBar.tooltip = "点击启动代理 (Port " + tmp1 + ")";
      this.statusBar.command = "devin-byok-plus.startProxy";
    }
  }
  findProxyRoot() {
    return proxyPaths.findProxyRoot(this.context.extensionPath);
  }
  findWorkspaceProxyRoot() {
    return proxyPaths.findWorkspaceProxyRoot();
  }
  getBundledProxyRoot() {
    return proxyPaths.getBundledProxyRoot(this.context.extensionPath);
  }
  usesPersistentUserConfig() {
    return proxyPaths.usesPersistentUserConfig();
  }
  getUserConfigDir() {
    return proxyPaths.getUserConfigDir();
  }
  ensureUserConfigDir() {
    return proxyPaths.ensureUserConfigDir();
  }
  getDefaultSystemPromptFilePath() {
    if (this.usesPersistentUserConfig()) {
      return path.join(this.getUserConfigDir(), "prompts", "system-prompt.md");
    }
    return path.join(this.proxyRoot, "prompts", "system-prompt.md");
  }
  findLegacyEnvCandidates() {
    const tmp0 = [];
    const tmp1 = new Set();
    const fn = arg0 => {
      if (!arg0 || tmp1.has(arg0)) {
        return;
      }
      tmp1.add(arg0);
      tmp0.push(arg0);
    };
    fn(path.join(this.proxyRoot, ".env"));
    const tmp2 = this.findWorkspaceProxyRoot();
    if (tmp2) {
      fn(path.join(tmp2, ".env"));
    }
    try {
      const tmp3 = path.dirname(this.context.extensionPath);
      for (const tmp02 of fs.readdirSync(tmp3)) {
        if (!/devin-byok-plus|windsurf-byok-plus/i.test(tmp02)) {
          continue;
        }
        if (path.join(tmp3, tmp02) === this.context.extensionPath) {
          continue;
        }
        fn(path.join(tmp3, tmp02, "proxy-scripts", ".env"));
      }
    } catch {}
    return tmp0.sort((arg0, arg1) => {
      try {
        return fs.statSync(arg1).mtimeMs - fs.statSync(arg0).mtimeMs;
      } catch {
        return 0;
      }
    });
  }
  findLegacySystemPromptCandidates() {
    const tmp0 = [];
    const tmp1 = new Set();
    const fn = arg0 => {
      if (!arg0 || tmp1.has(arg0)) {
        return;
      }
      tmp1.add(arg0);
      tmp0.push(arg0);
    };
    fn(path.join(this.proxyRoot, "prompts", "system-prompt.md"));
    const tmp2 = this.findWorkspaceProxyRoot();
    if (tmp2) {
      fn(path.join(tmp2, "prompts", "system-prompt.md"));
    }
    try {
      const tmp3 = path.dirname(this.context.extensionPath);
      for (const tmp02 of fs.readdirSync(tmp3)) {
        if (!/devin-byok-plus|windsurf-byok-plus/i.test(tmp02)) {
          continue;
        }
        if (path.join(tmp3, tmp02) === this.context.extensionPath) {
          continue;
        }
        fn(path.join(tmp3, tmp02, "proxy-scripts", "prompts", "system-prompt.md"));
      }
    } catch {}
    return tmp0.sort((arg0, arg1) => {
      try {
        return fs.statSync(arg1).mtimeMs - fs.statSync(arg0).mtimeMs;
      } catch {
        return 0;
      }
    });
  }
  migrateUserConfigIfNeeded() {
    if (!this.usesPersistentUserConfig()) {
      return;
    }
    this.ensureUserConfigDir();
    const tmp0 = this.getEnvFilePath();
    if (!fs.existsSync(tmp0)) {
      for (const tmp02 of this.findLegacyEnvCandidates()) {
        try {
          fs.copyFileSync(tmp02, tmp0);
          this.log("已迁移配置到持久目录: " + tmp02);
          break;
        } catch (tmp03) {
          const tmp12 = tmp03 instanceof Error ? tmp03.message : String(tmp03);
          this.log("迁移配置失败: " + tmp12);
        }
      }
    }
    const tmp1 = this.getDefaultSystemPromptFilePath();
    if (!fs.existsSync(tmp1)) {
      for (const tmp02 of this.findLegacySystemPromptCandidates()) {
        try {
          fs.copyFileSync(tmp02, tmp1);
          this.log("已迁移系统提示词到持久目录");
          break;
        } catch {}
      }
    }
    if (fs.existsSync(tmp0)) {
      this.rewritePersistentEnvPaths(tmp0);
    }
  }
  rewritePersistentEnvPaths(tmp0) {
    if (!this.usesPersistentUserConfig() || !fs.existsSync(tmp0)) {
      return;
    }
    const tmp1 = this.readEnvConfig();
    const tmp2 = this.getDefaultSystemPromptFilePath();
    let tmp3 = false;
    if (tmp1.SYSTEM_PROMPT_OVERRIDE === "true") {
      const tmp02 = (tmp1.SYSTEM_PROMPT_PATH || "").trim();
      const tmp12 = tmp02 ? this.getResolvedSystemPromptPath(tmp1) : tmp2;
      const tmp22 = path.normalize(tmp12);
      if (tmp02 !== tmp22) {
        tmp1.SYSTEM_PROMPT_PATH = tmp22;
        tmp3 = true;
      }
    }
    if (tmp3) {
      this.writeEnvConfig(tmp1);
    }
  }
  onLog(tmp0) {
    this.logCallback = tmp0;
  }
  log(tmp0) {
    console.log("[Devin BYOK Bridge] " + tmp0);
    this.logCallback?.("[" + new Date().toLocaleTimeString() + "] " + tmp0);
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
  setStartError(tmp0) {
    this.lastStartError = tmp0;
    this.log(tmp0);
    vscode.window.showWarningMessage(tmp0);
  }
  setStartWarning(tmp0) {
    this.lastStartWarning = tmp0;
    this.log(tmp0);
    vscode.window.showWarningMessage(tmp0);
  }
  async isPortAvailable(tmp0) {
    return new Promise(fn => {
      const tmp1 = net.createServer();
      tmp1.once("error", () => fn(false));
      tmp1.once("listening", () => {
        tmp1.close();
        fn(true);
      });
      tmp1.listen(tmp0, "127.0.0.1");
    });
  }
  async findAvailablePort(tmp0, tmp1 = []) {
    const tmp2 = new Set(tmp1);
    for (let tmp02 = 0; tmp02 < 100; tmp02++) {
      const tmp03 = tmp0 + tmp02;
      if (tmp03 > 65535) {
        return undefined;
      }
      if (tmp2.has(tmp03)) {
        continue;
      }
      if (await this.isPortAvailable(tmp03)) {
        return tmp03;
      }
    }
    return undefined;
  }
  async canConnectToPort(tmp0, tmp1) {
    return new Promise(fn => {
      const tmp12 = {
        port: tmp0,
        host: tmp1
      };
      const tmp2 = net.connect(tmp12);
      const fn2 = arg0 => {
        tmp2.removeAllListeners();
        if (!tmp2.destroyed) {
          tmp2.destroy();
        }
        fn(arg0);
      };
      tmp2.setTimeout(300);
      tmp2.once("connect", () => fn2(true));
      tmp2.once("timeout", () => fn2(false));
      tmp2.once("error", () => fn2(false));
    });
  }
  async isPortReachable(tmp0) {
    for (const tmp02 of ["localhost", "127.0.0.1", "::1"]) {
      if (await this.canConnectToPort(tmp0, tmp02)) {
        return true;
      }
    }
    return false;
  }
  getListeningPids(tmp0) {
    if (process.platform !== "win32") {
      return [];
    }
    try {
      const tmp02 = (0, child_process_1.execFileSync)("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-NetTCPConnection -LocalPort " + tmp0 + " -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 2500
      });
      return Array.from(new Set(tmp02.split(/\r?\n/).map(arg0 => Number.parseInt(arg0.trim(), 10)).filter(arg0 => Number.isInteger(arg0) && arg0 > 0)));
    } catch {
      return [];
    }
  }
  getPortOccupantDetail(tmp0) {
    const tmp1 = this.getListeningPids(tmp0);
    if (tmp1.length === 0) {
      return "";
    }
    if (process.platform !== "win32") {
      return tmp1.map(arg0 => "PID " + arg0).join(", ");
    }
    try {
      const tmp02 = (0, child_process_1.execFileSync)("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "$pids=@(" + tmp1.join(",") + "); Get-CimInstance Win32_Process | Where-Object { $pids -contains $_.ProcessId } | ForEach-Object { \"$($_.ProcessId) $($_.Name)\" }"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 2500
      });
      const tmp12 = tmp02.split(/\r?\n/).map(arg0 => arg0.trim()).filter(Boolean);
      if (tmp12.length > 0) {
        return tmp12.join("; ");
      }
    } catch {}
    return tmp1.map(arg0 => "PID " + arg0).join(", ");
  }
  killProcessTree(tmp0, tmp1) {
    if (!tmp0) {
      return;
    }
    try {
      if (process.platform === "win32") {
        (0, child_process_1.execFileSync)("taskkill.exe", ["/PID", String(tmp0), "/T", "/F"], {
          windowsHide: true,
          timeout: 3000,
          stdio: "ignore"
        });
      } else {
        process.kill(tmp0, "SIGTERM");
      }
      this.log(tmp1 + " 进程已结束 (PID " + tmp0 + ")");
    } catch (tmp02) {
      const tmp12 = tmp02 instanceof Error ? tmp02.message : String(tmp02);
      this.log(tmp1 + " 进程结束失败 (PID " + tmp0 + "): " + tmp12);
    }
  }
  killListeningPort(tmp0, tmp1) {
    const tmp2 = this.getListeningPids(tmp0);
    for (const tmp02 of tmp2) {
      this.killProcessTree(tmp02, tmp1 + " 端口 " + tmp0);
    }
    if (tmp2.length === 0) {
      this.log(tmp1 + " 端口 " + tmp0 + " 未发现监听进程");
    }
  }
  /**
   * 回收本扩展的孤儿代理进程（PPID=1，父进程已退出后被 init 接管）。
   * 只杀命令行匹配 proxy-scripts/src/(inference-proxy|hybrid-server).js 且 PPID=1 的进程。
   * 排除当前自有子进程。
   */
  reapOrphanedProxies() {
    if (process.platform === "win32") {
      return; // Windows 无 PPID=1 孤儿概念
    }
    const ownPids = new Set();
    if (this.hybridProcess?.pid) {
      ownPids.add(this.hybridProcess.pid);
    }
    if (this.inferenceProcess?.pid) {
      ownPids.add(this.inferenceProcess.pid);
    }
    try {
      const output = (0, child_process_1.execSync)(
        "ps -eo pid,ppid,command | grep -E 'proxy-scripts/src/(inference-proxy|hybrid-server)\\.js' | grep -v grep",
        { encoding: "utf-8", timeout: 3000 }
      );
      let reaped = 0;
      for (const line of output.split(/\r?\n/)) {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
        if (!match) continue;
        const pid = Number(match[1]);
        const ppid = Number(match[2]);
        if (ownPids.has(pid)) continue;
        if (ppid !== 1) continue; // 只清理真正的孤儿（PPID=1）
        try {
          process.kill(pid, "SIGTERM");
          reaped++;
          this.log("已回收孤儿代理进程 PID " + pid + " (cmd: " + match[3].slice(0, 80) + ")");
        } catch {}
      }
      if (reaped > 0) {
        this.log("共回收 " + reaped + " 个孤儿代理进程");
      }
    } catch {
      // ps/grep 找不到匹配行时会 exit(1)，忽略
    }
  }
  async waitForPortBound(port, childProcess, label, timeoutMs = 5000, readyCheck) {
    const startDeadline = Date.now();
    while (Date.now() - startDeadline < timeoutMs) {
      if (childProcess.exitCode !== null) {
        this.log(label + " 启动失败，进程已退出 (code: " + childProcess.exitCode + ")");
        return false;
      }
      if (readyCheck?.()) {
        return true;
      }
      if (await this.isPortReachable(port)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (readyCheck?.()) {
      return true;
    }
    this.log(label + " 启动超时，端口 " + port + " 未就绪");
    return false;
  }
  getEnvFilePath() {
    return proxyPaths.getEnvFilePath(this.proxyRoot);
  }
  getProxyRootPath() {
    return this.proxyRoot;
  }
  readEnvConfig() {
    const tmp0 = this.getEnvFilePath();
    const config = proxyConfig.readEnvConfig(tmp0);
    if (config.SYSTEM_PROMPT_PATH !== undefined) {
      config.SYSTEM_PROMPT_PATH = this.getSystemPromptConfigPath(config);
    }
    const _legacy = String.fromCharCode(90, 87, 72, 95);
    for (const _k of Object.keys(config)) {
      if (_k.startsWith(_legacy)) {
        delete config[_k];
      }
    }
    return config;
  }
  stripProtocol(tmp0) {
    return proxyConfig.stripProtocol(tmp0);
  }
  normalizeSystemPromptPathValue(tmp0) {
    const tmp1 = tmp0.trim();
    if (!tmp1) {
      return "./prompts/system-prompt.md";
    }
    if (!path.isAbsolute(tmp1)) {
      return tmp1;
    }
    const tmp2 = path.normalize(tmp1);
    const tmp3 = path.normalize(path.join(this.proxyRoot, "prompts", "system-prompt.md"));
    if (tmp2 === tmp3) {
      return "./prompts/system-prompt.md";
    }
    const tmp4 = this.findWorkspaceProxyRoot();
    if (tmp4) {
      const tmp02 = path.normalize(path.join(tmp4, "prompts", "system-prompt.md"));
      if (tmp2 === tmp02) {
        return "./prompts/system-prompt.md";
      }
    }
    if (this.usesPersistentUserConfig()) {
      const tmp5 = path.normalize(this.getDefaultSystemPromptFilePath());
      if (tmp2 === tmp5) {
        return tmp5;
      }
    }
    return tmp1;
  }
  getCompletionTimeoutMs(tmp0) {
    return proxyConfig.getCompletionTimeoutMs(tmp0);
  }
  getSystemPromptConfigPath(tmp0) {
    return proxyConfig.getSystemPromptConfigPath(tmp0);
  }
  getResolvedSystemPromptPath(tmp0) {
    return proxyConfig.getResolvedSystemPromptPath(tmp0);
  }
  resolveEnvForProxySpawn(tmp0) {
    const tmp1 = {
      ...tmp0
    };
    if (String(tmp1.SYSTEM_PROMPT_OVERRIDE || "").toLowerCase() === "true") {
      tmp1.SYSTEM_PROMPT_PATH = this.getResolvedSystemPromptPath(tmp1);
    }
    return tmp1;
  }
  writeEnvConfig(tmp0) {
    const tmp1 = this.getEnvFilePath();
    const tmp2 = this.readEnvConfig();
    const tmp3 = new Set(["ANTHROPIC_API_HOST", "ANTHROPIC_API_KEY", "ANTHROPIC_API_PATH", "OPENAI_API_HOST", "OPENAI_API_KEY", "OPENAI_API_PATH", "HYBRID_PORT", "INFERENCE_PORT", "DEFAULT_MODEL", "MAX_TOKENS", "OPENAI_REASONING_EFFORT", "OPENAI_THINKING_ENABLED", "COMPLETION_TIMEOUT_MS", "SYSTEM_PROMPT_OVERRIDE", "SYSTEM_PROMPT_PATH", "BYOK1_ANTHROPIC_API_HOST", "BYOK1_ANTHROPIC_API_KEY", "BYOK1_ANTHROPIC_API_PATH", "BYOK1_OPENAI_API_HOST", "BYOK1_OPENAI_API_KEY", "BYOK1_OPENAI_API_PATH", "BYOK1_MODEL", "BYOK1_THINKING_EFFORT", "BYOK2_ANTHROPIC_API_HOST", "BYOK2_ANTHROPIC_API_KEY", "BYOK2_ANTHROPIC_API_PATH", "BYOK2_OPENAI_API_HOST", "BYOK2_OPENAI_API_KEY", "BYOK2_OPENAI_API_PATH", "BYOK2_MODEL", "BYOK2_THINKING_EFFORT"]);
    const tmp4 = Object.entries(tmp2).filter(([tmp02]) => !tmp3.has(tmp02) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(tmp02)).map(([tmp02, tmp13]) => tmp02 + "=" + tmp13);
    const tmp5 = this.getSystemPromptConfigPath(tmp0);
    const tmp6 = ["# Devin BYOK Bridge 配置（由扩展管理）"];
    const fn = (arg0, arg1) => {
      const tmp22 = tmp0[arg0 + "ANTHROPIC_API_HOST"] ? this.stripProtocol(tmp0[arg0 + "ANTHROPIC_API_HOST"]) : "";
      tmp6.push("", "# ─── " + arg1 + " ───");
      tmp6.push(arg0 + "ANTHROPIC_API_HOST=" + tmp22);
      tmp6.push(arg0 + "ANTHROPIC_API_KEY=" + (tmp0[arg0 + "ANTHROPIC_API_KEY"] || ""));
      if (tmp0[arg0 + "ANTHROPIC_API_PATH"]) {
        tmp6.push(arg0 + "ANTHROPIC_API_PATH=" + tmp0[arg0 + "ANTHROPIC_API_PATH"]);
      }
      const tmp32 = tmp0[arg0 + "OPENAI_API_HOST"] ? this.stripProtocol(tmp0[arg0 + "OPENAI_API_HOST"]) : tmp22;
      tmp6.push(arg0 + "OPENAI_API_HOST=" + tmp32);
      tmp6.push(arg0 + "OPENAI_API_KEY=" + (tmp0[arg0 + "OPENAI_API_KEY"] || tmp0[arg0 + "ANTHROPIC_API_KEY"] || ""));
      if (tmp0[arg0 + "OPENAI_API_PATH"]) {
        tmp6.push(arg0 + "OPENAI_API_PATH=" + tmp0[arg0 + "OPENAI_API_PATH"]);
      }
      tmp6.push(arg0 + "MODEL=" + (tmp0[arg0 + "MODEL"] || ""));
      tmp6.push(arg0 + "THINKING_EFFORT=" + (tmp0[arg0 + "THINKING_EFFORT"] || ""));
    };
    fn("BYOK1_", "BYOK #1 · Claude Opus 4 BYOK");
    fn("BYOK2_", "BYOK #2 · Claude Opus 4 Thinking BYOK");
    const tmp8 = tmp0.BYOK1_ANTHROPIC_API_HOST ? this.stripProtocol(tmp0.BYOK1_ANTHROPIC_API_HOST) : tmp0.ANTHROPIC_API_HOST ? this.stripProtocol(tmp0.ANTHROPIC_API_HOST) : "";
    const tmp9 = tmp0.BYOK1_OPENAI_API_HOST ? this.stripProtocol(tmp0.BYOK1_OPENAI_API_HOST) : tmp0.OPENAI_API_HOST ? this.stripProtocol(tmp0.OPENAI_API_HOST) : tmp8;
    const tmp10 = tmp0.BYOK1_MODEL || tmp0.DEFAULT_MODEL || "";
    tmp6.push("", "# ─── 兼容 / 补全（镜像 BYOK #1）───", "ANTHROPIC_API_HOST=" + tmp8, "ANTHROPIC_API_KEY=" + (tmp0.BYOK1_ANTHROPIC_API_KEY || tmp0.ANTHROPIC_API_KEY || ""));
    if (tmp0.BYOK1_ANTHROPIC_API_PATH || tmp0.ANTHROPIC_API_PATH) {
      tmp6.push("ANTHROPIC_API_PATH=" + (tmp0.BYOK1_ANTHROPIC_API_PATH || tmp0.ANTHROPIC_API_PATH));
    }
    tmp6.push("OPENAI_API_HOST=" + tmp9, "OPENAI_API_KEY=" + (tmp0.BYOK1_OPENAI_API_KEY || tmp0.BYOK1_ANTHROPIC_API_KEY || tmp0.OPENAI_API_KEY || tmp0.ANTHROPIC_API_KEY || ""));
    if (tmp0.BYOK1_OPENAI_API_PATH || tmp0.OPENAI_API_PATH) {
      tmp6.push("OPENAI_API_PATH=" + (tmp0.BYOK1_OPENAI_API_PATH || tmp0.OPENAI_API_PATH));
    }
    tmp6.push("", "# ─── 通用 ───");
    tmp6.push("HYBRID_PORT=" + this.getHybridPort(tmp0).toString());
    tmp6.push("INFERENCE_PORT=" + this.getInferencePort(tmp0).toString());
    if (tmp10) {
      tmp6.push("DEFAULT_MODEL=" + tmp10);
    }
    if (tmp0.MAX_TOKENS) {
      tmp6.push("MAX_TOKENS=" + tmp0.MAX_TOKENS);
    }
    const tmp11 = tmp0.BYOK1_THINKING_EFFORT || tmp0.OPENAI_REASONING_EFFORT || "";
    const tmp12 = Object.prototype.hasOwnProperty.call(tmp0, "OPENAI_REASONING_EFFORT") ? tmp0.OPENAI_REASONING_EFFORT : tmp11;
    tmp6.push("OPENAI_REASONING_EFFORT=" + (tmp12 || ""));
    tmp6.push("OPENAI_THINKING_ENABLED=" + (tmp0.OPENAI_THINKING_ENABLED === "true" || !!tmp11 ? "true" : "false"));
    tmp6.push("COMPLETION_TIMEOUT_MS=" + this.getCompletionTimeoutMs(tmp0).toString());
    if (tmp0.SYSTEM_PROMPT_OVERRIDE) {
      tmp6.push("SYSTEM_PROMPT_OVERRIDE=" + tmp0.SYSTEM_PROMPT_OVERRIDE);
      const tmp13 = this.usesPersistentUserConfig() ? this.getResolvedSystemPromptPath(tmp0) : tmp5;
      tmp6.push("SYSTEM_PROMPT_PATH=" + tmp13);
    }
    if (tmp4.length > 0) {
      tmp6.push("", ...tmp4);
    }
    tmp6.push("");
    fs.writeFileSync(tmp1, tmp6.join("\n"), "utf-8");
  }
  buildRuntimeConfigPatch(tmp0) {
    const tmp1 = {
      defaultModel: tmp0.BYOK1_MODEL || tmp0.DEFAULT_MODEL || undefined,
      DEFAULT_MODEL: tmp0.BYOK1_MODEL || tmp0.DEFAULT_MODEL || "",
      BYOK1_ANTHROPIC_API_HOST: tmp0.BYOK1_ANTHROPIC_API_HOST ? this.stripProtocol(tmp0.BYOK1_ANTHROPIC_API_HOST) : "",
      BYOK1_ANTHROPIC_API_KEY: tmp0.BYOK1_ANTHROPIC_API_KEY || "",
      BYOK1_ANTHROPIC_API_PATH: tmp0.BYOK1_ANTHROPIC_API_PATH || "",
      BYOK1_OPENAI_API_HOST: tmp0.BYOK1_OPENAI_API_HOST ? this.stripProtocol(tmp0.BYOK1_OPENAI_API_HOST) : "",
      BYOK1_OPENAI_API_KEY: tmp0.BYOK1_OPENAI_API_KEY || "",
      BYOK1_OPENAI_API_PATH: tmp0.BYOK1_OPENAI_API_PATH || "",
      BYOK1_MODEL: tmp0.BYOK1_MODEL || "",
      BYOK1_THINKING_EFFORT: tmp0.BYOK1_THINKING_EFFORT || "",
      BYOK2_ANTHROPIC_API_HOST: tmp0.BYOK2_ANTHROPIC_API_HOST ? this.stripProtocol(tmp0.BYOK2_ANTHROPIC_API_HOST) : "",
      BYOK2_ANTHROPIC_API_KEY: tmp0.BYOK2_ANTHROPIC_API_KEY || "",
      BYOK2_ANTHROPIC_API_PATH: tmp0.BYOK2_ANTHROPIC_API_PATH || "",
      BYOK2_OPENAI_API_HOST: tmp0.BYOK2_OPENAI_API_HOST ? this.stripProtocol(tmp0.BYOK2_OPENAI_API_HOST) : "",
      BYOK2_OPENAI_API_KEY: tmp0.BYOK2_OPENAI_API_KEY || "",
      BYOK2_OPENAI_API_PATH: tmp0.BYOK2_OPENAI_API_PATH || "",
      BYOK2_MODEL: tmp0.BYOK2_MODEL || "",
      BYOK2_THINKING_EFFORT: tmp0.BYOK2_THINKING_EFFORT || "",
      ANTHROPIC_API_HOST: tmp0.BYOK1_ANTHROPIC_API_HOST ? this.stripProtocol(tmp0.BYOK1_ANTHROPIC_API_HOST) : tmp0.ANTHROPIC_API_HOST ? this.stripProtocol(tmp0.ANTHROPIC_API_HOST) : "",
      ANTHROPIC_API_KEY: tmp0.BYOK1_ANTHROPIC_API_KEY || tmp0.ANTHROPIC_API_KEY || "",
      ANTHROPIC_API_PATH: tmp0.BYOK1_ANTHROPIC_API_PATH || tmp0.ANTHROPIC_API_PATH || "",
      OPENAI_API_HOST: tmp0.BYOK1_OPENAI_API_HOST ? this.stripProtocol(tmp0.BYOK1_OPENAI_API_HOST) : tmp0.OPENAI_API_HOST ? this.stripProtocol(tmp0.OPENAI_API_HOST) : "",
      OPENAI_API_KEY: tmp0.BYOK1_OPENAI_API_KEY || tmp0.BYOK1_ANTHROPIC_API_KEY || tmp0.OPENAI_API_KEY || tmp0.ANTHROPIC_API_KEY || "",
      OPENAI_API_PATH: tmp0.BYOK1_OPENAI_API_PATH || tmp0.OPENAI_API_PATH || "",
      OPENAI_REASONING_EFFORT: Object.prototype.hasOwnProperty.call(tmp0, "OPENAI_REASONING_EFFORT") ? tmp0.OPENAI_REASONING_EFFORT : tmp0.BYOK1_THINKING_EFFORT || "",
      OPENAI_THINKING_ENABLED: tmp0.OPENAI_THINKING_ENABLED === "true" || !!tmp0.BYOK1_THINKING_EFFORT,
      COMPLETION_TIMEOUT_MS: this.getCompletionTimeoutMs(tmp0)
    };
    const tmp2 = Number.parseInt(String(tmp0.MAX_TOKENS || ""), 10);
    if (Number.isInteger(tmp2) && tmp2 > 0) {
      tmp1.maxTokens = tmp2;
    }
    return tmp1;
  }
  postHttpJson(tmp0, tmp1, tmp2, tmp3 = "") {
    const tmp4 = JSON.stringify(tmp2);
    const tmp5 = {
      "content-type": "application/json",
      "content-length": Buffer.byteLength(tmp4)
    };
    if (tmp3) {
      tmp5.authorization = "Bearer " + tmp3;
    }
    return new Promise((fn, fn2) => {
      const tmp22 = {
        hostname: "127.0.0.1",
        port: tmp0,
        path: tmp1,
        method: "POST",
        headers: tmp5
      };
      const tmp32 = http.request(tmp22, arg0 => {
        const tmp12 = [];
        arg0.on("data", arg02 => tmp12.push(Buffer.from(arg02)));
        arg0.on("end", () => {
          const tmp02 = Buffer.concat(tmp12).toString("utf8");
          if ((arg0.statusCode || 0) < 200 || (arg0.statusCode || 0) >= 300) {
            fn2(new Error("HTTP " + arg0.statusCode + ": " + tmp02.slice(0, 200)));
            return;
          }
          fn();
        });
      });
      tmp32.setTimeout(10000, () => tmp32.destroy(new Error("timeout")));
      tmp32.on("error", fn2);
      tmp32.end(tmp4);
    });
  }
  postHttp2Json(tmp0, tmp1, tmp2, tmp3 = "") {
    const tmp4 = JSON.stringify(tmp2);
    return new Promise((fn, fn2) => {
      const tmp22 = http2.connect("http://127.0.0.1:" + tmp0);
      let tmp32 = false;
      let tmp42 = 0;
      const tmp5 = [];
      let tmp6;
      const fn3 = arg0 => {
        if (tmp32) {
          return;
        }
        tmp32 = true;
        clearTimeout(tmp6);
        tmp22.close();
        if (arg0) {
          fn2(arg0);
        } else {
          fn();
        }
      };
      tmp6 = setTimeout(() => fn3(new Error("timeout")), 10000);
      tmp22.on("error", fn3);
      const tmp8 = {
        ":method": "POST",
        ":path": tmp1,
        "content-type": "application/json",
        "content-length": Buffer.byteLength(tmp4)
      };
      if (tmp3) {
        tmp8.authorization = "Bearer " + tmp3;
      }
      const tmp9 = tmp22.request(tmp8);
      tmp9.on("response", arg0 => {
        const tmp12 = arg0[":status"];
        tmp42 = typeof tmp12 === "number" ? tmp12 : Number(tmp12 || 0);
      });
      tmp9.on("data", arg0 => tmp5.push(Buffer.from(arg0)));
      tmp9.on("end", () => {
        const tmp02 = Buffer.concat(tmp5).toString("utf8");
        if (tmp42 < 200 || tmp42 >= 300) {
          fn3(new Error("HTTP " + tmp42 + ": " + tmp02.slice(0, 200)));
          return;
        }
        fn3();
      });
      tmp9.on("error", fn3);
      tmp9.end(tmp4);
    });
  }
  async reloadRuntimeConfig(tmp0, tmp1) {
    const tmp2 = tmp1 || this.portsFromConfig(tmp0);
    const tmp3 = this.buildRuntimeConfigPatch(tmp0);
    const tmp4 = tmp0.ADMIN_TOKEN || this.readEnvConfig().ADMIN_TOKEN || "";
    const tmp5 = {
      ok: false,
      hybrid: false,
      inference: false,
      errors: []
    };
    if (this.hybridProcess || this.externalProxy) {
      try {
        await this.postHttpJson(tmp2.hybridPort, "/api/config", tmp3, tmp4);
        tmp5.hybrid = true;
      } catch (tmp02) {
        const tmp12 = tmp02 instanceof Error ? tmp02.message : String(tmp02);
        tmp5.errors.push("hybrid: " + tmp12);
      }
    }
    if (this.inferenceProcess) {
      try {
        await this.postHttp2Json(tmp2.inferencePort, "/api/config", tmp3, tmp4);
        tmp5.inference = true;
      } catch (tmp02) {
        const tmp12 = tmp02 instanceof Error ? tmp02.message : String(tmp02);
        tmp5.errors.push("inference: " + tmp12);
      }
    }
    const tmp6 = !this.hybridProcess && !this.externalProxy || tmp5.hybrid;
    const tmp7 = !this.inferenceProcess || tmp5.inference;
    tmp5.ok = tmp6 && tmp7 && tmp5.errors.length === 0;
    return tmp5;
  }
  async ensureDependencies() {
    const tmp0 = path.join(this.proxyRoot, "node_modules");
    const tmp1 = path.join(this.proxyRoot, "package.json");
    if (!fs.existsSync(tmp1)) {
      return true;
    }
    try {
      const tmp02 = fs.readFileSync(tmp1, "utf-8");
      const tmp12 = JSON.parse(tmp02);
      const tmp2 = {
        ...tmp12.dependencies,
        ...tmp12.devDependencies,
        ...tmp12.optionalDependencies
      };
      const tmp3 = Object.keys(tmp2);
      if (tmp3.length === 0) {
        return true;
      }
    } catch {}
    if (fs.existsSync(tmp0)) {
      return true;
    }
    this.log("首次启动，安装代理依赖...");
    return new Promise(fn => {
      const tmp12 = (0, child_process_1.spawn)("npm", ["install", "--production", "--no-optional"], {
        cwd: this.proxyRoot,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"]
      });
      tmp12.stdout?.on("data", arg0 => this.log(arg0.toString().trim()));
      tmp12.stderr?.on("data", arg0 => this.log("[npm] " + arg0.toString().trim()));
      tmp12.on("exit", arg0 => {
        if (arg0 === 0) {
          this.log("依赖安装完成");
          fn(true);
        } else {
          this.log("依赖安装失败 (code: " + arg0 + ")");
          vscode.window.showErrorMessage("代理依赖安装失败，请手动在代理目录执行 npm install");
          fn(false);
        }
      });
    });
  }
  async isOurProxyRunning(tmp0) {
    return new Promise(fn => {
      const tmp1 = {
        hostname: "127.0.0.1",
        port: tmp0,
        path: "/api/config",
        method: "GET",
        timeout: 1500
      };
      const tmp2 = http.request(tmp1, arg0 => {
        let tmp12 = "";
        arg0.on("data", arg02 => tmp12 += arg02.toString());
        arg0.on("end", () => {
          try {
            const tmp02 = JSON.parse(tmp12);
            fn(tmp02 && typeof tmp02.defaultModel === "string");
          } catch {
            fn(false);
          }
        });
      });
      tmp2.on("error", () => fn(false));
      tmp2.on("timeout", () => {
        tmp2.destroy();
        fn(false);
      });
      tmp2.end();
    });
  }
  async refreshExternalProxyStatus() {
    if (this.hybridProcess) {
      return;
    }
    const tmp0 = this.readEnvConfig();
    const tmp1 = this.getHybridPort(tmp0);
    this.externalProxy = await this.isOurProxyRunning(tmp1);
    if (this.externalProxy) {
      this.startTime = Date.now();
    }
    this.updateStatusBar();
  }
  async start(tmp0 = "both", tmp1) {
    this.clearStartMessages();
    // 启动前清理本扩展遗留的孤儿进程，防止端口冲突和僵尸累积
    this.reapOrphanedProxies();
    if (this.hybridProcess) {
      this.log("代理已在运行中");
      return true;
    }
    const tmp2 = path.join(this.proxyRoot, "src", "hybrid-server.js");
    if (!fs.existsSync(tmp2)) {
      const tmp02 = "错误: 找不到 hybrid-server.js: " + tmp2;
      this.setStartError(tmp02);
      this.log("查找路径: " + this.proxyRoot);
      vscode.window.showErrorMessage("找不到代理脚本。如果是 VSIX 安装，请确保打包时包含了 proxy-scripts 目录。");
      return false;
    }
    if (!(await this.ensureDependencies())) {
      return false;
    }
    const tmp3 = this.readEnvConfig();
    const tmp4 = this.resolveEnvForProxySpawn(tmp1 ? {
      ...tmp3,
      ...tmp1
    } : tmp3);
    const tmp5 = this.getHybridPort(tmp4);
    let tmp6 = this.getInferencePort(tmp4);
    if (!(await this.isPortAvailable(tmp5))) {
      if (await this.isOurProxyRunning(tmp5)) {
        this.log("端口 " + tmp5 + " 已有代理运行（来自其他窗口），复用中");
        this.externalProxy = true;
        this.activeHybridPort = tmp5;
        this.activeInferencePort = tmp6;
        this.startTime = Date.now();
        const tmp03 = {
          hybridPort: tmp5,
          inferencePort: tmp6
        };
        const tmp13 = await this.reloadRuntimeConfig(tmp4, tmp03);
        if (tmp13.hybrid) {
          this.log("已同步配置到共享代理: model=" + (tmp4.DEFAULT_MODEL || "default") + ", key=" + (tmp4.ANTHROPIC_API_KEY ? "set" : "empty"));
        } else if (tmp13.errors.length > 0) {
          this.log("共享代理配置同步失败: " + tmp13.errors.join("; "));
        }
        this.updateStatusBar();
        await this.ensureDevinDesktopHttpProxySettings(tmp5);
        return true;
      }
      const tmp02 = this.getPortOccupantDetail(tmp5);
      const tmp12 = "代理启动失败：Hybrid 端口 " + tmp5 + " 已被占用" + (tmp02 ? "（" + tmp02 + "）" : "") + "。请关闭占用进程、修改端口，或先强制重启 LS 后再启动。";
      this.setStartError(tmp12);
      return false;
    }
    if (!tmp4.ANTHROPIC_API_KEY) {
      this.log("警告: 未配置 ANTHROPIC_API_KEY");
      vscode.window.showWarningMessage("未配置 API Key，请先在控制面板中设置");
    }
    let tmp7 = false;
    this.hybridProcess = (0, child_process_1.spawn)("node", [tmp2], {
      cwd: this.proxyRoot,
      env: {
        ...process.env,
        ...tmp4,
        PROXY_DEVICE_ID: this.deviceId,
        PROXY_CLIENT_VERSION: this.clientVersion
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    });
    const tmp8 = this.hybridProcess;
    this.hybridProcess.stdout?.on("data", arg0 => {
      const tmp12 = arg0.toString().trim();
      if (tmp12) {
        if (tmp12.includes("⚡ Devin BYOK Bridge hybrid on http://127.0.0.1:" + tmp5) || tmp12.includes("⚡ Devin BYOK Bridge hybrid on http://localhost:" + tmp5)) {
          tmp7 = true;
        }
        if (/⚡\s*(MITM\s+)?GetChatMessage\b/.test(tmp12) || tmp12.includes("GetStreamingCompletions") || tmp12.includes("GetWebSearchResults") || tmp12.includes("GetEmbeddings")) {
          this.requestCount++;
          this.updateStatusBar();
        }
        this.log(tmp12);
      }
    });
    this.hybridProcess.stderr?.on("data", arg0 => {
      const tmp12 = arg0.toString().trim();
      if (tmp12) {
        this.log("[stderr] " + tmp12);
      }
    });
    this.hybridProcess.on("error", arg0 => {
      this.log("hybrid-server 启动错误: " + arg0.message);
    });
    this.hybridProcess.on("exit", arg0 => {
      this.log("hybrid-server 退出 (code: " + arg0 + ")");
      if (this.hybridProcess !== tmp8) {
        return;
      }
      this.hybridProcess = null;
      this.updateStatusBar();
      if (this.autoRestart && arg0 !== null && arg0 !== 0 && this.restartCount < 3) {
        this.restartCount++;
        this.log("自动重启 (" + this.restartCount + "/3)...");
        setTimeout(() => this.start("both", tmp4), 2000);
      }
    });
    if (!(await this.waitForPortBound(tmp5, this.hybridProcess, "hybrid-server", 5000, () => tmp7))) {
      this.autoRestart = false;
      if (this.hybridProcess) {
        this.hybridProcess.kill("SIGTERM");
      }
      this.hybridProcess = null;
      this.updateStatusBar();
      setTimeout(() => {
        this.autoRestart = true;
      }, 1000);
      const tmp02 = "代理启动失败：Hybrid 端口 " + tmp5 + " 未成功监听，请查看日志";
      this.setStartError(tmp02);
      return false;
    }
    this.activeHybridPort = tmp5;
    this.activeInferencePort = tmp6;
    this.startTime = Date.now();
    this.requestCount = 0;
    this.restartCount = 0;
    this.log("hybrid-server 已启动 (port " + tmp5 + ")");
    if (tmp5 !== 3006 || tmp0 === "both" && tmp6 !== 3001) {
      this.log("提示: 非默认端口；侧栏「保存配置」会按端口同步 Devin Desktop 补丁，修改后请重启 IDE。");
    }
    this.updateStatusBar();
    await this.ensureDevinDesktopHttpProxySettings(tmp5);
    if (tmp0 === "both") {
      const tmp02 = path.join(this.proxyRoot, "src", "inference-proxy.js");
      if (!fs.existsSync(tmp02)) {
        this.log("警告: 找不到 inference-proxy.js，已跳过内联补全代理");
      } else {
        let tmp03 = tmp6;
        if (!(await this.isPortAvailable(tmp03))) {
          const tmp04 = tmp03;
          const tmp13 = this.getPortOccupantDetail(tmp04);
          const tmp23 = await this.findAvailablePort(tmp04 + 1, [tmp5]);
          if (!tmp23) {
            this.setStartWarning("Inference 端口 " + tmp04 + " 已被占用" + (tmp13 ? "（" + tmp13 + "）" : "") + "，未找到可用备用端口，仅启动 Chat 代理");
            return true;
          }
          tmp4.INFERENCE_PORT = String(tmp23);
          tmp6 = tmp23;
          tmp03 = tmp23;
          this.activeInferencePort = tmp23;
          // 回退端口仅作用于本次运行态，不持久化写回 .env，
          // 否则下次启动会从让步后的端口继续递增（端口号单调爬升 bug）。
          this.setStartWarning("Inference 端口 " + tmp04 + " 已被占用" + (tmp13 ? "（" + tmp13 + "）" : "") + "，本次已自动切换到 " + tmp23 + "（基准端口配置保持不变）并继续启动内联补全代理");
        }
        let tmp12 = false;
        this.inferenceProcess = (0, child_process_1.spawn)("node", [tmp02], {
          cwd: this.proxyRoot,
          env: {
            ...process.env,
            ...tmp4,
            INFERENCE_PORT: String(tmp03),
            PROXY_DEVICE_ID: this.deviceId,
            PROXY_CLIENT_VERSION: this.clientVersion
          },
          stdio: ["ignore", "pipe", "pipe", "ipc"]
        });
        const tmp22 = this.inferenceProcess;
        this.inferenceProcess.stdout?.on("data", arg0 => {
          const tmp13 = arg0.toString().trim();
          if (tmp13.includes("⚡ Devin BYOK Bridge inference on http://127.0.0.1:" + tmp03) || tmp13.includes("⚡ Devin BYOK Bridge inference on http://localhost:" + tmp03)) {
            tmp12 = true;
          }
          if (tmp13) {
            this.log("[inference] " + tmp13);
          }
        });
        this.inferenceProcess.stderr?.on("data", arg0 => {
          const tmp13 = arg0.toString().trim();
          if (tmp13) {
            this.log("[inference-err] " + tmp13);
          }
        });
        this.inferenceProcess.on("error", arg0 => {
          this.log("inference-proxy 启动错误: " + arg0.message);
        });
        this.inferenceProcess.on("exit", arg0 => {
          this.log("inference-proxy 退出 (code: " + arg0 + ")");
          if (this.inferenceProcess !== tmp22) {
            return;
          }
          this.inferenceProcess = null;
          if (this.activeInferencePort === tmp03) {
            this.activeInferencePort = undefined;
          }
        });
        if (!(await this.waitForPortBound(tmp03, this.inferenceProcess, "inference-proxy", 5000, () => tmp12))) {
          if (this.inferenceProcess) {
            this.inferenceProcess.kill("SIGTERM");
          }
          this.inferenceProcess = null;
          if (this.activeInferencePort === tmp03) {
            this.activeInferencePort = undefined;
          }
          vscode.window.showWarningMessage("Inference 代理启动失败：端口 " + tmp03 + " 未成功监听，仅启动了 Chat 代理");
        } else {
          this.activeInferencePort = tmp03;
          this.log("inference-proxy 已启动 (port " + tmp03 + ")");
        }
      }
    }
    return true;
  }
  stop() {
    this.autoRestart = false;
    const tmp0 = this.readEnvConfig();
    const tmp1 = this.getHybridPort(tmp0);
    const tmp2 = this.getInferencePort(tmp0);
    if (this.externalProxy) {
      this.externalProxy = false;
      this.activeHybridPort = undefined;
      this.activeInferencePort = undefined;
      this.killListeningPort(tmp1, "hybrid-server");
      this.killListeningPort(tmp2, "inference-proxy");
      this.log("已停止共享代理");
      this.restoreDevinDesktopHttpProxySettings();
      this.updateStatusBar();
      setTimeout(() => {
        this.autoRestart = true;
      }, 1000);
      return;
    }
    if (this.hybridProcess) {
      const tmp02 = this.hybridProcess.pid;
      this.hybridProcess.removeAllListeners("exit");
      this.killProcessTree(tmp02, "hybrid-server");
      this.hybridProcess = null;
      this.activeHybridPort = undefined;
      this.restoreDevinDesktopHttpProxySettings();
    }
    if (this.inferenceProcess) {
      const tmp02 = this.inferenceProcess.pid;
      this.inferenceProcess.removeAllListeners("exit");
      this.killProcessTree(tmp02, "inference-proxy");
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
    const tmp0 = this.readEnvConfig();
    const tmp1 = this.hybridProcess !== null || this.externalProxy;
    return {
      running: tmp1,
      hybridPid: this.hybridProcess?.pid ?? null,
      inferencePid: this.inferenceProcess?.pid ?? null,
      hybridPort: this.activeHybridPort ?? this.getHybridPort(tmp0),
      inferencePort: this.activeInferencePort ?? this.getInferencePort(tmp0),
      uptime: tmp1 ? Date.now() - this.startTime : 0,
      requestCount: this.requestCount
    };
  }
  dispose() {
    this.stop();
  }
}
exports.ProxyManager = ProxyManager;
