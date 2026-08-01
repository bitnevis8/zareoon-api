const { Op } = require("sequelize");
const { Workspace, WorkspaceMember, WorkspaceSubscription } = require("./model");
const { UserSubscription } = require("../subscription/model");
const User = require("../user/user/model");
const { PLAN_IDS, getPlanById, BILLING_PERIODS } = require("./plans");
const { getActiveWorkspaceSubscription } = require("./limits");

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days));
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + Number(months));
  return d;
}

/**
 * لیست کسب‌وکارهای کاربر + اشتراک فعال هر کدام
 */
async function listUserWorkspacesWithSubs(userId) {
  const uid = Number(userId);
  if (!uid) {
    const err = new Error("شناسه کاربر نامعتبر است");
    err.status = 400;
    throw err;
  }

  const user = await User.findByPk(uid, {
    attributes: ["id", "firstName", "lastName", "username", "mobile", "email"],
  });
  if (!user) {
    const err = new Error("کاربر یافت نشد");
    err.status = 404;
    throw err;
  }

  const memberships = await WorkspaceMember.findAll({
    where: { userId: uid, status: { [Op.in]: ["active", "invited"] } },
    order: [["id", "ASC"]],
  });
  const wsIds = memberships.map((m) => m.workspaceId);
  const workspaces = wsIds.length
    ? await Workspace.findAll({ where: { id: { [Op.in]: wsIds } } })
    : [];
  const wsMap = new Map(workspaces.map((w) => [w.id, w]));

  const items = [];
  for (const m of memberships) {
    const ws = wsMap.get(m.workspaceId);
    if (!ws) continue;
    const sub = await getActiveWorkspaceSubscription(ws.id);
    const plan = sub ? getPlanById(sub.planId) : getPlanById(PLAN_IDS.FREE);
    items.push({
      workspaceId: ws.id,
      name: ws.displayName || ws.name,
      profileSlug: ws.profileSlug,
      role: m.role,
      memberStatus: m.status,
      subscription: sub
        ? {
            id: sub.id,
            planId: sub.planId,
            planName: plan?.name || sub.planId,
            status: sub.status,
            billingPeriod: sub.billingPeriod,
            startsAt: sub.startsAt,
            endsAt: sub.endsAt,
            gateway: sub.gateway,
            amountToman: sub.amountToman,
            meta: sub.meta,
          }
        : {
            id: null,
            planId: PLAN_IDS.FREE,
            planName: "رایگان",
            status: "none",
            billingPeriod: "none",
            startsAt: null,
            endsAt: null,
            gateway: null,
            amountToman: 0,
            meta: null,
          },
    });
  }

  return {
    user: {
      id: user.id,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || user.mobile,
      username: user.username,
      mobile: user.mobile,
      email: user.email,
    },
    workspaces: items,
  };
}

/**
 * اختصاص دستی پلن به یک کسب‌وکار — با مدت دلخواه
 * @param {{ workspaceId, planId, durationDays?, durationMonths?, endsAt?, unlimited?, note?, grantedByUserId, targetUserId? }} opts
 */
