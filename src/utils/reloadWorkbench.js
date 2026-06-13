'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.reloadWorkbenchWindow = reloadWorkbenchWindow;
const vscode = require("vscode");
async function reloadWorkbenchWindow() {
  const tmp0 = await vscode.commands.getCommands();
  if (!tmp0.includes("workbench.action.reloadWindow")) {
    await vscode.window.showWarningMessage("当前 IDE 未提供 workbench.action.reloadWindow。请 Ctrl+Shift+P 搜索「Reload Window」或「重新加载窗口」；若仍无效请完全退出 Devin Desktop 再打开。");
    return;
  }
  await vscode.commands.executeCommand("workbench.action.reloadWindow");
}
