'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function readJsonIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readTextIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return '';
    }
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function stripProto(host) {
  return String(host || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function parseTomlQuotedValue(line) {
  const quoted = line.match(/=\s*"((?:\\.|[^"\\])*)"/);
  if (quoted) {
    return quoted[1].replace(/\\"/g, '"');
  }
  const bare = line.split('=').slice(1).join('=').trim();
  return bare.replace(/^['"]|['"]$/g, '');
}

function parseCodexConfigToml(text) {
  const result = {
    modelProvider: '',
    baseUrl: '',
    model: '',
    bearerToken: '',
    reasoningEffort: ''
  };
  if (!text) {
    return result;
  }
  let section = '';
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    const keyMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
    if (!keyMatch) {
      continue;
    }
    const key = keyMatch[1];
    if (key === 'model_provider' && !section) {
      result.modelProvider = parseTomlQuotedValue(line);
    } else if (key === 'model' && !section) {
      result.model = parseTomlQuotedValue(line);
    } else if (key === 'reasoning_effort' && !section) {
      result.reasoningEffort = parseTomlQuotedValue(line);
    } else if (key === 'base_url') {
      if (!section) {
        if (!result.baseUrl) {
          result.baseUrl = parseTomlQuotedValue(line);
        }
      } else if (section.startsWith('model_providers.')) {
        const providerId = section.slice('model_providers.'.length);
        if (!result.modelProvider || providerId === result.modelProvider) {
          result.baseUrl = parseTomlQuotedValue(line);
        }
      }
    } else if (key === 'experimental_bearer_token' && section.startsWith('model_providers.')) {
      const providerId = section.slice('model_providers.'.length);
      if (!result.modelProvider || providerId === result.modelProvider) {
        result.bearerToken = parseTomlQuotedValue(line);
      }
    }
  }
  if (result.modelProvider) {
    const sectionName = 'model_providers.' + result.modelProvider;
    let inSection = false;
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line === '[' + sectionName + ']') {
        inSection = true;
        continue;
      }
      if (/^\[/.test(line)) {
        inSection = false;
        continue;
      }
      if (!inSection) {
        continue;
      }
      if (line.startsWith('base_url')) {
        result.baseUrl = parseTomlQuotedValue(line);
      } else if (line.startsWith('experimental_bearer_token')) {
        result.bearerToken = parseTomlQuotedValue(line);
      }
    }
  }
  return result;
}

function readClaudeUserConfig(homeDir = os.homedir()) {
  const candidates = [path.join(homeDir, '.claude', 'settings.json'), path.join(homeDir, '.claude', 'claude.json')];
  let filePath = '';
  let settings = null;
  for (const candidate of candidates) {
    settings = readJsonIfExists(candidate);
    if (settings) {
      filePath = candidate;
      break;
    }
  }
  if (!settings) {
    return {
      ok: false,
      error: '未找到 Claude 用户配置，请确认 ~/.claude/settings.json 存在（CC Switch 切换 Claude 后会写入）'
    };
  }
  const env = settings.env && typeof settings.env === 'object' ? settings.env : {};
  const host = stripProto(env.ANTHROPIC_BASE_URL || '');
  const apiKey = firstNonEmpty(env.ANTHROPIC_AUTH_TOKEN, env.ANTHROPIC_API_KEY, env.OPENROUTER_API_KEY);
  const model = firstNonEmpty(env.ANTHROPIC_DEFAULT_OPUS_MODEL, env.ANTHROPIC_DEFAULT_SONNET_MODEL, env.ANTHROPIC_MODEL, env.ANTHROPIC_DEFAULT_HAIKU_MODEL);
  if (!apiKey && !host) {
    return {
      ok: false,
      error: 'Claude 配置中未找到 API Key 或 Base URL',
      filePath
    };
  }
  return {
    ok: true,
    source: 'claude',
    label: 'Claude 用户配置',
    filePath,
    host,
    apiKey,
    model,
    thinkingEffort: ''
  };
}

function readCodexUserConfig(homeDir = os.homedir()) {
  const codexDir = path.join(homeDir, '.codex');
  const authPath = path.join(codexDir, 'auth.json');
  const configPath = path.join(codexDir, 'config.toml');
  const auth = readJsonIfExists(authPath);
  const configText = readTextIfExists(configPath);
  if (!auth && !configText) {
    return {
      ok: false,
      error: '未找到 Codex/GPT 用户配置，请确认 ~/.codex/auth.json 或 config.toml 存在（CC Switch 切换 Codex 后会写入）'
    };
  }
  const parsed = parseCodexConfigToml(configText);
  const apiKey = firstNonEmpty(auth && auth.OPENAI_API_KEY, parsed.bearerToken);
  const host = stripProto(parsed.baseUrl || '');
  const model = parsed.model || '';
  const thinkingEffort = parsed.reasoningEffort || '';
  if (!apiKey) {
    return {
      ok: false,
      error: '当前 Codex 配置未找到 OPENAI_API_KEY（可能是 OAuth 官方登录）；请在 CC Switch 切换到带 API Key 的 GPT 供应商',
      filePath: authPath
    };
  }
  if (!host) {
    return {
      ok: false,
      error: 'Codex 配置中未找到 base_url；请确认 CC Switch 已启用 GPT/Codex 供应商',
      filePath: configPath
    };
  }
  return {
    ok: true,
    source: 'codex',
    label: 'Codex/GPT 用户配置',
    filePath: configPath,
    host,
    apiKey,
    model,
    thinkingEffort
  };
}

function readExternalUserConfig(source, homeDir = os.homedir()) {
  const normalized = String(source || 'claude').trim().toLowerCase();
  if (normalized === 'codex' || normalized === 'gpt' || normalized === 'openai') {
    return readCodexUserConfig(homeDir);
  }
  return readClaudeUserConfig(homeDir);
}

module.exports = {
  readClaudeUserConfig,
  readCodexUserConfig,
  readExternalUserConfig,
  stripProto
};
