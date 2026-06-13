/**
 * Proxy 配置管理
 * 处理配置文件的读取、写入和迁移
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * 端口解析和验证
 */
function parsePort(value, defaultPort) {
  const num = Number.parseInt(String(value || ''), 10);
  if (Number.isInteger(num) && num > 0 && num <= 65535) {
    return num;
  }
  return defaultPort;
}

/**
 * 获取 Hybrid 端口
 */
function getHybridPort(config) {
  return parsePort(config?.HYBRID_PORT, 3006);
}

/**
 * 获取 Inference 端口
 */
function getInferencePort(config) {
  return parsePort(config?.INFERENCE_PORT, 3001);
}

/**
 * 从配置中提取端口
 */
function portsFromConfig(config) {
  return {
    hybridPort: getHybridPort(config),
    inferencePort: getInferencePort(config),
  };
}

/**
 * 去除 URL 协议前缀
 */
function stripProtocol(url) {
  return String(url || '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

/**
 * 规范化系统提示词路径
 */
function normalizeSystemPromptPathValue(rawPath) {
  if (!rawPath) return '';

  const normalized = String(rawPath).trim();
  if (!normalized) return '';

  // 展开用户目录
  if (normalized.startsWith('~/')) {
    return path.join(os.homedir(), normalized.slice(2));
  }

  // 展开环境变量
  if (normalized.startsWith('$')) {
    const match = normalized.match(/^\$([A-Z_][A-Z0-9_]*)(.*)/i);
    if (match) {
      const envVar = match[1];
      const rest = match[2];
      const envValue = process.env[envVar];
      if (envValue) {
        return path.join(envValue, rest);
      }
    }
  }

  return normalized;
}

/**
 * 获取完成超时时间（毫秒）
 */
function getCompletionTimeoutMs(config) {
  const val = config?.COMPLETION_TIMEOUT_MS;
  const num = Number.parseInt(String(val || ''), 10);
  if (Number.isInteger(num) && num >= 1000 && num <= 600000) {
    return num;
  }
  return 120000; // 默认 2 分钟
}

/**
 * 获取系统提示词配置路径
 */
function getSystemPromptConfigPath(config) {
  const raw = config?.SYSTEM_PROMPT_PATH || '';
  return normalizeSystemPromptPathValue(raw);
}

/**
 * 解析系统提示词的实际路径
 */
function getResolvedSystemPromptPath(config) {
  const configPath = getSystemPromptConfigPath(config);
  if (!configPath) return '';

  // 如果是绝对路径且文件存在
  if (path.isAbsolute(configPath) && fs.existsSync(configPath)) {
    return configPath;
  }

  return '';
}

/**
 * 读取 .env 配置文件
 */
function readEnvConfig(envFilePath) {
  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(envFilePath, 'utf-8');
    const config = {};

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
      if (match) {
        const key = match[1];
        let value = match[2].trim();

        // 去除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        config[key] = value;
      }
    }

    return config;
  } catch (error) {
    console.error('[ProxyConfig] Failed to read .env:', error);
    return {};
  }
}

/**
 * 写入 .env 配置文件
 */
function writeEnvConfig(envFilePath, config) {
  const lines = ['# Devin BYOK Plus Configuration', '# Auto-generated', ''];

  const keys = Object.keys(config).sort();
  for (const key of keys) {
    const value = config[key];
    if (value === undefined || value === null) {
      continue;
    }

    // 如果值包含特殊字符，加引号
    const needsQuotes = /[\s"'$#\\]/.test(String(value));
    const quotedValue = needsQuotes ? `"${String(value).replace(/"/g, '\\"')}"` : value;

    lines.push(`${key}=${quotedValue}`);
  }

  lines.push(''); // 末尾空行

  try {
    fs.writeFileSync(envFilePath, lines.join('\n'), 'utf-8');
    return true;
  } catch (error) {
    console.error('[ProxyConfig] Failed to write .env:', error);
    return false;
  }
}

/**
 * 构建运行时配置补丁
 */
function buildRuntimeConfigPatch(config) {
  const patch = {};

  // 端口配置
  if (config.HYBRID_PORT) {
    patch.HYBRID_PORT = String(config.HYBRID_PORT);
  }
  if (config.INFERENCE_PORT) {
    patch.INFERENCE_PORT = String(config.INFERENCE_PORT);
  }

  // API 配置
  if (config.BYOK_1_HOST) {
    patch.BYOK_1_HOST = stripProtocol(config.BYOK_1_HOST);
  }
  if (config.BYOK_1_KEY) {
    patch.BYOK_1_KEY = config.BYOK_1_KEY;
  }
  if (config.BYOK_1_MODEL) {
    patch.BYOK_1_MODEL = config.BYOK_1_MODEL;
  }

  if (config.BYOK_2_HOST) {
    patch.BYOK_2_HOST = stripProtocol(config.BYOK_2_HOST);
  }
  if (config.BYOK_2_KEY) {
    patch.BYOK_2_KEY = config.BYOK_2_KEY;
  }
  if (config.BYOK_2_MODEL) {
    patch.BYOK_2_MODEL = config.BYOK_2_MODEL;
  }

  // 超时配置
  if (config.COMPLETION_TIMEOUT_MS) {
    patch.COMPLETION_TIMEOUT_MS = String(config.COMPLETION_TIMEOUT_MS);
  }

  // 系统提示词配置
  if (config.SYSTEM_PROMPT_PATH) {
    patch.SYSTEM_PROMPT_PATH = config.SYSTEM_PROMPT_PATH;
  }
  if (config.SYSTEM_PROMPT_OVERRIDE) {
    patch.SYSTEM_PROMPT_OVERRIDE = config.SYSTEM_PROMPT_OVERRIDE;
  }

  return patch;
}

module.exports = {
  parsePort,
  getHybridPort,
  getInferencePort,
  portsFromConfig,
  stripProtocol,
  normalizeSystemPromptPathValue,
  getCompletionTimeoutMs,
  getSystemPromptConfigPath,
  getResolvedSystemPromptPath,
  readEnvConfig,
  writeEnvConfig,
  buildRuntimeConfigPatch,
};
