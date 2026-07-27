const { Op } = require("sequelize");
const User = require("../user/user/model");
const Product = require("../farmer/product/model");
const InventoryLot = require("../farmer/inventoryLot/model");
const { BarterNotification } = require("./model");

const userAttrs = ["id", "firstName", "lastName", "username", "mobile"];

function lotInclude() {
  return [
    {
      model: Product,
      as: "product",
      attributes: ["id", "name", "englishName", "arabicName", "russianName", "slug", "parentId", "isOrderable"],
    },
    {
      model: User,
      as: "supplier",
      attributes: userAttrs,
    },
  ];
}

function serializeLot(lot) {
  if (!lot) return null;
  return lot.toJSON ? lot.toJSON() : { ...lot };
}

const unreadCount = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const count = await BarterNotification.count({
      where: { recipientUserId: userId, readAt: null },
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error("Barter unreadCount error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت اعلان‌های معاوضه" });
  }
};

const listNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const unreadOnly = req.query.unread === "1" || req.query.unread === "true";
    const where = { recipientUserId: userId };
    if (unreadOnly) where.readAt = null;

    const items = await BarterNotification.findAll({
      where,
      include: [
        {
          model: InventoryLot,
          as: "inventoryLot",
          include: lotInclude(),
        },
      ],
      order: [["id", "DESC"]],
      limit,
    });

    const data = items.map((row) => {
      const json = row.toJSON();
      json.type = "barter";
      json.inventoryLot = serializeLot(json.inventoryLot);
      return json;
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("Barter listNotifications error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت اعلان‌های معاوضه" });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const notification = await BarterNotification.findByPk(req.params.id);
    if (!notification || notification.recipientUserId !== userId) {
      return res.status(404).json({ success: false, message: "اعلان یافت نشد" });
    }
    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error("Barter markRead error:", error);
    res.status(500).json({ success: false, message: "خطا در به‌روزرسانی اعلان" });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    await BarterNotification.update(
      { readAt: new Date() },
      { where: { recipientUserId: userId, readAt: null } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Barter markAllRead error:", error);
    res.status(500).json({ success: false, message: "خطا در خواندن اعلان‌ها" });
  }
};

/** جزئیات یک موجودی معاوضه‌ای برای گیرنده اعلان یا عمومی */
const getOffer = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const lot = await InventoryLot.findByPk(id, { include: lotInclude() });
    if (!lot || !lot.acceptBarter) {
      return res.status(404).json({ success: false, message: "پیشنهاد معاوضه یافت نشد" });
    }
    res.json({ success: true, data: serializeLot(lot) });
  } catch (error) {
    console.error("Barter getOffer error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت پیشنهاد" });
  }
};

/** فهرست عمومی آگهی‌های معاوضه */
const listPublicOffers = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const q = String(req.query.q || "").trim();
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
    const kindRaw = String(req.query.kind || "").toLowerCase();
    const kind = kindRaw === "service" || kindRaw === "product" ? kindRaw : null;
    const serviceCategoryId = String(req.query.serviceCategoryId || "").trim();

    const where = {
      acceptBarter: true,
      status: { [Op.in]: ["on_field", "harvested", "reserved"] },
    };

    if (kind) where.barterDesiredKind = kind;
    if (Number.isFinite(categoryId)) {
      where.barterDesiredCategoryId = categoryId;
    }
    if (serviceCategoryId) {
      where.barterDesiredServiceCategoryId = serviceCategoryId;
    }
    if (q) {
      where[Op.or] = [
        { barterDesiredName: { [Op.like]: `%${q}%` } },
        { barterDesiredCategoryLabel: { [Op.like]: `%${q}%` } },
        { barterDesiredServiceCategoryId: { [Op.like]: `%${q}%` } },
        { barterNotes: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } },
      ];
    }

    const { rows, count } = await InventoryLot.findAndCountAll({
      where,
      include: lotInclude(),
      order: [["updated_at", "DESC"]],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: rows.map(serializeLot),
      meta: { total: count, limit, offset },
    });
  } catch (error) {
    console.error("Barter listPublicOffers error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت فهرست معاوضه" });
  }
};

/** اعلان‌های دریافتی به‌صورت لیست صفحه‌دار برای داشبورد */
const listInbox = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const { rows, count } = await BarterNotification.findAndCountAll({
      where: { recipientUserId: userId },
      include: [{ model: InventoryLot, as: "inventoryLot", include: lotInclude() }],
      order: [["id", "DESC"]],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: rows.map((r) => {
        const json = r.toJSON();
        json.type = "barter";
        return json;
      }),
      meta: { total: count, limit, offset },
    });
  } catch (error) {
    console.error("Barter listInbox error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت صندوق معاوضه" });
  }
};

module.exports = {
  unreadCount,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getOffer,
  listPublicOffers,
  listInbox,
};
