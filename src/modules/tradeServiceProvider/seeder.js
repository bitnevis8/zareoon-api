const TradeServiceProvider = require("./model");
const User = require("../user/user/model");
const { upsertVipCategoryConfig } = require("../siteSetting/service");
const seederData = require("./seederData.json");

const INSPECTION_VIP_MESSAGE = {
  fa: "تمامی خدمات بازرسی و استاندارد توسط شرکت بازرسی و مهندسی آریا فولاد قرن انجام می‌شود.",
  en: "All inspection and standards services are provided by Arya Foolad Qarn Inspection & Engineering Company.",
  ru: "Все услуги инспекции и стандартизации предоставляются компанией Arya Foolad Qarn.",
};

async function seedTradeServiceProviders() {
  console.log("🌱 Seeding Trade Service Providers...");

  for (const row of seederData) {
    const user = await User.findOne({ where: { email: row.userEmail } });
    if (!user) {
      console.warn(`⚠️ Skip provider ${row.slug}: user ${row.userEmail} not found`);
      continue;
    }

    const selectedServices = row.subcategoryIds.map((subcategoryId) => ({
      categoryId: row.categoryId,
      subcategoryId,
    }));

    const payload = {
      userId: user.id,
      entityType: row.entityType,
      displayName: row.displayName,
      contactName: row.contactName,
      phone: row.phone,
      email: row.email,
      categoryId: row.categoryId,
      subcategoryIds: row.subcategoryIds,
      selectedServices,
      countriesRoutes: row.countriesRoutes || null,
      servicesOffered: row.servicesOffered || null,
      licenses: row.licenses || null,
      experienceYears: row.experienceYears ?? null,
    notes: row.notes || null,
    logoUrl: row.logoUrl || null,
    status: row.status || "approved",
      rating: row.rating ?? null,
      reviewCount: row.reviewCount ?? 0,
    };

    const [provider] = await TradeServiceProvider.findOrCreate({
      where: { email: row.email },
      defaults: payload,
    });

    if (provider) {
      await provider.update(payload);
    }

    if (row.categoryId === "inspection-standards") {
      await upsertVipCategoryConfig(row.categoryId, {
        enabled: true,
        exclusiveProviderIds: [provider.id],
        messageMode: "custom",
        message: INSPECTION_VIP_MESSAGE,
        bannerImage: "/images/advertice/afg-insp.png",
      });
      console.log(`✅ VIP category ${row.categoryId} → provider #${provider.id}`);
    }

    console.log(`✅ Trade provider seeded: ${row.displayName}`);
  }

  console.log("✅ Trade Service Providers seeding completed!");
}

module.exports = seedTradeServiceProviders;
