const TradeServiceProvider = require("./model");
const { L1_CATEGORY_IDS } = require("./model");
const User = require("../user/user/model");
const { Op } = require("sequelize");
const { isTradeProvidersAutoApprove, validateRegistrationForServices, filterPublicProviders, getPageDeletionGraceDays } = require("../siteSetting/service");
const { ensureServiceProviderRole } = require("../../utils/assignRole");
const {
  assertPublicSlugAvailable,
  validatePublicSlug,
  isPublicSlugAvailable,
  loadBlockedPageSlugs,
} = require("../../utils/publicPageSlug");
const Account = require("../account/model");
const TradeProviderReview = require("./review/model");
const sequelize = require("../../core/database/mysql/connection");
const {
  initialStatusFromAutoApprove,
  isPubliclyVisible,
  maybeArchiveExpired,
  publicLifecyclePayload,
  normalizePageStatus,
  PAGE_STATUSES,
  CREATE_NOTICE_SERVICES_FA,
} = require("../../utils/pageLifecycle");

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
  if (changes.businessHours !== undefined) record.businessHours = changes.businessHours;
  if (changes.addressLabel !== undefined) {
    record.addressLabel = changes.addressLabel ? String(changes.addressLabel).trim().slice(0, 300) : null;
  }
  if (changes.latitude !== undefined && changes.longitude !== undefined) {
    const lat = changes.latitude != null && changes.latitude !== "" ? Number(changes.latitude) : null;
    const lng = changes.longitude != null && changes.longitude !== "" ? Number(changes.longitude) : null;
    if (lat != null && Number.isFinite(lat) && lng != null && Number.isFinite(lng)) {
      record.latitude = lat;
      record.longitude = lng;
    } else if (changes.latitude === null || changes.longitude === null) {
      record.latitude = null;
      record.longitude = null;
    }
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
    businessHours: body.businessHours && typeof body.businessHours === "object" ? body.businessHours : undefined,
    addressLabel: body.addressLabel != null ? String(body.addressLabel).trim().slice(0, 300) || null : undefined,
    latitude: body.latitude !== undefined ? body.latitude : undefined,
    longitude: body.longitude !== undefined ? body.longitude : undefined,
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

    const authUserId = resolveAuthUserId(req.user);
    const rawSlug = req.body.profileSlug || req.body.pageName || displayName;
    let profileSlug;
    try {
      if (authUserId) {
        const user = await User.findByPk(authUserId);
        const { getOrCreateAccountForUser } = require("../account/profileService");
        const account = user ? await getOrCreateAccountForUser(user) : null;
        if (account?.profileSlug) {
          profileSlug = account.profileSlug;
        } else {
          profileSlug = await assertPublicSlugAvailable(rawSlug, {
            excludeUserId: authUserId,
            excludeAccountId: account?.id,
          });
          if (account) await account.update({ profileSlug, isPublic: true });
        }
      } else {
        profileSlug = await assertPublicSlugAvailable(rawSlug);
      }
    } catch (slugErr) {
      return res.status(slugErr.statusCode || 400).json({ success: false, message: slugErr.message });
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
    const pageStatus = initialStatusFromAutoApprove(autoApprove);

    const { ensurePersonalWorkspaceFromReq } = require("../workspace/service");
    const { assertCanCreateService } = require("../workspace/limits");
    const ensured = await ensurePersonalWorkspaceFromReq(req);
    if (ensured?.workspace?.id) {
      await assertCanCreateService(ensured.workspace.id, req.user);
    }

    const record = await TradeServiceProvider.create({
      userId: authUserId,
      workspaceId: ensured?.workspace?.id || null,
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
      pageStatus,
      deletionRequestedAt: null,
      profileSlug,
      isPublic: true,
      businessHours:
        req.body.businessHours && typeof req.body.businessHours === "object"
          ? req.body.businessHours
          : null,
      addressLabel: req.body.addressLabel ? String(req.body.addressLabel).trim().slice(0, 300) : null,
      latitude:
        req.body.latitude != null && req.body.latitude !== "" && Number.isFinite(Number(req.body.latitude))
          ? Number(req.body.latitude)
          : null,
      longitude:
        req.body.longitude != null && req.body.longitude !== "" && Number.isFinite(Number(req.body.longitude))
          ? Number(req.body.longitude)
          : null,
    });

    if (ensured?.workspace?.id && !ensured.workspace.activityServices) {
      await ensured.workspace.update({ activityServices: true });
    }

    let sessionUser = null;
    if (authUserId) {
      try {
        await ensureServiceProviderRole(authUserId);
        const Role = require("../user/role/model");
        const { setUserSessionCookie } = require("../../utils/sessionToken");
        sessionUser = await User.findByPk(authUserId, {
          include: [{ model: Role, as: "userRoles", through: { attributes: [] } }],
        });
        if (sessionUser) {
          await setUserSessionCookie(res, sessionUser, { rememberMe: true });
        }
      } catch (roleErr) {
        console.warn("Could not assign service_provider role:", roleErr?.message || roleErr);
      }
    }

    const roles = (sessionUser?.userRoles || []).map((role) => ({
      id: role.id,
      name: role.name,
      nameEn: role.nameEn,
      nameFa: role.nameFa,
    }));

    res.status(201).json({
      success: true,
      data: record,
      user: sessionUser
        ? {
            id: sessionUser.id,
            userId: sessionUser.id,
            firstName: sessionUser.firstName,
            lastName: sessionUser.lastName,
            email: sessionUser.email,
            username: sessionUser.username,
            mobile: sessionUser.mobile,
            roles,
          }
        : null,
      createNotice: CREATE_NOTICE_SERVICES_FA,
      awaitsApproval: !autoApprove,
      message: autoApprove
        ? "صفحه خدمات شما ساخته شد و فعال است"
        : "درخواست ثبت‌نام ثبت شد و پس از بررسی مدیر منتشر می‌شود",
    });
  } catch (error) {
    console.error("Trade service provider create error:", error);
    res.status(500).json({ success: false, message: "خطا در ثبت درخواست" });
  }
};

