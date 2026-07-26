const User = require("../user/user/model");
const Role = require("../user/role/model");
const UserRole = require("../user/userRole/model");
const Account = require("../account/model");
const AccountProfileField = require("../account/profileField/model");
const TradeServiceProvider = require("../tradeServiceProvider/model");
const Product = require("../farmer/product/model");
const InventoryLot = require("../farmer/inventoryLot/model");
const { Workspace, WorkspaceMember } = require("../workspace/model");
const { WORKSPACE_ROLES } = require("../workspace/constants");
const { displayContentToLegacyFields } = require("../../utils/inventoryDisplayContent");
const data = require("./seederData.json");

/** نام کاتالوگ: نوع محصول قبل از نام واریته */
const PRODUCT_NAME_FIXES = {
  "date-klooteh": { fa: "خرمای کلوته", en: "Klooteh Date" },
  "date-estamaran": { fa: "خرمای استعمران", en: "Estamaran Date" },
  "date-zahidi-iraq": { fa: "خرمای زهدی عراق", en: "Zahidi Iraq Date" },
  "date-piarom": { fa: "خرمای پیارم", en: "Piarom Date" },
  "date-rabbi-iranshahr": { fa: "خرمای ربی ایرانشهر", en: "Rabbi Iranshahr Date" },
  "date-mazafati-rutab": { fa: "خرمای رطب مضافتی", en: "Mazafati Rutab Date" },
  "urea-fertilizer": { fa: "کود اوره", en: "Urea Fertilizer" },
};

async function ensureRole(userId, roleName) {
  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) {
    console.warn(`⚠️ Role ${roleName} not found`);
    return;
  }
  await UserRole.findOrCreate({
    where: { userId, roleId: role.id },
    defaults: { userId, roleId: role.id },
  });
}

async function upsertAccount(user, accountCfg) {
  let account = await Account.findOne({ where: { userId: user.id } });
  const payload = {
    entityType: accountCfg.entityType || "company",
    profileSlug: accountCfg.profileSlug,
    displayName: accountCfg.displayName || accountCfg.profileFields?.companyName || null,
    headline: accountCfg.headline || null,
    bio: accountCfg.bio || null,
    publicEmail: accountCfg.publicEmail || user.email || null,
    publicPhone: accountCfg.shopContacts?.phones?.[0] || user.mobile || null,
    shopContacts: accountCfg.shopContacts || null,
    country: accountCfg.country || "Iran",
    isPublic: accountCfg.isPublic !== false,
    shopStatus: accountCfg.shopStatus || "ACTIVE",
  };

  if (!account) {
    account = await Account.create({ userId: user.id, ...payload });
  } else {
    await account.update(payload);
  }

  const fields = accountCfg.profileFields || {};
  for (const [fieldKey, fieldValue] of Object.entries(fields)) {
    const existing = await AccountProfileField.findOne({
      where: { accountId: account.id, fieldKey },
    });
    if (existing) {
      await existing.update({ fieldValue: String(fieldValue) });
    } else {
      await AccountProfileField.create({
        accountId: account.id,
        fieldKey,
        fieldValue: String(fieldValue),
      });
    }
  }

  return account;
}

async function upsertTradeProvider(user, cfg, workspaceId = null) {
  const selectedServices = Array.isArray(cfg.selectedServices) ? cfg.selectedServices : [];
  const primaryCategoryId = selectedServices[0]?.categoryId || "packaging-prep";
  const payload = {
    userId: user.id,
    workspaceId: workspaceId || null,
    entityType: cfg.entityType || "company",
    displayName: cfg.displayName,
    contactName: cfg.contactName,
    phone: cfg.phone,
    email: cfg.email || user.email,
    categoryId: primaryCategoryId,
    subcategoryIds: selectedServices.map((s) => s.subcategoryId),
    selectedServices,
    countriesRoutes: cfg.countriesRoutes || null,
    servicesOffered: cfg.servicesOffered || null,
    experienceYears: cfg.experienceYears || null,
    notes: cfg.notes || null,
    status: cfg.status || "approved",
    profileSlug: cfg.profileSlug,
    isPublic: cfg.isPublic !== false,
    pageStatus: cfg.pageStatus || "ACTIVE",
    logoUrl: cfg.logoUrl || null,
  };

  let row = await TradeServiceProvider.findOne({
    where: { profileSlug: cfg.profileSlug },
  });
  if (!row) {
    row = await TradeServiceProvider.findOne({ where: { userId: user.id } });
  }
  if (!row) {
    row = await TradeServiceProvider.create(payload);
  } else {
    await row.update(payload);
  }
  return row;
}

async function ensureZareoonWorkspace(user, account) {
  let workspace =
    (account?.profileSlug
      ? await Workspace.findOne({ where: { profileSlug: account.profileSlug } })
      : null) ||
    (account?.id ? await Workspace.findOne({ where: { accountId: account.id } }) : null);

  if (!workspace) {
    workspace = await Workspace.create({
      name: account?.displayName || account?.profileSlug || "زارعون",
      displayName: account?.displayName || "زارعون",
      profileSlug: account?.profileSlug || "zareoon",
      entityType: account?.entityType || "company",
      activityBuyer: true,
      activitySeller: true,
      activityServices: true,
      isPublic: true,
      createdByUserId: user.id,
      accountId: account?.id || null,
      addressLabel: "تهران، تهران",
      addressText: "تهران",
    });
  } else {
    await workspace.update({
      displayName: account?.displayName || workspace.displayName || "زارعون",
      profileSlug: account?.profileSlug || workspace.profileSlug || "zareoon",
      activitySeller: true,
      activityServices: true,
      isPublic: true,
      accountId: account?.id || workspace.accountId,
    });
  }

  if (account && Number(account.workspaceId) !== Number(workspace.id)) {
    await account.update({ workspaceId: workspace.id });
  }

  await WorkspaceMember.findOrCreate({
    where: { workspaceId: workspace.id, userId: user.id },
    defaults: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WORKSPACE_ROLES.OWNER,
      status: "active",
      joinedAt: new Date(),
    },
  });

  if (Number(user.activeWorkspaceId) !== Number(workspace.id)) {
    await user.update({ activeWorkspaceId: workspace.id });
  }

  return workspace;
}

