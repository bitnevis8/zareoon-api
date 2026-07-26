const {
  getTradeSettings,
  updateTradeSettings,
  getUiPublicSettings,
  getPublicVipCategories,
  getEnabledLanguages,
  updateEnabledLanguages,
  getBlockedPageSlugs,
  updateBlockedPageSlugs,
  resetBlockedPageSlugsFromCatalog,
  exportBlockedPageSlugsCatalog,
  importBlockedPageSlugsCatalog,
  getPublicPageSlugRules,
  setPublicPageSlugRules,
  getCacheConfig,
  updateCacheConfig,
  getAuthSignupConfig,
  updateAuthSignupConfig,
  getAuthSignupPublic,
} = require("./service");
const cacheService = require("../../core/cache/cacheService");
const { listReservedSlugs } = require("../../utils/publicPageSlug");
const { loadCatalogFile } = require("../../utils/reservedUsernamesCatalog");

const getTrade = async (req, res) => {
  try {
    const data = await getTradeSettings();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Site settings getTrade error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت تنظیمات" });
  }
};

const patchTrade = async (req, res) => {
  try {
    const {
      tradeProvidersAutoApprove,
      shopsAutoApprove,
      pageDeletionGraceDays,
      vipTradeCategories,
      showFooterBreakpoint,
    } = req.body;

    if (
      tradeProvidersAutoApprove !== undefined &&
      typeof tradeProvidersAutoApprove !== "boolean"
    ) {
      return res.status(400).json({ success: false, message: "مقدار نامعتبر است" });
    }
    if (shopsAutoApprove !== undefined && typeof shopsAutoApprove !== "boolean") {
      return res.status(400).json({ success: false, message: "مقدار نامعتبر است" });
    }
    if (showFooterBreakpoint !== undefined && typeof showFooterBreakpoint !== "boolean") {
      return res.status(400).json({ success: false, message: "مقدار نامعتبر است" });
    }
    if (
      pageDeletionGraceDays !== undefined &&
      (typeof pageDeletionGraceDays !== "number" ||
        !Number.isFinite(pageDeletionGraceDays) ||
        pageDeletionGraceDays < 1)
    ) {
      return res.status(400).json({ success: false, message: "مهلت حذف نامعتبر است" });
    }

    if (vipTradeCategories !== undefined && typeof vipTradeCategories !== "object") {
      return res.status(400).json({ success: false, message: "پیکربندی VIP نامعتبر است" });
    }

    const data = await updateTradeSettings({
      tradeProvidersAutoApprove,
      shopsAutoApprove,
      pageDeletionGraceDays,
      vipTradeCategories,
      showFooterBreakpoint,
    });
    res.json({ success: true, data, message: "تنظیمات ذخیره شد" });
  } catch (error) {
    console.error("Site settings patchTrade error:", error);
    res.status(500).json({ success: false, message: "خطا در ذخیره تنظیمات" });
  }
};

const getUiPublic = async (_req, res) => {
  try {
    const data = await getUiPublicSettings();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Site settings getUiPublic error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت تنظیمات نمایش" });
  }
};

const getVipPublic = async (_req, res) => {
  try {
    const categories = await getPublicVipCategories();
    res.json({ success: true, data: { categories } });
  } catch (error) {
    console.error("Site settings getVipPublic error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت تنظیمات VIP" });
  }
};

const getLanguages = async (_req, res) => {
  try {
    const codes = await getEnabledLanguages();
    res.json({
      success: true,
      data: { codes, allCodes: ALL_LANGUAGE_CODES },
    });
  } catch (error) {
    console.error("Site settings getLanguages error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت زبان‌ها" });
  }
};

const patchLanguages = async (req, res) => {
  try {
    const { codes } = req.body;
    if (!Array.isArray(codes)) {
      return res.status(400).json({ success: false, message: "لیست زبان‌ها نامعتبر است" });
    }
    const next = await updateEnabledLanguages(codes);
    res.json({
      success: true,
      data: { codes: next, allCodes: ALL_LANGUAGE_CODES },
      message: "زبان‌های فعال ذخیره شد",
    });
  } catch (error) {
    console.error("Site settings patchLanguages error:", error);
    res.status(500).json({ success: false, message: "خطا در ذخیره زبان‌ها" });
  }
};

