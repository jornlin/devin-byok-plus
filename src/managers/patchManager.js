'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PatchManager = undefined;
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
let vscode;
try {
  vscode = require("vscode");
} catch {
  vscode = {
    window: {
      showInformationMessage: () => undefined,
      showWarningMessage: () => undefined,
      showErrorMessage: () => undefined
    }
  };
}
const child_process_1 = require("child_process");
const PATCH_RULES = [{
  "name": "P1: 重定向 API Server URL",
  "description": "将 getApiServerUrlFromContext 返回值改为 localhost:3006",
  "original": "e.getApiServerUrlFromContext=A=>{if((0,g.getConfig)(g.Config.API_SERVER_URL)!==n.DEFAULT_API_SERVER_URL)return(0,g.getConfig)(g.Config.API_SERVER_URL);const t=(0,e.isStaging)((0,g.getConfig)(g.Config.API_SERVER_URL))?\"apiServerUrl.staging\":\"apiServerUrl\",i=A.globalState.get(t);return void 0===i||(0,e.isStaging)(i)?(0,g.getConfig)(g.Config.API_SERVER_URL):i}",
  "patched": "e.getApiServerUrlFromContext=A=>{return\"http://localhost:3006\"}",
  "originalRegex": "([A-Za-z_$][\\w$]*)\\.getApiServerUrlFromContext=([A-Za-z_$][\\w$]*)=>\\{[\\s\\S]*?globalState\\.get\\([\\s\\S]*?return[\\s\\S]*?\\}",
  "patchedRegex": "([A-Za-z_$][\\w$]*)\\.getApiServerUrlFromContext=([A-Za-z_$][\\w$]*)=>\\{return\"http:\\/\\/localhost:3006\"\\}"
}, {
  "name": "P2: 锁定 restart() URL",
  "description": "防止登录后覆写回 Codeium 地址",
  "original": "async restart(A){this.apiServerUrl=A,this.inputs.apiServerUrl=A,",
  "patched": "async restart(A){A=\"http://localhost:3006\",this.apiServerUrl=A,this.inputs.apiServerUrl=A,",
  "originalRegex": "async restart\\(([A-Za-z_$][\\w$]*)\\)\\{this\\.apiServerUrl=\\1,this\\.inputs\\.apiServerUrl=\\1,",
  "patchedRegex": "async restart\\(([A-Za-z_$][\\w$]*)\\)\\{\\1=\"http:\\/\\/localhost:3006\",this\\.apiServerUrl=\\1,this\\.inputs\\.apiServerUrl=\\1,"
}, {
  "name": "P3: 重定向 Inference URL",
  "description": "将 inference API 地址改为 localhost:3001",
  "original": "const i=(0,w.getConfig)(w.Config.INFERENCE_API_SERVER_URL)",
  "patched": "const i=\"http://localhost:3001\"",
  "originalRegex": "const ([A-Za-z_$][\\w$]*)=\\(0,([A-Za-z_$][\\w$]*)\\.getConfig\\)\\(\\2\\.Config\\.INFERENCE_API_SERVER_URL\\)",
  "patchedRegex": "const ([A-Za-z_$][\\w$]*)=\"http:\\/\\/localhost:3001\""
}];
let patchCache;
function getPatches() {
  if (!patchCache) {
    patchCache = PATCH_RULES.map(rule => ({
      name: rule.name,
      description: rule.description,
      original: rule.original,
      patched: rule.patched,
      originalRegex: new RegExp(rule.originalRegex),
      patchedRegex: new RegExp(rule.patchedRegex)
    }));
  }
  return patchCache;
}
class PatchManager {
  static resolveExtensionJsPath(tmp0) {
    const tmp1 = tmp0 || PatchManager.findExtensionJs();
    if (tmp1 && fs.existsSync(tmp1)) {
      return tmp1;
    } else {
      return null;
    }
  }
  static escapeRegExp(tmp0) {
    return tmp0.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  static loopbackApiUrl(tmp0) {
    return "http://127.0.0.1:" + tmp0;
  }
  static patchUrlCandidates(tmp0) {
    const tmp1 = String(tmp0 || "").match(/^https?:\/\/[^/:]+:(\d+)$/);
    if (!tmp1) {
      return [tmp0];
    }
    return [PatchManager.loopbackApiUrl(tmp1[1]), "http://localhost:" + tmp1[1]];
  }
  static isPatched(tmp0, tmp1, tmp2 = "http://127.0.0.1:3006", tmp3 = "http://127.0.0.1:3001") {
    if (tmp1.name.startsWith("P1:")) {
      return PatchManager.patchUrlCandidates(tmp2).some(arg0 => new RegExp("\\.getApiServerUrlFromContext=[A-Za-z_$][\\w$]*=>\\{return\"" + PatchManager.escapeRegExp(arg0) + "\"\\}", "m").test(tmp0));
    }
    if (tmp1.name.startsWith("P2:")) {
      return PatchManager.patchUrlCandidates(tmp2).some(arg0 => new RegExp("async restart\\([A-Za-z_$][\\w$]*\\)\\{[A-Za-z_$][\\w$]*=\"" + PatchManager.escapeRegExp(arg0) + "\",this\\.apiServerUrl=", "m").test(tmp0));
    }
    if (tmp1.name.startsWith("P3:")) {
      return PatchManager.patchUrlCandidates(tmp3).some(arg0 => new RegExp("const\\s+[A-Za-z_$][\\w$]*=\"" + PatchManager.escapeRegExp(arg0) + "\"", "m").test(tmp0));
    }
    return tmp0.includes(tmp1.patched) || tmp1.patchedRegex.test(tmp0);
  }
  static isAvailable(tmp0, tmp1) {
    return tmp0.includes(tmp1.original) || tmp1.originalRegex.test(tmp0);
  }
  static applyPatchContent(tmp0, tmp1, tmp2, tmp3) {
    if (tmp1.name.startsWith("P1:")) {
      const tmp02 = "$1.getApiServerUrlFromContext=$2=>{return\"" + tmp2 + "\"}";
      let tmp12 = tmp0.replace(tmp1.originalRegex, tmp02);
      if (tmp12 === tmp0) {
        tmp12 = tmp0.replace(/([A-Za-z_$][\w$]*)\.getApiServerUrlFromContext=([A-Za-z_$][\w$]*)=>\{return"https?:\/\/(?:127\.0\.0\.1|localhost):\d+"\}/m, tmp02);
      }
      return {
        content: tmp12,
        changed: tmp12 !== tmp0
      };
    }
    if (tmp1.name.startsWith("P2:")) {
      let tmp02 = tmp0.replace(tmp1.originalRegex, "async restart($1){$1=\"" + tmp2 + "\",this.apiServerUrl=$1,this.inputs.apiServerUrl=$1,");
      if (tmp02 === tmp0) {
        tmp02 = tmp0.replace(/async restart\(([A-Za-z_$][\w$]*)\)\{([A-Za-z_$][\w$]*)="https?:\/\/(?:127\.0\.0\.1|localhost):\d+",this\.apiServerUrl=\2,this\.inputs\.apiServerUrl=\2,/m, "async restart($1){$2=\"" + tmp2 + "\",this.apiServerUrl=$2,this.inputs.apiServerUrl=$2,");
      }
      return {
        content: tmp02,
        changed: tmp02 !== tmp0
      };
    }
    if (tmp1.name.startsWith("P3:")) {
      const tmp02 = "const $1=\"" + tmp3 + "\"";
      let tmp12 = tmp0.replace(tmp1.originalRegex, tmp02);
      if (tmp12 === tmp0) {
        tmp12 = tmp0.replace(/const ([A-Za-z_$][\w$]*)="https?:\/\/(?:127\.0\.0\.1|localhost):\d+"/m, tmp02);
      }
      return {
        content: tmp12,
        changed: tmp12 !== tmp0
      };
    }
    const tmp4 = {
      content: tmp0,
      changed: false
    };
    return tmp4;
  }
  static addAppRootCandidates(tmp0) {
    const tmp1 = [vscode.env.appRoot, path.dirname(vscode.env.appRoot || ""), path.dirname(path.dirname(vscode.env.appRoot || ""))];
    for (const tmp02 of tmp1) {
      PatchManager.addCandidate(tmp0, path.join(tmp02, "extensions", "windsurf", "dist", "extension.js"));
      PatchManager.addCandidate(tmp0, path.join(tmp02, "app", "extensions", "windsurf", "dist", "extension.js"));
      PatchManager.addCandidate(tmp0, path.join(tmp02, "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
    }
  }
  static addCandidate(tmp0, tmp1) {
    if (!tmp1) {
      return;
    }
    const tmp2 = path.normalize(tmp1);
    if (!tmp0.some(arg0 => path.normalize(arg0).toLowerCase() === tmp2.toLowerCase())) {
      tmp0.push(tmp2);
    }
  }
  static addInstallRootCandidates(tmp0, tmp1) {
    if (!tmp1) {
      return;
    }
    const tmp2 = tmp1.replace(/^"|"$/g, "").trim();
    if (!tmp2) {
      return;
    }
    PatchManager.addCandidate(tmp0, path.join(tmp2, "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
    PatchManager.addCandidate(tmp0, path.join(tmp2, "app", "extensions", "windsurf", "dist", "extension.js"));
    PatchManager.addCandidate(tmp0, path.join(tmp2, "extensions", "windsurf", "dist", "extension.js"));
    PatchManager.addCandidate(tmp0, path.join(tmp2, "dist", "extension.js"));
  }
  static resolveBackupPath(tmp0) {
    const tmp1 = tmp0 + ".devin-bak";
    const tmp2 = tmp0 + ".windsurf-bak";
    if (fs.existsSync(tmp1)) {
      return tmp1;
    }
    if (fs.existsSync(tmp2)) {
      return tmp2;
    }
    return tmp1;
  }
  static resolveExistingBackupPath(tmp0) {
    const tmp1 = tmp0 + ".devin-bak";
    const tmp2 = tmp0 + ".windsurf-bak";
    if (fs.existsSync(tmp1)) {
      return tmp1;
    }
    if (fs.existsSync(tmp2)) {
      return tmp2;
    }
    return null;
  }
  static addWindowsProcessCandidates(tmp0) {
    if (process.platform !== "win32") {
      return;
    }
    for (const tmp02 of ["Devin.exe", "Windsurf.exe"]) {
      try {
        const tmp03 = (0, child_process_1.execFileSync)("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-CimInstance Win32_Process -Filter \"name='" + tmp02 + "'\" | Select-Object -ExpandProperty ExecutablePath"], {
          encoding: "utf8",
          windowsHide: true,
          timeout: 2500
        });
        for (const tmp04 of tmp03.split(/\r?\n/).map(arg0 => arg0.trim()).filter(Boolean)) {
          PatchManager.addInstallRootCandidates(tmp0, path.dirname(tmp04));
        }
      } catch {}
    }
  }
  static addWindowsShortcutCandidates(tmp0) {
    if (process.platform !== "win32") {
      return;
    }
    const tmp1 = process.env.APPDATA || "";
    const tmp2 = process.env.PUBLIC ? path.join(process.env.PUBLIC, "Desktop") : "";
    const tmp3 = process.env.USERPROFILE || "";
    const tmp4 = [tmp1 ? path.join(tmp1, "Microsoft", "Windows", "Start Menu", "Programs") : "", tmp3 ? path.join(tmp3, "Desktop") : "", tmp2].filter(Boolean);
    for (const tmp02 of tmp4) {
      if (!fs.existsSync(tmp02)) {
        continue;
      }
      try {
        const tmp03 = (0, child_process_1.execFileSync)("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "$shell=New-Object -ComObject WScript.Shell; Get-ChildItem -LiteralPath " + JSON.stringify(tmp02) + " -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Devin|Windsurf' } | ForEach-Object { $shell.CreateShortcut($_.FullName).TargetPath }"], {
          encoding: "utf8",
          windowsHide: true,
          timeout: 3500
        });
        for (const tmp04 of tmp03.split(/\r?\n/).map(arg0 => arg0.trim()).filter(Boolean)) {
          PatchManager.addInstallRootCandidates(tmp0, path.dirname(tmp04));
        }
      } catch {}
    }
  }
  static addDirectorySearchCandidates(tmp0, tmp1, tmp2 = 4) {
    const tmp3 = tmp1.filter(arg0 => arg0 && fs.existsSync(arg0)).map(arg0 => ({
      dir: arg0,
      depth: 0
    }));
    const tmp4 = new Set();
    while (tmp3.length > 0) {
      const tmp02 = tmp3.shift();
      const tmp12 = path.normalize(tmp02.dir).toLowerCase();
      if (tmp4.has(tmp12)) {
        continue;
      }
      tmp4.add(tmp12);
      const tmp22 = path.join(tmp02.dir, "resources", "app", "extensions", "windsurf", "dist", "extension.js");
      if (fs.existsSync(tmp22)) {
        PatchManager.addCandidate(tmp0, tmp22);
      }
      const tmp32 = path.join(tmp02.dir, "extensions", "windsurf", "dist", "extension.js");
      if (fs.existsSync(tmp32)) {
        PatchManager.addCandidate(tmp0, tmp32);
      }
      if (tmp02.depth >= tmp2) {
        continue;
      }
      let tmp42 = [];
      try {
        tmp42 = fs.readdirSync(tmp02.dir, {
          withFileTypes: true
        });
      } catch {
        continue;
      }
      for (const tmp03 of tmp42) {
        if (!tmp03.isDirectory()) {
          continue;
        }
        const tmp04 = tmp03.name.toLowerCase();
        if (!tmp04.includes("windsurf") && !tmp04.includes("codeium") && !tmp04.includes("devin")) {
          continue;
        }
        tmp3.push({
          dir: path.join(tmp02.dir, tmp03.name),
          depth: tmp02.depth + 1
        });
      }
    }
  }
  static findExtensionJs() {
    const tmp0 = [];
    PatchManager.addAppRootCandidates(tmp0);
    if (process.platform === "darwin") {
      PatchManager.addCandidate(tmp0, "/Applications/Devin.app/Contents/Resources/app/extensions/windsurf/dist/extension.js");
      PatchManager.addCandidate(tmp0, "/Applications/Windsurf.app/Contents/Resources/app/extensions/windsurf/dist/extension.js");
      const tmp02 = process.env.HOME || "";
      if (tmp02) {
        for (const tmp03 of ["Devin", "Windsurf"]) {
          const tmp04 = path.join(tmp02, "Library", "Application Support", tmp03, "extensions");
          if (fs.existsSync(tmp04)) {
            try {
              for (const tmp05 of fs.readdirSync(tmp04)) {
                if (tmp05.startsWith("windsurf-") || tmp05.startsWith("devin-")) {
                  PatchManager.addCandidate(tmp0, path.join(tmp04, tmp05, "dist", "extension.js"));
                }
              }
            } catch {}
          }
        }
      }
    }
    if (process.platform === "win32") {
      PatchManager.addInstallRootCandidates(tmp0, path.dirname(process.execPath));
      const tmp02 = process.env.LOCALAPPDATA || "";
      const tmp1 = process.env.ProgramFiles || "C:\\Program Files";
      const tmp2 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
      if (tmp02) {
        for (const tmp03 of ["Devin", "Windsurf", "devin", "windsurf"]) {
          PatchManager.addCandidate(tmp0, path.join(tmp02, "Programs", tmp03, "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
        }
        PatchManager.addDirectorySearchCandidates(tmp0, [path.join(tmp02, "Programs"), tmp02], 3);
      }
      PatchManager.addWindowsProcessCandidates(tmp0);
      PatchManager.addWindowsShortcutCandidates(tmp0);
      PatchManager.addDirectorySearchCandidates(tmp0, [tmp1, tmp2], 3);
      for (const tmp03 of [tmp1, tmp2]) {
        for (const tmp04 of ["Devin", "Windsurf"]) {
          PatchManager.addCandidate(tmp0, path.join(tmp03, tmp04, "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
        }
      }
      for (const tmp03 of ["C", "D", "E", "F"]) {
        for (const tmp04 of ["Devin", "Windsurf", "devin", "windsurf"]) {
          PatchManager.addCandidate(tmp0, path.join(tmp03 + ":", tmp04, "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
        }
      }
    }
    if (process.platform === "linux") {
      const tmp02 = process.env.HOME || "";
      if (tmp02) {
        for (const tmp03 of [".devin-server", ".windsurf-server"]) {
          const tmp04 = path.join(tmp02, tmp03, "bin");
          if (fs.existsSync(tmp04)) {
            try {
              for (const tmp05 of fs.readdirSync(tmp04)) {
                PatchManager.addCandidate(tmp0, path.join(tmp04, tmp05, "extensions", "windsurf", "dist", "extension.js"));
              }
            } catch {}
          }
        }
      }
      PatchManager.addCandidate(tmp0, "/usr/share/devin/resources/app/extensions/windsurf/dist/extension.js");
      PatchManager.addCandidate(tmp0, "/usr/share/windsurf/resources/app/extensions/windsurf/dist/extension.js");
    }
    return tmp0.find(arg0 => fs.existsSync(arg0)) || null;
  }
  static getStatus(tmp0, tmp1 = "http://127.0.0.1:3006", tmp2 = "http://127.0.0.1:3001") {
    const tmp3 = PatchManager.resolveExtensionJsPath(tmp0);
    if (!tmp3) {
      return {
        path: null,
        patches: getPatches().map(arg0 => ({
          name: arg0.name,
          status: "missing"
        }))
      };
    }
    const tmp4 = fs.readFileSync(tmp3, "utf-8");
    return {
      path: tmp3,
      patches: getPatches().map(arg0 => ({
        name: arg0.name,
        status: PatchManager.isPatched(tmp4, arg0, tmp1, tmp2) ? "applied" : PatchManager.isAvailable(tmp4, arg0) ? "available" : "missing"
      }))
    };
  }
  static apply(tmp0, tmp1 = "http://127.0.0.1:3006", tmp2 = "http://127.0.0.1:3001") {
    return PatchManager.applyWithCustomUrls(tmp1, tmp2, tmp0);
  }
  static revert(tmp0) {
    const tmp1 = PatchManager.resolveExtensionJsPath(tmp0);
    if (!tmp1) {
      return false;
    }
    const tmp2 = PatchManager.resolveExistingBackupPath(tmp1);
    if (!tmp2) {
      return false;
    }
    fs.copyFileSync(tmp2, tmp1);
    PatchManager.updateChecksum(tmp1);
    return true;
  }
  static updateChecksum(tmp0) {
    try {
      let tmp02 = path.dirname(tmp0);
      let tmp1 = "";
      for (let tmp03 = 0; tmp03 < 8; tmp03++) {
        const tmp04 = path.join(tmp02, "product.json");
        if (fs.existsSync(tmp04)) {
          tmp1 = tmp04;
          break;
        }
        const tmp12 = path.dirname(tmp02);
        if (tmp12 === tmp02) {
          break;
        }
        tmp02 = tmp12;
      }
      if (!tmp1) {
        return;
      }
      const fileBuffer = fs.readFileSync(tmp0);
      const tmp2 = crypto.createHash("sha256").update(fileBuffer).digest("base64");
      let tmp3 = fs.readFileSync(tmp1, "utf-8");
      if (tmp3.charCodeAt(0) === 65279) {
        tmp3 = tmp3.substring(1);
      }
      const tmp4 = JSON.parse(tmp3);
      if (tmp4.checksums) {
        const tmp03 = Object.keys(tmp4.checksums).find(arg0 => arg0.includes("extension.js"));
        if (tmp03) {
          tmp4.checksums[tmp03] = tmp2;
          fs.writeFileSync(tmp1, JSON.stringify(tmp4, null, "\t"), "utf-8");
        }
      }
    } catch {}
  }
  static applyWithCustomUrls(tmp0, tmp1, tmp2) {
    const tmp3 = PatchManager.resolveExtensionJsPath(tmp2);
    if (!tmp3) {
      return {
        success: false,
        applied: 0,
        skipped: 0,
        failed: 0,
        details: ["找不到 extension.js"]
      };
    }
    const tmp4 = PatchManager.resolveBackupPath(tmp3);
    const tmp5 = PatchManager.resolveExistingBackupPath(tmp3);
    if (!tmp5) {
      fs.copyFileSync(tmp3, tmp4);
    }
    let tmp6 = fs.readFileSync(tmp3, "utf-8");
    const tmp7 = tmp5 ? fs.readFileSync(tmp5, "utf-8") : fs.existsSync(tmp4) ? fs.readFileSync(tmp4, "utf-8") : null;
    const tmp8 = getPatches().some(arg0 => PatchManager.isPatched(tmp6, arg0, tmp0, tmp1));
    if (tmp8 && tmp7) {
      tmp6 = tmp7;
    }
    const tmp9 = [];
    let tmp10 = 0;
    let tmp11 = 0;
    let tmp12 = 0;
    for (const tmp02 of getPatches()) {
      if (PatchManager.isPatched(tmp6, tmp02, tmp0, tmp1)) {
        tmp11++;
        tmp9.push("[跳过] " + tmp02.name + " (已应用)");
        continue;
      }
      if (!PatchManager.isAvailable(tmp6, tmp02)) {
        tmp12++;
        tmp9.push("[缺失] " + tmp02.name);
        continue;
      }
      const tmp03 = PatchManager.applyPatchContent(tmp6, tmp02, tmp0, tmp1);
      if (!tmp03.changed) {
        tmp12++;
        tmp9.push("[失败] " + tmp02.name);
        continue;
      }
      tmp6 = tmp03.content;
      tmp10++;
      tmp9.push("[成功] " + tmp02.name);
    }
    if (tmp10 > 0) {
      fs.writeFileSync(tmp3, tmp6, "utf-8");
      PatchManager.updateChecksum(tmp3);
    }
    const tmp13 = {
      success: tmp12 === 0,
      applied: tmp10,
      skipped: tmp11,
      failed: tmp12,
      details: tmp9
    };
    return tmp13;
  }
}
exports.PatchManager = PatchManager;
