/**
 * Sidebar 状态管理
 * 处理配置的读取、验证和存储
 */

'use strict';

const vscode = require('vscode');

/**
 * 存储键常量
 */
const STORAGE_KEYS = {
  AUTO_START_PROXY: 'devin-byok-plus.autoStartProxy',
  LEGACY_AUTO_START_PROXY: 'windsurf-byok-plus.autoStartProxy',
  LEGACY_AUTO_START_PROXY_2: 'devin-byok-plus.autoStartProxy',
  PATCH_EXTENSION_PATH: 'devin-byok-plus.patchExtensionPath',
  LEGACY_PATCH_EXTENSION_PATH: 'windsurf-byok-plus.patchExtensionPath',
  LEGACY_PATCH_EXTENSION_PATH_2: 'devin-byok-plus.patchExtensionPath',
};

/**
 * 默认系统提示词
 */
const DEFAULT_SYSTEM_PROMPT = [
  "You are Devin Local, Devin Desktop's software engineering assistant.",
  'Help the user solve coding tasks through implementation, debugging, code review, and repository-aware reasoning.',
  'Prioritize correctness, low-risk changes, and forward progress.',
].join('\n');

/**
 * 内置提示词模板
 */
const BUILT_IN_PROMPT_TEMPLATES = [
  {
    id: 'default',
    label: '默认工程助手',
    description: '通用编码、调试、代码审查',
    content: DEFAULT_SYSTEM_PROMPT,
  },
  {
    id: 'code-review',
    label: '代码审查增强',
    description: '优先发现逻辑风险、配置污染和回归点',
    content: [
      DEFAULT_SYSTEM_PROMPT,
      '',
      'Focus on code review before making changes.',
      'Identify root causes, config pollution, runtime mapping mistakes, compatibility risks, and regression paths.',
      'Prefer small, low-risk fixes and verify behavior with compile or targeted tests.',
      'When reporting findings, clearly separate confirmed issues from hypotheses.',
    ].join('\n'),
  },
  {
    id: 'slow-request',
    label: '慢请求诊断',
    description: '定位代理、模型加载、上游首包和网络耗时',
    content: [
      DEFAULT_SYSTEM_PROMPT,
      '',
      'When debugging slow requests, map the full request path first.',
      'Separate local proxy delay from upstream/network/model first-token latency using timing logs.',
      'Check model loading, runtime hot reload, provider host/key mapping, cache invalidation, and request forwarding.',
      'Avoid masking latency symptoms; fix wrong routing or config causes first.',
    ].join('\n'),
  },
  {
    id: 'frontend-ui',
    label: '前端 UI 实现',
    description: '侧重交互、布局、状态反馈和可用性',
    content: [
      DEFAULT_SYSTEM_PROMPT,
      '',
      'When building UI, prioritize clarity, responsive layout, accessible controls, and immediate state feedback.',
      'Keep user flows simple, avoid surprising destructive actions, and preserve existing styling conventions.',
      'Verify UI data flow from controls to persisted config and runtime behavior.',
    ].join('\n'),
  },
  {
    id: 'backend-debug',
    label: '后端接口调试',
    description: '侧重接口链路、错误处理和运行时状态',
    content: [
      DEFAULT_SYSTEM_PROMPT,
      '',
      'When debugging backend or proxy code, trace inputs, normalized config, runtime config, network calls, and error propagation.',
      'Add or use targeted diagnostics instead of guessing.',
      'Prefer fixes that address the authoritative state and all relevant call sites.',
    ].join('\n'),
  },
  {
    id: 'zh-concise',
    label: '中文简洁模式',
    description: '中文回复，直接给结论和执行结果',
    content: [
      DEFAULT_SYSTEM_PROMPT,
      '',
      'Respond in Chinese unless the user asks otherwise.',
      'Be concise and direct. Start with the conclusion, then list actions and verification results.',
      'Use short Markdown sections and avoid unnecessary background explanation.',
    ].join('\n'),
  },
];

/**
 * Sidebar 配置状态管理器
 */
class SidebarState {
  constructor(context) {
    this.context = context;
    this.globalState = context.globalState;
  }

  /**
   * 获取自动启动代理配置（兼容旧版本）
   */
  getAutoStartProxy() {
    const current = this.globalState.get(STORAGE_KEYS.AUTO_START_PROXY);
    if (current !== undefined) {
      return current;
    }

    // 兼容旧版本配置
    const legacy1 = this.globalState.get(STORAGE_KEYS.LEGACY_AUTO_START_PROXY);
    if (legacy1 === true) {
      this.setAutoStartProxy(true);
      return true;
    }

    const legacy2 = this.globalState.get(STORAGE_KEYS.LEGACY_AUTO_START_PROXY_2);
    if (legacy2 === true) {
      this.setAutoStartProxy(true);
      return true;
    }

    return false;
  }

  /**
   * 设置自动启动代理配置
   */
  async setAutoStartProxy(value) {
    await this.globalState.update(STORAGE_KEYS.AUTO_START_PROXY, value);
  }

  /**
   * 获取补丁路径（兼容旧版本）
   */
  getPatchExtensionPath() {
    const current = this.globalState.get(STORAGE_KEYS.PATCH_EXTENSION_PATH);
    if (current) {
      return current;
    }

    // 兼容旧版本
    const legacy1 = this.globalState.get(STORAGE_KEYS.LEGACY_PATCH_EXTENSION_PATH);
    if (legacy1) {
      this.setPatchExtensionPath(legacy1);
      return legacy1;
    }

    const legacy2 = this.globalState.get(STORAGE_KEYS.LEGACY_PATCH_EXTENSION_PATH_2);
    if (legacy2) {
      this.setPatchExtensionPath(legacy2);
      return legacy2;
    }

    return '';
  }

  /**
   * 设置补丁路径
   */
  async setPatchExtensionPath(path) {
    await this.globalState.update(STORAGE_KEYS.PATCH_EXTENSION_PATH, path || undefined);
  }

  /**
   * 清除补丁路径
   */
  async clearPatchExtensionPath() {
    await this.setPatchExtensionPath('');
  }
}

module.exports = {
  SidebarState,
  STORAGE_KEYS,
  DEFAULT_SYSTEM_PROMPT,
  BUILT_IN_PROMPT_TEMPLATES,
};
