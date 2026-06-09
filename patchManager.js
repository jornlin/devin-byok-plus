'use strict';

var __createBinding = this && this.__createBinding || (Object.create ? function (_0x355b62, _0x95dd6a, _0x10dcff, _0x3b1970 = _0x10dcff) {
  var _0x1c77cf = Object.getOwnPropertyDescriptor(_0x95dd6a, _0x10dcff);
  if (!_0x1c77cf || ("get" in _0x1c77cf ? !_0x95dd6a.__esModule : _0x1c77cf.writable || _0x1c77cf.configurable)) {
    _0x1c77cf = {
      enumerable: true,
      get: function () {
        return _0x95dd6a[_0x10dcff];
      }
    };
  }
  Object.defineProperty(_0x355b62, _0x3b1970, _0x1c77cf);
} : function (_0x2aa579, _0x55068a, _0x72f69f, _0x5e0f50 = _0x72f69f) {
  _0x2aa579[_0x5e0f50] = _0x55068a[_0x72f69f];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function (_0x105bea, _0x5205e1) {
  const _0x1ab9c3 = {
    enumerable: true,
    value: _0x5205e1
  };
  Object.defineProperty(_0x105bea, "default", _0x1ab9c3);
} : function (_0x244fee, _0x134bc4) {
  _0x244fee.default = _0x134bc4;
});
var __importStar = this && this.__importStar || function () {
  function _0x11c630(_0x45b0ee) {
    _0x11c630 = Object.getOwnPropertyNames || function (_0x15f8e1) {
      var _0x2eec89 = [];
      for (var _0x5263f0 in _0x15f8e1) {
        if (Object.prototype.hasOwnProperty.call(_0x15f8e1, _0x5263f0)) {
          _0x2eec89[_0x2eec89.length] = _0x5263f0;
        }
      }
      return _0x2eec89;
    };
    return _0x11c630(_0x45b0ee);
  }
  return function (_0x343698) {
    if (_0x343698 && _0x343698.__esModule) {
      return _0x343698;
    }
    var _0x204a79 = {};
    if (_0x343698 != null) {
      for (var _0x2a7c3a = _0x11c630(_0x343698), _0x1d1b4c = 0; _0x1d1b4c < _0x2a7c3a.length; _0x1d1b4c++) {
        if (_0x2a7c3a[_0x1d1b4c] !== "default") {
          __createBinding(_0x204a79, _0x343698, _0x2a7c3a[_0x1d1b4c]);
        }
      }
    }
    __setModuleDefault(_0x204a79, _0x343698);
    return _0x204a79;
  };
}();
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PatchManager = undefined;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const PATCH_RULES_B64 = [{
  name: "UDE6IOmHjeWumuWQkSBBUEkgU2VydmVyIFVSTA==",
  description: "5bCGIGdldEFwaVNlcnZlclVybEZyb21Db250ZXh0IOi/lOWbnuWAvOaUueS4uiBsb2NhbGhvc3Q6MzAwNg==",
  original: "ZS5nZXRBcGlTZXJ2ZXJVcmxGcm9tQ29udGV4dD1BPT57aWYoKDAsZy5nZXRDb25maWcpKGcuQ29uZmlnLkFQSV9TRVJWRVJfVVJMKSE9PW4uREVGQVVMVF9BUElfU0VSVkVSX1VSTClyZXR1cm4oMCxnLmdldENvbmZpZykoZy5Db25maWcuQVBJX1NFUlZFUl9VUkwpO2NvbnN0IHQ9KDAsZS5pc1N0YWdpbmcpKCgwLGcuZ2V0Q29uZmlnKShnLkNvbmZpZy5BUElfU0VSVkVSX1VSTCkpPyJhcGlTZXJ2ZXJVcmwuc3RhZ2luZyI6ImFwaVNlcnZlclVybCIsaT1BLmdsb2JhbFN0YXRlLmdldCh0KTtyZXR1cm4gdm9pZCAwPT09aXx8KDAsZS5pc1N0YWdpbmcpKGkpPygwLGcuZ2V0Q29uZmlnKShnLkNvbmZpZy5BUElfU0VSVkVSX1VSTCk6aX0=",
  patched: "ZS5nZXRBcGlTZXJ2ZXJVcmxGcm9tQ29udGV4dD1BPT57cmV0dXJuImh0dHA6Ly9sb2NhbGhvc3Q6MzAwNiJ9",
  originalRegex: "KFtBLVphLXpfJF1bXHckXSopXC5nZXRBcGlTZXJ2ZXJVcmxGcm9tQ29udGV4dD0oW0EtWmEtel8kXVtcdyRdKik9Plx7W1xzXFNdKj9nbG9iYWxTdGF0ZVwuZ2V0XChbXHNcU10qP3JldHVybltcc1xTXSo/XH0=",
  patchedRegex: "KFtBLVphLXpfJF1bXHckXSopXC5nZXRBcGlTZXJ2ZXJVcmxGcm9tQ29udGV4dD0oW0EtWmEtel8kXVtcdyRdKik9Plx7cmV0dXJuImh0dHA6XC9cL2xvY2FsaG9zdDozMDA2Ilx9"
}, {
  name: "UDI6IOmUgeWumiByZXN0YXJ0KCkgVVJM",
  description: "6Ziy5q2i55m75b2V5ZCO6KaG5YaZ5ZueIENvZGVpdW0g5Zyw5Z2A",
  original: "YXN5bmMgcmVzdGFydChBKXt0aGlzLmFwaVNlcnZlclVybD1BLHRoaXMuaW5wdXRzLmFwaVNlcnZlclVybD1BLA==",
  patched: "YXN5bmMgcmVzdGFydChBKXtBPSJodHRwOi8vbG9jYWxob3N0OjMwMDYiLHRoaXMuYXBpU2VydmVyVXJsPUEsdGhpcy5pbnB1dHMuYXBpU2VydmVyVXJsPUEs",
  originalRegex: "YXN5bmMgcmVzdGFydFwoKFtBLVphLXpfJF1bXHckXSopXClce3RoaXNcLmFwaVNlcnZlclVybD1cMSx0aGlzXC5pbnB1dHNcLmFwaVNlcnZlclVybD1cMSw=",
  patchedRegex: "YXN5bmMgcmVzdGFydFwoKFtBLVphLXpfJF1bXHckXSopXClce1wxPSJodHRwOlwvXC9sb2NhbGhvc3Q6MzAwNiIsdGhpc1wuYXBpU2VydmVyVXJsPVwxLHRoaXNcLmlucHV0c1wuYXBpU2VydmVyVXJsPVwxLA=="
}, {
  name: "UDM6IOmHjeWumuWQkSBJbmZlcmVuY2UgVVJM",
  description: "5bCGIGluZmVyZW5jZSBBUEkg5Zyw5Z2A5pS55Li6IGxvY2FsaG9zdDozMDAx",
  original: "Y29uc3QgaT0oMCx3LmdldENvbmZpZykody5Db25maWcuSU5GRVJFTkNFX0FQSV9TRVJWRVJfVVJMKQ==",
  patched: "Y29uc3QgaT0iaHR0cDovL2xvY2FsaG9zdDozMDAxIg==",
  originalRegex: "Y29uc3QgKFtBLVphLXpfJF1bXHckXSopPVwoMCwoW0EtWmEtel8kXVtcdyRdKilcLmdldENvbmZpZ1wpXChcMlwuQ29uZmlnXC5JTkZFUkVOQ0VfQVBJX1NFUlZFUl9VUkxcKQ==",
  patchedRegex: "Y29uc3QgKFtBLVphLXpfJF1bXHckXSopPSJodHRwOlwvXC9sb2NhbGhvc3Q6MzAwMSI="
}];
let patchCache;
function decodePatchValue(_0x40f648) {
  return Buffer.from(_0x40f648, "base64").toString("utf8");
}
function getPatches() {
  if (!patchCache) {
    patchCache = PATCH_RULES_B64.map(_0x1312ce => ({
      name: decodePatchValue(_0x1312ce.name),
      description: decodePatchValue(_0x1312ce.description),
      original: decodePatchValue(_0x1312ce.original),
      patched: decodePatchValue(_0x1312ce.patched),
      originalRegex: new RegExp(decodePatchValue(_0x1312ce.originalRegex)),
      patchedRegex: new RegExp(decodePatchValue(_0x1312ce.patchedRegex))
    }));
  }
  return patchCache;
}
class PatchManager {
  static resolveExtensionJsPath(_0x3c1467) {
    const _0x177e14 = _0x3c1467 || PatchManager.findExtensionJs();
    if (_0x177e14 && fs.existsSync(_0x177e14)) {
      return _0x177e14;
    } else {
      return null;
    }
  }
  static escapeRegExp(_0x2c9276) {
    return _0x2c9276.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  static isPatched(_0x19bb45, _0x5aa773, _0x29ca09 = "http://localhost:3006", _0x37dd48 = "http://localhost:3001") {
    if (_0x5aa773.name.startsWith("P1:")) {
      return new RegExp("\\.getApiServerUrlFromContext=[A-Za-z_$][\\w$]*=>\\{return\"" + PatchManager.escapeRegExp(_0x29ca09) + "\"\\}", "m").test(_0x19bb45);
    }
    if (_0x5aa773.name.startsWith("P2:")) {
      return new RegExp("async restart\\([A-Za-z_$][\\w$]*\\)\\{[A-Za-z_$][\\w$]*=\"" + PatchManager.escapeRegExp(_0x29ca09) + "\",this\\.apiServerUrl=", "m").test(_0x19bb45);
    }
    if (_0x5aa773.name.startsWith("P3:")) {
      return new RegExp("const\\s+[A-Za-z_$][\\w$]*=\"" + PatchManager.escapeRegExp(_0x37dd48) + "\"", "m").test(_0x19bb45);
    }
    return _0x19bb45.includes(_0x5aa773.patched) || _0x5aa773.patchedRegex.test(_0x19bb45);
  }
  static isAvailable(_0x31088d, _0x9b3391) {
    return _0x31088d.includes(_0x9b3391.original) || _0x9b3391.originalRegex.test(_0x31088d);
  }
  static applyPatchContent(_0xc1d651, _0x1f1f11, _0xfe0b1b, _0x54c2b3) {
    if (_0x1f1f11.name.startsWith("P1:")) {
      const _0x1b71a8 = "$1.getApiServerUrlFromContext=$2=>{return\"" + _0xfe0b1b + "\"}";
      let _0x10cfa8 = _0xc1d651.replace(_0x1f1f11.originalRegex, _0x1b71a8);
      if (_0x10cfa8 === _0xc1d651) {
        _0x10cfa8 = _0xc1d651.replace(/([A-Za-z_$][\w$]*)\.getApiServerUrlFromContext=([A-Za-z_$][\w$]*)=>\{return"https?:\/\/localhost:\d+"\}/m, _0x1b71a8);
      }
      return {
        content: _0x10cfa8,
        changed: _0x10cfa8 !== _0xc1d651
      };
    }
    if (_0x1f1f11.name.startsWith("P2:")) {
      let _0x3102a2 = _0xc1d651.replace(_0x1f1f11.originalRegex, "async restart($1){$1=\"" + _0xfe0b1b + "\",this.apiServerUrl=$1,this.inputs.apiServerUrl=$1,");
      if (_0x3102a2 === _0xc1d651) {
        _0x3102a2 = _0xc1d651.replace(/async restart\(([A-Za-z_$][\w$]*)\)\{([A-Za-z_$][\w$]*)="https?:\/\/localhost:\d+",this\.apiServerUrl=\2,this\.inputs\.apiServerUrl=\2,/m, "async restart($1){$2=\"" + _0xfe0b1b + "\",this.apiServerUrl=$2,this.inputs.apiServerUrl=$2,");
      }
      return {
        content: _0x3102a2,
        changed: _0x3102a2 !== _0xc1d651
      };
    }
    if (_0x1f1f11.name.startsWith("P3:")) {
      const _0x175196 = "const $1=\"" + _0x54c2b3 + "\"";
      let _0x557ef6 = _0xc1d651.replace(_0x1f1f11.originalRegex, _0x175196);
      if (_0x557ef6 === _0xc1d651) {
        _0x557ef6 = _0xc1d651.replace(/const ([A-Za-z_$][\w$]*)="https?:\/\/localhost:\d+"/m, _0x175196);
      }
      return {
        content: _0x557ef6,
        changed: _0x557ef6 !== _0xc1d651
      };
    }
    const _0x23c47a = {
      content: _0xc1d651,
      changed: false
    };
    return _0x23c47a;
  }
  static addAppRootCandidates(_0x3fc55e) {
    const _0x23b7af = [vscode.env.appRoot, path.dirname(vscode.env.appRoot || ""), path.dirname(path.dirname(vscode.env.appRoot || ""))];
    for (const _0x3352f9 of _0x23b7af) {
      PatchManager.addCandidate(_0x3fc55e, path.join(_0x3352f9, "extensions", "windsurf", "dist", "extension.js"));
      PatchManager.addCandidate(_0x3fc55e, path.join(_0x3352f9, "app", "extensions", "windsurf", "dist", "extension.js"));
      PatchManager.addCandidate(_0x3fc55e, path.join(_0x3352f9, "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
    }
  }
  static addCandidate(_0x328fc8, _0x3ba6d6) {
    if (!_0x3ba6d6) {
      return;
    }
    const _0x27b2fb = path.normalize(_0x3ba6d6);
    if (!_0x328fc8.some(_0x1febb4 => path.normalize(_0x1febb4).toLowerCase() === _0x27b2fb.toLowerCase())) {
      _0x328fc8.push(_0x27b2fb);
    }
  }
  static addInstallRootCandidates(_0x45e546, _0x60b44a) {
    if (!_0x60b44a) {
      return;
    }
    const _0x1529f2 = _0x60b44a.replace(/^"|"$/g, "").trim();
    if (!_0x1529f2) {
      return;
    }
    PatchManager.addCandidate(_0x45e546, path.join(_0x1529f2, "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
    PatchManager.addCandidate(_0x45e546, path.join(_0x1529f2, "app", "extensions", "windsurf", "dist", "extension.js"));
    PatchManager.addCandidate(_0x45e546, path.join(_0x1529f2, "extensions", "windsurf", "dist", "extension.js"));
    PatchManager.addCandidate(_0x45e546, path.join(_0x1529f2, "dist", "extension.js"));
  }
  static addWindowsProcessCandidates(_0x434b58) {
    if (process.platform !== "win32") {
      return;
    }
    try {
      const _0x49d2a2 = (0, child_process_1.execFileSync)("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-CimInstance Win32_Process -Filter \"name='Windsurf.exe'\" | Select-Object -ExpandProperty ExecutablePath"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 2500
      });
      for (const _0x7e1fca of _0x49d2a2.split(/\r?\n/).map(_0x4d39c5 => _0x4d39c5.trim()).filter(Boolean)) {
        PatchManager.addInstallRootCandidates(_0x434b58, path.dirname(_0x7e1fca));
      }
    } catch {}
  }
  static addWindowsShortcutCandidates(_0x42cf2e) {
    if (process.platform !== "win32") {
      return;
    }
    const _0x500520 = process.env.APPDATA || "";
    const _0x46510c = process.env.PUBLIC ? path.join(process.env.PUBLIC, "Desktop") : "";
    const _0x107a47 = process.env.USERPROFILE || "";
    const _0x7bfdc0 = [_0x500520 ? path.join(_0x500520, "Microsoft", "Windows", "Start Menu", "Programs") : "", _0x107a47 ? path.join(_0x107a47, "Desktop") : "", _0x46510c].filter(Boolean);
    for (const _0x21720d of _0x7bfdc0) {
      if (!fs.existsSync(_0x21720d)) {
        continue;
      }
      try {
        const _0x3d9e3 = (0, child_process_1.execFileSync)("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "$shell=New-Object -ComObject WScript.Shell; Get-ChildItem -LiteralPath " + JSON.stringify(_0x21720d) + " -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'Windsurf' } | ForEach-Object { $shell.CreateShortcut($_.FullName).TargetPath }"], {
          encoding: "utf8",
          windowsHide: true,
          timeout: 3500
        });
        for (const _0x2ccbfc of _0x3d9e3.split(/\r?\n/).map(_0x93b8f3 => _0x93b8f3.trim()).filter(Boolean)) {
          PatchManager.addInstallRootCandidates(_0x42cf2e, path.dirname(_0x2ccbfc));
        }
      } catch {}
    }
  }
  static addDirectorySearchCandidates(_0x56b7e1, _0x354eac, _0x1aeecf = 4) {
    const _0x595b69 = _0x354eac.filter(_0x35f00a => _0x35f00a && fs.existsSync(_0x35f00a)).map(_0x2a2e7d => ({
      dir: _0x2a2e7d,
      depth: 0
    }));
    const _0x448ce1 = new Set();
    while (_0x595b69.length > 0) {
      const _0x407548 = _0x595b69.shift();
      const _0x26c966 = path.normalize(_0x407548.dir).toLowerCase();
      if (_0x448ce1.has(_0x26c966)) {
        continue;
      }
      _0x448ce1.add(_0x26c966);
      const _0x3b987e = path.join(_0x407548.dir, "resources", "app", "extensions", "windsurf", "dist", "extension.js");
      if (fs.existsSync(_0x3b987e)) {
        PatchManager.addCandidate(_0x56b7e1, _0x3b987e);
      }
      const _0x2c5885 = path.join(_0x407548.dir, "extensions", "windsurf", "dist", "extension.js");
      if (fs.existsSync(_0x2c5885)) {
        PatchManager.addCandidate(_0x56b7e1, _0x2c5885);
      }
      if (_0x407548.depth >= _0x1aeecf) {
        continue;
      }
      let _0x53cf78 = [];
      try {
        _0x53cf78 = fs.readdirSync(_0x407548.dir, {
          withFileTypes: true
        });
      } catch {
        continue;
      }
      for (const _0x20490d of _0x53cf78) {
        if (!_0x20490d.isDirectory()) {
          continue;
        }
        const _0x2d7652 = _0x20490d.name.toLowerCase();
        if (!_0x2d7652.includes("windsurf") && !_0x2d7652.includes("codeium")) {
          continue;
        }
        _0x595b69.push({
          dir: path.join(_0x407548.dir, _0x20490d.name),
          depth: _0x407548.depth + 1
        });
      }
    }
  }
  static findExtensionJs() {
    const _0x2cfa11 = [];
    PatchManager.addAppRootCandidates(_0x2cfa11);
    if (process.platform === "darwin") {
      PatchManager.addCandidate(_0x2cfa11, "/Applications/Windsurf.app/Contents/Resources/app/extensions/windsurf/dist/extension.js");
      const _0x5e72e3 = process.env.HOME || "";
      if (_0x5e72e3) {
        const _0x30906a = path.join(_0x5e72e3, "Library", "Application Support", "Windsurf", "extensions");
        if (fs.existsSync(_0x30906a)) {
          try {
            for (const _0x279bff of fs.readdirSync(_0x30906a)) {
              if (_0x279bff.startsWith("windsurf-")) {
                PatchManager.addCandidate(_0x2cfa11, path.join(_0x30906a, _0x279bff, "dist", "extension.js"));
              }
            }
          } catch {}
        }
      }
    }
    if (process.platform === "win32") {
      PatchManager.addInstallRootCandidates(_0x2cfa11, path.dirname(process.execPath));
      const _0x496a86 = process.env.LOCALAPPDATA || "";
      const _0x19bc7b = process.env.ProgramFiles || "C:\\Program Files";
      const _0x5ef441 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
      if (_0x496a86) {
        PatchManager.addCandidate(_0x2cfa11, path.join(_0x496a86, "Programs", "Windsurf", "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
        PatchManager.addCandidate(_0x2cfa11, path.join(_0x496a86, "Programs", "windsurf", "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
        PatchManager.addDirectorySearchCandidates(_0x2cfa11, [path.join(_0x496a86, "Programs"), _0x496a86], 3);
      }
      PatchManager.addWindowsProcessCandidates(_0x2cfa11);
      PatchManager.addWindowsShortcutCandidates(_0x2cfa11);
      PatchManager.addDirectorySearchCandidates(_0x2cfa11, [_0x19bc7b, _0x5ef441], 3);
      for (const _0x576e17 of [_0x19bc7b, _0x5ef441]) {
        PatchManager.addCandidate(_0x2cfa11, path.join(_0x576e17, "Windsurf", "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
      }
      for (const _0x1201c2 of ["C", "D", "E", "F"]) {
        PatchManager.addCandidate(_0x2cfa11, path.join(_0x1201c2 + ":", "Windsurf", "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
        PatchManager.addCandidate(_0x2cfa11, path.join(_0x1201c2 + ":", "windsurf", "resources", "app", "extensions", "windsurf", "dist", "extension.js"));
      }
    }
    if (process.platform === "linux") {
      const _0x21f9ee = process.env.HOME || "";
      if (_0x21f9ee) {
        const _0x1977f6 = path.join(_0x21f9ee, ".windsurf-server", "bin");
        if (fs.existsSync(_0x1977f6)) {
          try {
            for (const _0x50f7aa of fs.readdirSync(_0x1977f6)) {
              PatchManager.addCandidate(_0x2cfa11, path.join(_0x1977f6, _0x50f7aa, "extensions", "windsurf", "dist", "extension.js"));
            }
          } catch {}
        }
      }
      PatchManager.addCandidate(_0x2cfa11, "/usr/share/windsurf/resources/app/extensions/windsurf/dist/extension.js");
    }
    return _0x2cfa11.find(_0x4f9091 => fs.existsSync(_0x4f9091)) || null;
  }
  static getStatus(_0x1d7de1, _0x1838da = "http://localhost:3006", _0x47fb14 = "http://localhost:3001") {
    const _0x20c3d0 = PatchManager.resolveExtensionJsPath(_0x1d7de1);
    if (!_0x20c3d0) {
      return {
        path: null,
        patches: getPatches().map(_0x53fbd9 => ({
          name: _0x53fbd9.name,
          status: "missing"
        }))
      };
    }
    const _0x828d41 = fs.readFileSync(_0x20c3d0, "utf-8");
    return {
      path: _0x20c3d0,
      patches: getPatches().map(_0x2199b5 => ({
        name: _0x2199b5.name,
        status: PatchManager.isPatched(_0x828d41, _0x2199b5, _0x1838da, _0x47fb14) ? "applied" : PatchManager.isAvailable(_0x828d41, _0x2199b5) ? "available" : "missing"
      }))
    };
  }
  static apply(_0x51ce6e) {
    const _0x196a36 = PatchManager.resolveExtensionJsPath(_0x51ce6e);
    if (!_0x196a36) {
      return {
        success: false,
        applied: 0,
        skipped: 0,
        failed: 0,
        details: ["找不到 Windsurf extension.js"]
      };
    }
    const _0x4307f0 = _0x196a36 + ".windsurf-bak";
    if (!fs.existsSync(_0x4307f0)) {
      fs.copyFileSync(_0x196a36, _0x4307f0);
    }
    let _0x301c50 = fs.readFileSync(_0x196a36, "utf-8");
    const _0x53574d = [];
    let _0x22b95d = 0;
    let _0x13e255 = 0;
    let _0x4215c5 = 0;
    for (const _0x185c45 of getPatches()) {
      if (PatchManager.isPatched(_0x301c50, _0x185c45)) {
        _0x13e255++;
        _0x53574d.push("[跳过] " + _0x185c45.name + " (已应用)");
        continue;
      }
      if (!PatchManager.isAvailable(_0x301c50, _0x185c45)) {
        _0x4215c5++;
        _0x53574d.push("[缺失] " + _0x185c45.name + " (当前版本不包含此模式)");
        continue;
      }
      const _0x2ddae0 = PatchManager.applyPatchContent(_0x301c50, _0x185c45, "http://localhost:3006", "http://localhost:3001");
      if (!_0x2ddae0.changed) {
        _0x4215c5++;
        _0x53574d.push("[失败] " + _0x185c45.name + " (匹配到但替换未生效)");
        continue;
      }
      _0x301c50 = _0x2ddae0.content;
      _0x22b95d++;
      _0x53574d.push("[成功] " + _0x185c45.name);
    }
    if (_0x22b95d > 0) {
      fs.writeFileSync(_0x196a36, _0x301c50, "utf-8");
      PatchManager.updateChecksum(_0x196a36);
    }
    const _0x2ce3cf = {
      success: _0x4215c5 === 0,
      applied: _0x22b95d,
      skipped: _0x13e255,
      failed: _0x4215c5,
      details: _0x53574d
    };
    return _0x2ce3cf;
  }
  static revert(_0xdc8049) {
    const _0x11b4ae = PatchManager.resolveExtensionJsPath(_0xdc8049);
    if (!_0x11b4ae) {
      return false;
    }
    const _0x41fbc2 = _0x11b4ae + ".windsurf-bak";
    if (!fs.existsSync(_0x41fbc2)) {
      return false;
    }
    fs.copyFileSync(_0x41fbc2, _0x11b4ae);
    PatchManager.updateChecksum(_0x11b4ae);
    return true;
  }
  static updateChecksum(_0x2e6365) {
    try {
      let _0x11f113 = path.dirname(_0x2e6365);
      let _0x33c069 = "";
      for (let _0x54a5b9 = 0; _0x54a5b9 < 8; _0x54a5b9++) {
        const _0x5d704d = path.join(_0x11f113, "product.json");
        if (fs.existsSync(_0x5d704d)) {
          _0x33c069 = _0x5d704d;
          break;
        }
        const _0x2d56b1 = path.dirname(_0x11f113);
        if (_0x2d56b1 === _0x11f113) {
          break;
        }
        _0x11f113 = _0x2d56b1;
      }
      if (!_0x33c069) {
        return;
      }
      const fileBuffer = fs.readFileSync(_0x2e6365);
      const _0x444246 = crypto.createHash("sha256").update(fileBuffer).digest("base64");
      let _0x1f4e0a = fs.readFileSync(_0x33c069, "utf-8");
      if (_0x1f4e0a.charCodeAt(0) === 65279) {
        _0x1f4e0a = _0x1f4e0a.substring(1);
      }
      const _0x568e8e = JSON.parse(_0x1f4e0a);
      if (_0x568e8e.checksums) {
        const _0x404311 = Object.keys(_0x568e8e.checksums).find(_0x210a7f => _0x210a7f.includes("extension.js"));
        if (_0x404311) {
          _0x568e8e.checksums[_0x404311] = _0x444246;
          fs.writeFileSync(_0x33c069, JSON.stringify(_0x568e8e, null, "\t"), "utf-8");
        }
      }
    } catch {}
  }
  static applyWithCustomUrls(_0x25c6c6, _0x167ced, _0x26f023) {
    const _0x4b658c = PatchManager.resolveExtensionJsPath(_0x26f023);
    if (!_0x4b658c) {
      return {
        success: false,
        applied: 0,
        skipped: 0,
        failed: 0,
        details: ["找不到 extension.js"]
      };
    }
    const _0x56b772 = _0x4b658c + ".windsurf-bak";
    if (!fs.existsSync(_0x56b772)) {
      fs.copyFileSync(_0x4b658c, _0x56b772);
    }
    let _0x23517a = fs.readFileSync(_0x4b658c, "utf-8");
    const _0x36287f = fs.existsSync(_0x56b772) ? fs.readFileSync(_0x56b772, "utf-8") : null;
    const _0x4ac271 = getPatches().some(_0x3ede24 => PatchManager.isPatched(_0x23517a, _0x3ede24, _0x25c6c6, _0x167ced));
    if (_0x4ac271 && _0x36287f) {
      _0x23517a = _0x36287f;
    }
    const _0x4b4efd = [];
    let _0x5306f7 = 0;
    let _0x40912d = 0;
    let _0x3541c3 = 0;
    for (const _0x1f2d62 of getPatches()) {
      if (PatchManager.isPatched(_0x23517a, _0x1f2d62, _0x25c6c6, _0x167ced)) {
        _0x40912d++;
        _0x4b4efd.push("[跳过] " + _0x1f2d62.name + " (已应用)");
        continue;
      }
      if (!PatchManager.isAvailable(_0x23517a, _0x1f2d62)) {
        _0x3541c3++;
        _0x4b4efd.push("[缺失] " + _0x1f2d62.name);
        continue;
      }
      const _0x1602ce = PatchManager.applyPatchContent(_0x23517a, _0x1f2d62, _0x25c6c6, _0x167ced);
      if (!_0x1602ce.changed) {
        _0x3541c3++;
        _0x4b4efd.push("[失败] " + _0x1f2d62.name);
        continue;
      }
      _0x23517a = _0x1602ce.content;
      _0x5306f7++;
      _0x4b4efd.push("[成功] " + _0x1f2d62.name);
    }
    if (_0x5306f7 > 0) {
      fs.writeFileSync(_0x4b658c, _0x23517a, "utf-8");
      PatchManager.updateChecksum(_0x4b658c);
    }
    const _0x55806e = {
      success: _0x3541c3 === 0,
      applied: _0x5306f7,
      skipped: _0x40912d,
      failed: _0x3541c3,
      details: _0x4b4efd
    };
    return _0x55806e;
  }
}
exports.PatchManager = PatchManager;
