const { Op } = require("sequelize");
const ProductLandingPage = require("./model");
const LandingTemplate = require("./templateModel");
const InventoryLot = require("../farmer/inventoryLot/model");
const Product = require("../farmer/product/model");
const Account = require("../account/model");
const User = require("../user/user/model");
const { Workspace } = require("../workspace/model");
const { getWorkspaceContextForUser, preferredWorkspaceIdFromReq } = require("../workspace/service");
const { assertCanCreateLandingPage } = require("../workspace/limits");
const { isAdmin } = require("../../utils/roles");
const { THEMES, THEME_IDS, PALETTES, PATTERNS, PRODUCT_DISPLAY_MODES, resolveThemeId } = require("./themesCatalog");
const { DEFAULT_RECIPES } = require("./defaultRecipes");
const { normalizeContent, recipeToBlocks, uid } = require("./contentSchema");
const { pickProductMarketing } = require("./productMarketing");

function recipeMetaDefaults(template) {
  const fromCode = DEFAULT_RECIPES.find((r) => r.slug === template?.slug);
  return fromCode?.metaDefaults || template?.metaDefaults || {};
}

function applyProductContentToBlocks(blocks, seed) {
  if (!Array.isArray(blocks) || !blocks.length) return blocks;
  const {
    title,
    subtitle,
    body,
    enTitle,
    arTitle,
    imageUrl,
    specs,
    marketing,
    marketingEn,
  } = seed || {};

  const hero = blocks.find((b) => b.type === "hero");
  if (hero && title) {
    hero.props = hero.props || {};
    hero.props.fa = hero.props.fa || {};
    hero.props.en = hero.props.en || {};
    hero.props.ar = hero.props.ar || {};
    hero.props.fa.title = title;
    hero.props.fa.subtitle = subtitle || hero.props.fa.subtitle;
    hero.props.fa.body = body || marketing?.description || hero.props.fa.body;
    hero.props.en.title = enTitle || marketingEn?.name || title;
    hero.props.en.subtitle = marketingEn?.categoryPath || marketingEn?.metaDescription || hero.props.en.subtitle;
    hero.props.en.body = marketingEn?.description || hero.props.en.body;
    hero.props.ar.title = arTitle || title;
    if (imageUrl) {
      hero.props.imageUrl = imageUrl;
      hero.props.bgImageUrl = imageUrl;
    }
  }

  const specsBlock = blocks.find((b) => b.type === "specifications");
  if (specsBlock && Array.isArray(specs) && specs.length) {
    specsBlock.props = specsBlock.props || {};
    specsBlock.props.specRows = specs;
  }

  const featureBlocks = blocks.filter((b) => b.type === "features");
  if (featureBlocks[0] && marketing?.highlights?.length) {
    featureBlocks[0].props = featureBlocks[0].props || {};
    featureBlocks[0].props.fa = featureBlocks[0].props.fa || {};
    featureBlocks[0].props.en = featureBlocks[0].props.en || {};
    featureBlocks[0].props.fa.items = marketing.highlights;
    if (!featureBlocks[0].props.fa.title) featureBlocks[0].props.fa.title = "نکات کلیدی";
    if (marketingEn?.highlights?.length) {
      featureBlocks[0].props.en.items = marketingEn.highlights;
      featureBlocks[0].props.en.title = featureBlocks[0].props.en.title || "Key highlights";
    }
  }
  if (featureBlocks[1] && marketing?.benefits?.length) {
    featureBlocks[1].props = featureBlocks[1].props || {};
    featureBlocks[1].props.fa = featureBlocks[1].props.fa || {};
    featureBlocks[1].props.en = featureBlocks[1].props.en || {};
    featureBlocks[1].props.fa.items = marketing.benefits;
    if (!featureBlocks[1].props.fa.title) featureBlocks[1].props.fa.title = "مزایای خرید از زارعون";
    if (marketingEn?.benefits?.length) {
      featureBlocks[1].props.en.items = marketingEn.benefits;
      featureBlocks[1].props.en.title = featureBlocks[1].props.en.title || "Benefits of buying on Zareoon";
    }
  }

  const companyBlocks = blocks.filter((b) => b.type === "company");
  if (companyBlocks[0]) {
    companyBlocks[0].props = companyBlocks[0].props || {};
    companyBlocks[0].props.fa = companyBlocks[0].props.fa || {};
    companyBlocks[0].props.en = companyBlocks[0].props.en || {};
    const intro = marketing?.seoIntro || marketing?.description || body;
    if (intro) {
      companyBlocks[0].props.fa.title = companyBlocks[0].props.fa.title || "درباره این محصول";
      companyBlocks[0].props.fa.body = intro;
      if (marketing?.categoryPath) {
        companyBlocks[0].props.fa.subtitle = marketing.categoryPath;
      }
    }
    const introEn = marketingEn?.seoIntro || marketingEn?.description;
    if (introEn) {
      companyBlocks[0].props.en.title = companyBlocks[0].props.en.title || "About this product";
      companyBlocks[0].props.en.body = introEn;
      if (marketingEn?.categoryPath) companyBlocks[0].props.en.subtitle = marketingEn.categoryPath;
    }
  }
  if (companyBlocks[1] && (marketing?.seoOutro || marketingEn?.seoOutro)) {
    companyBlocks[1].props = companyBlocks[1].props || {};
    companyBlocks[1].props.fa = companyBlocks[1].props.fa || {};
    companyBlocks[1].props.en = companyBlocks[1].props.en || {};
    if (marketing?.seoOutro) companyBlocks[1].props.fa.body = marketing.seoOutro;
    if (marketingEn?.seoOutro) companyBlocks[1].props.en.body = marketingEn.seoOutro;
  }

  const faq = blocks.find((b) => b.type === "faq");
  if (faq && marketing?.faqs?.length) {
    faq.props = faq.props || {};
    faq.props.fa = faq.props.fa || {};
    faq.props.en = faq.props.en || {};
    faq.props.fa.items = marketing.faqs;
    faq.props.fa.title = faq.props.fa.title || "سوالات متداول خریداران";
    if (marketingEn?.faqs?.length) {
      faq.props.en.items = marketingEn.faqs;
      faq.props.en.title = faq.props.en.title || "Buyer FAQs";
    }
  }

  return blocks;
}

