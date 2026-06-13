/**
 * Proxy 路径管理
 * 处理代理根目录、配置目录和文件路径的查找与管理
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const vscode = require('vscode');

/**
 * 查找 proxy-scripts 根目录
 */
function findProxyRoot(extensionPath) {
  // 检查扩展同级目录（开发模式）
  const parentDir = path.dirname(extensionPath);
  if (fs.existsSync(path.join(parentDir, 'src', 'hybrid-server.js'))) {
    return parentDir;
  }

  // 检查打包后的位置
  const bundledRoot = getBundledProxyRoot(extensionPath);
  if (bundledRoot) {
    return bundledRoot;
  }

  // 检查工作区
  const workspaceRoot = findWorkspaceProxyRoot();
  if (workspaceRoot) {
    return workspaceRoot;
  }

  // 默认返回 proxy-scripts 目录
  return path.join(extensionPath, 'proxy-scripts');
}

/**
 * 获取打包后的 proxy 根目录
 */
function getBundledProxyRoot(extensionPath) {
  const proxyScriptsDir = path.join(extensionPath, 'proxy-scripts');
  if (fs.existsSync(path.join(proxyScriptsDir, 'src', 'hybrid-server.js'))) {
    return proxyScriptsDir;
  }
  return null;
}

/**
 * 查找工作区中的 proxy-scripts
 */
function findWorkspaceProxyRoot() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  for (const folder of workspaceFolders) {
    const candidates = [
      path.join(folder.uri.fsPath, 'proxy-scripts'),
      path.join(folder.uri.fsPath, 'devin-byok-plus', 'proxy-scripts'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'src', 'hybrid-server.js'))) {
        return candidate;
      }
    }
  }

  return null;
}

/**
 * 是否使用持久化用户配置
 */
function usesPersistentUserConfig() {
  return true; // 默认使用持久化配置
}

/**
 * 获取用户配置目录
 */
function getUserConfigDir() {
  return path.join(os.homedir(), '.devin-byok-plus');
}

/**
 * 确保用户配置目录存在
 */
function ensureUserConfigDir() {
  const dir = getUserConfigDir();
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      console.error('[ProxyPaths] Failed to create user config dir:', error);
    }
  }
  return dir;
}

/**
 * 获取默认系统提示词文件路径
 */
function getDefaultSystemPromptFilePath() {
  const configDir = ensureUserConfigDir();
  return path.join(configDir, 'system-prompt.md');
}

/**
 * 查找旧版本 .env 配置文件
 */
function findLegacyEnvCandidates(proxyRoot) {
  const candidates = [];

  // 当前 proxy-scripts 目录
  candidates.push(path.join(proxyRoot, '.env'));

  // 用户配置目录（旧版本）
  const oldConfigDirs = [
    path.join(os.homedir(), '.devin-byok-plus'),
    path.join(os.homedir(), '.windsurf-byok-plus'),
  ];

  for (const dir of oldConfigDirs) {
    if (fs.existsSync(dir)) {
      candidates.push(path.join(dir, '.env'));
    }
  }

  return candidates.filter((p) => fs.existsSync(p));
}

/**
 * 查找旧版本系统提示词文件
 */
function findLegacySystemPromptCandidates() {
  const candidates = [];

  const oldConfigDirs = [
    path.join(os.homedir(), '.devin-byok-plus'),
    path.join(os.homedir(), '.windsurf-byok-plus'),
  ];

  for (const dir of oldConfigDirs) {
    const promptFile = path.join(dir, 'system-prompt.md');
    if (fs.existsSync(promptFile)) {
      candidates.push(promptFile);
    }
  }

  return candidates;
}

/**
 * 获取 .env 文件路径
 */
function getEnvFilePath(proxyRoot) {
  if (usesPersistentUserConfig()) {
    const configDir = ensureUserConfigDir();
    return path.join(configDir, '.env');
  }
  return path.join(proxyRoot, '.env');
}

/**
 * 迁移旧版本配置
 */
function migrateUserConfigIfNeeded(proxyRoot) {
  if (!usesPersistentUserConfig()) {
    return;
  }

  const newEnvPath = getEnvFilePath(proxyRoot);

  // 如果新配置已存在，不需要迁移
  if (fs.existsSync(newEnvPath)) {
    return;
  }

  // 查找旧版本 .env
  const legacyEnvFiles = findLegacyEnvCandidates(proxyRoot);
  if (legacyEnvFiles.length > 0) {
    try {
      // 复制第一个找到的配置文件
      fs.copyFileSync(legacyEnvFiles[0], newEnvPath);
      console.log('[ProxyPaths] Migrated .env from:', legacyEnvFiles[0]);
    } catch (error) {
      console.error('[ProxyPaths] Failed to migrate .env:', error);
    }
  }

  // 迁移系统提示词
  const newPromptPath = getDefaultSystemPromptFilePath();
  if (!fs.existsSync(newPromptPath)) {
    const legacyPromptFiles = findLegacySystemPromptCandidates();
    if (legacyPromptFiles.length > 0) {
      try {
        fs.copyFileSync(legacyPromptFiles[0], newPromptPath);
        console.log('[ProxyPaths] Migrated system-prompt.md from:', legacyPromptFiles[0]);
      } catch (error) {
        console.error('[ProxyPaths] Failed to migrate system-prompt.md:', error);
      }
    }
  }
}

module.exports = {
  findProxyRoot,
  getBundledProxyRoot,
  findWorkspaceProxyRoot,
  usesPersistentUserConfig,
  getUserConfigDir,
  ensureUserConfigDir,
  getDefaultSystemPromptFilePath,
  findLegacyEnvCandidates,
  findLegacySystemPromptCandidates,
  getEnvFilePath,
  migrateUserConfigIfNeeded,
};
