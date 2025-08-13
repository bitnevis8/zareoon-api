const TransactionHistory = require("./model");
const seederData = require("./seederData.json");

const seedTransactionHistory = async () => {
  console.log("🌱 Seeding Transaction History...");
  const rows = seederData.data || seederData;
  for (const r of rows) {
    const data = { id: r.id, changeType: r.changeType, inventoryLotId: r.inventoryLotId, deltaQuantity: r.deltaQuantity, actorUserId: r.actorUserId };
    const existed = await TransactionHistory.findByPk(data.id);
    if (!existed) await TransactionHistory.create(data); else await TransactionHistory.update(data, { where: { id: data.id } });
  }
  console.log("✅ Transaction History seeding completed!");
};

module.exports = seedTransactionHistory;