const landingSupplierInclude = {
  model: User,
  as: "supplier",
  attributes: ["id", "firstName", "lastName", "username", "mobile", "avatar"],
  include: [
    {
      model: Account,
      as: "account",
      attributes: ["profileSlug", "displayName", "coverImage"],
      required: false,
    },
  ],
};

function sanitizeSupplierPublic(supplier) {
  if (!supplier) return null;
  const plain = supplier.toJSON ? supplier.toJSON() : { ...supplier };
  const hasPhone = Boolean(plain.mobile || plain.phone);
  delete plain.mobile;
  delete plain.phone;
  return { ...plain, hasPhone };
}

function availableFromLot(lot) {
  return Math.max(0, Number(lot.totalQuantity || 0) - Number(lot.reservedQuantity || 0));
}

/** دادهٔ زندهٔ محصول/موجودی برای بلوک‌های خرید و فروشنده */
async function loadLandingCommerce(row) {
  let lot = null;
  if (row.inventoryLotId) {
    lot = await InventoryLot.findByPk(row.inventoryLotId, { include: [landingSupplierInclude] });
  }
  if (!lot && row.productId) {
    lot = await InventoryLot.findOne({
      where: {
        productId: row.productId,
        status: { [Op.in]: ["harvested", "on_field"] },
      },
      include: [landingSupplierInclude],
      order: [["updatedAt", "DESC"]],
    });
  }

  const productId = row.productId || lot?.productId || null;
  let product = null;
  if (productId) {
    product = await Product.findByPk(productId, {
      attributes: ["id", "name", "slug", "imageUrl", "isOrderable"],
    });
  }

  if (!lot && !product) {
    return { product: null, offer: null };
  }

  const supplier = lot?.supplier ? sanitizeSupplierPublic(lot.supplier) : null;
  const offer = lot
    ? {
        lot: {
          id: lot.id,
          productId: lot.productId,
          qualityGrade: lot.qualityGrade,
          status: lot.status,
          unit: lot.unit,
          price: lot.price,
          priceCurrency: lot.priceCurrency,
          tieredPricing: lot.tieredPricing,
          minimumOrderQuantity: lot.minimumOrderQuantity,
          totalQuantity: lot.totalQuantity,
          reservedQuantity: lot.reservedQuantity,
          availableQuantity: availableFromLot(lot),
          packagingType: lot.packagingType,
          hsCode: lot.hsCode,
          description: lot.description,
          locationLabel: lot.locationLabel,
          hashtags: lot.hashtags,
          filterValues: lot.filterValues,
          displayContent: lot.displayContent,
          supplier,
        },
        supplier,
      }
    : null;

  return {
    product: product
      ? {
          id: product.id,
          name: product.name,
          slug: product.slug,
          imageUrl: product.imageUrl,
          isOrderable: product.isOrderable,
        }
      : null,
    offer,
  };
}

