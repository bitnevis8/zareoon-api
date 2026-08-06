const { FAMILY_TEMPLATES } = require("./templates");

function getFamilyTemplateSafe(familyId) {
  try {
    const { getFamilyTemplate } = require("../catalogStore");
    return getFamilyTemplate(familyId);
  } catch {
    return FAMILY_TEMPLATES[familyId] || FAMILY_TEMPLATES.general;
  }
}

function getRuntimeMaps() {
  try {
    const { getCatalogSync } = require("../catalogStore");
    const cat = getCatalogSync();
    return {
      rootFamilyMap: cat.rootFamilyMap || ROOT_FAMILY_MAP,
      l2FamilyMap: cat.l2FamilyMap || L2_FAMILY_MAP,
    };
  } catch {
    return { rootFamilyMap: ROOT_FAMILY_MAP, l2FamilyMap: L2_FAMILY_MAP };
  }
}

/**
 * نگاشت ریشه کاتالوگ (level-1) → خانواده صادرات
 * همه ۱۲ ریشه اصلی پوشش داده شده‌اند.
 */
const ROOT_FAMILY_MAP = {
  10000: "agro-raw", // محصولات کشاورزی
  10106: "food-processed", // مواد غذایی و نوشیدنی
  10175: "minerals", // فلزات/معدنی/شیمیایی — با L2 ریز می‌شود
  10353: "machinery", // ماشین‌آلات و تجهیزات صنعتی
  10503: "construction-materials", // ساختمان و مصالح
  10560: "industrial-parts", // لوازم خانگی و الکترونیک
  10592: "textile-consumer-goods", // پوشاک و نساجی
  10620: "textile-consumer-goods", // کیف، کفش، چرم
  10640: "textile-consumer-goods", // ورزش، هدایا، کودک
  10672: "general", // آرایشی بهداشتی — مسیر عمومی + برچسب/آزمایش
  10711: "industrial-parts", // خودرو و قطعات
  10774: "general", // سایر کالاها
};

/**
 * نگاشت زیردسته (level-2 slug) برای دقت بیشتر از ریشه
 */
const L2_FAMILY_MAP = {
  // کشاورزی
  "nuts-dried-fruits-edible-seeds": "agro-raw",
  cereals: "agro-raw",
  spices: "agro-raw",
  pulses: "agro-raw",
  "seeds-saplings-live-plants": "agro-raw",
  "coffee-cocoa-raw-commodities": "agro-raw",
  "livestock-beekeeping-animal-feed": "agro-raw",
  "fresh-fruits": "perishable-cold-chain",
  "fresh-vegetables-melons-and-herbs": "perishable-cold-chain",

  // غذایی
  beverages: "food-processed",
  "bakery-snacks-confectionery": "food-processed",
  "canned-preserved-prepared-foods": "food-processed",
  "food-staples-ingredients-additives": "food-processed",
  "meat-seafood-eggs": "perishable-cold-chain",
  "dairy-products": "perishable-cold-chain",

  // فلزات / معدنی / شیمیایی
  "agricultural-chemicals": "fertilizer-agri-input",
  "industrial-chemicals-gases": "chemical-dangerous-goods",
  "fuels-lubricants-energy-products": "chemical-dangerous-goods",
  "paints-coatings-resins": "chemical-dangerous-goods",
  "adhesives-sealants-tapes": "chemical-dangerous-goods",
  "mineral-ores-industrial-minerals": "minerals",
  "scrap-recyclables-waste-materials": "minerals",
  "aluminum-products": "industrial-parts",
  "iron-steel-products": "industrial-parts",
  "non-ferrous-stainless-metals": "industrial-parts",
  "glass-glass-products": "construction-materials",
  "plastics-polymer-products": "industrial-parts",
  "rubber-rubber-products": "industrial-parts",
  "industrial-raw-materials-polymers": "industrial-parts",
};

