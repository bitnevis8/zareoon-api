/**
 * لایه کش حرفه‌ای — Production: Redis | Development: حافظهٔ درون‌پردازه‌ای
 */
const config = require("config");

const NAMESPACES = {
  ALL: "all",
  PRODUCTS: "products",
  INVENTORY: "inventory",
  SEARCH: "search",
  SETTINGS: "settings",
  HOMEPAGE: "homepage",
};

const DEFAULT_CACHE_CONFIG = {
  enabled: true,
  ttlProducts: 120,
  ttlInventory: 60,
  ttlHomepage: 45,
  ttlSearch: 30,
  ttlSettings: 300,
};

let redisClient = null;
let redisStatus = {
  enabledByConfig: false,
  connected: false,
  lastError: null,
  mode: "memory",
  host: null,
  port: null,
};

const memoryStore = new Map(); // key -> { value, expiresAt }

function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function getRedisConfig() {
  try {
    if (!config.has("REDIS")) {
      return { ENABLED: false, HOST: "127.0.0.1", PORT: 6379, PASSWORD: "", DB: 0, KEY_PREFIX: "zareoon:" };
    }
    return {
      ENABLED: config.get("REDIS.ENABLED") !== false && config.get("REDIS.ENABLED") !== "false",
      HOST: config.has("REDIS.HOST") ? config.get("REDIS.HOST") : "127.0.0.1",
      PORT: Number(config.has("REDIS.PORT") ? config.get("REDIS.PORT") : 6379) || 6379,
      PASSWORD: config.has("REDIS.PASSWORD") ? String(config.get("REDIS.PASSWORD") || "") : "",
      DB: Number(config.has("REDIS.DB") ? config.get("REDIS.DB") : 0) || 0,
      KEY_PREFIX: config.has("REDIS.KEY_PREFIX") ? String(config.get("REDIS.KEY_PREFIX") || "zareoon:") : "zareoon:",
    };
  } catch {
    return { ENABLED: false, HOST: "127.0.0.1", PORT: 6379, PASSWORD: "", DB: 0, KEY_PREFIX: "zareoon:" };
  }
}

function prefixKey(key) {
  const { KEY_PREFIX } = getRedisConfig();
  return `${KEY_PREFIX}${key}`;
}

async function initRedis() {
  const cfg = getRedisConfig();
  redisStatus.enabledByConfig = Boolean(cfg.ENABLED) && isProduction();
  redisStatus.host = cfg.HOST;
  redisStatus.port = cfg.PORT;
  redisStatus.mode = redisStatus.enabledByConfig ? "redis" : "memory";

  if (!redisStatus.enabledByConfig) {
    console.log("ℹ️ Cache mode: in-memory (Redis فقط در production و ENABLED=true)");
    return null;
  }

  try {
    const Redis = require("ioredis");
    const opts = {
      host: cfg.HOST,
      port: cfg.PORT,
      db: cfg.DB,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: 5000,
      retryStrategy(times) {
        if (times > 8) return null;
        return Math.min(times * 200, 2000);
      },
    };
    if (cfg.PASSWORD) opts.password = cfg.PASSWORD;

    redisClient = new Redis(opts);
    redisClient.on("error", (err) => {
      redisStatus.connected = false;
      redisStatus.lastError = err.message || String(err);
    });
    redisClient.on("connect", () => {
      redisStatus.connected = true;
      redisStatus.lastError = null;
    });
    redisClient.on("ready", () => {
      redisStatus.connected = true;
      redisStatus.lastError = null;
      redisStatus.mode = "redis";
    });
    redisClient.on("end", () => {
      redisStatus.connected = false;
    });

    await redisClient.connect();
    await redisClient.ping();
    redisStatus.connected = true;
    redisStatus.lastError = null;
    console.log(`✅ Redis connected (${cfg.HOST}:${cfg.PORT} db=${cfg.DB})`);
    return redisClient;
  } catch (e) {
    redisStatus.connected = false;
    redisStatus.lastError = e.message || String(e);
    redisStatus.mode = "memory";
    console.warn("⚠️ Redis unavailable — falling back to memory cache:", redisStatus.lastError);
    try {
      if (redisClient) await redisClient.quit();
    } catch {
      /* ignore */
    }
    redisClient = null;
    return null;
  }
}

function useRedis() {
  return Boolean(redisClient && redisStatus.connected);
}

/** تنظیمات TTL از site_settings (با کش کوتاه در حافظه) */
let cachedAdminConfig = null;
let cachedAdminConfigAt = 0;

async function loadAdminCacheConfig() {
  const now = Date.now();
  if (cachedAdminConfig && now - cachedAdminConfigAt < 5000) {
    return cachedAdminConfig;
  }
  try {
    const { getCacheConfig } = require("../../modules/siteSetting/service");
    cachedAdminConfig = await getCacheConfig();
  } catch {
    cachedAdminConfig = { ...DEFAULT_CACHE_CONFIG };
  }
  cachedAdminConfigAt = now;
  return cachedAdminConfig;
}

function invalidateAdminConfigCache() {
  cachedAdminConfig = null;
  cachedAdminConfigAt = 0;
}

async function isCacheEnabled() {
  const cfg = await loadAdminCacheConfig();
  return cfg.enabled !== false;
}

