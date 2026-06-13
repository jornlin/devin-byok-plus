const DEFAULT_TTL_MS = Number.parseInt(process.env.GATEWAY_CAPABILITY_TTL_MS || "3600000", 10);
const _cache = new Map();

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
  const entry = _cache.get(key);
  if (!entry) {
    return null;
  }
  const ttl = Number.isFinite(DEFAULT_TTL_MS) && DEFAULT_TTL_MS > 0 ? DEFAULT_TTL_MS : 3600000;
  if (now - entry.ts > ttl) {
    _cache.delete(key);
    return null;
  }
  return entry;
}

export function markGatewayCapability(key, patch) {
  const entry = {
    ...(_cache.get(key) || {}),
    ...patch,
    ts: Date.now()
  };
  _cache.set(key, entry);
  return entry;
}

export function clearGatewayCapabilityCache() {
  _cache.clear();
}

export function _getGatewayCapabilityCacheSizeForTests() {
  return _cache.size;
}
