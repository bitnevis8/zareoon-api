const SiteSetting = require("./model");

const TRADE_PROVIDERS_AUTO_APPROVE = "tradeProvidersAutoApprove";
const SHOPS_AUTO_APPROVE = "shopsAutoApprove";
const PAGE_DELETION_GRACE_DAYS = "pageDeletionGraceDays";
const VIP_TRADE_CATEGORIES = "vipTradeCategories";
const SHOW_FOOTER_BREAKPOINT = "showFooterBreakpoint";
const ENABLED_LANGUAGES = "enabledLanguages";
const BLOCKED_PAGE_SLUGS = "blockedPageSlugs";
const PUBLIC_PAGE_SLUG_RULES = "publicPageSlugRules";
const CACHE_CONFIG = "cacheConfig";
const AUTH_SIGNUP_CONFIG = "authSignupConfig";
const UPLOAD_CONFIG = "uploadConfig";

const ALL_LANGUAGE_CODES = ["fa", "ar", "en", "ru", "tr", "es", "nl", "ur", "fi"];
const DEFAULT_ENABLED_LANGUAGE_CODES = ["fa", "ar", "en", "ru", "tr"];

const { ALL_PHONE_COUNTRY_CODES } = require("../../utils/phoneCountries");

const DEFAULT_AUTH_SIGNUP_CONFIG = {
  emailEnabled: true,
  phoneEnabled: true,
  allowedPhoneCountries: ["IR"],
  defaultPhoneCountry: "IR",
};

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

/** تنظیمات پردازش تصویر هنگام آپلود (WebP، واترمارک، کراپ سمت کلاینت) */
const DEFAULT_UPLOAD_CONFIG = {
  processImages: true,
  maxEdge: 1600,
  webpQuality: 78,
  webpEffort: 6,
  watermarkEnabled: true,
  watermarkLogoEnabled: true,
  watermarkTextEnabled: true,
  watermarkText: "زارعون",
  watermarkOpacity: 0.62,
  watermarkPosition: "bottom-right",
  cropBeforeUpload: true,
  cropOutputSize: 1200,
  showUserGuide: true,
};

function clampInt(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(Math.max(Math.floor(v), min), max);
}

function clampFloat(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(Math.max(v, min), max);
}

async function getUploadConfig() {
  const raw = await getJsonSetting(UPLOAD_CONFIG, {});
  const pos = String(raw.watermarkPosition || DEFAULT_UPLOAD_CONFIG.watermarkPosition).toLowerCase();
  return {
    processImages: raw.processImages !== false,
    maxEdge: clampInt(raw.maxEdge, 400, 4096, DEFAULT_UPLOAD_CONFIG.maxEdge),
    webpQuality: clampInt(raw.webpQuality, 40, 95, DEFAULT_UPLOAD_CONFIG.webpQuality),
    webpEffort: clampInt(raw.webpEffort, 0, 6, DEFAULT_UPLOAD_CONFIG.webpEffort),
    watermarkEnabled: raw.watermarkEnabled !== false,
    watermarkLogoEnabled: raw.watermarkLogoEnabled !== false,
    watermarkTextEnabled: raw.watermarkTextEnabled !== false,
    watermarkText: String(raw.watermarkText || DEFAULT_UPLOAD_CONFIG.watermarkText).slice(0, 40),
    watermarkOpacity: clampFloat(raw.watermarkOpacity, 0.15, 1, DEFAULT_UPLOAD_CONFIG.watermarkOpacity),
    watermarkPosition: pos === "bottom-left" ? "bottom-left" : "bottom-right",
    cropBeforeUpload: raw.cropBeforeUpload !== false,
    cropOutputSize: clampInt(raw.cropOutputSize, 400, 2400, DEFAULT_UPLOAD_CONFIG.cropOutputSize),
    showUserGuide: raw.showUserGuide !== false,
  };
}