const getLanguagesPublic = async (_req, res) => {
  try {
    const codes = await getEnabledLanguages();
    res.json({ success: true, data: { codes } });
  } catch (error) {
    console.error("Site settings getLanguagesPublic error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت زبان‌ها" });
  }
};

const getBlockedSlugs = async (_req, res) => {
  try {
    const [slugs, slugRules] = await Promise.all([getBlockedPageSlugs(), getPublicPageSlugRules()]);
    let catalogMeta = {};
    try {
      const catalog = loadCatalogFile();
      catalogMeta = {
        catalogVersion: catalog.version,
        catalogName: catalog.name,
        catalogCount: catalog.flat.length,
      };
    } catch {
      // ignore
    }
    res.json({
      success: true,
      data: {
        slugs,
        reserved: listReservedSlugs(),
        slugRules,
        ...catalogMeta,
      },
    });
  } catch (error) {
    console.error("Site settings getBlockedSlugs error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت اسامی غیرمجاز" });
  }
};

const patchBlockedSlugs = async (req, res) => {
  try {
    const { slugs, slugRules, minLength, maxLength } = req.body || {};
    let nextSlugs;
    if (slugs !== undefined) {
      if (!Array.isArray(slugs)) {
        return res.status(400).json({ success: false, message: "لیست نامعتبر است" });
      }
      nextSlugs = await updateBlockedPageSlugs(slugs);
    } else {
      nextSlugs = await getBlockedPageSlugs();
    }

    let nextRules = await getPublicPageSlugRules();
    if (slugRules !== undefined || minLength !== undefined || maxLength !== undefined) {
      nextRules = await setPublicPageSlugRules({
        ...nextRules,
        ...(slugRules && typeof slugRules === "object" ? slugRules : {}),
        ...(minLength !== undefined ? { minLength } : {}),
        ...(maxLength !== undefined ? { maxLength } : {}),
      });
    }

    res.json({
      success: true,
      data: { slugs: nextSlugs, slugRules: nextRules },
      message: "تنظیمات نام صفحه ذخیره شد",
    });
  } catch (error) {
    console.error("Site settings patchBlockedSlugs error:", error);
    res.status(500).json({ success: false, message: "خطا در ذخیره" });
  }
};

const getSlugRulesPublic = async (_req, res) => {
  try {
    const slugRules = await getPublicPageSlugRules();
    res.json({ success: true, data: { slugRules } });
  } catch (error) {
    console.error("Site settings getSlugRulesPublic error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت محدودیت نام صفحه" });
  }
};

