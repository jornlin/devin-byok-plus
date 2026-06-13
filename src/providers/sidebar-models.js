/**
 * 模型诊断和路由工具
 * 处理模型识别、诊断映射等
 */

'use strict';

/**
 * 诊断用 OpenAI 模型前缀
 */
const DIAGNOSTIC_OPENAI_PREFIXES = ['gpt-', 'MODEL_GPT'];

/**
 * 诊断模型映射表
 * 将内部诊断模型名映射到实际模型
 */
const DIAGNOSTIC_MODEL_MAP = {
  'gpt-5-4-low': 'gpt-5.4',
  'gpt-5-4-high': 'gpt-5.4',
  'gpt-5-4-xhigh': 'gpt-5.4',
  'gpt-5-4-xhigh-priority': 'gpt-5.4',
  'MODEL_GPT_5_LOW': 'gpt-5',
  'MODEL_GPT_5_MEDIUM': 'gpt-5',
  'MODEL_GPT_5_HIGH': 'gpt-5',
  'MODEL_CLAUDE_3_5_SONNET': 'claude-3-5-sonnet-20241022',
  'MODEL_CLAUDE_3_5_SONNET_LOW': 'claude-3-5-sonnet-20241022',
  'MODEL_CLAUDE_3_5_SONNET_MEDIUM': 'claude-3-5-sonnet-20241022',
  'MODEL_CLAUDE_3_5_SONNET_HIGH': 'claude-3-5-sonnet-20241022',
};

/**
 * 去除诊断模型名的 thinking 后缀
 */
function stripDiagnosticThinkingSuffix(modelId) {
  return String(modelId || '').replace(/-thinking$/i, '');
}

/**
 * 判断是否为诊断用 OpenAI 模型
 */
function isDiagnosticOpenAIModel(modelId) {
  const id = String(modelId || '').trim();
  return DIAGNOSTIC_OPENAI_PREFIXES.some((prefix) => id.startsWith(prefix));
}

/**
 * 解析诊断模型路由
 * 返回 { slot: 1|2|null, actualModel: string }
 */
function resolveDiagnosticModelRoute(modelId, envConfig) {
  const stripped = stripDiagnosticThinkingSuffix(modelId);
  const mapped = DIAGNOSTIC_MODEL_MAP[stripped] || stripped;

  // 检查是否匹配 BYOK #1
  const byok1Model = envConfig.BYOK_1_MODEL || '';
  if (byok1Model && modelIdMatches(mapped, byok1Model)) {
    return { slot: 1, actualModel: byok1Model };
  }

  // 检查是否匹配 BYOK #2
  const byok2Model = envConfig.BYOK_2_MODEL || '';
  if (byok2Model && modelIdMatches(mapped, byok2Model)) {
    return { slot: 2, actualModel: byok2Model };
  }

  // 如果是 OpenAI 模型且 #2 配置了 OpenAI，默认路由到 #2
  if (isDiagnosticOpenAIModel(mapped) && byok2Model) {
    return { slot: 2, actualModel: byok2Model };
  }

  return { slot: null, actualModel: mapped };
}

/**
 * 模型 ID 匹配检查（忽略版本号）
 */
function modelIdMatches(id1, id2) {
  const normalize = (id) =>
    String(id || '')
      .toLowerCase()
      .replace(/-\d{8}$/, '') // 移除日期后缀
      .replace(/[_\s]/g, '-');
  return normalize(id1) === normalize(id2);
}

/**
 * 检查模型路由诊断信息
 */
function checkModelRoutingDiagnostic(envConfig) {
  const diagnostics = [];

  const byok1 = envConfig.BYOK_1_MODEL || '';
  const byok2 = envConfig.BYOK_2_MODEL || '';

  if (!byok1 && !byok2) {
    diagnostics.push('⚠️ 未配置任何模型');
  }

  if (byok1) {
    diagnostics.push(`✅ BYOK #1: ${byok1}`);
  }
  if (byok2) {
    diagnostics.push(`✅ BYOK #2: ${byok2}`);
  }

  return diagnostics.join('\n');
}

/**
 * 展平模型列表
 */
function flattenModelIds(modelsResponse) {
  if (!modelsResponse || !Array.isArray(modelsResponse.data)) {
    return [];
  }

  return modelsResponse.data
    .map((model) => {
      if (typeof model === 'string') return model;
      if (model && typeof model.id === 'string') return model.id;
      if (model && typeof model.name === 'string') return model.name;
      return null;
    })
    .filter(Boolean);
}

/**
 * 规范化模型响应
 */
function normalizeModelsResponse(response) {
  if (!response) {
    return { data: [] };
  }

  // 如果已经是标准格式
  if (response.data && Array.isArray(response.data)) {
    return response;
  }

  // 如果是数组
  if (Array.isArray(response)) {
    return { data: response };
  }

  // 如果有 models 字段
  if (response.models && Array.isArray(response.models)) {
    return { data: response.models };
  }

  return { data: [] };
}

module.exports = {
  DIAGNOSTIC_OPENAI_PREFIXES,
  DIAGNOSTIC_MODEL_MAP,
  stripDiagnosticThinkingSuffix,
  isDiagnosticOpenAIModel,
  resolveDiagnosticModelRoute,
  modelIdMatches,
  checkModelRoutingDiagnostic,
  flattenModelIds,
  normalizeModelsResponse,
};
