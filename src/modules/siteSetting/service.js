const SiteSetting = require("./model");

const TRADE_PROVIDERS_AUTO_APPROVE = "tradeProvidersAutoApprove";
const SHOPS_AUTO_APPROVE = "shopsAutoApprove";
const PAGE_DELETION_GRACE_DAYS = "pageDeletionGraceDays";
const VIP_TRADE_CATEGORIES = "vipTradeCategories";
const ENABLED_LANGUAGES = "enabledLanguages";
const BLOCKED_PAGE_SLUGS = "blockedPageSlugs";
const PUBLIC_PAGE_SLUG_RULES = "publicPageSlugRules";
const CACHE_CONFIG = "cacheConfig";

const ALL_LANGUAGE_CODES = ["fa", "es", "en", "ar", "nl", "tr", "ru", "ur", "fi"];

const DEFAULT_PUBLIC_PAGE_SLUG_RULES = {
  minLength: 5,
  maxLength: 30,
};

const DEFAULT_CACHE_CONFIG = {
  enabled: true,
  ttlProducts: 120,
  ttlInventory: 60,
  ttlHomepage: 45,
  ttlSearch: 30,
  ttlSettings: 300,
};

function clampTtl(n, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) return fallback;
  return Math.min(Math.floor(v), 86400);
}

async function getCacheConfig() {
  const raw = await getJsonSetting(CACHE_CONFIG, {});
  return {
    enabled: raw.enabled !== false,
    ttlProducts: clampTtl(raw.ttlProducts, DEFAULT_CACHE_CONFIG.ttlProducts),
    ttlInventory: clampTtl(raw.ttlInventory, DEFAULT_CACHE_CONFIG.ttlInventory),
    ttlHomepage: clampTtl(raw.ttlHomepage, DEFAULT_CACHE_CONFIG.ttlHomepage),
    ttlSearch: clampTtl(raw.ttlSearch, DEFAULT_CACHE_CONFIG.ttlSearch),
    ttlSettings: clampTtl(raw.ttlSettings, DEFAULT_CACHE_CONFIG.ttlSettings),
  };
}

async function updateCacheConfig(patch = {}) {
  const current = await getCacheConfig();
  const next = {
    enabled: patch.enabled !== undefined ? !!patch.enabled : current.enabled,
    ttlProducts: patch.ttlProducts !== undefined ? clampTtl(patch.ttlProducts, current.ttlProducts) : current.ttlProducts,
    ttlInventory: patch.ttlInventory !== undefined ? clampTtl(patch.ttlInventory, current.ttlInventory) : current.ttlInventory,
    ttlHomepage: patch.ttlHomepage !== undefined ? clampTtl(patch.ttlHomepage, current.ttlHomepage) : current.ttlHomepage,
    ttlSearch: patch.ttlSearch !== undefined ? clampTtl(patch.ttlSearch, current.ttlSearch) : current.ttlSearch,
    ttlSettings: patch.ttlSettings !== undefined ? clampTtl(patch.ttlSettings, current.ttlSettings) : current.ttlSettings,
  };
  await setJsonSetting(CACHE_CONFIG, next);
  try {
    const cache = require("../../core/cache/cacheService");
    cache.invalidateAdminConfigCache();
  } catch {
    /* ignore */
  }
  return next;
}

const DEFAULT_VIP_MESSAGE = {
  fa: "این بخش VIP است و عضویت در آن امکان‌پذیر نیست.",
  en: "This is a VIP section. Membership is not available.",
  ru: "Это VIP-раздел. Регистрация недоступна.",
};

function parseBool(value, defaultValue = false) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

async function getBoolSetting(key, defaultValue = false) {
  const row = await SiteSetting.findByPk(key);
  if (!row) return defaultValue;
  return parseBool(row.value, defaultValue);
}

async function setBoolSetting(key, value) {
  await SiteSetting.upsert({ key, value: !!value });
}

async function getJsonSetting(key, defaultValue = {}) {
  const row = await SiteSetting.findByPk(key);
  if (!row || row.value == null) return defaultValue;
  if (typeof row.value === "object") return row.value;
  try {
    return JSON.parse(row.value);
  } catch {
    return defaultValue;
  }
}

async function setJsonSetting(key, value) {
  await SiteSetting.upsert({ key, value });
}

