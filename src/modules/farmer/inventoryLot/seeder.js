const InventoryLot = require("./model");
const { Op } = require("sequelize");
const CustomAttributeValue = require("../customAttributeValue/model");
const TransactionHistory = require("../transactionHistory/model");

/** Former demo lot IDs from seederData (dates, aluminum powder, fertilizer, pistachio). */
const DEMO_LOT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * Demo inventory lots are intentionally not seeded.
 * Removes only the known demo lot IDs so real seller inventory is preserved.
 */
const seedInventoryLots = async () => {
  console.log("🌱 Removing demo Inventory Lots (no default stock)...");

  try {
    await CustomAttributeValue.destroy({ where: { inventoryLotId: { [Op.in]: DEMO_LOT_IDS } } });
  } catch (e) {
    console.warn("⚠️ Could not clear demo attribute values:", e.message);
  }

  try {
    await TransactionHistory.destroy({ where: { inventoryLotId: { [Op.in]: DEMO_LOT_IDS } } });
  } catch (e) {
    console.warn("⚠️ Could not clear demo transaction history:", e.message);
  }

  const deleted = await InventoryLot.destroy({ where: { id: { [Op.in]: DEMO_LOT_IDS } } });
  console.log(`✅ Demo inventory cleared (removed ${deleted} lots). No default lots seeded.`);
};

module.exports = seedInventoryLots;
