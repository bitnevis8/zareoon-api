const OrderItem = require("./model");
const seederData = require("./seederData.json");

const seedOrderItems = async () => {
  console.log("🌱 Seeding Order Items...");
  const items = seederData.data || seederData;
  for (const i of items) {
    const data = { id: i.id, orderId: i.orderId, inventoryLotId: i.inventoryLotId, productId: i.productId, quantity: i.quantity };
    const existed = await OrderItem.findByPk(data.id);
    if (!existed) await OrderItem.create(data); else await OrderItem.update(data, { where: { id: data.id } });
  }
  console.log("✅ Order Items seeding completed!");
};

module.exports = seedOrderItems;