async function getTtl(kind) {
  const cfg = await loadAdminCacheConfig();
  const map = {
    products: cfg.ttlProducts,
    inventory: cfg.ttlInventory,
    homepage: cfg.ttlHomepage,
    search: cfg.ttlSearch,
    settings: cfg.ttlSettings,
  };
  const n = Number(map[kind]);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_CACHE_CONFIG[`ttl${kind[0].toUpperCase()}${kind.slice(1)}`] || 60;
  return Math.min(Math.floor(n), 86400);
}

function memoryGet(key) {
  const row = memoryStore.get(key);
  if (!row) return null;
  if (row.expiresAt && Date.now() > row.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return row.value;
}

function memorySet(key, value, ttlSec) {
  const expiresAt = ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0;
  memoryStore.set(key, { value, expiresAt });
}

async function get(key) {
  if (!(await isCacheEnabled())) return null;
  const full = prefixKey(key);
  try {
    if (useRedis()) {
      const raw = await redisClient.get(full);
      if (raw == null) return null;
      return JSON.parse(raw);
    }
  } catch (e) {
    redisStatus.lastError = e.message || String(e);
  }
  return memoryGet(full);
}

async function set(key, value, ttlSec) {
  if (!(await isCacheEnabled())) return false;
  const ttl = Math.max(0, Number(ttlSec) || 0);
  const full = prefixKey(key);
  try {
    if (useRedis()) {
      const payload = JSON.stringify(value);
      if (ttl > 0) await redisClient.set(full, payload, "EX", ttl);
      else await redisClient.set(full, payload);
      return true;
    }
  } catch (e) {
    redisStatus.lastError = e.message || String(e);
  }
  memorySet(full, value, ttl);
  return true;
}

async function del(key) {
  const full = prefixKey(key);
  memoryStore.delete(full);
  try {
    if (useRedis()) await redisClient.del(full);
  } catch (e) {
    redisStatus.lastError = e.message || String(e);
  }
}

async function delByPattern(pattern) {
  const fullPattern = prefixKey(pattern);
  // memory
  for (const k of [...memoryStore.keys()]) {
    if (matchGlob(k, fullPattern)) memoryStore.delete(k);
  }
  if (!useRedis()) return { deleted: 0, mode: "memory" };

  let deleted = 0;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redisClient.scan(cursor, "MATCH", fullPattern, "COUNT", 200);
      cursor = next;
      if (keys.length) {
        deleted += await redisClient.del(...keys);
      }
    } while (cursor !== "0");
  } catch (e) {
    redisStatus.lastError = e.message || String(e);
  }
  return { deleted, mode: "redis" };
}

function matchGlob(str, pattern) {
  // ساده: فقط * در انتها/وسط
  const re = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`
  );
  return re.test(str);
}

async function flushNamespace(ns) {
  const map = {
    [NAMESPACES.PRODUCTS]: "products:*",
    [NAMESPACES.INVENTORY]: "inventory:*",
    [NAMESPACES.SEARCH]: "search:*",
    [NAMESPACES.SETTINGS]: "settings:*",
    [NAMESPACES.HOMEPAGE]: "homepage:*",
    [NAMESPACES.ALL]: "*",
  };
  const pattern = map[ns] || map[NAMESPACES.ALL];
  return delByPattern(pattern);
}

async function wrap(key, ttlSec, producer) {
  const hit = await get(key);
  if (hit !== null && hit !== undefined) {
    return { data: hit, cache: "HIT" };
  }
  const data = await producer();
  await set(key, data, ttlSec);
  return { data, cache: "MISS" };
}

async function getStatus() {
  const cfg = getRedisConfig();
  const admin = await loadAdminCacheConfig();
  let redisInfo = null;
  if (useRedis()) {
    try {
      const info = await redisClient.info("memory");
      const used = /used_memory_human:(\S+)/.exec(info);
      const keys = await redisClient.dbsize();
      redisInfo = {
        usedMemory: used ? used[1] : null,
        dbKeys: keys,
      };
    } catch (e) {
      redisInfo = { error: e.message };
    }
  }
  return {
    production: isProduction(),
    mode: useRedis() ? "redis" : "memory",
    redis: {
      configured: Boolean(cfg.ENABLED),
      productionOnly: true,
      host: cfg.HOST,
      port: cfg.PORT,
      db: cfg.DB,
      keyPrefix: cfg.KEY_PREFIX,
      hasPassword: Boolean(cfg.PASSWORD),
      connected: redisStatus.connected,
      lastError: redisStatus.lastError,
      info: redisInfo,
    },
    cacheConfig: admin,
    memoryKeys: memoryStore.size,
    namespaces: Object.values(NAMESPACES),
  };
}

async function pingRedis() {
  if (!redisClient) return { ok: false, message: "Redis client not initialized (non-production or disabled)" };
  try {
    const pong = await redisClient.ping();
    redisStatus.connected = pong === "PONG";
    return { ok: redisStatus.connected, message: pong };
  } catch (e) {
    redisStatus.connected = false;
    redisStatus.lastError = e.message || String(e);
    return { ok: false, message: redisStatus.lastError };
  }
}

module.exports = {
  NAMESPACES,
  DEFAULT_CACHE_CONFIG,
  initRedis,
  get,
  set,
  del,
  delByPattern,
  flushNamespace,
  wrap,
  getStatus,
  pingRedis,
  getTtl,
  isCacheEnabled,
  loadAdminCacheConfig,
  invalidateAdminConfigCache,
  getRedisConfig,
};
