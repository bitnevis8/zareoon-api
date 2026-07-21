const TradeServiceProvider = require("./model");
const { updateVipTradeCategoriesConfig } = require("../siteSetting/service");

/**
 * دیگر ارائه‌دهنده پیش‌فرض seed نمی‌شود.
 * نمونه‌های قبلی (مثل آریا فولاد) پاک می‌شوند و VIP بازرسی خاموش می‌گردد.
 */
async function seedTradeServiceProviders() {
  console.log("🌱 Clearing demo Trade Service Providers (no defaults)...");

  const deleted = await TradeServiceProvider.destroy({ where: {}, truncate: false });
  console.log(`✅ Removed ${deleted} trade service provider(s).`);

  try {
    await updateVipTradeCategoriesConfig({});
    console.log("✅ VIP trade category overrides cleared.");
  } catch (e) {
    console.warn("⚠️ Could not clear VIP categories:", e.message);
  }

  console.log("✅ Trade Service Providers cleanup completed!");
}

module.exports = seedTradeServiceProviders;
