const { Op } = require("sequelize");
const {
  Workspace,
  WorkspaceMember,
  WorkspaceSubscription,
  UserPersonVerification,
  WorkspaceBusinessVerification,
  WorkspaceRepresentation,
} = require("./model");
const Account = require("../account/model");
const TradeServiceProvider = require("../tradeServiceProvider/model");
const User = require("../user/user/model");
const {
  WORKSPACE_ROLES,
  workspaceRoleHasPermission,
  VERIFICATION_STATUS,
  VERIFICATION_LEVELS,
  VERIFICATION_LEVEL_LABELS_FA,
  PERSON_VERIFICATION_LEVELS,
  BUSINESS_VERIFICATION_LEVELS,
  WORKSPACE_ROLE_PERMISSIONS,
  WORKSPACE_PERMISSIONS,
} = require("./constants");
const { PLAN_IDS, BILLING_PERIODS, getPlanById, publicPlan } = require("./plans");
const { buildPublicBadges, normalizeLevel } = require("./badges");
const { isSeller, isServiceProvider } = require("../../utils/roles");

async function ensurePersonVerification(userId, userRow) {
  const mobileStatus = userRow?.isMobileVerified ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.NONE;
  const emailStatus = userRow?.isEmailVerified ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.NONE;
  try {
    const [row] = await UserPersonVerification.findOrCreate({
      where: { userId },
      defaults: {
        mobileStatus,
        emailStatus,
        nationalIdStatus: VERIFICATION_STATUS.NONE,
        identityReviewStatus: VERIFICATION_STATUS.NONE,
        overallStatus: VERIFICATION_STATUS.NONE,
      },
    });
    return row;
  } catch (err) {
    // درخواست‌های موازی گاهی هم‌زمان create می‌زنند
    if (err?.name === "SequelizeUniqueConstraintError" || err?.parent?.code === "ER_DUP_ENTRY") {
      const existing = await UserPersonVerification.findOne({ where: { userId } });
      if (existing) return existing;
    }
    throw err;
  }
}

async function getMembership(userId, workspaceId) {
  return WorkspaceMember.findOne({
    where: { userId, workspaceId, status: { [Op.in]: ["active", "invited"] } },
  });
}

async function bootstrapWorkspaceExtras(workspace, userId, user) {
  await WorkspaceBusinessVerification.findOrCreate({
    where: { workspaceId: workspace.id },
    defaults: { overallStatus: VERIFICATION_STATUS.NONE },
  });
  await WorkspaceRepresentation.findOrCreate({
    where: { workspaceId: workspace.id, userId },
    defaults: { status: VERIFICATION_STATUS.NONE, title: "مالک" },
  });
  await ensurePersonVerification(userId, user);
}

/**
 * ساخت Workspace جدید — کاربر Owner می‌شود (بدون محدودیت تعداد)
 */
async function createWorkspace(user, payload = {}) {
  const userId = user?.id || user?.userId;
  if (!userId) {
    const err = new Error("کاربر نامعتبر");
    err.status = 401;
    throw err;
  }

  const name =
    String(payload.name || payload.displayName || "").trim() ||
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    `کسب‌وکار ${userId}`;

  const workspace = await Workspace.create({
    name,
    displayName: String(payload.displayName || name).trim() || name,
    profileSlug: payload.profileSlug ? String(payload.profileSlug).trim() : null,
    entityType: (() => {
      const raw = String(payload.entityType || "").trim().toLowerCase();
      if (raw === "individual") return "individual";
      if (raw === "company" || raw === "legal") return "company";
      const err = new Error("نوع شخصیت کسب‌وکار الزامی است: حقیقی (individual) یا حقوقی (company)");
      err.status = 400;
      throw err;
    })(),
    activityBuyer: true,
    activitySeller: Boolean(payload.activitySeller),
    activityServices: Boolean(payload.activityServices),
    isPublic: payload.isPublic !== false,
    addressText: payload.addressText ? String(payload.addressText).trim() : null,
    addressLabel: payload.addressLabel ? String(payload.addressLabel).trim() : null,
    latitude: payload.latitude != null && payload.latitude !== "" ? Number(payload.latitude) : null,
    longitude: payload.longitude != null && payload.longitude !== "" ? Number(payload.longitude) : null,
    businessHours: payload.businessHours || null,
    createdByUserId: userId,
    accountId: null,
  });

  const membership = await WorkspaceMember.create({
    workspaceId: workspace.id,
    userId,
    role: WORKSPACE_ROLES.OWNER,
    status: "active",
    joinedAt: new Date(),
  });

  await bootstrapWorkspaceExtras(workspace, userId, user);
  await User.update({ activeWorkspaceId: workspace.id }, { where: { id: userId } });

  return { workspace, membership };
}

