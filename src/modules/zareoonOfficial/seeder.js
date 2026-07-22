const User = require("../user/user/model");
const Role = require("../user/role/model");
const UserRole = require("../user/userRole/model");
const Account = require("../account/model");
const AccountProfileField = require("../account/profileField/model");
const TradeServiceProvider = require("../tradeServiceProvider/model");
const Product = require("../farmer/product/model");
const InventoryLot = require("../farmer/inventoryLot/model");
const { displayContentToLegacyFields } = require("../../utils/inventoryDisplayContent");
const data = require("./seederData.json");

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

async function upsertTradeProvider(user, cfg) {
  const selectedServices = Array.isArray(cfg.selectedServices) ? cfg.selectedServices : [];
  const primaryCategoryId = selectedServices[0]?.categoryId || "packaging-prep";
  const payload = {
    userId: user.id,
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

async function seedInventoryLots(user, lotsCfg) {
  let created = 0;
  let updated = 0;

  for (const item of lotsCfg) {
    const product = await Product.findOne({ where: { slug: item.productSlug } });
    if (!product) {
      console.warn(`⚠️ Product slug not found: ${item.productSlug}`);
      continue;
    }

    const legacy = displayContentToLegacyFields(item.displayContent || {});
    const titleFa = item.displayContent?.fa?.title || product.name;
    const grade = item.qualityGrade || "Premium";

    const existing = await InventoryLot.findOne({
      where: {
        farmerId: user.id,
        productId: product.id,
        qualityGrade: grade,
      },
    });

    const payload = {
      farmerId: user.id,
      productId: product.id,
      qualityGrade: grade,
      status: "harvested",
      unit: item.unit || product.defaultMeasurementUnit || product.unit || "kg",
      packagingType: item.packagingType || null,
      filterValues: null,
      hsCode: null,
      totalQuantity: item.totalQuantity != null ? Number(item.totalQuantity) : 10000,
      reservedQuantity: 0,
      price: item.price != null ? item.price : null,
      priceCurrency: "TOMAN",
      tieredPricing: null,
      minimumOrderQuantity: null,
      locationLabel: item.supplyCity || null,
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

  const officialAvatar = data.avatarUrl || "/images/logo.png";
  if (user.avatar !== officialAvatar) {
    await user.update({ avatar: officialAvatar });
    console.log(`✅ Official avatar set → ${officialAvatar}`);
  }

  const providerCfg = {
    ...(data.tradeProvider || {}),
    logoUrl: data.tradeProvider?.logoUrl || officialAvatar,
  };
  const provider = await upsertTradeProvider(user, providerCfg);
  console.log(`✅ Trade provider ready id=${provider.id} slug=${provider.profileSlug}`);

  const lotStats = await seedInventoryLots(user, data.inventoryLots || []);
  console.log(
    `✅ Inventory lots ready created=${lotStats.created} updated=${lotStats.updated}`
  );

  console.log("✅ Official Zareoon page seeding completed! → /zareoon");
}

module.exports = seedZareoonOfficial;
