const User = require("../user/user/model");
const {
  getWorkspaceContextForUser,
  ensurePersonalWorkspaceFromReq,
  createWorkspace,
  listWorkspacesForUser,
  setActiveWorkspace,
  preferredWorkspaceIdFromReq,
  assertWorkspacePermission,
  ensurePersonVerification,
  getVerificationBundleForUser,
  serializePersonVerification,
  serializeBusinessVerification,
  normalizeLevel,
} = require("./service");
const {
  WORKSPACE_ROLES,
  WORKSPACE_ROLE_LABELS_FA,
  WORKSPACE_PERMISSIONS,
  PLATFORM_ROLES,
  PLATFORM_ROLE_LABELS_FA,
  ACTIVITY_TYPES,
  PUBLIC_BADGE_KINDS,
  VERIFICATION_STATUS,
  VERIFICATION_LEVELS,
  PERSON_VERIFICATION_LEVELS,
  BUSINESS_VERIFICATION_LEVELS,
  VERIFICATION_LEVEL_LABELS_FA,
} = require("./constants");
const {
  getPersonRequirement,
  getBusinessRequirement,
  getNextRequestableLevel,
  validateApplicationFields,
  validateDocuments,
  publicRequirementsPayload,
  normalizeVerifiedLevel,
} = require("./verificationRequirements");
const {
  PLANS,
  BILLING_PERIODS,
  BILLING_PERIOD_META,
  publicPlan,
  priceForPlanPeriod,
} = require("./plans");
const {
  Workspace,
  WorkspaceMember,
  UserPersonVerification,
  WorkspaceBusinessVerification,
  WorkspaceRepresentation,
} = require("./model");
const { assertCanAddMember, getWorkspaceUsage } = require("./limits");
const { isAdmin, isPlatformStaff } = require("../../utils/roles");
const { Op } = require("sequelize");

const INVITABLE_ROLES = [
  WORKSPACE_ROLES.ADMIN,
  WORKSPACE_ROLES.SALES,
  WORKSPACE_ROLES.ORDERS_MANAGER,
  WORKSPACE_ROLES.PRODUCT_EDITOR,
  WORKSPACE_ROLES.VIEWER,
];

async function getMyWorkspace(req, res) {
  try {
    const ctx = await getWorkspaceContextForUser(req.user, {
      preferredWorkspaceId: preferredWorkspaceIdFromReq(req),
    });
    if (ctx?.workspace?.id) {
      ctx.usage = await getWorkspaceUsage(ctx.workspace.id);
    }
    return res.json({ success: true, data: ctx });
  } catch (error) {
    console.error("getMyWorkspace:", error);
    return res.status(500).json({ success: false, message: error.message || "خطا" });
  }
}

async function listMine(req, res) {
  try {
    const items = await listWorkspacesForUser(req.user.id);
    return res.json({ success: true, data: items });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "خطا" });
  }
}