async function listWorkspacesForUser(userId) {
  const memberships = await WorkspaceMember.findAll({
    where: { userId, status: { [Op.in]: ["active", "invited"] } },
    order: [["id", "ASC"]],
  });
  if (!memberships.length) return [];

  const ids = memberships.map((m) => m.workspaceId);
  const workspaces = await Workspace.findAll({ where: { id: ids } });
  const byId = Object.fromEntries(workspaces.map((w) => [w.id, w]));
  const user = await User.findByPk(userId, { attributes: ["id", "activeWorkspaceId"] });

  return memberships
    .map((m) => {
      const w = byId[m.workspaceId];
      if (!w) return null;
      return {
        id: w.id,
        name: w.name,
        displayName: w.displayName,
        profileSlug: w.profileSlug,
        entityType: w.entityType,
        role: m.role,
        status: m.status,
        isActive: Number(user?.activeWorkspaceId) === Number(w.id),
        activities: {
          seller: w.activitySeller,
          services: w.activityServices,
        },
      };
    })
    .filter(Boolean);
}

async function setActiveWorkspace(userId, workspaceId) {
  const membership = await WorkspaceMember.findOne({
    where: { userId, workspaceId, status: "active" },
  });
  if (!membership) {
    const err = new Error("عضویت فعال در این کسب‌وکار یافت نشد");
    err.status = 403;
    throw err;
  }
  await User.update({ activeWorkspaceId: workspaceId }, { where: { id: userId } });
  const workspace = await Workspace.findByPk(workspaceId);
  return { workspace, membership };
}

/**
 * Workspace فعال کاربر:
 * 1) preferredId (هدر/کوئری)
 * 2) users.active_workspace_id
 * 3) اولین عضویت فعال
 * 4) در صورت نبود، ساخت اولین Workspace (از Account اگر باشد)
 */
async function ensurePersonalWorkspace(user, { createIfMissing = true, preferredWorkspaceId = null } = {}) {
  const userId = user?.id || user?.userId;
  if (!userId) return null;

  const preferred = preferredWorkspaceId ? Number(preferredWorkspaceId) : null;
  if (preferred) {
    const membership = await WorkspaceMember.findOne({
      where: { userId, workspaceId: preferred, status: "active" },
    });
    if (membership) {
      const workspace = await Workspace.findByPk(preferred);
      if (workspace) {
        if (Number(user.activeWorkspaceId) !== preferred) {
          await User.update({ activeWorkspaceId: preferred }, { where: { id: userId } }).catch(() => {});
        }
        return { workspace, membership };
      }
    }
  }

  let dbUser = user;
  if (user.activeWorkspaceId == null) {
    dbUser = await User.findByPk(userId, {
      attributes: [
        "id",
        "firstName",
        "lastName",
        "isMobileVerified",
        "isEmailVerified",
        "activeWorkspaceId",
      ],
    });
  }

  if (dbUser?.activeWorkspaceId) {
    const membership = await WorkspaceMember.findOne({
      where: { userId, workspaceId: dbUser.activeWorkspaceId, status: "active" },
    });
    if (membership) {
      const workspace = await Workspace.findByPk(dbUser.activeWorkspaceId);
      if (workspace) return { workspace, membership };
    }
  }

  const membership = await WorkspaceMember.findOne({
    where: { userId, status: "active" },
    order: [["id", "ASC"]],
  });
  if (membership) {
    const workspace = await Workspace.findByPk(membership.workspaceId);
    if (workspace) {
      await User.update({ activeWorkspaceId: workspace.id }, { where: { id: userId } }).catch(() => {});
      return { workspace, membership };
    }
  }

  if (!createIfMissing) return null;

  // اولین Workspace: در صورت وجود Account به آن وصل شود
  const account = await Account.findOne({ where: { userId } });
  const seller = isSeller(user);
  const services = isServiceProvider(user);

  const workspace = await Workspace.create({
    name:
      account?.displayName ||
      account?.profileSlug ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      `workspace-${userId}`,
    displayName: account?.displayName || null,
    profileSlug: account?.profileSlug || null,
    entityType: account?.entityType || "individual",
    activityBuyer: true,
    activitySeller: Boolean(seller || account),
    activityServices: Boolean(services),
    isPublic: account?.isPublic !== false,
    createdByUserId: userId,
    accountId: account?.id || null,
  });

  if (account && !account.workspaceId) {
    await account.update({ workspaceId: workspace.id });
  }

  const membershipCreated = await WorkspaceMember.create({
    workspaceId: workspace.id,
    userId,
    role: WORKSPACE_ROLES.OWNER,
    status: "active",
    joinedAt: new Date(),
  });

  await bootstrapWorkspaceExtras(workspace, userId, user);
  await User.update({ activeWorkspaceId: workspace.id }, { where: { id: userId } });

  const provider = await TradeServiceProvider.findOne({
    where: { userId, workspaceId: null },
    order: [["id", "ASC"]],
  });
  if (provider) {
    await provider.update({ workspaceId: workspace.id });
    if (!workspace.activityServices) await workspace.update({ activityServices: true });
  }

  return { workspace, membership: membershipCreated };
}