async function updateUploadConfig(patch = {}) {
  const current = await getUploadConfig();
  const next = {
    processImages: patch.processImages !== undefined ? !!patch.processImages : current.processImages,
    maxEdge: patch.maxEdge !== undefined ? clampInt(patch.maxEdge, 400, 4096, current.maxEdge) : current.maxEdge,
    webpQuality:
      patch.webpQuality !== undefined
        ? clampInt(patch.webpQuality, 40, 95, current.webpQuality)
        : current.webpQuality,
    webpEffort:
      patch.webpEffort !== undefined ? clampInt(patch.webpEffort, 0, 6, current.webpEffort) : current.webpEffort,
    watermarkEnabled: patch.watermarkEnabled !== undefined ? !!patch.watermarkEnabled : current.watermarkEnabled,
    watermarkLogoEnabled:
      patch.watermarkLogoEnabled !== undefined ? !!patch.watermarkLogoEnabled : current.watermarkLogoEnabled,
    watermarkTextEnabled:
      patch.watermarkTextEnabled !== undefined ? !!patch.watermarkTextEnabled : current.watermarkTextEnabled,
    watermarkText:
      patch.watermarkText !== undefined
        ? String(patch.watermarkText || DEFAULT_UPLOAD_CONFIG.watermarkText).slice(0, 40)
        : current.watermarkText,
    watermarkOpacity:
      patch.watermarkOpacity !== undefined
        ? clampFloat(patch.watermarkOpacity, 0.15, 1, current.watermarkOpacity)
        : current.watermarkOpacity,
    watermarkPosition:
      patch.watermarkPosition !== undefined
        ? String(patch.watermarkPosition).toLowerCase() === "bottom-left"
          ? "bottom-left"
          : "bottom-right"
        : current.watermarkPosition,
    cropBeforeUpload: patch.cropBeforeUpload !== undefined ? !!patch.cropBeforeUpload : current.cropBeforeUpload,
    cropOutputSize:
      patch.cropOutputSize !== undefined
        ? clampInt(patch.cropOutputSize, 400, 2400, current.cropOutputSize)
        : current.cropOutputSize,
    showUserGuide: patch.showUserGuide !== undefined ? !!patch.showUserGuide : current.showUserGuide,
  };
  await setJsonSetting(UPLOAD_CONFIG, next);
  try {
    const cache = require("../../core/cache/cacheService");
    cache.invalidateAdminConfigCache();
  } catch {
    /* ignore */
  }
  return next;
}

/** تنظیمات عمومی برای کلاینت (کراپ / راهنما) — بدون جزئیات فشرده‌سازی حساس نیست ولی همه را می‌دهیم */
async function getUploadConfigPublic() {
  const cfg = await getUploadConfig();
  return {
    cropBeforeUpload: cfg.cropBeforeUpload,
    cropOutputSize: cfg.cropOutputSize,
    showUserGuide: cfg.showUserGuide,
    processImages: cfg.processImages,
    watermarkEnabled: cfg.watermarkEnabled,
  };
}

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