const listPublic = async (req, res) => {
  try {
    const where = {
      status: "approved",
      isPublic: true,
      pageStatus: { [Op.in]: ["ACTIVE", "PENDING_DELETION", "CLOSED", "SUSPENDED"] },
    };
    const categoryFilter = req.query?.categoryId;

    let items = await TradeServiceProvider.findAll({
      where,
      order: [["id", "DESC"]],
      attributes: {
        exclude: ["adminNotes", "notes"],
      },
      limit: Math.min(Math.max(Number(req.query.limit) || 200, 1), 500),
    });

    // فقط صفحات قابل سفارش در لیست اصلی؛ PENDING_DELETION هم می‌ماند ولی می‌توان فیلتر کرد
    items = items.filter((row) => isPubliclyVisible(row.pageStatus || "ACTIVE"));

    if (categoryFilter) {
      items = items.filter((row) => providerMatchesCategory(row, categoryFilter));
      items = await filterPublicProviders(items, categoryFilter);
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || items.length, 1), 500);
    if (items.length > limit) items = items.slice(0, limit);

    const userIds = [...new Set(items.map((row) => row.userId).filter(Boolean))];
    const shopUserIds = new Set();
    if (userIds.length) {
      const Account = require("../account/model");
      const accounts = await Account.findAll({
        where: {
          userId: { [Op.in]: userIds },
          profileSlug: { [Op.ne]: null },
          isPublic: true,
          shopStatus: { [Op.in]: ["ACTIVE", "PENDING_DELETION", "CLOSED", "SUSPENDED"] },
        },
        attributes: ["userId", "shopStatus"],
      });
      for (const a of accounts) {
        if (isPubliclyVisible(a.shopStatus || "ACTIVE")) {
          shopUserIds.add(Number(a.userId));
        }
      }
    }

    const data = items.map((row) => {
      const plain = typeof row.toJSON === "function" ? row.toJSON() : { ...row };
      const slug = plain.profileSlug;
      if (!plain.logoUrl && String(slug || "").toLowerCase() === "zareoon") {
        plain.logoUrl = "/images/logo.png";
      }
      plain.hasShop = shopUserIds.has(Number(plain.userId));
      return plain;
    });

    res.json({ success: true, data });
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
    const key = String(req.params.id || "").trim();
    if (!key || /^\d+$/.test(key)) {
      return res.status(404).json({ success: false, message: "یافت نشد" });
    }

    const item = await TradeServiceProvider.findOne({
      where: { profileSlug: key },
      attributes: { exclude: ["adminNotes"] },
    });
    if (!item) return res.status(404).json({ success: false, message: "یافت نشد" });

    const graceDays = await getPageDeletionGraceDays();
    const archived = await maybeArchiveExpired(item, graceDays);
    if (archived.changed) await item.reload();

    const viewerId = req.user?.id || req.user?.userId;
    const isOwner = viewerId && Number(item.userId) === Number(viewerId);
    const pageStatus = normalizePageStatus(item.pageStatus);

    if (item.status !== "approved" && !isOwner) {
      return res.status(404).json({ success: false, message: "یافت نشد" });
    }
    if (item.isPublic === false && !isOwner) {
      return res.status(404).json({ success: false, message: "این صفحه غیرفعال است" });
    }
    if (!isPubliclyVisible(pageStatus) && !isOwner) {
      return res.status(404).json({ success: false, message: "یافت نشد" });
    }

    const lifecycle = publicLifecyclePayload(pageStatus, {
      deletionRequestedAt: item.deletionRequestedAt,
      graceDays,
    });

    let canReview = false;
    let myReview = null;
    if (viewerId && Number(viewerId) !== Number(item.userId)) {
      canReview = true;
      myReview = await TradeProviderReview.findOne({
        where: { providerId: item.id, reviewerId: viewerId },
        attributes: ["id", "rating", "comment", "createdAt"],
      });
    }

    const reviews = await TradeProviderReview.findAll({
      where: { providerId: item.id },
      include: [{ model: User, as: "reviewer", attributes: ["id", "firstName", "lastName"] }],
      order: [["createdAt", "DESC"]],
      limit: 30,
    });

    res.json({
      success: true,
      data: {
        ...item.toJSON(),
        ...lifecycle,
      },
      meta: {
        isOwnerPreview:
          isOwner &&
          (item.status !== "approved" || item.isPublic === false || !isPubliclyVisible(pageStatus)),
        canReview,
        myReview,
        reviews,
      },
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
    const account = await Account.findOne({ where: { userId }, attributes: ["canHidePublicPage", "isPublic"] });
    const canHidePublicPage = !!account?.canHidePublicPage;
    const enriched = items.map((item) => {
      const plain = typeof item.toJSON === "function" ? item.toJSON() : { ...item };
      return { ...plain, canHidePublicPage };
    });

    res.json({
      success: true,
      data: enriched,
      primary: enriched[0] || null,
      canHidePublicPage,
    });
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

    // غیرفعال‌سازی صفحه عمومی — فقط با مجوز ادمین
    if (req.body.isPublic !== undefined) {
      try {
        const { setUserPageVisibility } = require("../account/profileService");
        await setUserPageVisibility(userId, !!req.body.isPublic, { requirePermission: true });
        await item.reload();
      } catch (visErr) {
        return res.status(visErr.statusCode || 403).json({ success: false, message: visErr.message });
      }
    }

    if (req.body.profileSlug !== undefined && String(req.body.profileSlug).trim()) {
      try {
        item.profileSlug = await assertPublicSlugAvailable(req.body.profileSlug, {
          excludeProviderId: item.id,
          excludeUserId: item.userId,
        });
        if (item.userId) {
          await Account.update(
            { profileSlug: item.profileSlug },
            { where: { userId: item.userId } }
          );
        }
      } catch (slugErr) {
        return res.status(slugErr.statusCode || 400).json({ success: false, message: slugErr.message });
      }
    }

    const vipCheck = await validateRegistrationForServices(
      changes.selectedServices,
      req.headers["accept-language"]?.slice(0, 2) || "fa",
      {
        existingCategoryIds: [
          item.categoryId,
          ...(Array.isArray(item.selectedServices)
            ? item.selectedServices.map((s) => s?.categoryId)
            : []),
        ].filter(Boolean),
      }
    );
    if (!vipCheck.ok) {
      return res.status(403).json({ success: false, message: vipCheck.message, code: "VIP_CATEGORY" });
    }

    if (item.status === "approved") {
      applyChangesToProvider(item, changes);
      item.pendingChanges = null;
      await item.save();
      return res.json({
        success: true,
        data: item,
        message: "تغییرات ذخیره و روی صفحه عمومی اعمال شد",
        pendingReview: false,
      });
    }

    applyChangesToProvider(item, changes);
    item.pendingChanges = null;
    // اگر هنوز تأیید نشده، در صف تأیید اولیه می‌ماند ولی فیلدها به‌روز می‌شوند
    if (item.status !== "rejected") {
      item.status = item.status === "pending" ? "pending" : item.status;
    }
    await item.save();

    res.json({
      success: true,
      data: item,
      message: "تغییرات ذخیره شد",
      pendingReview: item.status === "pending",
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
    if (req.body.isPublic !== undefined) {
      item.isPublic = !!req.body.isPublic;
      if (item.userId) {
        await Account.update({ isPublic: item.isPublic }, { where: { userId: item.userId } });
      }
    }
    if (req.body.pageStatus !== undefined) {
      const next = normalizePageStatus(req.body.pageStatus, null);
      if (!next || !PAGE_STATUSES.includes(next)) {
        return res.status(400).json({ success: false, message: "وضعیت صفحه نامعتبر است" });
      }
      item.pageStatus = next;
      if (next === "PENDING_DELETION" && !item.deletionRequestedAt) {
        item.deletionRequestedAt = new Date();
      }
      if (next === "ACTIVE") {
        item.deletionRequestedAt = null;
      }
    }

    if (status === "approved") {
      if (!req.body.pageStatus) item.pageStatus = "ACTIVE";
      item.deletionRequestedAt = null;
    }
    if (status === "pending" && !req.body.pageStatus) {
      item.pageStatus = "INACTIVE";
    }
    if (status === "rejected" && !req.body.pageStatus) {
      item.pageStatus = "INACTIVE";
    }

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

const checkSlugAvailable = async (req, res) => {
  try {
    const { loadSlugLengthRules } = require("../../utils/publicPageSlug");
    const [blocked, rules] = await Promise.all([loadBlockedPageSlugs(), loadSlugLengthRules()]);
    const validated = validatePublicSlug(req.query?.slug || "", blocked, rules);
    if (!validated.ok) {
      return res.json({
        success: true,
        data: {
          available: false,
          slug: validated.slug,
          message: validated.message,
          slugRules: rules,
        },
      });
    }
    const excludeProviderId = req.query?.excludeProviderId ? Number(req.query.excludeProviderId) : null;
    const excludeUserId = req.user?.userId || req.user?.id || null;
    const available = await isPublicSlugAvailable(validated.slug, {
      excludeProviderId,
      excludeUserId: excludeUserId ? Number(excludeUserId) : null,
    });
    res.json({
      success: true,
      data: {
        available,
        slug: validated.slug,
        message: available ? "این نام آزاد است" : "این نام قبلاً رزرو شده است",
        slugRules: rules,
      },
    });
  } catch (error) {
    console.error("TSP checkSlugAvailable:", error);
    res.status(500).json({ success: false, message: "خطا در بررسی نام" });
  }
};

/** فقط تغییر نمایش عمومی — بدون ارسال کل فرم */
const updateVisibility = async (req, res) => {
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
    if (req.body.isPublic === undefined) {
      return res.status(400).json({ success: false, message: "مقدار isPublic الزامی است" });
    }
    try {
      const { setUserPageVisibility } = require("../account/profileService");
      await setUserPageVisibility(userId, !!req.body.isPublic, { requirePermission: true });
      await item.reload();
    } catch (visErr) {
      return res.status(visErr.statusCode || 403).json({ success: false, message: visErr.message });
    }
    res.json({
      success: true,
      data: item,
      message: item.isPublic ? "صفحه خدمات فعال شد" : "صفحه خدمات غیرفعال شد",
    });
  } catch (error) {
    console.error("TSP updateVisibility:", error);
    res.status(500).json({ success: false, message: "خطا در تغییر وضعیت صفحه" });
  }
};

/** درخواست بستن صفحه خدمات — حذف فوری نیست */
const requestDeletion = async (req, res) => {
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
    const graceDays = await getPageDeletionGraceDays();
    await item.update({
      pageStatus: "PENDING_DELETION",
      deletionRequestedAt: new Date(),
    });
    res.json({
      success: true,
      data: item,
      message: `درخواست بستن ثبت شد. صفحه حدود ${graceDays} روز دیگر با پیام مناسب نمایش داده می‌شود و امکان سفارش ندارد.`,
    });
  } catch (error) {
    console.error("TSP requestDeletion:", error);
    res.status(500).json({ success: false, message: "خطا در ثبت درخواست حذف" });
  }
};

const cancelDeletion = async (req, res) => {
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
    if (normalizePageStatus(item.pageStatus) !== "PENDING_DELETION") {
      return res.status(400).json({ success: false, message: "درخواست حذفی در جریان نیست" });
    }
    await item.update({ pageStatus: "ACTIVE", deletionRequestedAt: null });
    res.json({ success: true, data: item, message: "صفحه دوباره فعال شد" });
  } catch (error) {
    console.error("TSP cancelDeletion:", error);
    res.status(500).json({ success: false, message: "خطا در لغو حذف" });
  }
};

async function refreshProviderRatingStats(providerId) {
  const [avgRow] = await TradeProviderReview.findAll({
    where: { providerId },
    attributes: [
      [sequelize.fn("AVG", sequelize.col("rating")), "avg"],
      [sequelize.fn("COUNT", sequelize.col("id")), "count"],
    ],
    raw: true,
  });
  const avg = avgRow?.avg != null ? Number(Number(avgRow.avg).toFixed(2)) : null;
  const count = Number(avgRow?.count || 0);
  await TradeServiceProvider.update({ rating: avg, reviewCount: count }, { where: { id: providerId } });
  return { avg, count };
}

const createReview = async (req, res) => {
  try {
    const reviewerId = resolveAuthUserId(req.user);
    if (!reviewerId) {
      return res.status(401).json({ success: false, message: "برای امتیازدهی وارد شوید" });
    }
    const providerId = Number(req.params.id);
    const rating = Number(req.body.rating);
    const comment = req.body.comment ? String(req.body.comment).trim().slice(0, 2000) : null;
    if (!providerId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "امتیاز باید بین ۱ تا ۵ باشد" });
    }

    const provider = await TradeServiceProvider.findByPk(providerId);
    if (!provider || provider.status !== "approved") {
      return res.status(404).json({ success: false, message: "ارائه‌دهنده یافت نشد" });
    }
    if (Number(provider.userId) === Number(reviewerId)) {
      return res.status(400).json({ success: false, message: "نمی‌توانید به صفحه خودتان امتیاز دهید" });
    }

    const existing = await TradeProviderReview.findOne({ where: { providerId, reviewerId } });
    if (existing) {
      await existing.update({ rating: Math.round(rating), comment });
    } else {
      await TradeProviderReview.create({
        providerId,
        reviewerId,
        rating: Math.round(rating),
        comment,
      });
    }

    const { avg, count } = await refreshProviderRatingStats(providerId);
    const saved = await TradeProviderReview.findOne({ where: { providerId, reviewerId } });

    res.json({
      success: true,
      data: {
        review: saved,
        rating: avg,
        reviewCount: count,
      },
      message: "امتیاز شما ثبت شد",
    });
  } catch (error) {
    console.error("TSP createReview:", error);
    res.status(500).json({ success: false, message: "خطا در ثبت امتیاز" });
  }
};

module.exports = {
  create,
  listPublic,
  getOnePublic,
  list,
  getOne,
  getMine,
  countPending,
  updateMine,
  updateStatus,
  checkSlugAvailable,
  updateVisibility,
  requestDeletion,
  cancelDeletion,
  createReview,
};

