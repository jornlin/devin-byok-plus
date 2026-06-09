'use strict';

const vscode = require('vscode');
const { SidebarProvider } = require('./sidebarProvider');
const { ProxyManager } = require('./proxyManager');
const { PatchManager } = require('./patchManager');
const { reloadWorkbenchWindow } = require('./reloadWorkbench');
const { getDeviceId, getClientVersion } = require('./integrity');

let proxyManager;
const KEY_AUTO_START_PROXY = 'devin-byok-bridge.autoStartProxy';
const LEGACY_KEY_AUTO_START_PROXY = 'windsurf-byok-bridge.autoStartProxy';

function activate(context) {
  const extensionPath = context.extensionPath;
  const deviceId = getDeviceId(context);
  const clientVersion = getClientVersion(extensionPath);
  proxyManager = new ProxyManager(context, deviceId, clientVersion);
  const sidebar = new SidebarProvider(context, proxyManager);

  if (context.globalState.get(KEY_AUTO_START_PROXY) === undefined && context.globalState.get(LEGACY_KEY_AUTO_START_PROXY) === true) {
    context.globalState.update(KEY_AUTO_START_PROXY, true);
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('devin-byok-bridge.sidebar', sidebar),
    vscode.commands.registerCommand('devin-byok-bridge.startProxy', async () => {
      const ok = await proxyManager.start('both', sidebar.getRuntimeConfigForCurrentMode());
      if (ok) {
        await sidebar.ensurePatchAppliedAfterProxyStart(true);
        vscode.window.showInformationMessage('Devin BYOK Bridge 已启动');
        sidebar.refresh();
      }
    }),
    vscode.commands.registerCommand('devin-byok-bridge.stopProxy', () => {
      proxyManager.stop();
      vscode.window.showInformationMessage('Devin BYOK Bridge 已停止');
      sidebar.refresh();
    }),
    vscode.commands.registerCommand('devin-byok-bridge.applyPatch', async () => {
      const status = proxyManager.getStatus();
      const result = PatchManager.applyWithCustomUrls(
        PatchManager.loopbackApiUrl(status.hybridPort),
        PatchManager.loopbackApiUrl(status.inferencePort)
      );
      if (result.applied > 0) {
        vscode.window.showInformationMessage('已应用 ' + result.applied + ' 个补丁，需重启 Devin Desktop', '重启 Devin').then(choice => {
          if (choice === '重启 Devin') reloadWorkbenchWindow();
        });
      } else if (result.skipped > 0) {
        vscode.window.showInformationMessage('所有补丁已是最新');
      } else {
        vscode.window.showWarningMessage('未找到可应用的补丁，可能 Devin Desktop 版本不兼容');
      }
      sidebar.refresh();
    }),
    vscode.commands.registerCommand('devin-byok-bridge.revertPatch', async () => {
      if (PatchManager.revert()) {
        vscode.window.showInformationMessage('补丁已还原，需重启 Devin Desktop');
      } else {
        vscode.window.showWarningMessage('未找到备份文件');
      }
      sidebar.refresh();
    }),
    vscode.commands.registerCommand('devin-byok-bridge.reloadWorkbench', () => reloadWorkbenchWindow())
  );

  if (context.globalState.get(KEY_AUTO_START_PROXY) === true) {
    setTimeout(() => {
      proxyManager.start('both', sidebar.getRuntimeConfigForCurrentMode()).then(ok => {
        if (ok) sidebar.refresh();
      });
    }, 2000);
  }
  console.log('[Devin BYOK Bridge] 扩展已就绪');
}

function deactivate() {
  proxyManager?.dispose();
}

exports.activate = activate;
exports.deactivate = deactivate;