async function isTradeProvidersAutoApprove() {
  return getBoolSetting(TRADE_PROVIDERS_AUTO_APPROVE, true);
}

async function isShopsAutoApprove() {
  return getBoolSetting(SHOPS_AUTO_APPROVE, true);
}

async function getPageDeletionGraceDays() {
  const row = await SiteSetting.findByPk(PAGE_DELETION_GRACE_DAYS);
  if (!row || row.value == null) return 30;
  const n = Number(row.value);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(Math.floor(n), 365);
}

async function setPageDeletionGraceDays(days) {
  const n = Number(days);
  const value = Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 365) : 30;
  await SiteSetting.upsert({ key: PAGE_DELETION_GRACE_DAYS, value });
  return value;
}

async function getVipTradeCategoriesConfig() {
  return getJsonSetting(VIP_TRADE_CATEGORIES, {});
}

async function getVipCategoryConfig(categoryId) {
  const all = await getVipTradeCategoriesConfig();
  return all[categoryId] || null;
}

async function isCategoryVipExclusive(categoryId) {
  const cfg = await getVipCategoryConfig(categoryId);
  return cfg?.enabled === true;
}

async function getExclusiveProviderIds(categoryId) {
  const cfg = await getVipCategoryConfig(categoryId);
  if (!cfg?.enabled) return [];
  return Array.isArray(cfg.exclusiveProviderIds)
    ? cfg.exclusiveProviderIds.map(Number).filter(Boolean)
    : [];
}

async function upsertVipCategoryConfig(categoryId, patch) {
  const all = await getVipTradeCategoriesConfig();
  all[categoryId] = { ...(all[categoryId] || {}), ...patch };
  await setJsonSetting(VIP_TRADE_CATEGORIES, all);
  return all[categoryId];
}

async function updateVipTradeCategoriesConfig(categories) {
  if (categories !== undefined) {
    await setJsonSetting(VIP_TRADE_CATEGORIES, categories || {});
  }
  return getVipTradeCategoriesConfig();
}

function resolveVipMessage(cfg, lang = "fa") {
  if (cfg?.messageMode === "default") {
    return DEFAULT_VIP_MESSAGE[lang] || DEFAULT_VIP_MESSAGE.fa;
  }
  const msg = cfg?.message;
  if (msg) {
    if (typeof msg === "string") return msg;
    return msg[lang] || msg.fa || DEFAULT_VIP_MESSAGE.fa;
  }
  return DEFAULT_VIP_MESSAGE[lang] || DEFAULT_VIP_MESSAGE.fa;
}

async function validateRegistrationForServices(normalizedServices, lang = "fa") {
  const vipConfig = await getVipTradeCategoriesConfig();
  const seen = new Set();
  /** بسته‌بندی و آماده‌سازی — خدمت اختصاصی زارعون؛ عضویت آزاد ندارد */
  const PLATFORM_OWNED = new Set(["packaging-prep"]);

  for (const svc of normalizedServices) {
    if (seen.has(svc.categoryId)) continue;
    seen.add(svc.categoryId);

    if (PLATFORM_OWNED.has(svc.categoryId)) {
      return {
        ok: false,
        categoryId: svc.categoryId,
        message:
          lang === "en"
            ? "This service is operated exclusively by Zareoon. Provider registration is not available."
            : "این خدمت به‌صورت اختصاصی توسط زارعون ارائه می‌شود و عضویت ارائه‌دهنده برای آن فعال نیست.",
      };
    }

    const cfg = vipConfig[svc.categoryId];
    if (cfg?.enabled) {
      return {
        ok: false,
        categoryId: svc.categoryId,
        message: resolveVipMessage(cfg, lang),
      };
    }
  }

  return { ok: true };
}

async function filterPublicProviders(items, categoryFilter) {
  if (!categoryFilter) return items;

  const vip = await getVipCategoryConfig(categoryFilter);
  if (!vip?.enabled) return items;

  const exclusiveIds = await getExclusiveProviderIds(categoryFilter);
  return items.filter((row) => exclusiveIds.includes(Number(row.id)));
}

async function getTradeSettings() {
  return {
    tradeProvidersAutoApprove: await isTradeProvidersAutoApprove(),
    shopsAutoApprove: await isShopsAutoApprove(),
    pageDeletionGraceDays: await getPageDeletionGraceDays(),
    vipTradeCategories: await getVipTradeCategoriesConfig(),
  };
}

