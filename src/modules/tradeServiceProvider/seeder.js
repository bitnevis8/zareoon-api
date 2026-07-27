const { updateVipTradeCategoriesConfig } = require("../siteSetting/service");

/**
 * VIP/انحصار دسته‌های خدمات را پاک می‌کند — ارائه‌دهندگان seed‌شده حفظ می‌شوند.
 */
async function seedTradeServiceProviders() {
  console.log("🌱 Clearing VIP / exclusive trade category locks...");

  try {
    await updateVipTradeCategoriesConfig({});
    console.log("✅ VIP trade category overrides cleared.");
  } catch (e) {
    console.warn("⚠️ Could not clear VIP categories:", e.message);
  }

  console.log("✅ Trade service category locks cleanup completed!");
}

module.exports = seedTradeServiceProviders;