async function createMine(req, res) {
  try {
    const { workspace, membership } = await createWorkspace(req.user, req.body || {});
    const ctx = await getWorkspaceContextForUser(req.user, {
      preferredWorkspaceId: workspace.id,
    });
    return res.status(201).json({
      success: true,
      data: ctx,
      membership: { role: membership.role, status: membership.status },
      message: "کسب‌وکار جدید ایجاد شد",
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

async function switchMine(req, res) {
  try {
    const workspaceId = Number(req.body?.workspaceId || req.params.workspaceId);
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: "workspaceId لازم است" });
    }
    await setActiveWorkspace(req.user.id, workspaceId);
    const ctx = await getWorkspaceContextForUser(req.user, { preferredWorkspaceId: workspaceId });
    return res.json({ success: true, data: ctx, message: "کسب‌وکار انتخاب شد" });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

async function listCatalog(req, res) {
  try {
    const periods = [BILLING_PERIODS.MONTHLY, BILLING_PERIODS.QUARTERLY, BILLING_PERIODS.SEMIANNUAL, BILLING_PERIODS.ANNUAL];
    const plans = PLANS.map((plan) => ({
      ...publicPlan(plan, BILLING_PERIODS.MONTHLY),
      prices: periods.map((period) => ({
        billingPeriod: period,
        labelFa: BILLING_PERIOD_META[period].labelFa,
        months: BILLING_PERIOD_META[period].months,
        priceToman: priceForPlanPeriod(plan.id, period),
      })),
    }));

    return res.json({
      success: true,
      data: {
        plans,
        billingPeriods: periods.map((id) => ({
          id,
          labelFa: BILLING_PERIOD_META[id].labelFa,
          months: BILLING_PERIOD_META[id].months,
        })),
        workspaceRoles: Object.values(WORKSPACE_ROLES).map((id) => ({
          id,
          labelFa: WORKSPACE_ROLE_LABELS_FA[id],
        })),
        platformRoles: Object.values(PLATFORM_ROLES).map((id) => ({
          id,
          labelFa: PLATFORM_ROLE_LABELS_FA[id],
        })),
        activityTypes: Object.values(ACTIVITY_TYPES),
        badgeKinds: Object.values(PUBLIC_BADGE_KINDS),
        noteFa:
          "نشان اشتراک با احراز هویت یکی نیست. عضو طلایی فقط یعنی اشتراک طلایی فعال است.",
      },
    });
  } catch (error) {
    console.error("listCatalog:", error);
    return res.status(500).json({ success: false, message: error.message || "خطا" });
  }
}

async function listMembers(req, res) {
  try {
    const ensured = await ensurePersonalWorkspaceFromReq(req);
    if (!ensured) return res.status(404).json({ success: false, message: "کسب‌وکار یافت نشد" });
    if (ensured.membership.status !== "active") {
      return res.status(403).json({ success: false, message: "عضویت فعال نیست" });
    }

    const members = await WorkspaceMember.findAll({
      where: { workspaceId: ensured.workspace.id },
      order: [["id", "ASC"]],
    });
    const userIds = members.map((m) => m.userId);
    const users = await User.findAll({
      where: { id: userIds },
      attributes: ["id", "firstName", "lastName", "mobile", "email"],
    });
    const byId = Object.fromEntries(users.map((u) => [u.id, u]));

    return res.json({
      success: true,
      data: members.map((m) => {
        const u = byId[m.userId];
        return {
          id: m.id,
          userId: m.userId,
          role: m.role,
          roleLabelFa: WORKSPACE_ROLE_LABELS_FA[m.role] || m.role,
          status: m.status,
          joinedAt: m.joinedAt,
          user: u
            ? {
                id: u.id,
                name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.mobile || u.email,
                mobile: u.mobile,
                email: u.email,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

async function inviteMember(req, res) {
  try {
    const ensured = await ensurePersonalWorkspaceFromReq(req);
    if (!ensured) return res.status(404).json({ success: false, message: "کسب‌وکار یافت نشد" });
    assertWorkspacePermission(ensured.membership, WORKSPACE_PERMISSIONS.MANAGE_MEMBERS);

    const role = String(req.body?.role || WORKSPACE_ROLES.VIEWER);
    if (!INVITABLE_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "نقش نامعتبر است" });
    }
    if (role === WORKSPACE_ROLES.OWNER) {
      return res.status(400).json({ success: false, message: "نمی‌توان مالک جدید دعوت کرد" });
    }

    await assertCanAddMember(ensured.workspace.id);

    const mobile = String(req.body?.mobile || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const userIdRaw = req.body?.userId;

    let target = null;
    if (userIdRaw) {
      target = await User.findByPk(Number(userIdRaw));
    } else if (mobile) {
      target = await User.findOne({ where: { mobile } });
    } else if (email) {
      target = await User.findOne({ where: { email } });
    }
    if (!target) {
      return res.status(404).json({ success: false, message: "کاربر یافت نشد؛ ابتدا باید در زارعون ثبت‌نام کند" });
    }
    if (target.id === req.user.id) {
      return res.status(400).json({ success: false, message: "نمی‌توانید خودتان را دعوت کنید" });
    }

    const existing = await WorkspaceMember.findOne({
      where: { workspaceId: ensured.workspace.id, userId: target.id },
    });
    if (existing && existing.status === "active") {
      return res.status(409).json({ success: false, message: "این کاربر هم‌اکنون عضو است" });
    }

    let member;
    if (existing) {
      await existing.update({
        role,
        status: "invited",
        invitedByUserId: req.user.id,
      });
      member = existing;
    } else {
      member = await WorkspaceMember.create({
        workspaceId: ensured.workspace.id,
        userId: target.id,
        role,
        status: "invited",
        invitedByUserId: req.user.id,
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        id: member.id,
        userId: member.userId,
        role: member.role,
        status: member.status,
      },
      message: "دعوت ثبت شد",
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

async function updateMemberRole(req, res) {
  try {
    const ensured = await ensurePersonalWorkspaceFromReq(req);
    assertWorkspacePermission(ensured.membership, WORKSPACE_PERMISSIONS.MANAGE_MEMBERS);
    const member = await WorkspaceMember.findOne({
      where: { id: Number(req.params.memberId), workspaceId: ensured.workspace.id },
    });
    if (!member) return res.status(404).json({ success: false, message: "عضو یافت نشد" });
    if (member.role === WORKSPACE_ROLES.OWNER) {
      return res.status(400).json({ success: false, message: "نقش مالک قابل تغییر نیست" });
    }
    const role = String(req.body?.role || "");
    if (!INVITABLE_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "نقش نامعتبر است" });
    }
    await member.update({ role });
    return res.json({ success: true, data: { id: member.id, role: member.role } });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

async function removeMember(req, res) {
  try {
    const ensured = await ensurePersonalWorkspaceFromReq(req);
    assertWorkspacePermission(ensured.membership, WORKSPACE_PERMISSIONS.MANAGE_MEMBERS);
    const member = await WorkspaceMember.findOne({
      where: { id: Number(req.params.memberId), workspaceId: ensured.workspace.id },
    });
    if (!member) return res.status(404).json({ success: false, message: "عضو یافت نشد" });
    if (member.role === WORKSPACE_ROLES.OWNER) {
      return res.status(400).json({ success: false, message: "مالک را نمی‌توان حذف کرد" });
    }
    await member.update({ status: "left" });
    return res.json({ success: true, message: "عضو حذف شد" });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

async function acceptInvite(req, res) {
  try {
    const member = await WorkspaceMember.findOne({
      where: {
        userId: req.user.id,
        status: "invited",
        id: Number(req.params.memberId),
      },
    });
    if (!member) return res.status(404).json({ success: false, message: "دعوت یافت نشد" });
    await member.update({ status: "active", joinedAt: new Date() });
    return res.json({ success: true, message: "عضویت فعال شد" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "خطا" });
  }
}

async function updateActivities(req, res) {
  try {
    const ensured = await ensurePersonalWorkspaceFromReq(req);
    assertWorkspacePermission(ensured.membership, WORKSPACE_PERMISSIONS.MANAGE_SETTINGS);
    const patch = {};
    if (typeof req.body?.seller === "boolean") patch.activitySeller = req.body.seller;
    if (typeof req.body?.services === "boolean") patch.activityServices = req.body.services;
    // خرید برای همه کاربران فعال است؛ فلگ خریدار روی Workspace نمایش/ویرایش نمی‌شود
    patch.activityBuyer = true;
    await ensured.workspace.update(patch);
    return res.json({
      success: true,
      data: {
        seller: ensured.workspace.activitySeller,
        services: ensured.workspace.activityServices,
      },
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

function normalizeDocuments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => ({
      id: d?.id != null ? Number(d.id) : null,
      url: String(d?.url || d?.downloadUrl || "").trim() || null,
      kind: String(d?.kind || "other").trim().slice(0, 64),
      label: String(d?.label || "").trim().slice(0, 120) || null,
      mimeType: String(d?.mimeType || d?.mimetype || "").trim() || null,
      fileType: String(d?.fileType || "").trim() || null,
    }))
    .filter((d) => d.url || d.id)
    .slice(0, 20);
}

function pickApplication(body, keys) {
  const out = {};
  for (const key of keys) {
    if (body?.[key] != null && String(body[key]).trim() !== "") {
      out[key] = String(body[key]).trim().slice(0, key.includes("address") || key.includes("Info") || key === "note" ? 2000 : 200);
    }
  }
  return out;
}

async function getMyVerification(req, res) {
  try {
    const data = await getVerificationBundleForUser(req.user);
    data.requirements = publicRequirementsPayload();
    const personVerified =
      data.person?.overall === VERIFICATION_STATUS.VERIFIED ? data.person.level : VERIFICATION_LEVELS.NONE;
    const bizVerified =
      data.businesses?.find((b) => b.workspace?.id === data.activeWorkspaceId)?.verification?.overall ===
      VERIFICATION_STATUS.VERIFIED
        ? data.businesses.find((b) => b.workspace?.id === data.activeWorkspaceId)?.verification?.level
        : VERIFICATION_LEVELS.NONE;
    data.nextLevel = {
      person: getNextRequestableLevel(personVerified),
      business: getNextRequestableLevel(bizVerified),
    };
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "خطا" });
  }
}

async function submitPersonVerification(req, res) {
  try {
    const row = await ensurePersonVerification(req.user.id, req.user);
    if (row.overallStatus === VERIFICATION_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        message: "درخواست قبلی هنوز در صف بررسی است",
      });
    }

    const currentLevel =
      row.overallStatus === VERIFICATION_STATUS.VERIFIED
        ? normalizeVerifiedLevel(row.meta?.level)
        : VERIFICATION_LEVELS.NONE;
    const nextAllowed = getNextRequestableLevel(currentLevel);
    if (!nextAllowed) {
      return res.status(400).json({
        success: false,
        message: "بالاترین سطح احراز شخص را دارید",
      });
    }

    const requestedLevel = normalizeLevel(req.body?.requestedLevel) || nextAllowed;
    if (requestedLevel !== nextAllowed) {
      return res.status(400).json({
        success: false,
        message: `فقط سطح «${VERIFICATION_LEVEL_LABELS_FA[nextAllowed]}» قابل ارسال است. ابتدا پله‌های قبل را تکمیل کنید.`,
      });
    }

    const requirement = getPersonRequirement(requestedLevel);
    const application = pickApplication(req.body, [
      "firstName",
      "lastName",
      "fatherName",
      "nationalId",
      "birthDate",
      "birthPlace",
      "nationalCardSerial",
      "address",
      "postalCode",
      "city",
      "province",
      "occupation",
      "note",
    ]);

    const nationalId = application.nationalId || String(req.body?.nationalId || "").trim();
    if (nationalId) application.nationalId = nationalId;

    const missingFields = validateApplicationFields(application, requirement);
    if (missingFields.length) {
      return res.status(400).json({
        success: false,
        message: `برای سطح ${requirement.titleFa} این فیلدها الزامی است: ${missingFields.join(", ")}`,
      });
    }

    await User.update(
      {
        nationalId: application.nationalId,
        ...(application.firstName ? { firstName: application.firstName } : {}),
        ...(application.lastName ? { lastName: application.lastName } : {}),
      },
      { where: { id: req.user.id } }
    );

    const documents = normalizeDocuments(req.body?.documents);
    const missingDocs = validateDocuments(documents, requirement);
    if (missingDocs.length) {
      return res.status(400).json({
        success: false,
        message: `مدارک الزامی این پله ناقص است: ${missingDocs.join(", ")}`,
      });
    }

    row.nationalIdStatus = VERIFICATION_STATUS.PENDING;
    row.identityReviewStatus = VERIFICATION_STATUS.PENDING;
    row.overallStatus = VERIFICATION_STATUS.PENDING;
    row.meta = {
      ...(row.meta || {}),
      submittedAt: new Date().toISOString(),
      application,
      documents,
      reviewNote: null,
      level: currentLevel,
      requestedLevel,
    };
    await row.save();

    const freshUser = await User.findByPk(req.user.id);
    return res.json({
      success: true,
      data: serializePersonVerification(row, freshUser),
      message: `درخواست احراز شخص — سطح ${requirement.titleFa} — ثبت شد`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "خطا" });
  }
}

async function submitBusinessVerification(req, res) {
  try {
    const ensured = await ensurePersonalWorkspaceFromReq(req);
    assertWorkspacePermission(ensured.membership, WORKSPACE_PERMISSIONS.MANAGE_SETTINGS);
    const [row] = await WorkspaceBusinessVerification.findOrCreate({
      where: { workspaceId: ensured.workspace.id },
      defaults: { overallStatus: VERIFICATION_STATUS.NONE },
    });

    if (row.overallStatus === VERIFICATION_STATUS.PENDING) {
      return res.status(400).json({
        success: false,
        message: "درخواست قبلی این کسب‌وکار هنوز در صف بررسی است",
      });
    }

    const currentLevel =
      row.overallStatus === VERIFICATION_STATUS.VERIFIED
        ? normalizeVerifiedLevel(row.meta?.level)
        : VERIFICATION_LEVELS.NONE;
    const nextAllowed = getNextRequestableLevel(currentLevel);
    if (!nextAllowed) {
      return res.status(400).json({
        success: false,
        message: "بالاترین سطح احراز کسب‌وکار را دارید",
      });
    }

    const requestedLevel = normalizeLevel(req.body?.requestedLevel) || nextAllowed;
    if (requestedLevel !== nextAllowed) {
      return res.status(400).json({
        success: false,
        message: `فقط سطح «${VERIFICATION_LEVEL_LABELS_FA[nextAllowed]}» قابل ارسال است. ابتدا پله‌های قبل را تکمیل کنید.`,
      });
    }

    const requirement = getBusinessRequirement(requestedLevel, ensured.workspace.entityType);
    const application = pickApplication(req.body, [
      "legalName",
      "tradeName",
      "entityType",
      "nationalId",
      "registrationNumber",
      "economicCode",
      "licenseInfo",
      "licenseNumber",
      "licenseIssuer",
      "address",
      "postalCode",
      "city",
      "province",
      "phone",
      "email",
      "website",
      "bankName",
      "bankAccountIban",
      "accountHolderName",
      "ceoName",
      "ceoNationalId",
      "note",
    ]);

    const fields = ["nationalId", "registrationNumber", "licenseInfo", "address", "bankAccountIban"];
    for (const f of fields) {
      if (application[f] != null) row[f] = application[f];
      else if (req.body?.[f] != null) row[f] = String(req.body[f]).trim();
    }

    const missingFields = validateApplicationFields(application, requirement);
    if (missingFields.length) {
      return res.status(400).json({
        success: false,
        message: `برای سطح ${requirement.titleFa} این فیلدها الزامی است: ${missingFields.join(", ")}`,
      });
    }

    const documents = normalizeDocuments(req.body?.documents);
    const missingDocs = validateDocuments(documents, requirement);
    if (missingDocs.length) {
      return res.status(400).json({
        success: false,
        message: `مدارک الزامی این پله ناقص است: ${missingDocs.join(", ")}`,
      });
    }

    row.nationalIdStatus = row.nationalId ? VERIFICATION_STATUS.PENDING : row.nationalIdStatus;
    row.registrationStatus = row.registrationNumber ? VERIFICATION_STATUS.PENDING : row.registrationStatus;
    row.licenseStatus = row.licenseInfo || application.licenseNumber ? VERIFICATION_STATUS.PENDING : row.licenseStatus;
    row.addressStatus = row.address ? VERIFICATION_STATUS.PENDING : row.addressStatus;
    row.bankAccountStatus = row.bankAccountIban ? VERIFICATION_STATUS.PENDING : row.bankAccountStatus;
    row.overallStatus = VERIFICATION_STATUS.PENDING;
    const entityNorm = String(ensured.workspace.entityType || "").toLowerCase() === "individual" ? "individual" : "company";
    row.meta = {
      ...(row.meta || {}),
      submittedAt: new Date().toISOString(),
      application: { ...application, entityType: entityNorm },
      documents,
      reviewNote: null,
      level: currentLevel,
      requestedLevel,
      entityType: entityNorm,
    };
    await row.save();

    return res.json({
      success: true,
      data: serializeBusinessVerification(row),
      message: `درخواست احراز کسب‌وکار — سطح ${requirement.titleFa} — ثبت شد`,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

async function submitRepresentation(req, res) {
  try {
    const ensured = await ensurePersonalWorkspaceFromReq(req);
    const [row] = await WorkspaceRepresentation.findOrCreate({
      where: { workspaceId: ensured.workspace.id, userId: req.user.id },
      defaults: { status: VERIFICATION_STATUS.NONE },
    });
    row.status = VERIFICATION_STATUS.PENDING;
    row.title = String(req.body?.title || row.title || "نماینده").trim();
    row.meta = {
      ...(row.meta || {}),
      submittedAt: new Date().toISOString(),
      note: req.body?.note || null,
      documents: normalizeDocuments(req.body?.documents),
    };
    await row.save();
    return res.json({ success: true, data: row, message: "درخواست احراز نمایندگی ثبت شد" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "خطا" });
  }
}

function assertVerificationOfficer(user) {
  if (isAdmin(user) || isPlatformStaff(user)) return;
  const err = new Error("دسترسی احراز ندارید");
  err.status = 403;
  throw err;
}

function resolveReviewDecision(body) {
  const decision = String(body?.decision || "").toLowerCase();
  if (![VERIFICATION_STATUS.VERIFIED, VERIFICATION_STATUS.REJECTED].includes(decision)) {
    return null;
  }
  return decision;
}

async function adminReviewPerson(req, res) {
  try {
    assertVerificationOfficer(req.user);
    const userId = Number(req.params.userId);
    const decision = resolveReviewDecision(req.body);
    if (!decision) return res.status(400).json({ success: false, message: "decision نامعتبر" });

    const row = await UserPersonVerification.findOne({ where: { userId } });
    if (!row) return res.status(404).json({ success: false, message: "یافت نشد" });

    const level =
      decision === VERIFICATION_STATUS.VERIFIED
        ? normalizeLevel(req.body?.level) || VERIFICATION_LEVELS.STANDARD
        : VERIFICATION_LEVELS.NONE;

    if (decision === VERIFICATION_STATUS.VERIFIED && !PERSON_VERIFICATION_LEVELS.includes(level)) {
      return res.status(400).json({ success: false, message: "درجه احراز نامعتبر است" });
    }

    row.nationalIdStatus = decision;
    row.identityReviewStatus = decision;
    row.overallStatus = decision;
    row.reviewedAt = new Date();
    row.reviewedByUserId = req.user.id;
    row.meta = {
      ...(row.meta || {}),
      level,
      reviewNote: String(req.body?.reviewNote || "").trim().slice(0, 2000) || null,
      reviewedAt: new Date().toISOString(),
      fieldStatuses: req.body?.fieldStatuses || null,
    };
    await row.save();

    const user = await User.findByPk(userId);
    return res.json({
      success: true,
      data: serializePersonVerification(row, user),
      message:
        decision === VERIFICATION_STATUS.VERIFIED
          ? `احراز شخص تأیید شد — درجه: ${VERIFICATION_LEVEL_LABELS_FA[level]}`
          : "درخواست احراز شخص رد شد",
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

async function adminReviewBusiness(req, res) {
  try {
    assertVerificationOfficer(req.user);
    const workspaceId = Number(req.params.workspaceId);
    const decision = resolveReviewDecision(req.body);
    if (!decision) return res.status(400).json({ success: false, message: "decision نامعتبر" });

    const row = await WorkspaceBusinessVerification.findOne({ where: { workspaceId } });
    if (!row) return res.status(404).json({ success: false, message: "یافت نشد" });

    const level =
      decision === VERIFICATION_STATUS.VERIFIED
        ? normalizeLevel(req.body?.level) || VERIFICATION_LEVELS.STANDARD
        : VERIFICATION_LEVELS.NONE;

    if (decision === VERIFICATION_STATUS.VERIFIED && !BUSINESS_VERIFICATION_LEVELS.includes(level)) {
      return res.status(400).json({ success: false, message: "درجه احراز نامعتبر است" });
    }

    for (const key of [
      "nationalIdStatus",
      "registrationStatus",
      "licenseStatus",
      "addressStatus",
      "bankAccountStatus",
      "overallStatus",
    ]) {
      row[key] = decision;
    }
    row.reviewedAt = new Date();
    row.reviewedByUserId = req.user.id;
    row.meta = {
      ...(row.meta || {}),
      level,
      reviewNote: String(req.body?.reviewNote || "").trim().slice(0, 2000) || null,
      reviewedAt: new Date().toISOString(),
      fieldStatuses: req.body?.fieldStatuses || null,
    };
    await row.save();

    return res.json({
      success: true,
      data: serializeBusinessVerification(row),
      message:
        decision === VERIFICATION_STATUS.VERIFIED
          ? `احراز کسب‌وکار تأیید شد — درجه: ${VERIFICATION_LEVEL_LABELS_FA[level]}`
          : "درخواست احراز کسب‌وکار رد شد",
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

async function adminReviewRepresentation(req, res) {
  try {
    assertVerificationOfficer(req.user);
    const id = Number(req.params.id);
    const decision = resolveReviewDecision(req.body);
    if (!decision) return res.status(400).json({ success: false, message: "decision نامعتبر" });
    const row = await WorkspaceRepresentation.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: "یافت نشد" });
    row.status = decision;
    row.reviewedAt = new Date();
    row.reviewedByUserId = req.user.id;
    row.meta = {
      ...(row.meta || {}),
      reviewNote: String(req.body?.reviewNote || "").trim().slice(0, 2000) || null,
    };
    await row.save();
    return res.json({ success: true, data: row });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

async function adminListPending(req, res) {
  try {
    assertVerificationOfficer(req.user);
    const [persons, businesses, reps] = await Promise.all([
      UserPersonVerification.findAll({
        where: { overallStatus: VERIFICATION_STATUS.PENDING },
        order: [["updatedAt", "DESC"]],
        limit: 100,
      }),
      WorkspaceBusinessVerification.findAll({
        where: { overallStatus: VERIFICATION_STATUS.PENDING },
        order: [["updatedAt", "DESC"]],
        limit: 100,
      }),
      WorkspaceRepresentation.findAll({
        where: { status: VERIFICATION_STATUS.PENDING },
        order: [["updatedAt", "DESC"]],
        limit: 100,
      }),
    ]);

    const userIds = [...new Set(persons.map((p) => p.userId).filter(Boolean))];
    const wsIds = [
      ...new Set([
        ...businesses.map((b) => b.workspaceId).filter(Boolean),
        ...reps.map((r) => r.workspaceId).filter(Boolean),
      ]),
    ];

    const [users, workspaces] = await Promise.all([
      userIds.length
        ? User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ["id", "firstName", "lastName", "mobile", "email", "nationalId", "username"],
          })
        : [],
      wsIds.length ? Workspace.findAll({ where: { id: { [Op.in]: wsIds } } }) : [],
    ]);

    const userById = Object.fromEntries(users.map((u) => [u.id, u]));
    const wsById = Object.fromEntries(workspaces.map((w) => [w.id, w]));

    return res.json({
      success: true,
      data: {
        persons: persons.map((p) => ({
          ...serializePersonVerification(p, userById[p.userId]),
          id: p.id,
          userId: p.userId,
          updatedAt: p.updatedAt,
        })),
        businesses: businesses.map((b) => ({
          ...serializeBusinessVerification(b),
          id: b.id,
          workspaceId: b.workspaceId,
          workspace: wsById[b.workspaceId]
            ? {
                id: wsById[b.workspaceId].id,
                name: wsById[b.workspaceId].name,
                displayName: wsById[b.workspaceId].displayName,
                entityType: wsById[b.workspaceId].entityType,
                profileSlug: wsById[b.workspaceId].profileSlug,
              }
            : null,
          updatedAt: b.updatedAt,
        })),
        representations: reps.map((r) => ({
          id: r.id,
          workspaceId: r.workspaceId,
          userId: r.userId,
          title: r.title,
          status: r.status,
          meta: r.meta,
          workspace: wsById[r.workspaceId]
            ? {
                id: wsById[r.workspaceId].id,
                name: wsById[r.workspaceId].name,
                displayName: wsById[r.workspaceId].displayName,
              }
            : null,
          updatedAt: r.updatedAt,
        })),
        levels: {
          person: PERSON_VERIFICATION_LEVELS,
          business: BUSINESS_VERIFICATION_LEVELS,
          labels: VERIFICATION_LEVEL_LABELS_FA,
        },
      },
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message || "خطا" });
  }
}

module.exports = {
  getMyWorkspace,
  listMine,
  createMine,
  switchMine,
  listCatalog,
  listMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
  acceptInvite,
  updateActivities,
  getMyVerification,
  submitPersonVerification,
  submitBusinessVerification,
  submitRepresentation,
  adminReviewPerson,
  adminReviewBusiness,
  adminReviewRepresentation,
  adminListPending,
};
