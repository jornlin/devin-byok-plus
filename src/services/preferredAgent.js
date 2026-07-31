/**
 * Devin 默认 Agent 偏好管理
 *
 * 背景：Devin 的新建标签页默认选中「Devin Local」（connector id = devin-cli），
 * 判定逻辑在 workbench 的 pOn() 兜底：
 *   KEe(id) = id.toLowerCase().startsWith("devin") && id !== "devin-cloud"
 * 即 preferredAgent 未设置时，任何 id 以 devin 开头的 agent 都会被当成默认值。
 *
 * 而 Devin Local 走的是 ACP 协议 + 独立的 devin CLI 二进制，**不经过本插件的代理**，
 * 它的模型清单来自 ACP 的 availableModels，与我们注入的 client_model_configs 无关，
 * 因此在该模式下模型下拉框显示 "None selected"，必须手动切到 Cascade 才能用 BYOK。
 *
 * 把 preferredAgent 设为 Cascade 的哨兵值 `__cascade__` 即可让新标签页默认用 Cascade。
 * 逻辑链（workbench 的 qJ()）：p === O7 → N 为 null → 落到 F → 返回 O7（Cascade）。
 *
 * 注意：这是 Devin 自身的 settings.json（用户级配置），不是本插件的 .env。
 * 用 VS Code 配置 API 写入而非手改文件——settings.json 允许注释（JSONC），
 * 直接 JSON.parse 会失败，且 API 能保留格式、原子写入。
 */

'use strict';

/** Cascade 在 agent 体系里的哨兵值（workbench 中的 O7 常量） */
const CASCADE_SENTINEL = '__cascade__';

/** 配置项路径。Devin 内部是 dualRead（windsurf.* 与 devin.* 都读），故两个都要写 */
const CONFIG_SECTIONS = ['devin.acp', 'windsurf.acp'];
const CONFIG_KEY = 'preferredAgent';

/**
 * 读取当前的 preferredAgent。
 * @param {Object} vscode
 * @returns {string} 当前值；未设置时为空串
 */
function readPreferredAgent(vscode) {
  for (const section of CONFIG_SECTIONS) {
    try {
      const value = vscode.workspace.getConfiguration(section).get(CONFIG_KEY);
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    } catch {
      // 配置 API 不可用（如测试桩），忽略
    }
  }
  return '';
}

/**
 * 当前是否已默认使用 Cascade。
 * @param {Object} vscode
 * @returns {boolean}
 */
function isCascadePreferred(vscode) {
  return readPreferredAgent(vscode) === CASCADE_SENTINEL;
}

/**
 * 当前是否被用户设成了别的 agent（既非 Cascade 也非未设置）。
 * 这种情况下不应擅自覆盖——用户可能确实想默认用 claude-code 之类。
 * @param {Object} vscode
 * @returns {string} 用户选的其他 agent id；没有则空串
 */
function getForeignPreference(vscode) {
  const current = readPreferredAgent(vscode);
  return current && current !== CASCADE_SENTINEL ? current : '';
}

/**
 * 写入 preferredAgent（两个前缀都写）。
 * @param {Object} vscode
 * @param {string|undefined} value - 传 undefined 表示清除该项
 */
async function writePreferredAgent(vscode, value) {
  const target = vscode.ConfigurationTarget?.Global ?? 1;
  const errors = [];
  for (const section of CONFIG_SECTIONS) {
    try {
      await vscode.workspace.getConfiguration(section).update(CONFIG_KEY, value, target);
    } catch (err) {
      errors.push(section + ': ' + (err instanceof Error ? err.message : String(err)));
    }
  }
  if (errors.length === CONFIG_SECTIONS.length) {
    throw new Error(errors.join('；'));
  }
}

/**
 * 应用「默认使用 Cascade」开关。
 *
 * 开启：仅在当前未设置时写入哨兵值。若用户已手动指定了别的 agent，则保持不动
 *       并回报该事实，避免覆盖用户的主动选择。
 * 关闭：仅在当前值确实是哨兵值时清除，回落到 Devin 自身的默认行为。
 *
 * 幂等：重复调用不会产生副作用。
 *
 * @param {Object} vscode
 * @param {boolean} enabled
 * @returns {Promise<{changed:boolean, skipped:boolean, foreign:string, mode:string}>}
 */
async function applyCascadePreference(vscode, enabled) {
  const foreign = getForeignPreference(vscode);
  if (enabled) {
    if (foreign) {
      // 用户主动选了别的 agent —— 尊重它，不覆盖
      return { changed: false, skipped: true, foreign, mode: 'on' };
    }
    if (isCascadePreferred(vscode)) {
      return { changed: false, skipped: false, foreign: '', mode: 'on' };
    }
    await writePreferredAgent(vscode, CASCADE_SENTINEL);
    return { changed: true, skipped: false, foreign: '', mode: 'on' };
  }
  if (isCascadePreferred(vscode)) {
    await writePreferredAgent(vscode, undefined);
    return { changed: true, skipped: false, foreign: '', mode: 'off' };
  }
  return { changed: false, skipped: false, foreign, mode: 'off' };
}

module.exports = {
  CASCADE_SENTINEL,
  CONFIG_SECTIONS,
  CONFIG_KEY,
  readPreferredAgent,
  isCascadePreferred,
  getForeignPreference,
  writePreferredAgent,
  applyCascadePreference,
};