function preferredWorkspaceIdFromReq(req) {
  const h = req?.headers?.["x-workspace-id"] || req?.headers?.["X-Workspace-Id"];
  const q = req?.query?.workspaceId;
  const b = req?.body?.workspaceId;
  const raw = h || q || b;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function ensurePersonalWorkspaceFromReq(req, opts = {}) {
  return ensurePersonalWorkspace(req.user, {
    ...opts,
    preferredWorkspaceId: preferredWorkspaceIdFromReq(req),
  });
}

async function getActiveWorkspaceSubscription(workspaceId) {
  const now = new Date();
  return WorkspaceSubscription.findOne({
    where: {
      workspaceId,
      status: "active",
      [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }],
    },
    order: [["endsAt", "DESC"], ["id", "DESC"]],
  });
}

async function getWorkspaceContextForUser(user, { preferredWorkspaceId = null } = {}) {
  const ensured = await ensurePersonalWorkspace(user, {
    createIfMissing: true,
    preferredWorkspaceId,
  });
  if (!ensured) return null;
  const { workspace, membership } = ensured;

  const [sub, person, business, representation, workspaces] = await Promise.all([
    getActiveWorkspaceSubscription(workspace.id),
    ensurePersonVerification(user.id, user),
    WorkspaceBusinessVerification.findOne({ where: { workspaceId: workspace.id } }),
    WorkspaceRepresentation.findOne({ where: { workspaceId: workspace.id, userId: user.id } }),
    listWorkspacesForUser(user.id),
  ]);

  const planId = sub?.planId || PLAN_IDS.FREE;
  const plan = getPlanById(planId);
  const billingPeriod = sub?.billingPeriod || BILLING_PERIODS.NONE;

  const badges = buildPublicBadges({
    planId,
    personOverall: person?.overallStatus,
    businessOverall: business?.overallStatus,
    representationStatus: representation?.status,
    personLevel: person?.meta?.level,
    businessLevel: business?.meta?.level,
  });

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      displayName: workspace.displayName,
      profileSlug: workspace.profileSlug,
      entityType: workspace.entityType,
      isPublic: workspace.isPublic,
      addressText: workspace.addressText || null,
      addressLabel: workspace.addressLabel || null,
      latitude: workspace.latitude != null ? Number(workspace.latitude) : null,
      longitude: workspace.longitude != null ? Number(workspace.longitude) : null,
      businessHours: workspace.businessHours || null,
      activities: {
        seller: workspace.activitySeller,
        services: workspace.activityServices,
      },
      accountId: workspace.accountId,
    },
    workspaces,
    membership: {
      role: membership.role,
      status: membership.status,
      permissions: (WORKSPACE_ROLE_PERMISSIONS[membership.role] || []).slice(),
    },
    subscription: {
      planId,
      billingPeriod,
      status: sub?.status || (planId === PLAN_IDS.FREE ? "free" : "none"),
      startsAt: sub?.startsAt || null,
      endsAt: sub?.endsAt || null,
      plan: publicPlan(plan, billingPeriod === BILLING_PERIODS.NONE ? BILLING_PERIODS.MONTHLY : billingPeriod),
    },
    verification: {
      person: serializePersonVerification(person, user),
      business: serializeBusinessVerification(business),
      representation: {
        status: representation?.status || VERIFICATION_STATUS.NONE,
        title: representation?.title || null,
      },
    },
    badges,
  };
}