const exportBlockedSlugs = async (_req, res) => {
  try {
    const doc = await exportBlockedPageSlugsCatalog();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="zareoon-blocked-page-slugs-${Date.now()}.json"`
    );
    res.status(200).send(JSON.stringify(doc, null, 2));
  } catch (error) {
    console.error("Site settings exportBlockedSlugs error:", error);
    res.status(500).json({ success: false, message: "خطا در خروجی JSON" });
  }
};

const importBlockedSlugs = async (req, res) => {
  try {
    const mode = req.body?.mode === "merge" ? "merge" : "replace";
    const payload = req.body?.catalog ?? req.body;
    const next = await importBlockedPageSlugsCatalog(payload, { mode });
    res.json({
      success: true,
      data: { slugs: next, count: next.length, mode },
      message:
        mode === "merge"
          ? `ایمپورت ادغامی انجام شد (${next.length} مورد)`
          : `ایمپورت با جایگزینی انجام شد (${next.length} مورد)`,
    });
  } catch (error) {
    console.error("Site settings importBlockedSlugs error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "خطا در ایمپورت",
    });
  }
};

const resetBlockedSlugs = async (_req, res) => {
  try {
    const next = await resetBlockedPageSlugsFromCatalog();
    res.json({
      success: true,
      data: { slugs: next, count: next.length },
      message: `لیست از فایل پیش‌فرض بارگذاری شد (${next.length} مورد)`,
    });
  } catch (error) {
    console.error("Site settings resetBlockedSlugs error:", error);
    res.status(500).json({ success: false, message: "خطا در بازنشانی از کاتالوگ" });
  }
};

const getCache = async (_req, res) => {
  try {
    const [status, config] = await Promise.all([cacheService.getStatus(), getCacheConfig()]);
    res.json({ success: true, data: { ...status, cacheConfig: config } });
  } catch (error) {
    console.error("Site settings getCache error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت وضعیت کش" });
  }
};

const patchCache = async (req, res) => {
  try {
    const body = req.body || {};
    const allowed = [
      "enabled",
      "ttlProducts",
      "ttlInventory",
      "ttlHomepage",
      "ttlSearch",
      "ttlSettings",
    ];
    const patch = {};
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, message: "هیچ تنظیمی ارسال نشده" });
    }
    const data = await updateCacheConfig(patch);
    res.json({ success: true, data, message: "تنظیمات کش ذخیره شد" });
  } catch (error) {
    console.error("Site settings patchCache error:", error);
    res.status(500).json({ success: false, message: "خطا در ذخیره تنظیمات کش" });
  }
};

const flushCache = async (req, res) => {
  try {
    const ns = String(req.body?.namespace || req.query?.namespace || "all").toLowerCase();
    const allowed = new Set(Object.values(cacheService.NAMESPACES));
    if (!allowed.has(ns)) {
      return res.status(400).json({
        success: false,
        message: `namespace نامعتبر. مجاز: ${[...allowed].join(", ")}`,
      });
    }
    const result = await cacheService.flushNamespace(ns);
    res.json({
      success: true,
      data: { namespace: ns, ...result },
      message:
        ns === "all"
          ? "همهٔ کش‌ها پاک شد"
          : `کش «${ns}» پاک شد${result.deleted != null ? ` (${result.deleted} کلید)` : ""}`,
    });
  } catch (error) {
    console.error("Site settings flushCache error:", error);
    res.status(500).json({ success: false, message: "خطا در پاک‌سازی کش" });
  }
};

const pingCacheRedis = async (_req, res) => {
  try {
    const result = await cacheService.pingRedis();
    const status = await cacheService.getStatus();
    res.json({ success: result.ok, data: { ...result, status }, message: result.message });
  } catch (error) {
    console.error("Site settings pingCacheRedis error:", error);
    res.status(500).json({ success: false, message: "خطا در تست Redis" });
  }
};

const getAuthSignup = async (_req, res) => {
  try {
    const data = await getAuthSignupConfig();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Site settings getAuthSignup error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت تنظیمات ثبت‌نام" });
  }
};

const patchAuthSignup = async (req, res) => {
  try {
    const data = await updateAuthSignupConfig(req.body || {});
    res.json({ success: true, data, message: "تنظیمات ثبت‌نام ذخیره شد" });
  } catch (error) {
    console.error("Site settings patchAuthSignup error:", error);
    res.status(500).json({ success: false, message: "خطا در ذخیره تنظیمات ثبت‌نام" });
  }
};

const getAuthSignupPublicHandler = async (_req, res) => {
  try {
    const data = await getAuthSignupPublic();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Site settings getAuthSignupPublic error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت تنظیمات" });
  }
};

module.exports = {
  getTrade,
  patchTrade,
  getUiPublic,
  getVipPublic,
  getLanguages,
  patchLanguages,
  getLanguagesPublic,
  getBlockedSlugs,
  patchBlockedSlugs,
  exportBlockedSlugs,
  importBlockedSlugs,
  resetBlockedSlugs,
  getSlugRulesPublic,
  getCache,
  patchCache,
  flushCache,
  pingCacheRedis,
  getAuthSignup,
  patchAuthSignup,
  getAuthSignupPublic: getAuthSignupPublicHandler,
};
