const fs = require('fs');
const path = require('path');
const os = require('os');
const { sanitizeMaxTokens, sanitizeContextWindow } = require('./maxTokens');

const PROFILES_FILE = 'profiles.json';

function getUserConfigDir() {
  if (process.env.DEVIN_BYOK_CONFIG_DIR) {
    return process.env.DEVIN_BYOK_CONFIG_DIR;
  }
  return path.join(os.homedir(), '.devin-byok-plus');
}

function ensureUserConfigDir() {
  const dir = getUserConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getProfilesPath() {
  return path.join(ensureUserConfigDir(), PROFILES_FILE);
}

const PROTOCOL_VALUES = ['', 'anthropic', 'openai', 'gemini'];

function sanitizeProtocol(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return PROTOCOL_VALUES.includes(normalized) ? normalized : '';
}

const MODEL_LIST_MODE_VALUES = ['inject', 'replace', 'off'];

/**
 * 模型列表接管模式清洗。缺省/非法值回落 inject（保留官方模型 + 追加 BYOK 槽位）。
 */
function sanitizeModelListMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return MODEL_LIST_MODE_VALUES.includes(normalized) ? normalized : 'replace';
}

function createDefaultProfile(envConfig = {}) {
  return {
    id: generateProfileId(),
    name: '方案 1',
    balanceToken: envConfig.BYOK1_BALANCE_TOKEN || '',
    userId: envConfig.BYOK1_USER_ID || '',
    byok1: {
      host: envConfig.BYOK1_ANTHROPIC_API_HOST || '',
      key: envConfig.BYOK1_ANTHROPIC_API_KEY || '',
      model: envConfig.BYOK1_MODEL || '',
      thinkingEffort: envConfig.BYOK1_THINKING_EFFORT || '',
      protocol: sanitizeProtocol(envConfig.BYOK1_PROTOCOL),
      anthropicPath: envConfig.BYOK1_ANTHROPIC_API_PATH || '',
      openaiPath: envConfig.BYOK1_OPENAI_API_PATH || '',
    },
    byok2: {
      host: envConfig.BYOK2_ANTHROPIC_API_HOST || '',
      key: envConfig.BYOK2_ANTHROPIC_API_KEY || '',
      model: envConfig.BYOK2_MODEL || '',
      thinkingEffort: envConfig.BYOK2_THINKING_EFFORT || '',
      protocol: sanitizeProtocol(envConfig.BYOK2_PROTOCOL),
      anthropicPath: envConfig.BYOK2_ANTHROPIC_API_PATH || '',
      openaiPath: envConfig.BYOK2_OPENAI_API_PATH || '',
    },
    byok3: {
      host: envConfig.BYOK3_ANTHROPIC_API_HOST || '',
      key: envConfig.BYOK3_ANTHROPIC_API_KEY || '',
      model: envConfig.BYOK3_MODEL || '',
      thinkingEffort: envConfig.BYOK3_THINKING_EFFORT || '',
      protocol: sanitizeProtocol(envConfig.BYOK3_PROTOCOL),
      anthropicPath: envConfig.BYOK3_ANTHROPIC_API_PATH || '',
      openaiPath: envConfig.BYOK3_OPENAI_API_PATH || '',
    },
    byok4: {
      host: envConfig.BYOK4_ANTHROPIC_API_HOST || '',
      key: envConfig.BYOK4_ANTHROPIC_API_KEY || '',
      model: envConfig.BYOK4_MODEL || '',
      thinkingEffort: envConfig.BYOK4_THINKING_EFFORT || '',
      protocol: sanitizeProtocol(envConfig.BYOK4_PROTOCOL),
      anthropicPath: envConfig.BYOK4_ANTHROPIC_API_PATH || '',
      openaiPath: envConfig.BYOK4_OPENAI_API_PATH || '',
    },
    advanced: {
      hybridPort: envConfig.HYBRID_PORT || '',
      inferencePort: envConfig.INFERENCE_PORT || '',
      anthropicPath: envConfig.ANTHROPIC_API_PATH || '/v1/messages',
      openaiPath: envConfig.OPENAI_API_PATH || '/v1/responses',
      maxTokens: String(sanitizeMaxTokens(envConfig.MAX_TOKENS)),
      contextWindow: String(sanitizeContextWindow(envConfig.CONTEXT_WINDOW)),
      completionTimeout: envConfig.COMPLETION_TIMEOUT_MS || '12000',
      modelListMode: sanitizeModelListMode(envConfig.MODEL_LIST_MODE),
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function generateProfileId() {
  return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function readProfiles() {
  const filePath = getProfilesPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!data.version || !Array.isArray(data.profiles) || typeof data.activeId !== 'string') {
      throw new Error('Invalid profiles.json structure');
    }

    data.profiles = data.profiles.map((p) => normalizeProfile(p));
    return data;
  } catch (err) {
    console.error('[ProfileStore] Failed to read profiles.json:', err);
    return null;
  }
}

function emptySlot() {
  return {
    host: '',
    key: '',
    model: '',
    thinkingEffort: '',
    protocol: '',
    anthropicPath: '',
    openaiPath: '',
  };
}

function normalizeSlot(slot) {
  const merged = { ...emptySlot(), ...(slot || {}) };
  merged.protocol = sanitizeProtocol(merged.protocol);
  return merged;
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== 'object') {
    return profile;
  }
  if (profile.balanceToken === undefined) profile.balanceToken = '';
  if (profile.userId === undefined) profile.userId = '';
  profile.byok1 = normalizeSlot(profile.byok1);
  profile.byok2 = normalizeSlot(profile.byok2);
  profile.byok3 = normalizeSlot(profile.byok3);
  profile.byok4 = normalizeSlot(profile.byok4);
  profile.advanced = profile.advanced || {};
  return profile;
}

function writeProfiles(data) {
  const filePath = getProfilesPath();
  const content = JSON.stringify(data, null, 2);

  try {
    fs.writeFileSync(filePath, content, { mode: 0o600, encoding: 'utf-8' });
  } catch (err) {
    console.error('[ProfileStore] Failed to write profiles.json:', err);
    throw err;
  }
}

function migrateFromEnv(envConfig) {
  const profile = createDefaultProfile(envConfig);
  const data = {
    version: 1,
    profiles: [profile],
    activeId: profile.id,
  };

  writeProfiles(data);
  console.log('[ProfileStore] Migrated .env to profiles.json, activeId:', profile.id);

  return data;
}

function ensureProfilesExist(envConfig) {
  const existing = readProfiles();
  if (existing) {
    return existing;
  }

  return migrateFromEnv(envConfig);
}

function detectModelProtocol(model) {
  const normalized = String(model || '').trim().toLowerCase().replace(/-thinking$/i, '');
  if (!normalized) return '';
  if (/^gemini-|^model_google_gemini|^models\/gemini-/.test(normalized)) return 'gemini';
  if (/^gpt-|^o[0-9][a-z0-9.-]*|^chatgpt-|^model_gpt/.test(normalized)) return 'openai';
  if (/^claude-|^model_claude/.test(normalized)) return 'anthropic';
  return '';
}

function resolveEffectiveProtocol(slot) {
  const manual = sanitizeProtocol(slot && slot.protocol);
  if (manual) return manual;
  return detectModelProtocol(slot && slot.model);
}

function listProfiles(envConfig) {
  const data = ensureProfilesExist(envConfig);
  return {
    profiles: data.profiles.map((p) => {
      const b1 = normalizeSlot(p.byok1);
      const b2 = normalizeSlot(p.byok2);
      const b3 = normalizeSlot(p.byok3);
      const b4 = normalizeSlot(p.byok4);
      return {
        id: p.id,
        name: p.name,
        isActive: p.id === data.activeId,
        byok1Configured: !!(b1.key && b1.model),
        byok2Configured: !!(b2.key && b2.model),
        byok3Configured: !!(b3.key && b3.model),
        byok4Configured: !!(b4.key && b4.model),
        byok1Display: b1.host || 'api.anthropic.com',
        byok1Model: b1.model,
        byok1Protocol: resolveEffectiveProtocol(b1),
        byok1ProtocolManual: sanitizeProtocol(b1.protocol),
        byok1ThinkingEffort: b1.thinkingEffort || '',
        byok2Display: b2.host || 'api.anthropic.com',
        byok2Model: b2.model,
        byok2Protocol: resolveEffectiveProtocol(b2),
        byok2ProtocolManual: sanitizeProtocol(b2.protocol),
        byok2ThinkingEffort: b2.thinkingEffort || '',
        byok3Display: b3.host || 'api.anthropic.com',
        byok3Model: b3.model,
        byok3Protocol: resolveEffectiveProtocol(b3),
        byok3ProtocolManual: sanitizeProtocol(b3.protocol),
        byok3ThinkingEffort: b3.thinkingEffort || '',
        byok4Display: b4.host || 'api.anthropic.com',
        byok4Model: b4.model,
        byok4Protocol: resolveEffectiveProtocol(b4),
        byok4ProtocolManual: sanitizeProtocol(b4.protocol),
        byok4ThinkingEffort: b4.thinkingEffort || '',
        // 方案列表显示单次输出上限，便于一眼区分不同方案的配置
        maxTokens: sanitizeMaxTokens((p.advanced || {}).maxTokens),
        contextWindow: sanitizeContextWindow((p.advanced || {}).contextWindow),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    }),
    activeId: data.activeId,
  };
}

function getActiveProfile(envConfig) {
  const data = ensureProfilesExist(envConfig);
  const active = data.profiles.find((p) => p.id === data.activeId);

  if (!active) {
    const fallback = data.profiles[0];
    data.activeId = fallback.id;
    writeProfiles(data);
    return fallback;
  }

  return active;
}

function getProfileById(id, envConfig) {
  const data = ensureProfilesExist(envConfig);
  return data.profiles.find((p) => p.id === id) || null;
}

function createProfile(name, envConfig) {
  const data = ensureProfilesExist(envConfig);

  const profile = {
    ...createDefaultProfile(),
    name: name || `方案 ${data.profiles.length + 1}`,
  };

  data.profiles.push(profile);
  writeProfiles(data);

  return profile;
}

function updateProfile(id, updates, envConfig) {
  const data = ensureProfilesExist(envConfig);
  const profile = data.profiles.find((p) => p.id === id);

  if (!profile) {
    throw new Error(`Profile not found: ${id}`);
  }

  Object.assign(profile, updates, { updatedAt: Date.now() });
  writeProfiles(data);

  return profile;
}

function deleteProfile(id, envConfig) {
  const data = ensureProfilesExist(envConfig);

  if (data.profiles.length === 1) {
    throw new Error('Cannot delete the last profile');
  }

  const index = data.profiles.findIndex((p) => p.id === id);
  if (index === -1) {
    throw new Error(`Profile not found: ${id}`);
  }

  data.profiles.splice(index, 1);

  if (data.activeId === id) {
    data.activeId = data.profiles[0].id;
  }

  writeProfiles(data);

  return { deletedId: id, newActiveId: data.activeId };
}

function activateProfile(id, envConfig) {
  const data = ensureProfilesExist(envConfig);
  const profile = data.profiles.find((p) => p.id === id);

  if (!profile) {
    throw new Error(`Profile not found: ${id}`);
  }

  data.activeId = id;
  writeProfiles(data);

  return profile;
}

function renameProfile(id, newName, envConfig) {
  if (!newName || !newName.trim()) {
    throw new Error('Profile name cannot be empty');
  }

  return updateProfile(id, { name: newName.trim() }, envConfig);
}

function duplicateProfile(id, envConfig) {
  const data = ensureProfilesExist(envConfig);
  const source = data.profiles.find((p) => p.id === id);

  if (!source) {
    throw new Error(`Profile not found: ${id}`);
  }

  const duplicate = {
    ...JSON.parse(JSON.stringify(source)),
    id: generateProfileId(),
    name: source.name + ' (副本)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  data.profiles.push(duplicate);
  writeProfiles(data);

  return duplicate;
}

function projectToEnvConfig(profile) {
  const b1 = normalizeSlot(profile.byok1);
  const b2 = normalizeSlot(profile.byok2);
  const b3 = normalizeSlot(profile.byok3);
  const b4 = normalizeSlot(profile.byok4);
  const adv = profile.advanced || {};
  return {
    BYOK1_ANTHROPIC_API_HOST: b1.host || '',
    BYOK1_ANTHROPIC_API_KEY: b1.key || '',
    BYOK1_ANTHROPIC_API_PATH: b1.anthropicPath || '',
    BYOK1_OPENAI_API_HOST: b1.host || '',
    BYOK1_OPENAI_API_KEY: b1.key || '',
    BYOK1_OPENAI_API_PATH: b1.openaiPath || '',
    BYOK1_MODEL: b1.model || '',
    BYOK1_THINKING_EFFORT: b1.thinkingEffort || '',
    BYOK1_PROTOCOL: b1.protocol || '',

    BYOK2_ANTHROPIC_API_HOST: b2.host || '',
    BYOK2_ANTHROPIC_API_KEY: b2.key || '',
    BYOK2_ANTHROPIC_API_PATH: b2.anthropicPath || '',
    BYOK2_OPENAI_API_HOST: b2.host || '',
    BYOK2_OPENAI_API_KEY: b2.key || '',
    BYOK2_OPENAI_API_PATH: b2.openaiPath || '',
    BYOK2_MODEL: b2.model || '',
    BYOK2_THINKING_EFFORT: b2.thinkingEffort || '',
    BYOK2_PROTOCOL: b2.protocol || '',

    BYOK3_ANTHROPIC_API_HOST: b3.host || '',
    BYOK3_ANTHROPIC_API_KEY: b3.key || '',
    BYOK3_ANTHROPIC_API_PATH: b3.anthropicPath || '',
    BYOK3_OPENAI_API_HOST: b3.host || '',
    BYOK3_OPENAI_API_KEY: b3.key || '',
    BYOK3_OPENAI_API_PATH: b3.openaiPath || '',
    BYOK3_MODEL: b3.model || '',
    BYOK3_THINKING_EFFORT: b3.thinkingEffort || '',
    BYOK3_PROTOCOL: b3.protocol || '',

    BYOK4_ANTHROPIC_API_HOST: b4.host || '',
    BYOK4_ANTHROPIC_API_KEY: b4.key || '',
    BYOK4_ANTHROPIC_API_PATH: b4.anthropicPath || '',
    BYOK4_OPENAI_API_HOST: b4.host || '',
    BYOK4_OPENAI_API_KEY: b4.key || '',
    BYOK4_OPENAI_API_PATH: b4.openaiPath || '',
    BYOK4_MODEL: b4.model || '',
    BYOK4_THINKING_EFFORT: b4.thinkingEffort || '',
    BYOK4_PROTOCOL: b4.protocol || '',

    ANTHROPIC_API_PATH: adv.anthropicPath || '/v1/messages',
    OPENAI_API_PATH: adv.openaiPath || '/v1/responses',
    MAX_TOKENS: String(sanitizeMaxTokens(adv.maxTokens)),
    CONTEXT_WINDOW: String(sanitizeContextWindow(adv.contextWindow)),
    COMPLETION_TIMEOUT_MS: adv.completionTimeout || '12000',
    MODEL_LIST_MODE: sanitizeModelListMode(adv.modelListMode),

    HYBRID_PORT: adv.hybridPort || '',
    INFERENCE_PORT: adv.inferencePort || '',
  };
}

module.exports = {
  listProfiles,
  getActiveProfile,
  getProfileById,
  createProfile,
  updateProfile,
  deleteProfile,
  activateProfile,
  renameProfile,
  duplicateProfile,
  projectToEnvConfig,
  ensureProfilesExist,
  createDefaultProfile,
  sanitizeProtocol,
  sanitizeModelListMode,
  detectModelProtocol,
  resolveEffectiveProtocol,
};