async function updateTradeSettings({
  tradeProvidersAutoApprove,
  shopsAutoApprove,
  pageDeletionGraceDays,
  vipTradeCategories,
}) {
  if (tradeProvidersAutoApprove !== undefined) {
    await setBoolSetting(TRADE_PROVIDERS_AUTO_APPROVE, tradeProvidersAutoApprove);
  }
  if (shopsAutoApprove !== undefined) {
    await setBoolSetting(SHOPS_AUTO_APPROVE, shopsAutoApprove);
  }
  if (pageDeletionGraceDays !== undefined) {
    await setPageDeletionGraceDays(pageDeletionGraceDays);
  }
  if (vipTradeCategories !== undefined) {
    await updateVipTradeCategoriesConfig(vipTradeCategories);
  }
  return getTradeSettings();
}

async function getPublicVipCategories() {
  const config = await getVipTradeCategoriesConfig();
  const publicMap = {};

  for (const [categoryId, cfg] of Object.entries(config)) {
    if (!cfg?.enabled) continue;
    publicMap[categoryId] = {
      enabled: true,
      messageMode:
        cfg.messageMode === "default"
          ? "default"
          : cfg.messageMode === "custom" || cfg.message
            ? "custom"
            : "default",
      message:
        cfg.messageMode === "default"
          ? DEFAULT_VIP_MESSAGE
          : cfg.message || DEFAULT_VIP_MESSAGE,
      bannerImage: cfg.messageMode !== "default" && cfg.bannerImage ? cfg.bannerImage : null,
    };
  }

  return publicMap;
}

function normalizeLanguageCodes(codes) {
  if (!Array.isArray(codes)) return [...ALL_LANGUAGE_CODES];
  const unique = [...new Set(codes.map((c) => String(c || "").trim().toLowerCase()))].filter((c) =>
    ALL_LANGUAGE_CODES.includes(c)
  );
  if (!unique.includes("fa")) unique.unshift("fa");
  return unique.length ? unique : [...ALL_LANGUAGE_CODES];
}

async function getEnabledLanguages() {
  const stored = await getJsonSetting(ENABLED_LANGUAGES, null);
  if (!stored) return [...ALL_LANGUAGE_CODES];
  let next = normalizeLanguageCodes(stored);

  // One-time migrations for languages added after the setting was first saved.
  const migrations = [
    { code: "es", flag: "enabledLanguagesEsV1" },
    { code: "nl", flag: "enabledLanguagesNlV1" },
  ];
  let changed = false;
  for (const { code, flag } of migrations) {
    if (!next.includes(code) && ALL_LANGUAGE_CODES.includes(code)) {
      const migrated = await getBoolSetting(flag, false);
      if (!migrated) {
        next = normalizeLanguageCodes([...next, code]);
        await setBoolSetting(flag, true);
        changed = true;
      }
    }
  }
  if (changed) await setJsonSetting(ENABLED_LANGUAGES, next);
  return next;
}

async function updateEnabledLanguages(codes) {
  const next = normalizeLanguageCodes(codes);
  await setJsonSetting(ENABLED_LANGUAGES, next);
  return next;
}

function normalizeBlockedSlugs(list) {
  if (!Array.isArray(list)) return [];
  const { normalizeToken } = require("../../utils/reservedUsernamesCatalog");
  const unique = [
    ...new Set(
      list
        .map((item) => normalizeToken(item))
        .filter((s) => s && s.length >= 2 && !/^\d+$/.test(s))
    ),
  ];
  return unique.sort();
}

async function ensureBlockedPageSlugsSeeded() {
  const row = await SiteSetting.findByPk(BLOCKED_PAGE_SLUGS);
  if (row && row.value != null) {
    const current = Array.isArray(row.value) ? row.value : [];
    if (current.length > 0) {
      return { seeded: false, slugs: normalizeBlockedSlugs(current) };
    }
  }
  const { getDefaultReservedSlugs } = require("../../utils/reservedUsernamesCatalog");
  const defaults = normalizeBlockedSlugs(getDefaultReservedSlugs());
  await setJsonSetting(BLOCKED_PAGE_SLUGS, defaults);
  return { seeded: true, slugs: defaults };
}