/** پوشش ریشه برای نمایش در UI / مستندات */
const ROOT_COVERAGE = [
  { rootId: 10000, rootSlug: "agriculture", rootTitleFa: "محصولات کشاورزی", defaultFamily: "agro-raw", note: "میوه/سبزی تازه → سردخانه‌ای" },
  { rootId: 10106, rootSlug: "food-beverages", rootTitleFa: "مواد غذایی و نوشیدنی", defaultFamily: "food-processed", note: "لبنیات/گوشت → سردخانه‌ای" },
  { rootId: 10175, rootSlug: "metals-minerals-chemicals", rootTitleFa: "فلزات، معدنی و شیمیایی", defaultFamily: "minerals", note: "کود/شیمیایی خطرناک جدا می‌شود" },
  { rootId: 10353, rootSlug: "industrial-machinery-equipment", rootTitleFa: "ماشین‌آلات صنعتی", defaultFamily: "machinery", note: null },
  { rootId: 10503, rootSlug: "construction-building-materials", rootTitleFa: "مصالح ساختمانی", defaultFamily: "construction-materials", note: null },
  { rootId: 10560, rootSlug: "home-appliances-electronics", rootTitleFa: "لوازم خانگی و الکترونیک", defaultFamily: "industrial-parts", note: null },
  { rootId: 10592, rootSlug: "apparel-textiles-fashion", rootTitleFa: "پوشاک و نساجی", defaultFamily: "textile-consumer-goods", note: null },
  { rootId: 10620, rootSlug: "bags-shoes-leather-products", rootTitleFa: "کیف و کفش و چرم", defaultFamily: "textile-consumer-goods", note: null },
  { rootId: 10640, rootSlug: "sports-entertainment-gifts-kids", rootTitleFa: "ورزش و هدایا", defaultFamily: "textile-consumer-goods", note: null },
  { rootId: 10672, rootSlug: "cosmetics-hygiene-health", rootTitleFa: "آرایشی و بهداشتی", defaultFamily: "general", note: "برچسب و آزمایش پیشنهاد می‌شود" },
  { rootId: 10711, rootSlug: "automotive-parts", rootTitleFa: "خودرو و قطعات", defaultFamily: "industrial-parts", note: null },
  { rootId: 10774, rootSlug: "other-goods-general-products", rootTitleFa: "سایر کالاها", defaultFamily: "general", note: null },
];

