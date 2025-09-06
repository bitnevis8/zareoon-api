const sequelize = require("../../../core/database/mysql/connection");
const { QueryTypes, Op } = require("sequelize");
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

      await OrderItem.create({ orderId: order.id, inventoryLotId: lot.id, productId: lot.productId, quantity: it.quantity }, { transaction: tx });
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
  const allowed = ["pending","approved","assigned","reviewing","preparing","ready","shipped","delivered","cancelled","rejected","processing"];
  if (!allowed.includes(status)) {
    console.log("Invalid status:", status, "Allowed:", allowed);
    return res.status(400).json({ success: false, message: "Invalid status" });
  }

  const item = await OrderItem.findByPk(itemId, { include: [{ model: InventoryLot, as: "inventoryLot" }] });
  if (!item) return res.status(404).json({ success: false, message: "Not found" });

  // Authorization: supplier must own the lot OR user must be admin
  const actorId = req.user?.id;
  const userRoles = Array.isArray(req.user?.roles) ? req.user.roles.map(r => r.nameEn) : [];
  const isAdmin = userRoles.includes('Administrator');
  
  if (!isAdmin && actorId && item.inventoryLot?.farmerId && item.inventoryLot.farmerId !== actorId) {
    return res.status(403).json({ success: false, message: "Unauthorized to update this item" });
  }

  try {
    // Try to update the status
    item.status = status;
    if (typeof notes === 'string') item.statusNotes = notes;
    await item.save();
    console.log("Item status updated successfully:", item.id, "to", status);
  } catch (error) {
    console.error("Error saving item status:", error);
    // If ENUM error, try to update using raw SQL
    if (error.message.includes('ENUM')) {
      try {
        await sequelize.query(
          'UPDATE order_items SET status = ?, status_notes = ? WHERE id = ?',
          {
            replacements: [status, notes || null, itemId],
            type: QueryTypes.UPDATE
          }
        );
        console.log("Item status updated using raw SQL");
      } catch (sqlError) {
        console.error("Raw SQL update failed:", sqlError);
        return res.status(500).json({ success: false, message: "Failed to update status" });
      }
    } else {
      return res.status(500).json({ success: false, message: "Failed to update status" });
    }
  }
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
        where: {
          status: {
            [Op.ne]: 'pending' // Only show items that are NOT pending
          }
        },
        include: [
          { model: InventoryLot, as: 'inventoryLot', where: { farmerId: actorId }, include: [ { model: Product, as: 'product', attributes: ['id','name'] } ] }
        ]
      }
    ],
    order: [["id","DESC"]]
  });
  return res.json({ success: true, data: rows });
};

// List orders for the logged-in customer
const listForCustomer = async (req, res) => {
  const customerId = req.user?.userId || req.user?.id;
  console.log("listForCustomer - customerId:", customerId);
  console.log("listForCustomer - req.user:", req.user);
  console.log("listForCustomer - req.user.userId:", req.user?.userId);
  console.log("listForCustomer - req.user.id:", req.user?.id);
  
  if (!customerId) {
    console.log("listForCustomer - No customerId found");
    return res.status(401).json({ success: false, message: 'Unauthorized - No customer ID' });
  }

  try {
    // First, let's check if there are any orders for this customer
    const orderCount = await Order.count({ where: { customerId } });
    console.log("listForCustomer - order count for customer", customerId, ":", orderCount);
    
    const rows = await Order.findAll({
      where: { customerId },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            { 
              model: InventoryLot, 
              as: 'inventoryLot', 
              include: [ 
                { model: Product, as: 'product', attributes: ['id','name'] },
                { model: User, as: 'farmer', attributes: ['id','firstName','lastName','username','mobile'] }
              ] 
            }
          ]
        },
        { model: OrderRequestItem, as: 'requestItems' }
      ],
      order: [["id","DESC"]]
    });
    console.log("listForCustomer - found orders:", rows.length);
    console.log("listForCustomer - orders data:", JSON.stringify(rows, null, 2));
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("listForCustomer - error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
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

// Get orders for admin management
const listForAdmin = async (req, res) => {
  try {
    console.log("=== Admin Order Management ===");
    console.log("Admin user:", req.user);
    
    const orders = await Order.findAll({
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        },
        {
          model: User,
          as: 'supplier',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        },
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'englishName', 'unit']
            },
            {
              model: InventoryLot,
              as: 'inventoryLot',
              include: [
                {
                  model: User,
                  as: 'farmer',
                  attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'mobile']
                }
              ]
            }
          ]
        },
        {
          model: OrderRequestItem,
          as: 'requestItems',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'englishName', 'unit']
            },
            {
              model: InventoryLot,
              as: 'inventoryLot',
              include: [
                {
                  model: User,
                  as: 'farmer',
                  attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'mobile']
                }
              ]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log("Admin orders count:", orders.length);
    console.log("Admin orders:", JSON.stringify(orders, null, 2));

    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error("Admin order management error:", error);
    res.status(500).json({
      success: false,
      message: "خطا در دریافت سفارشات",
      error: error.message
    });
  }
};