async function getBlockedPageSlugs() {
  const { slugs } = await ensureBlockedPageSlugsSeeded();
  return slugs;
}

async function updateBlockedPageSlugs(list) {
  const next = normalizeBlockedSlugs(list);
  await setJsonSetting(BLOCKED_PAGE_SLUGS, next);
  return next;
}

async function resetBlockedPageSlugsFromCatalog() {
  const { getDefaultReservedSlugs } = require("../../utils/reservedUsernamesCatalog");
  return updateBlockedPageSlugs(getDefaultReservedSlugs());
}

async function exportBlockedPageSlugsCatalog() {
  const { buildExportDocument, loadCatalogFile } = require("../../utils/reservedUsernamesCatalog");
  const slugs = await getBlockedPageSlugs();
  const catalog = loadCatalogFile();
  return buildExportDocument(slugs, {
    version: catalog.version,
    source: "admin-export",
  });
}

async function importBlockedPageSlugsCatalog(payload, { mode = "replace" } = {}) {
  const { extractSlugsFromImportPayload } = require("../../utils/reservedUsernamesCatalog");
  const incoming = extractSlugsFromImportPayload(payload);
  if (mode === "merge") {
    const current = await getBlockedPageSlugs();
    return updateBlockedPageSlugs([...current, ...incoming]);
  }
  return updateBlockedPageSlugs(incoming);
}

function clampSlugRules(input = {}) {
  let minLength = Number(input.minLength);
  let maxLength = Number(input.maxLength);
  if (!Number.isFinite(minLength)) minLength = DEFAULT_PUBLIC_PAGE_SLUG_RULES.minLength;
  if (!Number.isFinite(maxLength)) maxLength = DEFAULT_PUBLIC_PAGE_SLUG_RULES.maxLength;
  minLength = Math.min(20, Math.max(2, Math.floor(minLength)));
  maxLength = Math.min(80, Math.max(5, Math.floor(maxLength)));
  if (maxLength < minLength) maxLength = minLength;
  return { minLength, maxLength };
}

async function getPublicPageSlugRules() {
  const stored = await getJsonSetting(PUBLIC_PAGE_SLUG_RULES, null);
  if (!stored || typeof stored !== "object") {
    return { ...DEFAULT_PUBLIC_PAGE_SLUG_RULES };
  }
  return clampSlugRules(stored);
}

async function setPublicPageSlugRules(rules) {
  const next = clampSlugRules(rules || {});
  await setJsonSetting(PUBLIC_PAGE_SLUG_RULES, next);
  return next;
}

module.exports = {
  TRADE_PROVIDERS_AUTO_APPROVE,
  SHOPS_AUTO_APPROVE,
  PAGE_DELETION_GRACE_DAYS,
  VIP_TRADE_CATEGORIES,
  ENABLED_LANGUAGES,
  BLOCKED_PAGE_SLUGS,
  PUBLIC_PAGE_SLUG_RULES,
  ALL_LANGUAGE_CODES,
  DEFAULT_VIP_MESSAGE,
  DEFAULT_PUBLIC_PAGE_SLUG_RULES,
  isTradeProvidersAutoApprove,
  isShopsAutoApprove,
  getPageDeletionGraceDays,
  setPageDeletionGraceDays,
  getVipTradeCategoriesConfig,
  getVipCategoryConfig,
  isCategoryVipExclusive,
  getExclusiveProviderIds,
  upsertVipCategoryConfig,
  updateVipTradeCategoriesConfig,
  validateRegistrationForServices,
  filterPublicProviders,
  resolveVipMessage,
  getTradeSettings,
  updateTradeSettings,
  getPublicVipCategories,
  getEnabledLanguages,
  updateEnabledLanguages,
  normalizeLanguageCodes,
  getBlockedPageSlugs,
  updateBlockedPageSlugs,
  normalizeBlockedSlugs,
  ensureBlockedPageSlugsSeeded,
  resetBlockedPageSlugsFromCatalog,
  exportBlockedPageSlugsCatalog,
  importBlockedPageSlugsCatalog,
  getPublicPageSlugRules,
  setPublicPageSlugRules,
  clampSlugRules,
  CACHE_CONFIG,
  DEFAULT_CACHE_CONFIG,
  getCacheConfig,
  updateCacheConfig,
};
