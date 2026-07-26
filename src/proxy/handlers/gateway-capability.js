import fs from "node:fs";
import path from "node:path";

const DEFAULT_TTL_MS = Number.parseInt(process.env.GATEWAY_CAPABILITY_TTL_MS || "3600000", 10);
const _cache = new Map();
let _cachePath = String(process.env.GATEWAY_CAPABILITY_CACHE_PATH || "").trim();
let _loadedFromDisk = false;
let _persistWarningShown = false;

function normalizePart(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function buildGatewayCapabilityKey({
  protocol,
  host,
  port,
  apiPath,
  providerKind,
  slot
}) {
  return [protocol, host, port, apiPath, providerKind, slot].map(normalizePart).join("|");
}

export function getGatewayCapability(key, now = Date.now()) {
  loadCacheFromDisk();
  const entry = _cache.get(key);
  if (!entry) {
    return null;
  }
  const ttl = Number.isFinite(DEFAULT_TTL_MS) && DEFAULT_TTL_MS > 0 ? DEFAULT_TTL_MS : 3600000;
  if (now - entry.ts > ttl) {
    _cache.delete(key);
    persistCacheToDisk();
    return null;
  }
  return entry;
}

export function markGatewayCapability(key, patch) {
  loadCacheFromDisk();
  const entry = {
    ...(_cache.get(key) || {}),
    ...patch,
    ts: Date.now()
  };
  _cache.set(key, entry);
  persistCacheToDisk();
  return entry;
}

export function clearGatewayCapabilityCache() {
  _cache.clear();
  _loadedFromDisk = true;
  if (_cachePath) {
    try {
      fs.rmSync(_cachePath, {
        force: true
      });
    } catch (error) {
      warnPersistOnce(error);
    }
  }
}

export function _getGatewayCapabilityCacheSizeForTests() {
  return _cache.size;
}

export function _setGatewayCapabilityCachePathForTests(cachePath) {
  _cachePath = String(cachePath || "").trim();
  _cache.clear();
  _loadedFromDisk = false;
  _persistWarningShown = false;
}

export function _resetGatewayCapabilityMemoryForTests() {
  _cache.clear();
  _loadedFromDisk = false;
}

function loadCacheFromDisk() {
  if (_loadedFromDisk) {
    return;
  }
  _loadedFromDisk = true;
  if (!_cachePath) {
    return;
  }
  try {
    const raw = fs.readFileSync(_cachePath, "utf8");
    const parsed = JSON.parse(raw);
    const entries = parsed && typeof parsed === "object" ? parsed.entries || parsed : {};
    if (!entries || typeof entries !== "object") {
      return;
    }
    for (const [key, entry] of Object.entries(entries)) {
      if (!key || !entry || typeof entry !== "object" || !Number.isFinite(entry.ts)) {
        continue;
      }
      _cache.set(key, entry);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      warnPersistOnce(error);
    }
  }
}

function persistCacheToDisk() {
  if (!_cachePath) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(_cachePath), {
      recursive: true
    });
    const entries = {};
    for (const [key, entry] of _cache.entries()) {
      entries[key] = entry;
    }
    fs.writeFileSync(_cachePath, JSON.stringify({
      version: 1,
      entries
    }, null, 2), "utf8");
  } catch (error) {
    warnPersistOnce(error);
  }
}

function warnPersistOnce(error) {
  if (_persistWarningShown) {
    return;
  }
  _persistWarningShown = true;
  console.warn("  ⚠️  Gateway capability cache persistence disabled: " + (error?.message || error));
}