function textBlob(product = {}, slugPath = []) {
  const parts = [
    product.name,
    product.englishName,
    product.slug,
    product.categoryPath,
    ...(Array.isArray(product.keywords) ? product.keywords : []),
    ...(slugPath || []),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function inferFlagsFromProduct(product = {}, tradeCompliance = {}, hints = {}, slugPath = []) {
  const blob = textBlob(product, slugPath);
  const flags = { ...(hints.flags || {}) };
  const { l2FamilyMap } = getRuntimeMaps();
  const l2 = hints.l2Slug || slugPath.find((s) => l2FamilyMap[s]) || null;

  if (
    /date|خرما|pistachio|پسته|saffron|زعفران|raisin|کشمش|wheat|گندم|rice|برنج|raw|خام|dried|خشک/.test(blob)
  ) {
    flags.isAgroRaw = true;
    flags.isFood = true;
  }
  if (/juice|آبمیوه|beverage|نوشیدنی|کنسرو|processed|فرآوری|jam|مربا|canned|bakery/.test(blob)) {
    flags.isProcessedFood = true;
    flags.isFood = true;
    flags.labelingRequired = true;
  }
  if (
    /cold|سرد|یخ|fresh|تازه|perish|فاسد|dairy|لبنی|meat|گوشت|fish|ماهی|seafood|میوه تازه|سبزی/.test(blob) ||
    l2 === "fresh-fruits" ||
    l2 === "fresh-vegetables-melons-and-herbs" ||
    l2 === "dairy-products" ||
    l2 === "meat-seafood-eggs"
  ) {
    flags.coldChainRequired = true;
    flags.perishable = true;
    flags.isFood = true;
  }
  if (/fertilizer|کود|urea|اوره|pesticide|سم|npk|agricultural-chemical/.test(blob) || l2 === "agricultural-chemicals") {
    flags.isAgriInput = true;
    flags.chemicalReview = true;
    flags.labSuggested = true;
  }
  if (
    /sulfur|گوگرد|sulphur|acid|اسید|chemical|شیمی|solvent|حلال|dangerous|خطرناک|fuel|سوخت|gas|گاز/.test(blob) ||
    tradeCompliance.dangerousGoodsReviewRequired ||
    ["industrial-chemicals-gases", "fuels-lubricants-energy-products", "paints-coatings-resins"].includes(l2)
  ) {
    flags.dangerousGoods = true;
    flags.labSuggested = true;
  }
  if (/mineral|معدن|ore|سنگ معدن|copper|مس|zinc|روی|iron ore/.test(blob) || l2 === "mineral-ores-industrial-minerals") {
    flags.isMineral = true;
    flags.labSuggested = true;
  }
  if (/machine|ماشین|equipment|تجهیز|motor|موتور/.test(blob)) {
    flags.isMachinery = true;
  }
  if (hints.rootSlug === "cosmetics-hygiene-health" || /cosmetic|آرایش|بهداشت|hygiene/.test(blob)) {
    flags.labelingRequired = true;
    flags.labSuggested = true;
  }

  if (hints.coldChainRequired) flags.coldChainRequired = true;
  if (hints.dangerousGoods) flags.dangerousGoods = true;
  if (hints.isFood) flags.isFood = true;
  if (tradeCompliance.requiresDocumentReview) flags.labSuggested = true;

  return flags;
}

function resolveExportFamily({
  product,
  rootCategoryId,
  tradeCompliance,
  hints,
  l2Slug,
  slugPath,
} = {}) {
  const { rootFamilyMap, l2FamilyMap } = getRuntimeMaps();
  const path = Array.isArray(slugPath) ? slugPath : [];
  const resolvedL2 = l2Slug || hints?.l2Slug || path.find((s) => l2FamilyMap[s]) || null;
  const mergedHints = { ...(hints || {}), l2Slug: resolvedL2 };
  const flags = inferFlagsFromProduct(product, tradeCompliance || {}, mergedHints, path);

  let familyId = hints?.exportFamily || null;
  let matchedBy = familyId ? "manual" : null;

  // 1) زیردسته دقیق‌تر از ریشه
  if (!familyId && resolvedL2 && l2FamilyMap[resolvedL2]) {
    familyId = l2FamilyMap[resolvedL2];
    matchedBy = `l2:${resolvedL2}`;
  }

  // 2) فلگ‌های قوی (DG / سردخانه / کود)
  if (!familyId) {
    if (flags.dangerousGoods && flags.isAgriInput) {
      familyId = "fertilizer-agri-input";
      matchedBy = "flag:agri-input+dg";
    } else if (flags.dangerousGoods) {
      familyId = "chemical-dangerous-goods";
      matchedBy = "flag:dangerous-goods";
    } else if (flags.coldChainRequired || flags.perishable) {
      familyId = "perishable-cold-chain";
      matchedBy = "flag:cold-chain";
    } else if (flags.isAgriInput) {
      familyId = "fertilizer-agri-input";
      matchedBy = "flag:agri-input";
    } else if (flags.isMineral) {
      familyId = "minerals";
      matchedBy = "flag:mineral";
    } else if (flags.isProcessedFood) {
      familyId = "food-processed";
      matchedBy = "flag:processed-food";
    } else if (flags.isAgroRaw) {
      familyId = "agro-raw";
      matchedBy = "flag:agro-raw";
    } else if (flags.isMachinery) {
      familyId = "machinery";
      matchedBy = "flag:machinery";
    }
  }

  // 3) ریشه کاتالوگ
  if (!familyId && rootCategoryId != null && rootFamilyMap[Number(rootCategoryId)]) {
    familyId = rootFamilyMap[Number(rootCategoryId)];
    matchedBy = `root:${rootCategoryId}`;
  }

  if (!familyId) {
    familyId = "general";
    matchedBy = "fallback:general";
  }

  const template = getFamilyTemplateSafe(familyId);
  return {
    familyId: template.id,
    template,
    flags: { ...(template.defaultFlags || {}), ...flags },
    matchedBy,
    l2Slug: resolvedL2,
    rootCategoryId: rootCategoryId != null ? Number(rootCategoryId) : null,
  };
}

async function resolveCategoryContext(product, ProductModel) {
  if (!product) {
    return { rootCategoryId: null, rootSlug: null, l2Id: null, l2Slug: null, slugPath: [] };
  }

  const chain = [];
  let current = product;
  const guard = new Set();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    chain.push({
      id: current.id,
      slug: current.slug || null,
      level: current.level,
      parentId: current.parentId,
    });
    if (current.parentId == null || current.level === 1) break;
    // eslint-disable-next-line no-await-in-loop
    current = await ProductModel.findByPk(current.parentId, {
      attributes: ["id", "parentId", "level", "name", "slug"],
    });
  }

  const root = chain.find((c) => c.level === 1) || chain[chain.length - 1] || null;
  const l2 = chain.find((c) => c.level === 2) || null;
  const slugPath = chain.map((c) => c.slug).filter(Boolean);

  return {
    rootCategoryId: root?.id || product.id,
    rootSlug: root?.slug || null,
    l2Id: l2?.id || null,
    l2Slug: l2?.slug || null,
    slugPath,
  };
}

/** سازگاری با کد قبلی */
async function resolveRootCategoryId(product, ProductModel) {
  const ctx = await resolveCategoryContext(product, ProductModel);
  return ctx.rootCategoryId;
}

function listFamiliesPublic() {
  try {
    const store = require("../catalogStore");
    return store.listFamiliesPublic();
  } catch {
    return Object.values(FAMILY_TEMPLATES).map((f) => ({
      id: f.id,
      titleFa: f.titleFa,
      titleEn: f.titleEn,
      descriptionFa: f.descriptionFa,
      stepCount: f.stepCodes.length,
    }));
  }
}

module.exports = {
  ROOT_FAMILY_MAP,
  L2_FAMILY_MAP,
  ROOT_COVERAGE,
  inferFlagsFromProduct,
  resolveExportFamily,
  resolveRootCategoryId,
  resolveCategoryContext,
  listFamiliesPublic,
};