function serializePersonVerification(person, user = null) {
  const meta = person?.meta || {};
  return {
    overall: person?.overallStatus || VERIFICATION_STATUS.NONE,
    mobile: person?.mobileStatus,
    email: person?.emailStatus,
    nationalId: person?.nationalIdStatus,
    identityReview: person?.identityReviewStatus,
    level: meta.level || VERIFICATION_LEVELS.NONE,
    levelLabelFa: VERIFICATION_LEVEL_LABELS_FA[meta.level] || VERIFICATION_LEVEL_LABELS_FA.none,
    requestedLevel: meta.requestedLevel || null,
    application: meta.application || null,
    documents: Array.isArray(meta.documents) ? meta.documents : [],
    reviewNote: meta.reviewNote || null,
    submittedAt: meta.submittedAt || null,
    reviewedAt: person?.reviewedAt || null,
    user: user
      ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          mobile: user.mobile,
          email: user.email,
          nationalId: user.nationalId || meta.application?.nationalId || null,
        }
      : null,
  };
}

function serializeBusinessVerification(business) {
  const meta = business?.meta || {};
  return {
    overall: business?.overallStatus || VERIFICATION_STATUS.NONE,
    nationalId: business?.nationalIdStatus,
    registration: business?.registrationStatus,
    license: business?.licenseStatus,
    address: business?.addressStatus,
    bankAccount: business?.bankAccountStatus,
    level: meta.level || VERIFICATION_LEVELS.NONE,
    levelLabelFa: VERIFICATION_LEVEL_LABELS_FA[meta.level] || VERIFICATION_LEVEL_LABELS_FA.none,
    requestedLevel: meta.requestedLevel || null,
    fields: {
      nationalId: business?.nationalId || null,
      registrationNumber: business?.registrationNumber || null,
      licenseInfo: business?.licenseInfo || null,
      address: business?.address || null,
      bankAccountIban: business?.bankAccountIban || null,
    },
    application: meta.application || null,
    documents: Array.isArray(meta.documents) ? meta.documents : [],
    reviewNote: meta.reviewNote || null,
    submittedAt: meta.submittedAt || null,
    reviewedAt: business?.reviewedAt || null,
    workspaceId: business?.workspaceId || null,
  };
}

async function getVerificationBundleForUser(user) {
  const userId = user.id || user.userId;
  const dbUser =
    (await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName", "mobile", "email", "nationalId", "isMobileVerified", "isEmailVerified"],
    })) || user;

  const person = await ensurePersonVerification(userId, dbUser);
  const workspaces = await listWorkspacesForUser(userId);
  const wsIds = workspaces.map((w) => w.id);
  const businesses = wsIds.length
    ? await WorkspaceBusinessVerification.findAll({ where: { workspaceId: { [Op.in]: wsIds } } })
    : [];
  const byWs = Object.fromEntries(businesses.map((b) => [b.workspaceId, b]));

  const active = await ensurePersonalWorkspace(dbUser, { createIfMissing: true });
  const representation = await WorkspaceRepresentation.findOne({
    where: { workspaceId: active.workspace.id, userId },
  });

  return {
    person: serializePersonVerification(person, dbUser),
    businesses: workspaces.map((w) => ({
      workspace: w,
      verification: serializeBusinessVerification(byWs[w.id] || null),
    })),
    activeWorkspaceId: active.workspace.id,
    representation: {
      status: representation?.status || VERIFICATION_STATUS.NONE,
      title: representation?.title || null,
    },
    levels: {
      person: PERSON_VERIFICATION_LEVELS,
      business: BUSINESS_VERIFICATION_LEVELS,
      labels: VERIFICATION_LEVEL_LABELS_FA,
    },
  };
}

function assertWorkspacePermission(membership, permission) {
  if (!membership || membership.status !== "active") {
    const err = new Error("عضویت فعال در کسب‌وکار یافت نشد");
    err.status = 403;
    throw err;
  }
  if (!workspaceRoleHasPermission(membership.role, permission)) {
    const err = new Error("دسترسی کافی در این کسب‌وکار ندارید");
    err.status = 403;
    throw err;
  }
}

module.exports = {
  ensurePersonalWorkspace,
  ensurePersonalWorkspaceFromReq,
  preferredWorkspaceIdFromReq,
  createWorkspace,
  listWorkspacesForUser,
  setActiveWorkspace,
  getMembership,
  ensurePersonVerification,
  getActiveWorkspaceSubscription,
  getWorkspaceContextForUser,
  assertWorkspacePermission,
  serializePersonVerification,
  serializeBusinessVerification,
  getVerificationBundleForUser,
  normalizeLevel,
  WORKSPACE_PERMISSIONS,
};
