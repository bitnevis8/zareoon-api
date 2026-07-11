const { Op } = require("sequelize");
const User = require("../user/user/model");
const {
  ApplicantRequest,
  ApplicantRequestNotification,
  REQUEST_TYPES,
} = require("./model");
const { notifyRecipientsForRequest } = require("./service");

const userAttrs = ["id", "firstName", "lastName", "username", "mobile", "email"];

function serializeRequest(item, { viewerUserId, isRecipient = false, isOwner = false } = {}) {
  const plain = item?.toJSON ? item.toJSON() : { ...item };
  const owner = isOwner || plain.userId === viewerUserId;

  if (!owner && isRecipient && plain.allowPhoneContact === false) {
    plain.phone = null;
    plain.phoneHidden = true;
  } else {
    plain.phoneHidden = false;
  }

  return plain;
}

const requestInclude = [
  {
    model: User,
    as: "applicant",
    attributes: userAttrs,
  },
];

const create = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "احراز هویت الزامی است" });
    }

    const {
      requestType,
      productCategoryId,
      serviceCategoryId,
      serviceSubcategoryId,
      categoryLabel,
      title,
      description,
      quantity,
      unit,
      phone,
      company,
      notes,
      details,
      allowPhoneContact,
    } = req.body;

    if (!REQUEST_TYPES.includes(requestType)) {
      return res.status(400).json({ success: false, message: "نوع درخواست نامعتبر است" });
    }

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: "عنوان درخواست الزامی است" });
    }

    if (!phone?.trim()) {
      return res.status(400).json({ success: false, message: "شماره تماس الزامی است" });
    }

    if (!categoryLabel?.trim()) {
      return res.status(400).json({ success: false, message: "دسته‌بندی الزامی است" });
    }

    if (requestType === "product" && !productCategoryId) {
      return res.status(400).json({ success: false, message: "دسته محصول را انتخاب کنید" });
    }

    if (requestType === "service" && !serviceCategoryId) {
      return res.status(400).json({ success: false, message: "دسته خدمات را انتخاب کنید" });
    }

    const record = await ApplicantRequest.create({
      userId,
      requestType,
      productCategoryId: requestType === "product" ? Number(productCategoryId) : null,
      serviceCategoryId: requestType === "service" ? String(serviceCategoryId).trim() : null,
      serviceSubcategoryId:
        requestType === "service" && serviceSubcategoryId
          ? String(serviceSubcategoryId).trim()
          : null,
      categoryLabel: categoryLabel.trim(),
      title: title.trim(),
      description: description?.trim() || null,
      quantity: quantity != null && quantity !== "" ? quantity : null,
      unit: unit?.trim() || null,
      phone: phone.trim(),
      allowPhoneContact: allowPhoneContact !== false && allowPhoneContact !== "false",
      company: company?.trim() || null,
      notes: notes?.trim() || null,
      details: details && typeof details === "object" ? details : null,
      status: "open",
    });

    const notifiedCount = await notifyRecipientsForRequest(record, userId);

    const created = await ApplicantRequest.findByPk(record.id, { include: requestInclude });

    res.status(201).json({
      success: true,
      data: created,
      notifiedCount,
      message: "درخواست شما ثبت شد",
    });
  } catch (error) {
    console.error("Applicant request create error:", error);
    res.status(500).json({ success: false, message: "خطا در ثبت درخواست" });
  }
};

const listMine = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const items = await ApplicantRequest.findAll({
      where: { userId },
      order: [["id", "DESC"]],
    });
    res.json({ success: true, data: items });
  } catch (error) {
    console.error("Applicant request listMine error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت درخواست‌ها" });
  }
};

const unreadCount = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const count = await ApplicantRequestNotification.count({
      where: { recipientUserId: userId, readAt: null },
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error("Applicant request unreadCount error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت اعلان‌ها" });
  }
};

const listNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const unreadOnly = req.query.unread === "1" || req.query.unread === "true";

    const where = { recipientUserId: userId };
    if (unreadOnly) where.readAt = null;

    const items = await ApplicantRequestNotification.findAll({
      where,
      include: [
        {
          model: ApplicantRequest,
          as: "request",
          include: requestInclude,
        },
      ],
      order: [["id", "DESC"]],
      limit,
    });

    const data = items.map((row) => {
      const json = row.toJSON();
      if (json.request) {
        json.request = serializeRequest(json.request, {
          viewerUserId: userId,
          isRecipient: true,
        });
      }
      return json;
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error("Applicant request listNotifications error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت اعلان‌ها" });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const notification = await ApplicantRequestNotification.findByPk(req.params.id);
    if (!notification || notification.recipientUserId !== userId) {
      return res.status(404).json({ success: false, message: "اعلان یافت نشد" });
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    res.json({ success: true, data: notification });
  } catch (error) {
    console.error("Applicant request markNotificationRead error:", error);
    res.status(500).json({ success: false, message: "خطا در به‌روزرسانی اعلان" });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    await ApplicantRequestNotification.update(
      { readAt: new Date() },
      { where: { recipientUserId: userId, readAt: null } }
    );
    res.json({ success: true, message: "همه اعلان‌ها خوانده شد" });
  } catch (error) {
    console.error("Applicant request markAllNotificationsRead error:", error);
    res.status(500).json({ success: false, message: "خطا در به‌روزرسانی اعلان‌ها" });
  }
};

const getById = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const item = await ApplicantRequest.findByPk(req.params.id, { include: requestInclude });
    if (!item) return res.status(404).json({ success: false, message: "یافت نشد" });

    const isOwner = item.userId === userId;
    const isRecipient = await ApplicantRequestNotification.findOne({
      where: { requestId: item.id, recipientUserId: userId },
    });

    if (!isOwner && !isRecipient) {
      return res.status(403).json({ success: false, message: "دسترسی مجاز نیست" });
    }

    res.json({
      success: true,
      data: serializeRequest(item, {
        viewerUserId: userId,
        isOwner,
        isRecipient: !!isRecipient,
      }),
      viewerRole: isOwner ? "applicant" : "recipient",
    });
  } catch (error) {
    console.error("Applicant request getById error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت درخواست" });
  }
};

module.exports = {
  create,
  listMine,
  unreadCount,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getById,
};
