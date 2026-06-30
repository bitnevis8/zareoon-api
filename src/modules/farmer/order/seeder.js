const Order = require("./model");
const User = require("../../user/user/model");
const seederData = require("./seederData.json");

const seedOrders = async () => {
  console.log("🌱 Seeding Orders...");
  const orders = seederData.data || seederData;
  for (const o of orders) {
    const customer = await User.findByPk(o.customerId);
    if (!customer) {
      console.warn(`⚠️ Skip order ${o.id}: customer ${o.customerId} not found`);
      continue;
    }

    const data = { id: o.id, customerId: o.customerId, status: o.status || "pending" };
    const existed = await Order.findByPk(data.id);
    if (!existed) await Order.create(data); else await Order.update(data, { where: { id: data.id } });
  }
  console.log("✅ Orders seeding completed!");
};

module.exports = seedOrders;

