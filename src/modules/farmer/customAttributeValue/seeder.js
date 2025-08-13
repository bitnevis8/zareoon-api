const CustomAttributeValue = require("./model");
const seederData = require("./seederData.json");

const seedCustomAttributeValues = async () => {
  console.log("🌱 Seeding Custom Attribute Values...");
  const values = seederData.data || seederData;
  for (const v of values) {
    const data = { id: v.id, inventoryLotId: v.inventoryLotId, attributeDefinitionId: v.attributeDefinitionId, value: v.value || null };
    const existed = await CustomAttributeValue.findByPk(data.id);
    if (!existed) await CustomAttributeValue.create(data); else await CustomAttributeValue.update(data, { where: { id: data.id } });
  }
  console.log("✅ Custom Attribute Values seeding completed!");
};

module.exports = seedCustomAttributeValues;

