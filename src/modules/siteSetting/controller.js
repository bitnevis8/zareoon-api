const {
  getTradeSettings,
  updateTradeSettings,
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
  ALL_LANGUAGE_CODES,
} = require("./service");
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
    const { tradeProvidersAutoApprove, shopsAutoApprove, pageDeletionGraceDays, vipTradeCategories } =
      req.body;

    if (
      tradeProvidersAutoApprove !== undefined &&
      typeof tradeProvidersAutoApprove !== "boolean"
    ) {
      return res.status(400).json({ success: false, message: "مقدار نامعتبر است" });
    }
    if (shopsAutoApprove !== undefined && typeof shopsAutoApprove !== "boolean") {
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
    });
    res.json({ success: true, data, message: "تنظیمات ذخیره شد" });
  } catch (error) {
    console.error("Site settings patchTrade error:", error);
    res.status(500).json({ success: false, message: "خطا در ذخیره تنظیمات" });
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

module.exports = {
  getTrade,
  patchTrade,
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
};
