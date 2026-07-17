const TradeServiceProvider = require("./model");
const { L1_CATEGORY_IDS } = require("./model");
const User = require("../user/user/model");
const { Op } = require("sequelize");
const { isTradeProvidersAutoApprove, validateRegistrationForServices, filterPublicProviders } = require("../siteSetting/service");
const { ensureServiceProviderRole } = require("../../utils/assignRole");

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

function resolveAuthUserId(user) {
  const id = user?.id || user?.userId;
  return id != null && id !== "" ? Number(id) : null;
}

async function linkProviderToUser(record, userId) {
  if (!record || !userId || record.userId) return record;
  record.userId = userId;
  await record.save();
  return record;
}

async function findProvidersForUser(userId) {
  const user = await User.findByPk(userId, {
    attributes: ["id", "email", "mobile", "phone"],
  });
  if (!user) return [];

  const orConditions = [{ userId }];
  const email = user.email?.trim();
  const phones = [user.mobile, user.phone].filter(Boolean).map((p) => String(p).trim());

  if (email) {
    orConditions.push({ userId: { [Op.is]: null }, email });
  }
  for (const phone of phones) {
    orConditions.push({ userId: { [Op.is]: null }, phone });
  }

  const items = await TradeServiceProvider.findAll({
    where: { [Op.or]: orConditions },
    order: [["id", "DESC"]],
    attributes: { exclude: ["adminNotes"] },
  });

  await Promise.all(items.map((item) => linkProviderToUser(item, userId)));
  return items;
}

function applyChangesToProvider(record, changes) {
  if (!changes || typeof changes !== "object") return record;

  if (changes.displayName?.trim()) record.displayName = changes.displayName.trim();
  if (changes.contactName?.trim()) record.contactName = changes.contactName.trim();
  if (changes.phone?.trim()) record.phone = changes.phone.trim();
  if (changes.email !== undefined) record.email = changes.email?.trim() || null;
  if (changes.countriesRoutes !== undefined) record.countriesRoutes = changes.countriesRoutes?.trim() || null;
  if (changes.servicesOffered !== undefined) record.servicesOffered = changes.servicesOffered?.trim() || null;
  if (changes.licenses !== undefined) record.licenses = changes.licenses?.trim() || null;
  if (changes.notes !== undefined) record.notes = changes.notes?.trim() || null;
  if (changes.experienceYears !== undefined && changes.experienceYears !== "") {
    record.experienceYears = Number(changes.experienceYears);
  }
  if (changes.entityType === "individual" || changes.entityType === "company") {
    record.entityType = changes.entityType;
  }

  const normalizedServices = normalizeSelectedServices(changes.selectedServices);
  if (normalizedServices.length) {
    record.selectedServices = normalizedServices;
    record.categoryId = normalizedServices[0].categoryId;
    record.subcategoryIds = normalizedServices.map((s) => s.subcategoryId);
  }

  if (Array.isArray(changes.documentUrls)) {
    record.documentUrls = changes.documentUrls;
  }

  return record;
}

function buildChangesPayload(body) {
  const normalizedServices = normalizeSelectedServices(body.selectedServices);
  let services = normalizedServices;
  if (!services.length && body.categoryId && Array.isArray(body.subcategoryIds) && body.subcategoryIds.length) {
    services = body.subcategoryIds.map((subId) => ({
      categoryId: body.categoryId,
      subcategoryId: String(subId),
    }));
  }

  return {
    entityType: body.entityType === "individual" ? "individual" : "company",
    displayName: body.displayName?.trim() || "",
    contactName: body.contactName?.trim() || "",
    phone: body.phone?.trim() || "",
    email: body.email?.trim() || null,
    selectedServices: services,
    countriesRoutes: body.countriesRoutes?.trim() || null,
    servicesOffered: body.servicesOffered?.trim() || null,
    licenses: body.licenses?.trim() || null,
    experienceYears: body.experienceYears != null && body.experienceYears !== "" ? Number(body.experienceYears) : null,
    notes: body.notes?.trim() || null,
    documentUrls: Array.isArray(body.documentUrls) ? body.documentUrls : [],
    submittedAt: new Date().toISOString(),
  };
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

    const authUserId = resolveAuthUserId(req.user);

    const record = await TradeServiceProvider.create({
      userId: authUserId,
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

    if (authUserId) {
      try {
        await ensureServiceProviderRole(authUserId);
      } catch (roleErr) {
        console.warn("Could not assign service_provider role:", roleErr?.message || roleErr);
      }
    }

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
    const item = await TradeServiceProvider.findByPk(req.params.id, {
      attributes: { exclude: ["adminNotes"] },
    });
    if (!item) return res.status(404).json({ success: false, message: "یافت نشد" });

    const viewerId = req.user?.id || req.user?.userId;
    const isOwner = viewerId && Number(item.userId) === Number(viewerId);

    if (item.status !== "approved" && !isOwner) {
      return res.status(404).json({ success: false, message: "یافت نشد" });
    }

    res.json({
      success: true,
      data: item,
      meta: { isOwnerPreview: isOwner && item.status !== "approved" },
    });
  } catch (error) {
    console.error("Trade service provider getOnePublic error:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت پروفایل" });
  }
};