async function ctxFromReq(req) {
  return getWorkspaceContextForUser(req.user, {
    preferredWorkspaceId: preferredWorkspaceIdFromReq(req),
  });
}

function slugify(input) {
  return (
    String(input || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]+/gi, "-")
      .replace(/^-|-$/g, "")
      .replace(/[\u0600-\u06FF]/g, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || `landing-${Date.now().toString(36)}`
  );
}

function serialize(row, extra = {}) {
  const plain = row.toJSON ? row.toJSON() : { ...row };
  if (plain.content) {
    plain.content = normalizeContent(plain.content, {
      themeId: plain.themeId,
      templateId: plain.templateId,
    });
  }
  return { ...plain, ...extra };
}

function serializeTemplate(row) {
  return row.toJSON ? row.toJSON() : { ...row };
}

/** اطمینان از وجود قالب‌های سیستمی و همگام‌سازی recipe از کد */
async function ensureSystemTemplates() {
  const keepSlugs = new Set(DEFAULT_RECIPES.map((r) => r.slug));
  const obsolete = await LandingTemplate.findAll({
    where: { isSystem: true, workspaceId: null },
  });
  for (const row of obsolete) {
    if (!keepSlugs.has(row.slug)) {
      await row.destroy();
    }
  }

  for (const r of DEFAULT_RECIPES) {
    const existing = await LandingTemplate.findOne({
      where: { slug: r.slug, isSystem: true, workspaceId: null },
    });
    if (existing) {
      existing.nameFa = r.nameFa;
      existing.nameEn = r.nameEn;
      existing.category = r.category;
      existing.themeIdDefault = resolveThemeId(r.themeIdDefault);
      existing.recipe = r.recipe;
      existing.sortOrder = r.sortOrder;
      existing.isPublished = true;
      await existing.save();
      continue;
    }
    await LandingTemplate.create({
      slug: r.slug,
      nameFa: r.nameFa,
      nameEn: r.nameEn,
      category: r.category,
      themeIdDefault: resolveThemeId(r.themeIdDefault),
      recipe: r.recipe,
      isSystem: true,
      isPublished: true,
      sortOrder: r.sortOrder,
      workspaceId: null,
    });
  }
}

