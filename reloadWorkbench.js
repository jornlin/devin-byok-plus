'use strict';

var __createBinding = this && this.__createBinding || (Object.create ? function (_0x356a09, _0x13d9ab, _0x3926ff, _0x450527 = _0x3926ff) {
  var _0x3aad15 = Object.getOwnPropertyDescriptor(_0x13d9ab, _0x3926ff);
  if (!_0x3aad15 || ("get" in _0x3aad15 ? !_0x13d9ab.__esModule : _0x3aad15.writable || _0x3aad15.configurable)) {
    _0x3aad15 = {
      enumerable: true,
      get: function () {
        return _0x13d9ab[_0x3926ff];
      }
    };
  }
  Object.defineProperty(_0x356a09, _0x450527, _0x3aad15);
} : function (_0x38316f, _0x14d48a, _0x347968, _0x55d7d9 = _0x347968) {
  _0x38316f[_0x55d7d9] = _0x14d48a[_0x347968];
});
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function (_0x279c3d, _0x2cd709) {
  var _0x4c0f0d = {
    enumerable: true,
    value: _0x2cd709
  };
  Object.defineProperty(_0x279c3d, "default", _0x4c0f0d);
} : function (_0x372495, _0x2f8b11) {
  _0x372495.default = _0x2f8b11;
});
var __importStar = this && this.__importStar || function () {
  function _0x23b7a5(_0x3e3ac7) {
    _0x23b7a5 = Object.getOwnPropertyNames || function (_0x2f9b7f) {
      var _0xa9a0c2 = [];
      for (var _0x1e0974 in _0x2f9b7f) {
        if (Object.prototype.hasOwnProperty.call(_0x2f9b7f, _0x1e0974)) {
          _0xa9a0c2[_0xa9a0c2.length] = _0x1e0974;
        }
      }
      return _0xa9a0c2;
    };
    return _0x23b7a5(_0x3e3ac7);
  }
  return function (_0x5da9c3) {
    if (_0x5da9c3 && _0x5da9c3.__esModule) {
      return _0x5da9c3;
    }
    var _0x5531e3 = {};
    if (_0x5da9c3 != null) {
      for (var _0x3cb3ea = _0x23b7a5(_0x5da9c3), _0x5df391 = 0; _0x5df391 < _0x3cb3ea.length; _0x5df391++) {
        if (_0x3cb3ea[_0x5df391] !== "default") {
          __createBinding(_0x5531e3, _0x5da9c3, _0x3cb3ea[_0x5df391]);
        }
      }
    }
    __setModuleDefault(_0x5531e3, _0x5da9c3);
    return _0x5531e3;
  };
}();
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.reloadWorkbenchWindow = reloadWorkbenchWindow;
const vscode = __importStar(require("vscode"));
async function reloadWorkbenchWindow() {
  const _0x3da262 = await vscode.commands.getCommands();
  if (!_0x3da262.includes("workbench.action.reloadWindow")) {
    await vscode.window.showWarningMessage("当前 IDE 未提供 workbench.action.reloadWindow。请 Ctrl+Shift+P 搜索「Reload Window」或「重新加载窗口」；若仍无效请完全退出 Windsurf 再打开。");
    return;
  }
  await vscode.commands.executeCommand("workbench.action.reloadWindow");
}