const getMine = async (req, res) => {
  try {
    const userId = resolveAuthUserId(req.user);
    if (!userId) {
      return res.status(401).json({ success: false, message: "احراز هویت لازم است" });
    }

    const items = await findProvidersForUser(userId);

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

const countPending = async (req, res) => {
  try {
    const statusPending = await TradeServiceProvider.count({ where: { status: "pending" } });
    const updatePending = await TradeServiceProvider.count({
      where: {
        status: "approved",
        pendingChanges: { [Op.ne]: null },
      },
    });
    res.json({
      success: true,
      data: {
        pending: statusPending + updatePending,
        newRegistrations: statusPending,
        profileUpdates: updatePending,
      },
    });
  } catch (error) {
    console.error("Trade service provider countPending error:", error);
    res.status(500).json({ success: false, message: "خطا در شمارش درخواست‌ها" });
  }
};

const updateMine = async (req, res) => {
  try {
    const userId = resolveAuthUserId(req.user);
    if (!userId) {
      return res.status(401).json({ success: false, message: "احراز هویت لازم است" });
    }

    const items = await findProvidersForUser(userId);
    const item = items[0];
    if (!item) {
      return res.status(404).json({ success: false, message: "پروفایل یافت نشد" });
    }

    const changes = buildChangesPayload(req.body);
    if (!changes.displayName || !changes.contactName || !changes.phone) {
      return res.status(400).json({ success: false, message: "نام، نام تماس و تلفن الزامی است" });
    }
    if (!changes.selectedServices.length) {
      return res.status(400).json({ success: false, message: "حداقل یک خدمت انتخاب کنید" });
    }

    const vipCheck = await validateRegistrationForServices(
      changes.selectedServices,
      req.headers["accept-language"]?.slice(0, 2) || "fa"
    );
    if (!vipCheck.ok) {
      return res.status(403).json({ success: false, message: vipCheck.message, code: "VIP_CATEGORY" });
    }

    if (item.status === "approved") {
      item.pendingChanges = changes;
      await item.save();
      return res.json({
        success: true,
        data: item,
        message: "تغییرات ثبت شد و پس از تأیید مدیر روی صفحه عمومی اعمال می‌شود",
        pendingReview: true,
      });
    }

    applyChangesToProvider(item, changes);
    item.pendingChanges = null;
    item.status = "pending";
    await item.save();

    res.json({
      success: true,
      data: item,
      message: "تغییرات ثبت شد و پس از تأیید مدیر منتشر می‌شود",
      pendingReview: true,
    });
  } catch (error) {
    console.error("Trade service provider updateMine error:", error);
    res.status(500).json({ success: false, message: "خطا در ذخیره تغییرات" });
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

    if (status === "approved" && item.pendingChanges) {
      applyChangesToProvider(item, item.pendingChanges);
      item.pendingChanges = null;
    }

    if (status === "rejected" && item.pendingChanges) {
      item.pendingChanges = null;
    }

    if (!item.userId && (item.email || item.phone)) {
      const linkWhere = [];
      if (item.email?.trim()) linkWhere.push({ email: item.email.trim() });
      if (item.phone?.trim()) linkWhere.push({ mobile: item.phone.trim() }, { phone: item.phone.trim() });
      if (linkWhere.length) {
        const matchedUser = await User.findOne({ where: { [Op.or]: linkWhere } });
        if (matchedUser) item.userId = matchedUser.id;
      }
    }

    await item.save();
    res.json({ success: true, data: item, message: "به‌روزرسانی شد" });
  } catch (error) {
    console.error("Trade service provider updateStatus error:", error);
    res.status(500).json({ success: false, message: "خطا در به‌روزرسانی" });
  }
};

module.exports = { create, listPublic, getOnePublic, list, getOne, getMine, countPending, updateMine, updateStatus };
