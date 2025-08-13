const sequelize = require("../../../core/database/mysql/connection");
const Order = require("./model");
const OrderItem = require("../orderItem/model");
const InventoryLot = require("../inventoryLot/model");
const Product = require("../product/model");
const TransactionHistory = require("../transactionHistory/model");
const OrderRequestItem = require("../orderRequestItem/model");
const User = require("../../user/user/model");

const list = async (req, res) => {
  const where = {};
  if (req.query && req.query.customerId && Number.isFinite(Number(req.query.customerId))) {
    where.customerId = Number(req.query.customerId);
  }
  const items = await Order.findAll({ where, include: [
    { 
      model: OrderItem, as: "items",
      include: [
        { model: InventoryLot, as: "inventoryLot", include: [
          { model: Product, as: "product", attributes: ["id","name"] },
          { model: User, as: "farmer", attributes: ["id","firstName","lastName","username","mobile"] }
        ] }
      ]
    },
    { model: OrderRequestItem, as: 'requestItems' },
    { model: User, as: "customer", attributes: ["id","firstName","lastName","username","mobile"] }
  ], order: [["id","DESC"]] });
  res.json({ success: true, data: items });
};

const getById = async (req, res) => {
  const order = await Order.findByPk(req.params.id, { include: [
    { 
      model: OrderItem, as: "items",
      include: [
        { model: InventoryLot, as: "inventoryLot", include: [
          { model: Product, as: "product", attributes: ["id","name"] },
          { model: User, as: "farmer", attributes: ["id","firstName","lastName","username","mobile"] }
        ] }
      ]
    },
    { model: OrderRequestItem, as: 'requestItems' },
    { model: User, as: "customer", attributes: ["id","firstName","lastName","username","mobile"] }
  ] });
  if (!order) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: order });
};

// Create order with requested items: [{inventoryLotId, quantity}]
const create = async (req, res) => {
  const { customerId, items = [] } = req.body;
  if (!customerId || !Array.isArray(items) || items.length === 0)
    return res.status(400).json({ success: false, message: "Invalid payload" });

  const tx = await sequelize.transaction();
  try {
    const order = await Order.create({ customerId, status: "reserved" }, { transaction: tx });

    for (const it of items) {
      const lot = await InventoryLot.findByPk(it.inventoryLotId, { transaction: tx, lock: tx.LOCK.UPDATE });
      if (!lot) throw new Error("Inventory lot not found");

      const available = parseFloat(lot.totalQuantity) - parseFloat(lot.reservedQuantity || 0);
      if (parseFloat(it.quantity) > available) throw new Error("Insufficient inventory");

      lot.reservedQuantity = parseFloat(lot.reservedQuantity || 0) + parseFloat(it.quantity);
      lot.status = "reserved";
      await lot.save({ transaction: tx });

      await OrderItem.create({ orderId: order.id, inventoryLotId: lot.id, quantity: it.quantity }, { transaction: tx });
      await TransactionHistory.create({ changeType: "reserve", inventoryLotId: lot.id, deltaQuantity: it.quantity, actorUserId: req.user?.id || customerId }, { transaction: tx });
    }

    await tx.commit();
    const created = await Order.findByPk(order.id, { include: [{ model: OrderItem, as: "items" }] });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    await tx.rollback();
    res.status(400).json({ success: false, message: e.message });
  }
};

const cancel = async (req, res) => {
  const order = await Order.findByPk(req.params.id, { include: [{ model: OrderItem, as: "items" }] });
  if (!order) return res.status(404).json({ success: false, message: "Not found" });

  const tx = await sequelize.transaction();
  try {
    for (const it of order.items) {
      const lot = await InventoryLot.findByPk(it.inventoryLotId, { transaction: tx, lock: tx.LOCK.UPDATE });
      lot.reservedQuantity = parseFloat(lot.reservedQuantity || 0) - parseFloat(it.quantity);
      if (lot.reservedQuantity <= 0) {
        lot.reservedQuantity = 0;
        lot.status = "harvested";
      }
      await lot.save({ transaction: tx });
      await TransactionHistory.create({ changeType: "release", inventoryLotId: lot.id, deltaQuantity: -Math.abs(it.quantity), actorUserId: req.user?.id || 0 }, { transaction: tx });
    }

    order.status = "cancelled";
    await order.save({ transaction: tx });
    await tx.commit();
    res.json({ success: true, data: order });
  } catch (e) {
    await tx.rollback();
    res.status(400).json({ success: false, message: e.message });
  }
};

const complete = async (req, res) => {
  const order = await Order.findByPk(req.params.id, { include: [{ model: OrderItem, as: "items" }] });
  if (!order) return res.status(404).json({ success: false, message: "Not found" });

  const tx = await sequelize.transaction();
  try {
    for (const it of order.items) {
      const lot = await InventoryLot.findByPk(it.inventoryLotId, { transaction: tx, lock: tx.LOCK.UPDATE });
      const newTotal = parseFloat(lot.totalQuantity) - parseFloat(it.quantity);
      lot.totalQuantity = newTotal < 0 ? 0 : newTotal;
      lot.reservedQuantity = parseFloat(lot.reservedQuantity || 0) - parseFloat(it.quantity);
      if (lot.totalQuantity === 0) lot.status = "sold";
      await lot.save({ transaction: tx });
      await TransactionHistory.create({ changeType: "sell", inventoryLotId: lot.id, deltaQuantity: -Math.abs(it.quantity), actorUserId: req.user?.id || 0 }, { transaction: tx });
    }

    order.status = "completed";
    await order.save({ transaction: tx });
    await tx.commit();
    res.json({ success: true, data: order });
  } catch (e) {
    await tx.rollback();
    res.status(400).json({ success: false, message: e.message });
  }
};

