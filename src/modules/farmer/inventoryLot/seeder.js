const InventoryLot = require("./model");
const User = require("../../user/user/model");
const seederData = require("./seederData.json");

const seedInventoryLots = async () => {
  console.log("🌱 Seeding Inventory Lots...");
  const lots = seederData.data || seederData;
  for (const l of lots) {
    let farmerId = l.farmerId;

    if (!farmerId && l.farmerEmail) {
      const farmerByEmail = await User.findOne({ where: { email: l.farmerEmail } });
      if (!farmerByEmail) {
        console.warn(`⚠️ Skip inventory lot ${l.id}: farmer email ${l.farmerEmail} not found`);
        continue;
      }
      farmerId = farmerByEmail.id;
    }

    const farmer = await User.findByPk(farmerId);
    if (!farmer) {
      console.warn(`⚠️ Skip inventory lot ${l.id}: farmer ${farmerId} not found`);
      continue;
    }

    const data = {
      id: l.id,
      farmerId,
      productId: l.productId,
      englishName: l.englishName || null,
      arabicName: l.arabicName || null,
      russianName: l.russianName || null,
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

