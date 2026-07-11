const InventoryLot = require("./model");
const User = require("../../user/user/model");
const Product = require("../product/model");
const seederData = require("./seederData.json");

async function resolveProductId(lot) {
  if (lot.productSlug) {
    const bySlug = await Product.findOne({ where: { slug: lot.productSlug } });
    if (bySlug) return bySlug.id;
  }
  if (lot.productName) {
    const byName = await Product.findOne({ where: { name: lot.productName } });
    if (byName) return byName.id;
  }
  if (lot.productEnglishName) {
    const byEnglishName = await Product.findOne({ where: { englishName: lot.productEnglishName } });
    if (byEnglishName) return byEnglishName.id;
  }
  if (lot.productId) {
    const byId = await Product.findByPk(lot.productId);
    if (byId) return byId.id;
  }
  return null;
}

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

    const productId = await resolveProductId(l);
    if (!productId) {
      console.warn(
        `⚠️ Skip inventory lot ${l.id}: product not found (slug=${l.productSlug || "-"}, id=${l.productId || "-"})`
      );
      continue;
    }

    const data = {
      id: l.id,
      farmerId,
      productId,
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

