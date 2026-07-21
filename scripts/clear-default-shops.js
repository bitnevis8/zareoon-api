/**
 * پاک‌سازی فروشگاه‌ها، موجودی و ارائه‌دهندگان پیش‌فرض از دیتابیس فعلی.
 * اجرا از پوشه api:
 *   node scripts/clear-default-shops.js
 */
process.chdir(require("path").join(__dirname, ".."));
process.env.NODE_CONFIG_DIR = require("path").join(__dirname, "../config");

async function main() {
  const seedInventoryLots = require("../src/modules/farmer/inventoryLot/seeder");
  const seedClearDefaultShops = require("../src/modules/account/clearDefaultShopsSeeder");
  const seedTradeServiceProviders = require("../src/modules/tradeServiceProvider/seeder");
  const seedUserRoles = require("../src/modules/user/userRole/seeder");

  console.log("🧹 Clearing default shops, stock, and trade providers...\n");
  await seedInventoryLots();
  await seedClearDefaultShops();
  await seedTradeServiceProviders();
  await seedUserRoles();
  console.log("\n✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
