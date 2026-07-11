const TradeServiceProvider = require("./model");
const { L1_CATEGORY_IDS } = require("./model");
const User = require("../user/user/model");
const { isTradeProvidersAutoApprove, validateRegistrationForServices, filterPublicProviders } = require("../siteSetting/service");

const userAttrs = ["id", "firstName", "lastName", "username", "mobile", "email"];

function normalizeSelectedServices(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && L1_CATEGORY_IDS.includes(item.categoryId) && item.subcategoryId)
    .map((item) => ({
      categoryId: item.categoryId,
      subcategoryId: String(item.subcategoryId),
    }));
}

function providerMatchesCategory(record, categoryId) {
  if (!categoryId) return true;
  if (record.categoryId === categoryId) return true;
  const selected = record.selectedServices || [];
  return selected.some((s) => s.categoryId === categoryId);
}

const create = async (req, res) => {
  try {
    const {
      entityType,
      displayName,
      contactName,
      phone,
      email,
      categoryId,
      subcategoryIds,
      selectedServices,
      countriesRoutes,
      servicesOffered,
      licenses,
      experienceYears,
      notes,
    } = req.body;

    const normalizedServices = normalizeSelectedServices(selectedServices);

    if (!normalizedServices.length && categoryId && Array.isArray(subcategoryIds) && subcategoryIds.length) {
      for (const subId of subcategoryIds) {
        normalizedServices.push({ categoryId, subcategoryId: String(subId) });
      }
    }

    if (!normalizedServices.length) {
      return res.status(400).json({ success: false, message: "حداقل یک خدمت انتخاب کنید" });
    }

    const primaryCategoryId = normalizedServices[0].categoryId;

    if (!displayName?.trim() || !contactName?.trim() || !phone?.trim()) {
      return res.status(400).json({ success: false, message: "نام، نام تماس و تلفن الزامی است" });
    }

    const vipCheck = await validateRegistrationForServices(
      normalizedServices,
      req.headers["accept-language"]?.slice(0, 2) || "fa"
    );
    if (!vipCheck.ok) {
      return res.status(403).json({ success: false, message: vipCheck.message, code: "VIP_CATEGORY" });
    }

    const validEntity = entityType === "individual" ? "individual" : "company";
    const autoApprove = await isTradeProvidersAutoApprove();
    const initialStatus = autoApprove ? "approved" : "pending";

    const record = await TradeServiceProvider.create({
      userId: req.user?.id || req.user?.userId || null,
      entityType: validEntity,
      displayName: displayName.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      categoryId: primaryCategoryId,
      subcategoryIds: normalizedServices.map((s) => s.subcategoryId),
      selectedServices: normalizedServices,
      countriesRoutes: countriesRoutes?.trim() || null,
      servicesOffered: servicesOffered?.trim() || null,
      licenses: licenses?.trim() || null,
      experienceYears:
        experienceYears != null && experienceYears !== "" ? Number(experienceYears) : null,
      notes: notes?.trim() || null,
      status: initialStatus,
    });

    res.status(201).json({
      success: true,
      data: record,
      message: autoApprove
        ? "ثبت‌نام شما تأیید شد و در فهرست ارائه‌دهندگان نمایش داده می‌شود"
        : "درخواست ثبت‌نام ثبت شد و پس از بررسی مدیر منتشر می‌شود",
    });
  } catch (error) {
    console.error("Trade service provider create error:", error);
    res.status(500).json({ success: false, message: "خطا در ثبت درخواست" });
  }
};

const listPublic = async (req, res) => {
  try {
    const where = { status: "approved" };
    const categoryFilter = req.query?.categoryId;

    let items = await TradeServiceProvider.findAll({
      where,
      order: [["id", "DESC"]],
      attributes: {
        exclude: ["adminNotes", "notes"],
      },
    });

    if (categoryFilter) {
      items = items.filter((row) => providerMatchesCategory(row, categoryFilter));
      items = await filterPublicProviders(items, categoryFilter);
    }

    res.json({ success: true, data: items });
  } catch (error) {
    console.error("Trade service provider listPublic error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت ارائه‌دهندگان" });
  }
};

const list = async (req, res) => {
  try {
    const where = {};
    if (req.query?.status) where.status = req.query.status;

    let items = await TradeServiceProvider.findAll({
      where,
      include: [{ model: User, as: "user", attributes: userAttrs }],
      order: [["id", "DESC"]],
    });

    if (req.query?.categoryId) {
      items = items.filter((row) => providerMatchesCategory(row, req.query.categoryId));
    }

    res.json({ success: true, data: items });
  } catch (error) {
    console.error("Trade service provider list error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت درخواست‌ها" });
  }
};

const getOnePublic = async (req, res) => {
  try {
    const item = await TradeServiceProvider.findOne({
      where: { id: req.params.id, status: "approved" },
      attributes: { exclude: ["adminNotes"] },
    });
    if (!item) return res.status(404).json({ success: false, message: "یافت نشد" });

    res.json({ success: true, data: item });
  } catch (error) {
    console.error("Trade service provider getOnePublic error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت پروفایل" });
  }
};

const getMine = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "احراز هویت لازم است" });
    }

    const items = await TradeServiceProvider.findAll({
      where: { userId },
      order: [["id", "DESC"]],
      attributes: { exclude: ["adminNotes"] },
    });

    res.json({ success: true, data: items, primary: items[0] || null });
  } catch (error) {
    console.error("Trade service provider getMine error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت پروفایل" });
  }
};

const getOne = async (req, res) => {
  try {
    const item = await TradeServiceProvider.findByPk(req.params.id, {
      include: [{ model: User, as: "user", attributes: userAttrs }],
    });
    if (!item) return res.status(404).json({ success: false, message: "یافت نشد" });
    res.json({ success: true, data: item });
  } catch (error) {
    console.error("Trade service provider getOne error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت جزئیات" });
  }
};

const updateStatus = async (req, res) => {
  try {
    const item = await TradeServiceProvider.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: "یافت نشد" });

    const validStatuses = ["pending", "approved", "rejected"];
    const { status, adminNotes } = req.body;

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "وضعیت نامعتبر است" });
    }

    if (status) item.status = status;
    if (adminNotes !== undefined) item.adminNotes = adminNotes?.trim() || null;

    await item.save();
    res.json({ success: true, data: item, message: "به‌روزرسانی شد" });
  } catch (error) {
    console.error("Trade service provider updateStatus error:", error);
    res.status(500).json({ success: false, message: "خطا در به‌روزرسانی" });
  }
};

module.exports = { create, listPublic, getOnePublic, list, getOne, getMine, updateStatus };
