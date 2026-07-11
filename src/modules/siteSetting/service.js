const SiteSetting = require("./model");

const TRADE_PROVIDERS_AUTO_APPROVE = "tradeProvidersAutoApprove";
const VIP_TRADE_CATEGORIES = "vipTradeCategories";

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
  return getBoolSetting(TRADE_PROVIDERS_AUTO_APPROVE, false);
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

  for (const svc of normalizedServices) {
    if (seen.has(svc.categoryId)) continue;
    seen.add(svc.categoryId);
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
    vipTradeCategories: await getVipTradeCategoriesConfig(),
  };
}

async function updateTradeSettings({ tradeProvidersAutoApprove, vipTradeCategories }) {
  if (tradeProvidersAutoApprove !== undefined) {
    await setBoolSetting(TRADE_PROVIDERS_AUTO_APPROVE, tradeProvidersAutoApprove);
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

module.exports = {
  TRADE_PROVIDERS_AUTO_APPROVE,
  VIP_TRADE_CATEGORIES,
  DEFAULT_VIP_MESSAGE,
  isTradeProvidersAutoApprove,
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
};
