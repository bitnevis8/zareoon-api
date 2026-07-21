const InventoryLot = require("./model");
const CustomAttributeValue = require("../customAttributeValue/model");
const TransactionHistory = require("../transactionHistory/model");

/**
 * موجودی/محصول پیش‌فرض seed نمی‌شود — همه لات‌های دمو/قبلی پاک می‌شوند.
 */
const seedInventoryLots = async () => {
  console.log("🌱 Removing all Inventory Lots (no default shop stock)...");

  try {
    await CustomAttributeValue.destroy({ where: {} });
  } catch (e) {
    console.warn("⚠️ Could not clear attribute values:", e.message);
  }

  try {
    await TransactionHistory.destroy({ where: {} });
  } catch (e) {
    console.warn("⚠️ Could not clear transaction history:", e.message);
  }

  const deleted = await InventoryLot.destroy({ where: {} });
  console.log(`✅ Inventory cleared (removed ${deleted} lots). No default lots seeded.`);
};

module.exports = seedInventoryLots;
