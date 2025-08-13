const { Op } = require("sequelize");
const { Cart, CartItem } = require("./model");
const InventoryLot = require("../inventoryLot/model");
const Order = require("../order/model");
const OrderItem = require("../orderItem/model");
const OrderRequestItem = require("../orderRequestItem/model");
const TransactionHistory = require("../transactionHistory/model");
const sequelize = require("../../../core/database/mysql/connection");

const meId = (req) => {
  const q = req.query?.customerId;
  if (q && Number.isFinite(Number(q))) return Number(q);
  return req.user?.id || req.body?.customerId || 1;
};

const getMyCart = async (req, res) => {
  const customerId = meId(req);
  let cart = await Cart.findOne({ where: { customerId, status: "active" }, include: [{ model: CartItem, as: "items" }] });
  if (!cart) cart = await Cart.create({ customerId, status: "active" });
  const items = await CartItem.findAll({ where: { cartId: cart.id } });
  const mappedItems = items.map(i => ({
    id: i.id,
    cartId: i.cartId,
    productId: i.productId,
    qualityGrade: i.qualityGrade,
    unit: i.unit,
    quantity: i.quantity,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));
  res.json({ success: true, data: { id: cart.id, customerId, status: cart.status, createdAt: cart.createdAt, updatedAt: cart.updatedAt, items: mappedItems } });
};

const addItem = async (req, res) => {
  const customerId = meId(req);
  const { productId, qualityGrade, quantity, unit } = req.body;
  if (!productId || !qualityGrade || !quantity) return res.status(400).json({ success: false, message: "Invalid payload" });
  let cart = await Cart.findOne({ where: { customerId, status: "active" } });
  if (!cart) cart = await Cart.create({ customerId, status: "active" });
  const item = await CartItem.create({ cartId: cart.id, productId, qualityGrade, quantity, unit: unit || null });
  res.status(201).json({ success: true, data: item });
};

const updateItem = async (req, res) => {
  const id = req.params.id;
  const payload = req.body;
  const [count] = await CartItem.update(payload, { where: { id } });
  if (!count) return res.status(404).json({ success: false, message: "Not found" });
  const updated = await CartItem.findByPk(id);
  res.json({ success: true, data: updated });
};

const removeItem = async (req, res) => {
  const id = req.params.id;
  await CartItem.destroy({ where: { id } });
  res.json({ success: true });
};

// Checkout: create order with request items only (pending). Admin will allocate later.
const checkout = async (req, res) => {
  const customerId = meId(req);
  const cart = await Cart.findOne({ where: { customerId, status: "active" } });
  if (!cart) return res.status(404).json({ success: false, message: "سبد خالی است" });
  const items = await CartItem.findAll({ where: { cartId: cart.id } });
  if (items.length === 0) return res.status(400).json({ success: false, message: "سبد خالی است" });

  const tx = await sequelize.transaction();
  try {
    const order = await Order.create({ customerId, status: "pending" }, { transaction: tx });
    for (const it of items) {
      await OrderRequestItem.create({ orderId: order.id, productId: it.productId, qualityGrade: it.qualityGrade, unit: it.unit || null, quantity: it.quantity }, { transaction: tx });
    }

    await Cart.update({ status: "checked_out" }, { where: { id: cart.id }, transaction: tx });
    await tx.commit();
    res.json({ success: true, data: { orderId: order.id } });
  } catch (e) {
    await tx.rollback();
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports = { getMyCart, addItem, updateItem, removeItem, checkout };