async function isShowFooterBreakpoint() {
  return getBoolSetting(SHOW_FOOTER_BREAKPOINT, true);
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

async function validateRegistrationForServices(normalizedServices, lang = "fa", options = {}) {
  const vipConfig = await getVipTradeCategoriesConfig();
  const seen = new Set();
  /** دسته‌هایی که همین پروفایل از قبل داشته — برای ویرایش صفحهٔ اختصاصی مجاز است */
  const alreadyOwned = new Set(
    (Array.isArray(options.existingCategoryIds) ? options.existingCategoryIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  );

  for (const svc of normalizedServices) {
    if (seen.has(svc.categoryId)) continue;
    seen.add(svc.categoryId);
    const categoryId = String(svc.categoryId || "").trim();
    if (!categoryId) continue;

    const cfg = vipConfig[categoryId];
    if (cfg?.enabled) {
      if (alreadyOwned.has(categoryId)) continue;
      return {
        ok: false,
        categoryId,
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
    showFooterBreakpoint: await isShowFooterBreakpoint(),
  };
}

async function updateTradeSettings({
  tradeProvidersAutoApprove,
  shopsAutoApprove,
  pageDeletionGraceDays,
  vipTradeCategories,
  showFooterBreakpoint,
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
  if (showFooterBreakpoint !== undefined) {
    await setBoolSetting(SHOW_FOOTER_BREAKPOINT, showFooterBreakpoint);
  }
  return getTradeSettings();
}

async function getUiPublicSettings() {
  return {
    showFooterBreakpoint: await isShowFooterBreakpoint(),
  };
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
  if (!Array.isArray(codes)) return [...DEFAULT_ENABLED_LANGUAGE_CODES];
  const unique = [...new Set(codes.map((c) => String(c || "").trim().toLowerCase()))].filter((c) =>
    ALL_LANGUAGE_CODES.includes(c)
  );
  if (!unique.includes("fa")) unique.unshift("fa");
  // حفظ ترتیب پیش‌فرض برای زبان‌های شناخته‌شده
  const ordered = [];
  for (const code of ALL_LANGUAGE_CODES) {
    if (unique.includes(code)) ordered.push(code);
  }
  return ordered.length ? ordered : [...DEFAULT_ENABLED_LANGUAGE_CODES];
}

function isSameCodeSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sa = [...a].map((c) => String(c).toLowerCase()).sort();
  const sb = [...b].map((c) => String(c).toLowerCase()).sort();
  return sa.every((c, i) => c === sb[i]);
}

async function getEnabledLanguages() {
  const stored = await getJsonSetting(ENABLED_LANGUAGES, null);
  const coreMigrated = await getBoolSetting("enabledLanguagesCoreSetV1", false);

  // یک‌بار: پیش‌فرض قدیمی (همه زبان‌ها) → مجموعهٔ هستهٔ fa/ar/en/ru/tr
  if (!coreMigrated) {
    await setBoolSetting("enabledLanguagesCoreSetV1", true);
    await setBoolSetting("enabledLanguagesEsV1", true);
    await setBoolSetting("enabledLanguagesNlV1", true);
    const normalizedStored = stored ? normalizeLanguageCodes(stored) : null;
    if (!normalizedStored || isSameCodeSet(normalizedStored, ALL_LANGUAGE_CODES)) {
      const core = [...DEFAULT_ENABLED_LANGUAGE_CODES];
      await setJsonSetting(ENABLED_LANGUAGES, core);
      return core;
    }
  }

  if (!stored) return [...DEFAULT_ENABLED_LANGUAGE_CODES];
  return normalizeLanguageCodes(stored);
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

function normalizeAuthSignupConfig(raw = {}) {
  const emailEnabled = raw.emailEnabled !== false;
  const phoneEnabled = raw.phoneEnabled !== false;
  let allowed = Array.isArray(raw.allowedPhoneCountries)
    ? raw.allowedPhoneCountries.map((c) => String(c).toUpperCase()).filter((c) => ALL_PHONE_COUNTRY_CODES.includes(c))
    : [...DEFAULT_AUTH_SIGNUP_CONFIG.allowedPhoneCountries];
  if (!allowed.length) allowed = ["IR"];
  let defaultPhoneCountry = String(raw.defaultPhoneCountry || "IR").toUpperCase();
  if (!allowed.includes(defaultPhoneCountry)) defaultPhoneCountry = allowed[0];
  return {
    emailEnabled,
    phoneEnabled,
    allowedPhoneCountries: allowed,
    defaultPhoneCountry,
    allPhoneCountryCodes: ALL_PHONE_COUNTRY_CODES,
  };
}

async function getAuthSignupConfig() {
  const stored = await getJsonSetting(AUTH_SIGNUP_CONFIG, null);
  return normalizeAuthSignupConfig(stored && typeof stored === "object" ? stored : {});
}

async function updateAuthSignupConfig(patch = {}) {
  const current = await getAuthSignupConfig();
  const next = normalizeAuthSignupConfig({
    emailEnabled: patch.emailEnabled !== undefined ? !!patch.emailEnabled : current.emailEnabled,
    phoneEnabled: patch.phoneEnabled !== undefined ? !!patch.phoneEnabled : current.phoneEnabled,
    allowedPhoneCountries:
      patch.allowedPhoneCountries !== undefined ? patch.allowedPhoneCountries : current.allowedPhoneCountries,
    defaultPhoneCountry:
      patch.defaultPhoneCountry !== undefined ? patch.defaultPhoneCountry : current.defaultPhoneCountry,
  });
  await setJsonSetting(AUTH_SIGNUP_CONFIG, {
    emailEnabled: next.emailEnabled,
    phoneEnabled: next.phoneEnabled,
    allowedPhoneCountries: next.allowedPhoneCountries,
    defaultPhoneCountry: next.defaultPhoneCountry,
  });
  return next;
}

async function getAuthSignupPublic() {
  const cfg = await getAuthSignupConfig();
  return {
    emailEnabled: cfg.emailEnabled,
    phoneEnabled: cfg.phoneEnabled,
    allowedPhoneCountries: cfg.allowedPhoneCountries,
    defaultPhoneCountry: cfg.defaultPhoneCountry,
  };
}

module.exports = {
  TRADE_PROVIDERS_AUTO_APPROVE,
  SHOPS_AUTO_APPROVE,
  PAGE_DELETION_GRACE_DAYS,
  VIP_TRADE_CATEGORIES,
  SHOW_FOOTER_BREAKPOINT,
  ENABLED_LANGUAGES,
  BLOCKED_PAGE_SLUGS,
  PUBLIC_PAGE_SLUG_RULES,
  ALL_LANGUAGE_CODES,
  DEFAULT_ENABLED_LANGUAGE_CODES,
  DEFAULT_VIP_MESSAGE,
  DEFAULT_PUBLIC_PAGE_SLUG_RULES,
  isTradeProvidersAutoApprove,
  isShopsAutoApprove,
  isShowFooterBreakpoint,
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
  getUiPublicSettings,
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
  AUTH_SIGNUP_CONFIG,
  DEFAULT_AUTH_SIGNUP_CONFIG,
  getAuthSignupConfig,
  updateAuthSignupConfig,
  getAuthSignupPublic,
  normalizeAuthSignupConfig,
  UPLOAD_CONFIG,
  DEFAULT_UPLOAD_CONFIG,
  getUploadConfig,
  updateUploadConfig,
  getUploadConfigPublic,
};