async function listMine(req, res) {
  try {
    const ctx = await ctxFromReq(req);
    if (!ctx?.workspace?.id) {
      return res.status(400).json({ success: false, message: "کسب‌وکار فعال ندارید" });
    }
    const rows = await ProductLandingPage.findAll({
      where: { workspaceId: ctx.workspace.id },
      order: [["updatedAt", "DESC"]],
    });
    res.json({
      success: true,
      data: {
        items: rows.map((r) => serialize(r)),
        themes: THEMES,
        count: rows.length,
      },
    });
  } catch (e) {
    console.error("landing listMine", e);
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function getMine(req, res) {
  try {
    const ctx = await ctxFromReq(req);
    if (!ctx?.workspace?.id) {
      return res.status(400).json({ success: false, message: "کسب‌وکار فعال ندارید" });
    }
    const id = parseInt(req.params.id, 10);
    const row = await ProductLandingPage.findOne({
      where: { id, workspaceId: ctx.workspace.id },
    });
    if (!row) return res.status(404).json({ success: false, message: "لندینگ یافت نشد" });
    const { product, offer } = await loadLandingCommerce(row);
    res.json({ success: true, data: { ...serialize(row), product, offer } });
  } catch (e) {
    console.error("landing getMine", e);
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function create(req, res) {
  try {
    const ctx = await ctxFromReq(req);
    if (!ctx?.workspace?.id) {
      return res.status(400).json({ success: false, message: "کسب‌وکار فعال ندارید" });
    }
    await assertCanCreateLandingPage(ctx.workspace.id);
    await ensureSystemTemplates();

    const body = req.body || {};
    let productId = body.productId ? parseInt(body.productId, 10) : null;
    let inventoryLotId = body.inventoryLotId ? parseInt(body.inventoryLotId, 10) : null;
    let seedTitle = body.title || "";
    let seedSubtitle = "";
    let seedBody = "";
    let seedHero = null;
    let seedEnTitle = "";
    let seedArTitle = "";
    let seedSpecs = [];
    let marketing = null;
    let marketingEn = null;

    if (inventoryLotId) {
      const lot = await InventoryLot.findOne({
        where: {
          id: inventoryLotId,
          [Op.or]: [{ workspaceId: ctx.workspace.id }, { farmerId: req.user.id }],
        },
      });
      if (!lot) {
        return res.status(404).json({ success: false, message: "محصول/موجودی یافت نشد" });
      }
      productId = lot.productId;
      const fa = lot.displayContent?.fa || {};
      const en = lot.displayContent?.en || {};
      const ar = lot.displayContent?.ar || {};
      seedTitle = seedTitle || fa.title || lot.englishName || "";
      seedSubtitle = fa.subtitle || lot.locationLabel || "";
      seedBody = fa.body || lot.description || "";
      seedEnTitle = en.title || lot.englishName || seedTitle;
      seedArTitle = ar.title || lot.arabicName || seedTitle;
      seedSpecs = [
        { key: "درجه کیفیت", value: lot.qualityGrade || "—" },
        { key: "واحد", value: lot.unit || "—" },
        { key: "حداقل سفارش", value: lot.minimumOrderQuantity != null ? String(lot.minimumOrderQuantity) : "—" },
        { key: "کد HS", value: lot.hsCode || lot.filterValues?.hsCode || "—" },
        { key: "محل", value: lot.locationLabel || "—" },
      ];
    }

    if (productId) {
      const product = await Product.findByPk(productId);
      if (product) {
        marketing = pickProductMarketing(product, "fa");
        marketingEn = pickProductMarketing(product, "en");
        if (!seedTitle) seedTitle = marketing.name || product.name;
        if (!seedSubtitle) seedSubtitle = marketing.categoryPath || marketing.metaDescription || "";
        if (!seedBody) seedBody = marketing.description || "";
        if (!seedEnTitle) seedEnTitle = marketingEn.name || product.englishName || seedTitle;
        if (!seedHero) seedHero = product.imageUrl || null;
        if (!seedSpecs.length) {
          seedSpecs = [
            { key: "واحد", value: product.defaultMeasurementUnit || product.unit || "—" },
            { key: "کشور مبدأ", value: product.supplyCountry || "IR" },
            { key: "MOQ", value: "—" },
            { key: "Incoterms", value: "FOB / CIF / EXW" },
            { key: "HS Code", value: "—" },
          ];
        }
      }
    }

    let template = null;
    const templateId = body.templateId ? parseInt(body.templateId, 10) : null;
    if (templateId) {
      template = await LandingTemplate.findOne({
        where: {
          id: templateId,
          isPublished: true,
          [Op.or]: [{ isSystem: true }, { workspaceId: ctx.workspace.id }],
        },
      });
    } else if (body.templateSlug) {
      template = await LandingTemplate.findOne({
        where: {
          slug: String(body.templateSlug),
          isPublished: true,
          [Op.or]: [{ isSystem: true, workspaceId: null }, { workspaceId: ctx.workspace.id }],
        },
      });
    }

    const themeId = resolveThemeId(
      THEME_IDS.includes(body.themeId) ? body.themeId : template?.themeIdDefault || "atelier"
    );
    const metaDefaults = recipeMetaDefaults(template);

    let blocks = [];
    if (body.content?.version === 2 && Array.isArray(body.content.blocks)) {
      blocks = body.content.blocks;
    } else if (template?.recipe?.blocks?.length) {
      blocks = recipeToBlocks(template.recipe.blocks);
      applyProductContentToBlocks(blocks, {
        title: seedTitle,
        subtitle: seedSubtitle,
        body: seedBody,
        enTitle: seedEnTitle,
        arTitle: seedArTitle,
        imageUrl: seedHero,
        specs: seedSpecs,
        marketing,
        marketingEn,
      });
    } else {
      // بدون قالب / شروع خالی — بدون بلوک پیش‌فرض
      blocks = [];
    }

    let slug = slugify(body.slug || seedEnTitle || seedTitle || `product-${Date.now()}`);
    const exists = await ProductLandingPage.findOne({
      where: { workspaceId: ctx.workspace.id, slug },
    });
    if (exists) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const content = normalizeContent(
      {
        version: 2,
        blocks,
        themeId,
        templateId: template?.id || null,
        meta: {
          paletteId:
            body.paletteId ||
            metaDefaults.paletteId ||
            ({
              atelier: "forest",
              soft: "ocean",
              tech: "slate-night",
            }[themeId] || "forest"),
          patternId: body.patternId || metaDefaults.patternId || "mesh",
          fontFa: body.fontFa || metaDefaults.fontFa || "vazirmatn",
          fontEn: body.fontEn || metaDefaults.fontEn || "inter",
          productDisplayMode: ["catalog", "landing", "catalog_only"].includes(body.productDisplayMode)
            ? body.productDisplayMode
            : metaDefaults.productDisplayMode || "catalog",
        },
      },
      { themeId, templateId: template?.id || null }
    );

    const row = await ProductLandingPage.create({
      workspaceId: ctx.workspace.id,
      ownerUserId: req.user.id,
      inventoryLotId,
      productId,
      templateId: template?.id || null,
      slug,
      themeId,
      status: "draft",
      content,
    });

    res.status(201).json({ success: true, data: serialize(row), message: "لندینگ ایجاد شد" });
  } catch (e) {
    console.error("landing create", e);
    const status = e.status || 500;
    res.status(status).json({ success: false, message: e.message || "خطا در ایجاد", code: e.code });
  }
}

async function update(req, res) {
  try {
    const ctx = await ctxFromReq(req);
    if (!ctx?.workspace?.id) {
      return res.status(400).json({ success: false, message: "کسب‌وکار فعال ندارید" });
    }
    const id = parseInt(req.params.id, 10);
    const row = await ProductLandingPage.findOne({
      where: { id, workspaceId: ctx.workspace.id },
    });
    if (!row) return res.status(404).json({ success: false, message: "لندینگ یافت نشد" });

    const body = req.body || {};
    if (body.themeId) {
      row.themeId = resolveThemeId(body.themeId);
    }
    if (body.templateId != null) {
      row.templateId = body.templateId ? parseInt(body.templateId, 10) : null;
    }
    if (body.slug) {
      const next = slugify(body.slug);
      if (next && next !== row.slug) {
        const clash = await ProductLandingPage.findOne({
          where: { workspaceId: ctx.workspace.id, slug: next },
        });
        if (clash && clash.id !== row.id) {
          return res.status(409).json({ success: false, message: "این آدرس قبلاً استفاده شده" });
        }
        row.slug = next;
      }
    }
    if (body.content) {
      row.content = normalizeContent(body.content, {
        themeId: row.themeId,
        templateId: row.templateId,
      });
      if (body.content.themeId && THEME_IDS.includes(body.content.themeId)) {
        row.themeId = body.content.themeId;
      }
    }
    if (body.status && ["draft", "published", "archived"].includes(body.status)) {
      row.status = body.status;
      if (body.status === "published" && !row.publishedAt) row.publishedAt = new Date();
    }

    await row.save();
    res.json({ success: true, data: serialize(row), message: "ذخیره شد" });
  } catch (e) {
    console.error("landing update", e);
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function remove(req, res) {
  try {
    const ctx = await ctxFromReq(req);
    if (!ctx?.workspace?.id) {
      return res.status(400).json({ success: false, message: "کسب‌وکار فعال ندارید" });
    }
    const id = parseInt(req.params.id, 10);
    const row = await ProductLandingPage.findOne({
      where: { id, workspaceId: ctx.workspace.id },
    });
    if (!row) return res.status(404).json({ success: false, message: "لندینگ یافت نشد" });
    await row.destroy();
    res.json({ success: true, message: "حذف شد" });
  } catch (e) {
    console.error("landing remove", e);
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function getPublic(req, res) {
  try {
    const shopSlug = String(req.params.shopSlug || "").trim().toLowerCase();
    const landingSlug = String(req.params.landingSlug || "").trim().toLowerCase();
    if (!shopSlug || !landingSlug) {
      return res.status(400).json({ success: false, message: "آدرس نامعتبر" });
    }

    const account = await Account.findOne({
      where: { profileSlug: shopSlug },
      attributes: [
        "id",
        "userId",
        "workspaceId",
        "profileSlug",
        "displayName",
        "coverImage",
        "headline",
        "publicPhone",
        "shopContacts",
      ],
    });
    if (!account) {
      return res.status(404).json({ success: false, message: "فروشگاه یافت نشد" });
    }

    let workspaceId = account.workspaceId || null;
    if (!workspaceId) {
      const ws = await Workspace.findOne({
        where: {
          [Op.or]: [
            { profileSlug: shopSlug },
            { accountId: account.id },
            { createdByUserId: account.userId },
          ],
        },
        attributes: ["id"],
        order: [["id", "ASC"]],
      });
      workspaceId = ws?.id || null;
    }

    const where = { slug: landingSlug, status: "published" };
    if (workspaceId) where.workspaceId = workspaceId;
    else where.ownerUserId = account.userId;

    const row = await ProductLandingPage.findOne({ where });
    if (!row) {
      return res.status(404).json({ success: false, message: "لندینگ منتشرنشده یا یافت نشد" });
    }

    const { product, offer } = await loadLandingCommerce(row);

    let viewerCanEdit = false;
    if (req.user?.id) {
      if (isAdmin(req.user)) {
        viewerCanEdit = true;
      } else if (row.ownerUserId && Number(row.ownerUserId) === Number(req.user.id)) {
        viewerCanEdit = true;
      } else {
        try {
          const ctx = await getWorkspaceContextForUser(req.user, {
            preferredWorkspaceId: preferredWorkspaceIdFromReq(req),
          });
          if (ctx?.workspace?.id && Number(ctx.workspace.id) === Number(row.workspaceId)) {
            viewerCanEdit = true;
          }
        } catch {
          viewerCanEdit = false;
        }
      }
    }

    const messengers = account.shopContacts?.messengers || {};
    res.json({
      success: true,
      data: {
        landing: serialize(row),
        shop: {
          slug: account.profileSlug,
          name: account.displayName,
          coverImage: account.coverImage,
          headline: account.headline,
          phone: account.publicPhone || null,
          whatsapp: messengers.whatsapp || null,
        },
        product,
        offer,
        themes: THEMES,
        viewerCanEdit,
        editorPath: viewerCanEdit ? `/dashboard/supplier/landings/${row.id}?scope=own` : null,
      },
    });
  } catch (e) {
    console.error("landing getPublic", e);
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function themes(_req, res) {
  res.json({
    success: true,
    data: { themes: THEMES, palettes: PALETTES, patterns: PATTERNS, productDisplayModes: PRODUCT_DISPLAY_MODES },
  });
}

/**
 * لینک عمومی لندینگ برای یک یا چند محصول (کارت کاتالوگ / هدر صفحه محصول)
 * GET ?ids=1,2,3  یا  /:productId
 */
async function resolveByProducts(req, res) {
  try {
    const rawIds = req.params.productId
      ? [req.params.productId]
      : String(req.query.ids || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
    const productIds = [...new Set(rawIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))].slice(0, 80);
    if (!productIds.length) {
      return res.json({ success: true, data: { items: {} } });
    }

    const rows = await ProductLandingPage.findAll({
      where: {
        status: "published",
        productId: { [Op.in]: productIds },
      },
      order: [["updatedAt", "DESC"]],
    });

    const byProduct = {};
    for (const row of rows) {
      const pid = Number(row.productId);
      if (byProduct[pid]) continue;
      const mode = row.content?.meta?.productDisplayMode || "catalog";
      let shopSlug = null;
      const ws = await Workspace.findByPk(row.workspaceId, { attributes: ["id", "profileSlug", "accountId", "createdByUserId"] });
      if (ws?.profileSlug) shopSlug = ws.profileSlug;
      if (!shopSlug && ws?.accountId) {
        const acc = await Account.findByPk(ws.accountId, { attributes: ["profileSlug"] });
        shopSlug = acc?.profileSlug || null;
      }
      if (!shopSlug) {
        const acc = await Account.findOne({
          where: { userId: row.ownerUserId },
          attributes: ["profileSlug"],
          order: [["id", "ASC"]],
        });
        shopSlug = acc?.profileSlug || null;
      }
      const path = shopSlug && row.slug ? `/${shopSlug}/p/${row.slug}` : null;
      byProduct[pid] = {
        productId: pid,
        landingId: row.id,
        landingSlug: row.slug,
        shopSlug,
        path,
        displayMode: ["catalog", "landing", "catalog_only"].includes(mode) ? mode : "catalog",
      };
    }

    res.json({ success: true, data: { items: byProduct } });
  } catch (e) {
    console.error("landing resolveByProducts", e);
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function listTemplates(req, res) {
  try {
    await ensureSystemTemplates();
    const ctx = await ctxFromReq(req).catch(() => null);
    const wsId = ctx?.workspace?.id || null;
    const where = {
      isPublished: true,
      [Op.or]: [{ isSystem: true, workspaceId: null }, ...(wsId ? [{ workspaceId: wsId }] : [])],
    };
    const rows = await LandingTemplate.findAll({
      where,
      order: [
        ["isSystem", "DESC"],
        ["sortOrder", "ASC"],
        ["id", "ASC"],
      ],
    });
    res.json({ success: true, data: { items: rows.map(serializeTemplate) } });
  } catch (e) {
    console.error("landing listTemplates", e);
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function getTemplate(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await LandingTemplate.findByPk(id);
    if (!row || (!row.isPublished && !isAdmin(req.user))) {
      return res.status(404).json({ success: false, message: "قالب یافت نشد" });
    }
    res.json({ success: true, data: serializeTemplate(row) });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function adminListTemplates(req, res) {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "فقط مدیر" });
    }
    await ensureSystemTemplates();
    const rows = await LandingTemplate.findAll({
      where: { isSystem: true },
      order: [["sortOrder", "ASC"], ["id", "ASC"]],
    });
    res.json({ success: true, data: { items: rows.map(serializeTemplate), themes: THEMES } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function adminCreateTemplate(req, res) {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "فقط مدیر" });
    }
    const body = req.body || {};
    const slug = slugify(body.slug || body.nameEn || body.nameFa || `tpl-${Date.now()}`);
    const clash = await LandingTemplate.findOne({
      where: { slug, isSystem: true, workspaceId: null },
    });
    if (clash) {
      return res.status(409).json({ success: false, message: "اسلاگ قالب تکراری است" });
    }
    const recipeBlocks = Array.isArray(body.recipe?.blocks) ? body.recipe.blocks : [];
    const row = await LandingTemplate.create({
      slug,
      nameFa: String(body.nameFa || "قالب جدید").slice(0, 160),
      nameEn: body.nameEn ? String(body.nameEn).slice(0, 160) : null,
      category: body.category ? String(body.category).slice(0, 60) : "custom",
      descriptionFa: body.descriptionFa ? String(body.descriptionFa).slice(0, 500) : null,
      themeIdDefault: THEME_IDS.includes(body.themeIdDefault) ? body.themeIdDefault : "atelier",
      recipe: {
        blocks: recipeBlocks.map((b) => ({
          type: b.type,
          variant: b.variant || "default",
          hidden: Boolean(b.hidden),
          props: b.props || {},
          responsive: b.responsive || {},
        })),
      },
      thumbnailUrl: body.thumbnailUrl || null,
      isSystem: true,
      isPublished: body.isPublished !== false,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 100,
      workspaceId: null,
      createdByUserId: req.user.id,
    });
    res.status(201).json({ success: true, data: serializeTemplate(row) });
  } catch (e) {
    console.error("adminCreateTemplate", e);
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function adminUpdateTemplate(req, res) {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "فقط مدیر" });
    }
    const id = parseInt(req.params.id, 10);
    const row = await LandingTemplate.findByPk(id);
    if (!row || !row.isSystem) {
      return res.status(404).json({ success: false, message: "قالب سیستمی یافت نشد" });
    }
    const body = req.body || {};
    if (body.nameFa != null) row.nameFa = String(body.nameFa).slice(0, 160);
    if (body.nameEn != null) row.nameEn = String(body.nameEn).slice(0, 160);
    if (body.category != null) row.category = String(body.category).slice(0, 60);
    if (body.descriptionFa != null) row.descriptionFa = String(body.descriptionFa).slice(0, 500);
    if (body.themeIdDefault && THEME_IDS.includes(body.themeIdDefault)) {
      row.themeIdDefault = body.themeIdDefault;
    }
    if (body.slug) {
      const next = slugify(body.slug);
      const clash = await LandingTemplate.findOne({
        where: { slug: next, isSystem: true, workspaceId: null, id: { [Op.ne]: row.id } },
      });
      if (clash) return res.status(409).json({ success: false, message: "اسلاگ تکراری" });
      row.slug = next;
    }
    if (body.recipe?.blocks) {
      row.recipe = {
        blocks: body.recipe.blocks.map((b) => ({
          type: b.type,
          variant: b.variant || "default",
          hidden: Boolean(b.hidden),
          props: b.props || {},
          responsive: b.responsive || {},
        })),
      };
    }
    if (typeof body.isPublished === "boolean") row.isPublished = body.isPublished;
    if (body.sortOrder != null) row.sortOrder = Number(body.sortOrder) || 100;
    if (body.thumbnailUrl !== undefined) row.thumbnailUrl = body.thumbnailUrl;
    await row.save();
    res.json({ success: true, data: serializeTemplate(row) });
  } catch (e) {
    console.error("adminUpdateTemplate", e);
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

async function adminDeleteTemplate(req, res) {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ success: false, message: "فقط مدیر" });
    }
    const id = parseInt(req.params.id, 10);
    const row = await LandingTemplate.findByPk(id);
    if (!row || !row.isSystem) {
      return res.status(404).json({ success: false, message: "قالب یافت نشد" });
    }
    await row.destroy();
    res.json({ success: true, message: "حذف شد" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

/** ذخیره قالب سفارشی کاربر از روی لندینگ فعلی */
async function saveAsMyTemplate(req, res) {
  try {
    const ctx = await ctxFromReq(req);
    if (!ctx?.workspace?.id) {
      return res.status(400).json({ success: false, message: "کسب‌وکار فعال ندارید" });
    }
    const body = req.body || {};
    const landingId = body.landingId ? parseInt(body.landingId, 10) : null;
    let blocks = Array.isArray(body.recipe?.blocks) ? body.recipe.blocks : null;
    let themeIdDefault = THEME_IDS.includes(body.themeIdDefault) ? body.themeIdDefault : "atelier";

    if (landingId) {
      const landing = await ProductLandingPage.findOne({
        where: { id: landingId, workspaceId: ctx.workspace.id },
      });
      if (!landing) return res.status(404).json({ success: false, message: "لندینگ یافت نشد" });
      const content = normalizeContent(landing.content || {}, { themeId: landing.themeId });
      blocks = content.blocks.map((b) => ({
        type: b.type,
        variant: b.variant,
        hidden: b.hidden,
        props: b.props,
        responsive: b.responsive,
      }));
      themeIdDefault = landing.themeId;
    }
    if (!blocks?.length) {
      return res.status(400).json({ success: false, message: "بلوکی برای ذخیره نیست" });
    }

    const slug = slugify(body.slug || body.nameFa || `my-${uid("tpl")}`);
    const row = await LandingTemplate.create({
      slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
      nameFa: String(body.nameFa || "قالب من").slice(0, 160),
      nameEn: body.nameEn || null,
      category: "custom",
      themeIdDefault,
      recipe: { blocks },
      isSystem: false,
      isPublished: true,
      sortOrder: 500,
      workspaceId: ctx.workspace.id,
      createdByUserId: req.user.id,
    });
    res.status(201).json({ success: true, data: serializeTemplate(row) });
  } catch (e) {
    console.error("saveAsMyTemplate", e);
    res.status(500).json({ success: false, message: e.message || "خطا" });
  }
}

module.exports = {
  listMine,
  getMine,
  create,
  update,
  remove,
  getPublic,
  themes,
  resolveByProducts,
  listTemplates,
  getTemplate,
  adminListTemplates,
  adminCreateTemplate,
  adminUpdateTemplate,
  adminDeleteTemplate,
  saveAsMyTemplate,
  ensureSystemTemplates,
};