async function grantManualSubscription(opts = {}) {
  const workspaceId = Number(opts.workspaceId);
  const planId = String(opts.planId || "").trim().toLowerCase();
  const plan = getPlanById(planId);
  if (!workspaceId || !plan) {
    const err = new Error("کسب‌وکار یا پلن نامعتبر است");
    err.status = 400;
    throw err;
  }

  const workspace = await Workspace.findByPk(workspaceId);
  if (!workspace) {
    const err = new Error("کسب‌وکار یافت نشد");
    err.status = 404;
    throw err;
  }

  const startsAt = new Date();
  let endsAt = null;
  let billingPeriod = BILLING_PERIODS.NONE;

  if (opts.unlimited === true || opts.unlimited === "true" || opts.unlimited === 1) {
    endsAt = null;
    billingPeriod = BILLING_PERIODS.NONE;
  } else if (opts.endsAt) {
    endsAt = new Date(opts.endsAt);
    if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      const err = new Error("تاریخ پایان نامعتبر است");
      err.status = 400;
      throw err;
    }
  } else if (opts.durationDays != null && opts.durationDays !== "") {
    const days = Math.floor(Number(opts.durationDays));
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      const err = new Error("مدت اعتبار باید بین ۱ تا ۳۶۵۰ روز باشد");
      err.status = 400;
      throw err;
    }
    endsAt = addDays(startsAt, days);
    if (days >= 360) billingPeriod = BILLING_PERIODS.ANNUAL;
    else if (days >= 170) billingPeriod = BILLING_PERIODS.SEMIANNUAL;
    else if (days >= 80) billingPeriod = BILLING_PERIODS.QUARTERLY;
    else billingPeriod = BILLING_PERIODS.MONTHLY;
  } else if (opts.durationMonths != null && opts.durationMonths !== "") {
    const months = Math.floor(Number(opts.durationMonths));
    if (!Number.isFinite(months) || months < 1 || months > 120) {
      const err = new Error("مدت اعتبار باید بین ۱ تا ۱۲۰ ماه باشد");
      err.status = 400;
      throw err;
    }
    endsAt = addMonths(startsAt, months);
    if (months >= 12) billingPeriod = BILLING_PERIODS.ANNUAL;
    else if (months >= 6) billingPeriod = BILLING_PERIODS.SEMIANNUAL;
    else if (months >= 3) billingPeriod = BILLING_PERIODS.QUARTERLY;
    else billingPeriod = BILLING_PERIODS.MONTHLY;
  } else {
    const err = new Error("مدت اعتبار را مشخص کنید (روز / ماه / تاریخ پایان / نامحدود)");
    err.status = 400;
    throw err;
  }

  // مالک یا کاربر هدف برای legacy user_subscriptions
  let targetUserId = opts.targetUserId ? Number(opts.targetUserId) : null;
  if (!targetUserId) {
    const owner = await WorkspaceMember.findOne({
      where: { workspaceId, role: "owner", status: "active" },
    });
    targetUserId = owner?.userId || workspace.createdByUserId;
  }

  await WorkspaceSubscription.update(
    { status: "expired" },
    { where: { workspaceId, status: "active" } }
  );

  if (targetUserId) {
    await UserSubscription.update(
      { status: "expired" },
      { where: { userId: targetUserId, status: "active" } }
    );
  }

  const meta = {
    grantedManually: true,
    grantedByUserId: opts.grantedByUserId || null,
    grantedAt: new Date().toISOString(),
    note: String(opts.note || "").trim().slice(0, 1000) || null,
    unlimited: endsAt == null,
  };

  const legacy = targetUserId
    ? await UserSubscription.create({
        userId: targetUserId,
        planId,
        status: "active",
        amountToman: 0,
        gateway: "manual",
        authority: `manual-${Date.now()}-${workspaceId}`,
        startsAt,
        endsAt,
        meta: { ...meta, workspaceId, billingPeriod },
      })
    : null;

  const wsSub = await WorkspaceSubscription.create({
    workspaceId,
    planId,
    billingPeriod,
    status: "active",
    amountToman: 0,
    gateway: "manual",
    authority: legacy?.authority || `manual-ws-${Date.now()}-${workspaceId}`,
    startsAt,
    endsAt,
    meta,
    legacyUserSubscriptionId: legacy?.id || null,
  });

  return {
    workspace: {
      id: workspace.id,
      name: workspace.displayName || workspace.name,
    },
    plan: { id: plan.id, name: plan.name },
    subscription: wsSub,
    legacySubscription: legacy,
  };
}

/**
 * قطع اشتراک فعال کسب‌وکار
 */
async function revokeManualSubscription({ workspaceId, revokedByUserId, note }) {
  const wid = Number(workspaceId);
  if (!wid) {
    const err = new Error("شناسه کسب‌وکار نامعتبر است");
    err.status = 400;
    throw err;
  }

  const active = await getActiveWorkspaceSubscription(wid);
  if (!active) {
    const err = new Error("اشتراک فعالی برای این کسب‌وکار نیست");
    err.status = 404;
    throw err;
  }

  active.status = "canceled";
  active.meta = {
    ...(active.meta || {}),
    revokedByUserId: revokedByUserId || null,
    revokedAt: new Date().toISOString(),
    revokeNote: String(note || "").trim().slice(0, 1000) || null,
  };
  await active.save();

  if (active.legacyUserSubscriptionId) {
    await UserSubscription.update(
      { status: "canceled" },
      { where: { id: active.legacyUserSubscriptionId } }
    );
  }

  return active;
}

module.exports = {
  listUserWorkspacesWithSubs,
  grantManualSubscription,
  revokeManualSubscription,
};
