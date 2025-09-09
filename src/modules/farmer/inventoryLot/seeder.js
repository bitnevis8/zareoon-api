const InventoryLot = require("./model");
const seederData = require("./seederData.json");

const seedInventoryLots = async () => {
  console.log("🌱 Seeding Inventory Lots...");
  const lots = seederData.data || seederData;
  for (const l of lots) {
    const data = {
      id: l.id,
      farmerId: l.farmerId,
      productId: l.productId,
      qualityGrade: l.qualityGrade,
      status: l.status || "harvested",
      unit: l.unit,
      totalQuantity: l.totalQuantity,
      reservedQuantity: l.reservedQuantity || 0,
      price: l.price || null,
      minimumOrderQuantity: l.minimumOrderQuantity || null,
      tieredPricing: l.tieredPricing || null,
      areaHectare: l.areaHectare || null,
      yieldEstimatePerHectare: l.yieldEstimatePerHectare || null
    };
    const existed = await InventoryLot.findByPk(data.id);
    if (!existed) await InventoryLot.create(data); else await InventoryLot.update(data, { where: { id: data.id } });
  }
  console.log("✅ Inventory Lots seeding completed!");
};

module.exports = seedInventoryLots;