async function fixProductDisplayNames() {
  let n = 0;
  for (const [slug, names] of Object.entries(PRODUCT_NAME_FIXES)) {
    const product = await Product.findOne({ where: { slug } });
    if (!product) continue;
    const patch = {};
    if (names.fa && product.name !== names.fa) patch.name = names.fa;
    if (names.en && product.englishName !== names.en) patch.englishName = names.en;
    if (Object.keys(patch).length) {
      await product.update(patch);
      n += 1;
    }
  }
  return n;
}

function buildOriginFilter(item, index = 0) {
  const country = String(item.originCountry || item.supplyCountry || "IR").toUpperCase();
  const province = item.originProvince || item.supplyProvince || null;
  const city = item.originCity || item.supplyCity || null;
  const verified = item.listingVerified !== false;
  const levels = ["basic", "standard", "enhanced", "full"];
  return {
    originCountry: country,
    originProvince: province,
    originCity: city,
    listingVerified: verified,
    verificationLevel: verified
      ? item.verificationLevel || levels[index % levels.length]
      : "none",
  };
}

function buildLocationLabel(item, filterValues) {
  if (item.locationLabel) return item.locationLabel;
  const city = filterValues.originCity;
  const province = filterValues.originProvince;
  if (city && province) return `${city}، ${province}`;
  return city || province || null;
}

async function seedInventoryLots(user, workspace, lotsCfg) {
  let created = 0;
  let updated = 0;

  for (let i = 0; i < lotsCfg.length; i += 1) {
    const item = lotsCfg[i];
    const product = await Product.findOne({ where: { slug: item.productSlug } });
    if (!product) {
      console.warn(`⚠️ Product slug not found: ${item.productSlug}`);
      continue;
    }

    const legacy = displayContentToLegacyFields(item.displayContent || {});
    const titleFa = item.displayContent?.fa?.title || product.name;
    const grade = item.qualityGrade || "Premium";
    const filterValues = buildOriginFilter(item, i);
    const locationLabel = buildLocationLabel(item, filterValues);

    const existing = await InventoryLot.findOne({
      where: {
        farmerId: user.id,
        productId: product.id,
        qualityGrade: grade,
      },
    });

    const payload = {
      farmerId: user.id,
      workspaceId: workspace?.id || null,
      productId: product.id,
      qualityGrade: grade,
      status: "harvested",
      unit: item.unit || product.defaultMeasurementUnit || product.unit || "kg",
      packagingType: item.packagingType || null,
      filterValues,
      hsCode: null,
      totalQuantity: item.totalQuantity != null ? Number(item.totalQuantity) : 40000,
      reservedQuantity: 0,
      price: item.price != null ? Number(item.price) : 140000,
      priceCurrency: item.priceCurrency || "TOMAN",
      tieredPricing: null,
      minimumOrderQuantity: null,
      locationLabel,
      ...legacy,
      description: legacy.description || `${titleFa} — عرضه زارعون`,
    };

    if (existing) {
      await existing.update(payload);
      updated += 1;
    } else {
      await InventoryLot.create(payload);
      created += 1;
    }
  }

  return { created, updated };
}

/**
 * صفحه رسمی zareoon برای مدیر کل (حسین): فروشگاه + خدمات + محصولات استعلامی
 */
async function seedZareoonOfficial() {
  console.log("🌱 Seeding official Zareoon shop & services...");

  const ownerEmail = data.ownerEmail || "bitnevis@yahoo.com";
  const user = await User.findOne({ where: { email: ownerEmail } });
  if (!user) {
    console.warn(`⚠️ Owner user not found (${ownerEmail}); skip zareoon official seed`);
    return;
  }

  await ensureRole(user.id, "seller");
  await ensureRole(user.id, "service_provider");

  const account = await upsertAccount(user, data.account || {});
  console.log(`✅ Account ready id=${account.id} slug=${account.profileSlug}`);

  const workspace = await ensureZareoonWorkspace(user, account);
  console.log(`✅ Workspace ready id=${workspace.id} slug=${workspace.profileSlug}`);

  const renamed = await fixProductDisplayNames();
  if (renamed) console.log(`✅ Product display names fixed: ${renamed}`);

  const officialAvatar = data.avatarUrl || "/images/logo.png";
  if (user.avatar !== officialAvatar) {
    await user.update({ avatar: officialAvatar });
    console.log(`✅ Official avatar set → ${officialAvatar}`);
  }

  const providerCfg = {
    ...(data.tradeProvider || {}),
    logoUrl: data.tradeProvider?.logoUrl || officialAvatar,
  };
  const provider = await upsertTradeProvider(user, providerCfg, workspace.id);
  console.log(`✅ Trade provider ready id=${provider.id} slug=${provider.profileSlug}`);

  const lotStats = await seedInventoryLots(user, workspace, data.inventoryLots || []);
  console.log(
    `✅ Inventory lots ready created=${lotStats.created} updated=${lotStats.updated} workspaceId=${workspace.id}`
  );

  console.log("✅ Official Zareoon page seeding completed! → /zareoon");
}

module.exports = seedZareoonOfficial;
