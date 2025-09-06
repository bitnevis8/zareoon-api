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

// محاسبه موجودی سلسله مراتبی برای محصولات و دسته‌ها
const getHierarchicalStock = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (!productId) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    // دریافت محصول اصلی
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // دریافت همه محصولات برای محاسبه سلسله مراتبی
    const allProducts = await Product.findAll({
      where: { isActive: true },
      order: [["id", "ASC"]]
    });

    // دریافت همه موجودی‌ها
    const allInventoryLots = await InventoryLot.findAll({
      where: { status: { [Op.in]: ["harvested", "reserved"] } }
    });

    // محاسبه موجودی سلسله مراتبی
    const stockData = calculateHierarchicalStock(product, allProducts, allInventoryLots);

    res.json({ 
      success: true, 
      data: {
        product: {
          id: product.id,
          name: product.name,
          parentId: product.parentId,
          isOrderable: product.isOrderable
        },
        stock: stockData
      }
    });
  } catch (error) {
    console.error("Error calculating hierarchical stock:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// تابع محاسبه موجودی سلسله مراتبی
const calculateHierarchicalStock = (product, allProducts, inventoryLots) => {
  const result = {
    totalStock: 0,
    availableStock: 0,
    reservedStock: 0,
    batches: [],
    children: []
  };

  if (product.isOrderable) {
    // محصول نهایی - محاسبه از بچ‌ها
    const productLots = inventoryLots.filter(lot => lot.productId === product.id);
    
    // گروه‌بندی بر اساس درجه کیفیت
    const batchesByGrade = {};
    productLots.forEach(lot => {
      const grade = lot.qualityGrade || 'بدون درجه';
      if (!batchesByGrade[grade]) {
        batchesByGrade[grade] = {
          grade: grade,
          totalStock: 0,
          availableStock: 0,
          reservedStock: 0,
          lots: []
        };
      }
      
      const total = parseFloat(lot.totalQuantity || 0);
      const reserved = parseFloat(lot.reservedQuantity || 0);
      const available = total - reserved;
      
      batchesByGrade[grade].totalStock += total;
      batchesByGrade[grade].availableStock += available;
      batchesByGrade[grade].reservedStock += reserved;
      batchesByGrade[grade].lots.push({
        id: lot.id,
        totalQuantity: total,
        availableQuantity: available,
        reservedQuantity: reserved,
        unit: lot.unit,
        status: lot.status
      });
    });

    result.batches = Object.values(batchesByGrade);
    result.totalStock = result.batches.reduce((sum, batch) => sum + batch.totalStock, 0);
    result.availableStock = result.batches.reduce((sum, batch) => sum + batch.availableStock, 0);
    result.reservedStock = result.batches.reduce((sum, batch) => sum + batch.reservedStock, 0);

  } else {
    // دسته - محاسبه از زیرمجموعه‌ها
    const children = allProducts.filter(p => p.parentId === product.id && p.isActive);
    
    for (const child of children) {
      const childStock = calculateHierarchicalStock(child, allProducts, inventoryLots);
      result.children.push({
        product: {
          id: child.id,
          name: child.name,
          isOrderable: child.isOrderable
        },
        stock: childStock
      });
      
      result.totalStock += childStock.totalStock;
      result.availableStock += childStock.availableStock;
      result.reservedStock += childStock.reservedStock;
    }
  }

  return result;
};

module.exports.getHierarchicalStock = getHierarchicalStock;

