const OrderRequestItem = require("./model");
const seederData = require("./seederData.json");

const seedOrderRequestItems = async () => {
  console.log("🌱 Seeding Order Request Items...");
  const items = seederData.data || seederData;
  for (const item of items) {
    const data = { 
      id: item.id, 
      orderId: item.orderId, 
      productId: item.productId,
      quantity: item.quantity,
      qualityGrade: item.qualityGrade,
      unit: item.unit,
      notes: item.notes,
      status: item.status || "pending"
    };
    const existed = await OrderRequestItem.findByPk(data.id);
    if (!existed) await OrderRequestItem.create(data); 
    else await OrderRequestItem.update(data, { where: { id: data.id } });
  }
  console.log("✅ Order Request Items seeding completed!");
};

module.exports = seedOrderRequestItems;