// List items of an order with enriched lot info for supplier dashboards
const listItems = async (req, res) => {
  const order = await Order.findByPk(req.params.id, { include: [
    { model: OrderItem, as: "items", include: [ { model: InventoryLot, as: "inventoryLot", include: [ { model: Product, as: 'product', attributes: ['id','name'] } ] } ] },
    { model: User, as: "customer", attributes: ["id","firstName","lastName","username","mobile"] }
  ]});
  if (!order) return res.status(404).json({ success: false, message: "Not found" });

  const roles = Array.isArray(req.user?.roles) ? req.user.roles.map(r => r.nameEn) : [];
  const isFarmer = roles.includes('Farmer');
  const actorId = req.user?.userId || req.user?.id;
  let items = order.items || [];
  if (isFarmer && actorId) {
    items = items.filter(it => it.inventoryLot && Number(it.inventoryLot.farmerId) === Number(actorId));
  }
  res.json({ success: true, data: items });
};

// Supplier updates status of a specific order item they own (based on inventoryLot.farmerId)
const updateItemStatus = async (req, res) => {
  const { itemId } = req.params;
  const { status, notes } = req.body || {};
  const allowed = ["assigned","reviewing","preparing","ready","shipped","delivered","cancelled"];
  if (!allowed.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });

  const item = await OrderItem.findByPk(itemId, { include: [{ model: InventoryLot, as: "inventoryLot" }] });
  if (!item) return res.status(404).json({ success: false, message: "Not found" });

  // Authorization: supplier must own the lot
  const actorId = req.user?.id;
  if (actorId && item.inventoryLot?.farmerId && item.inventoryLot.farmerId !== actorId) {
    return res.status(403).json({ success: false, message: "Unauthorized to update this item" });
  }

  item.status = status;
  if (typeof notes === 'string') item.statusNotes = notes;
  await item.save();
  return res.json({ success: true, data: item });
};

// List orders that have items assigned to the logged-in farmer (supplier)
const listForFarmer = async (req, res) => {
  const actorId = req.user?.userId || req.user?.id;
  if (!actorId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const rows = await Order.findAll({
    include: [
      {
        model: OrderItem,
        as: 'items',
        required: true,
        include: [
          { model: InventoryLot, as: 'inventoryLot', where: { farmerId: actorId }, include: [ { model: Product, as: 'product', attributes: ['id','name'] } ] }
        ]
      }
    ],
    order: [["id","DESC"]]
  });
  return res.json({ success: true, data: rows });
};

// Admin allocation: replace current lot reservations of an order with provided allocation
// Payload: { items: [{ inventoryLotId, quantity }] }
const allocate = async (req, res) => {
  const orderId = req.params.id;
  const { items = [] } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Invalid payload" });
  }

  const order = await Order.findByPk(orderId, { include: [{ model: OrderItem, as: 'items' }] });
  if (!order) return res.status(404).json({ success: false, message: 'Not found' });

  const tx = await sequelize.transaction();
  try {
    // 1) Release previous reservations tied to this order
    for (const it of order.items) {
      const lot = await InventoryLot.findByPk(it.inventoryLotId, { transaction: tx, lock: tx.LOCK.UPDATE });
      lot.reservedQuantity = Math.max(0, parseFloat(lot.reservedQuantity || 0) - parseFloat(it.quantity));
      if (lot.reservedQuantity === 0 && lot.status === 'reserved') {
        lot.status = 'harvested';
      }
      await lot.save({ transaction: tx });
      await TransactionHistory.create({ changeType: 'release', inventoryLotId: lot.id, deltaQuantity: -Math.abs(it.quantity), actorUserId: req.user?.id || 0 }, { transaction: tx });
    }
    // Remove old items
    await OrderItem.destroy({ where: { orderId: order.id }, transaction: tx });

    // 2) Apply new allocation
    for (const it of items) {
      const lot = await InventoryLot.findByPk(it.inventoryLotId, { transaction: tx, lock: tx.LOCK.UPDATE });
      if (!lot) throw new Error('Inventory lot not found');
      const available = parseFloat(lot.totalQuantity) - parseFloat(lot.reservedQuantity || 0);
      const need = parseFloat(it.quantity);
      if (need <= 0) continue;
      if (need > available + 1e-9) throw new Error('Insufficient inventory for lot #' + lot.id);
      lot.reservedQuantity = parseFloat(lot.reservedQuantity || 0) + need;
      lot.status = 'reserved';
      await lot.save({ transaction: tx });
      await OrderItem.create({ orderId: order.id, inventoryLotId: lot.id, quantity: need }, { transaction: tx });
      await TransactionHistory.create({ changeType: 'reserve', inventoryLotId: lot.id, deltaQuantity: need, actorUserId: req.user?.id || 0 }, { transaction: tx });
    }

    // Keep or set order status as reserved
    order.status = 'reserved';
    await order.save({ transaction: tx });

    await tx.commit();
    const refreshed = await Order.findByPk(order.id, { include: [{ model: OrderItem, as: 'items' }] });
    return res.json({ success: true, data: refreshed });
  } catch (e) {
    await tx.rollback();
    return res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { list, getById, create, cancel, complete, listItems, updateItemStatus, listForFarmer, allocate };

