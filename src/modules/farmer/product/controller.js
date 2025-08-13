const { Op } = require("sequelize");
const Product = require("./model");
const OrderItem = require("../orderItem/model");
const InventoryLot = require("../inventoryLot/model");
const Order = require("../order/model");
const User = require("../../user/user/model");
const { Cart, CartItem } = require("../cart/model");

const list = async (req, res) => {
  const where = {};
  if (req.query.parentId !== undefined) where.parentId = req.query.parentId || null;
  if (req.query.isOrderable !== undefined) where.isOrderable = String(req.query.isOrderable) === 'true';

  const q = (req.query.q || "").trim();
  if (q) {
    where[Op.or] = [
      { name: { [Op.like]: `%${q}%` } },
      { slug: { [Op.like]: `%${q}%` } },
      { englishName: { [Op.like]: `%${q}%` } },
    ];
  }

  const options = { where, order: [["id", "ASC"]] };
  if (q && req.query.limit !== undefined) {
    const limit = parseInt(req.query.limit, 10);
    if (Number.isFinite(limit) && limit > 0) options.limit = limit;
  }
  const items = await Product.findAll(options);
  res.json({ success: true, data: items });
};

const getById = async (req, res) => {
  const item = await Product.findByPk(req.params.id);
  if (!item) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true, data: item });
};

const create = async (req, res) => {
  const payload = req.body;
  // Backward compatibility: if categoryId is provided and parentId is not, use it as parentId
  if (payload.parentId === undefined && payload.categoryId !== undefined) {
    payload.parentId = payload.categoryId;
  }
  // If isOrderable is undefined, infer: has unit => true, else false
  if (payload.isOrderable === undefined) {
    payload.isOrderable = Boolean(payload.unit);
  }
  const created = await Product.create(payload);
  res.status(201).json({ success: true, data: created });
};

const update = async (req, res) => {
  const id = req.params.id;
  const payload = req.body;
  if (payload.parentId === undefined && payload.categoryId !== undefined) {
    payload.parentId = payload.categoryId;
  }
  const [count] = await Product.update(payload, { where: { id } });
  if (!count) return res.status(404).json({ success: false, message: "Not found" });
  const updated = await Product.findByPk(id);
  res.json({ success: true, data: updated });
};

const remove = async (req, res) => {
  const id = req.params.id;
  const count = await Product.destroy({ where: { id } });
  if (!count) return res.status(404).json({ success: false, message: "Not found" });
  res.json({ success: true });
};

// Export products (and categories) as CSV for Excel
const exportEnglishCsv = async (req, res) => {
  const where = {};
  // Optional filters: ?isOrderable=true/false
  if (req.query.isOrderable !== undefined) where.isOrderable = String(req.query.isOrderable) === 'true';
  const items = await Product.findAll({ where, order: [["id", "ASC"]] });
  const headers = [
    "id","parentId","isOrderable","name","englishName","slug","unit","isActive","sortOrder","isFeatured"
  ];
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const rows = items.map(p => [
    p.id,
    p.parentId ?? "",
    p.isOrderable ? 1 : 0,
    p.name ?? "",
    p.englishName ?? "",
    p.slug ?? "",
    p.unit ?? "",
    p.isActive === false ? 0 : 1,
    Number.isFinite(p.sortOrder) ? p.sortOrder : "",
    p.isFeatured ? 1 : 0,
  ]);
  const csv = [headers.map(escapeCsv).join(","), ...rows.map(r => r.map(escapeCsv).join(","))].join("\n");
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="products_english.csv"');
  res.send('\uFEFF' + csv); // BOM for Excel UTF-8
};

module.exports = { list, getById, create, update, remove, exportEnglishCsv };

// تاریخچه سفارش‌های مرتبط با یک محصول بر اساس lots
const orderHistory = async (req, res) => {
  const productId = Number(req.params.id);
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  const whereLot = { productId };
  try {
    const items = await OrderItem.findAll({
      include: [
        { model: InventoryLot, as: 'inventoryLot', where: whereLot },
        { model: Order, as: 'order', include: [{ model: User, as: 'customer' }] },
      ],
      order: [[{ model: Order, as: 'order' }, 'createdAt', 'DESC']],
      limit,
      offset,
    });
    const mapped = items.map(oi => ({
      id: oi.id,
      orderId: oi.orderId,
      createdAt: oi.order?.createdAt,
      status: oi.order?.status,
      customer: oi.order?.customer ? {
        id: oi.order.customer.id,
        name: `${oi.order.customer.firstName || ''} ${oi.order.customer.lastName || ''}`.trim() || (oi.order.customer.username || oi.order.customer.mobile || `#${oi.order.customer.id}`)
      } : null,
      quantity: oi.quantity,
      inventoryLotId: oi.inventoryLotId,
      qualityGrade: oi.inventoryLot?.qualityGrade,
      unit: oi.inventoryLot?.unit,
    }));
    res.json({ success: true, data: mapped });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports.orderHistory = orderHistory;

// آیتم‌های سبد خرید فعال مرتبط با یک محصول
const cartItemsForProduct = async (req, res) => {
  const productId = Number(req.params.id);
  const limit = parseInt(req.query.limit || '50', 10);
  const offset = parseInt(req.query.offset || '0', 10);
  try {
    const items = await CartItem.findAll({
      where: { productId },
      include: [
        { model: Cart, as: 'cart', where: { status: 'active' }, include: [{ model: User, as: 'customer' }] },
      ],
      order: [[{ model: Cart, as: 'cart' }, 'createdAt', 'DESC']],
      limit,
      offset,
    });
    const mapped = items.map(ci => ({
      id: ci.id,
      cartId: ci.cartId,
      createdAt: ci.cart?.createdAt,
      customer: ci.cart?.customer ? {
        id: ci.cart.customer.id,
        name: `${ci.cart.customer.firstName || ''} ${ci.cart.customer.lastName || ''}`.trim() || (ci.cart.customer.username || ci.cart.customer.mobile || `#${ci.cart.customer.id}`)
      } : null,
      qualityGrade: ci.qualityGrade,
      quantity: ci.quantity,
      unit: ci.unit,
    }));
    res.json({ success: true, data: mapped });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

module.exports.cartItemsForProduct = cartItemsForProduct;