// Approve order and send to supplier
const approveOrder = async (req, res) => {
  try {
    const orderId = req.params.id; // Route is /:id/approve, so use req.params.id
    const { supplierId, notes } = req.body;
    
    console.log("=== Approve Order ===");
    console.log("Order ID:", orderId);
    console.log("Supplier ID:", supplierId);
    console.log("Notes:", notes);
    
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "سفارش یافت نشد"
      });
    }
    
    // Auto-detect supplier from OrderRequestItem's inventoryLot if supplierId is 'auto'
    let finalSupplierId = supplierId;
    if (supplierId === 'auto' || !supplierId) {
      const requestItems = await OrderRequestItem.findAll({
        where: { orderId: orderId },
        include: [
          {
            model: InventoryLot,
            as: 'inventoryLot',
            include: [
              {
                model: User,
                as: 'farmer',
                attributes: ['id', 'firstName', 'lastName']
              }
            ]
          }
        ]
      });
      
      if (requestItems.length > 0 && requestItems[0].inventoryLot?.farmer) {
        finalSupplierId = requestItems[0].inventoryLot.farmer.id;
        console.log("Auto-detected supplier:", finalSupplierId, requestItems[0].inventoryLot.farmer.firstName, requestItems[0].inventoryLot.farmer.lastName);
      } else {
        return res.status(400).json({
          success: false,
          message: "نمی‌توان تامین‌کننده را شناسایی کرد"
        });
      }
    }
    
    // Get order request items
    const requestItems = await OrderRequestItem.findAll({
      where: { orderId: orderId }
    });
    
    console.log("Request items found:", requestItems.length);
    
    // Convert OrderRequestItem to OrderItem for each request
    for (const requestItem of requestItems) {
      // Find available inventory lots for this product and quality grade
      const availableLots = await InventoryLot.findAll({
        where: {
          productId: requestItem.productId,
          qualityGrade: requestItem.qualityGrade,
          status: 'harvested'
        },
        include: [
          {
            model: User,
            as: 'farmer',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
          }
        ],
        order: [['totalQuantity', 'DESC']] // Order by highest quantity first
      });
      
      console.log(`Available lots for product ${requestItem.productId}, grade ${requestItem.qualityGrade}:`, availableLots.length);
      
      if (availableLots.length > 0) {
        // Use the first available lot (highest quantity)
        const selectedLot = availableLots[0];
        
        // Create OrderItem
        await OrderItem.create({
          orderId: orderId,
          inventoryLotId: selectedLot.id,
          productId: requestItem.productId,
          quantity: requestItem.quantity,
          status: 'assigned'
        });
        
        console.log(`Created OrderItem for lot ${selectedLot.id}, farmer: ${selectedLot.farmer?.firstName} ${selectedLot.farmer?.lastName}`);
      } else {
        console.log(`No available lots for product ${requestItem.productId}, grade ${requestItem.qualityGrade}`);
      }
    }
    
    // Update order status to approved
    await order.update({
      status: 'approved',
      supplierId: finalSupplierId,
      adminNotes: notes,
      approvedAt: new Date(),
      approvedBy: req.user.id
    });
    
    console.log("Order approved successfully");
    
    res.json({
      success: true,
      message: "سفارش تایید شد و به تامین‌کننده ارسال شد"
    });
  } catch (error) {
    console.error("Approve order error:", error);
    res.status(500).json({
      success: false,
      message: "خطا در تایید سفارش",
      error: error.message
    });
  }
};

// Update order status
const updateStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    
    console.log("=== Update Order Status ===");
    console.log("Order ID:", orderId);
    console.log("New status:", status);
    console.log("Notes:", notes);
    
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "سفارش یافت نشد"
      });
    }
    
    // Update order status
    await order.update({
      status: status,
      adminNotes: notes,
      updatedAt: new Date()
    });
    
    console.log("Order status updated successfully");
    
    res.json({
      success: true,
      message: "وضعیت سفارش به‌روزرسانی شد"
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "خطا در به‌روزرسانی وضعیت سفارش",
      error: error.message
    });
  }
};

module.exports = { list, getById, create, cancel, complete, listItems, updateItemStatus, listForFarmer, listForCustomer, allocate, listForAdmin, approveOrder, updateStatus };

