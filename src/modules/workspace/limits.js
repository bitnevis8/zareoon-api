const { Op } = require("sequelize");
const InventoryLot = require("../farmer/inventoryLot/model");
const TradeServiceProvider = require("../tradeServiceProvider/model");
const SupplierPost = require("../supplierProfile/post/model");
const { WorkspaceMember, WorkspaceSubscription } = require("./model");
const { getPlanById, PLAN_IDS } = require("./plans");
const { isAdmin } = require("../../utils/roles");

/** سقف‌های نامحدود برای مدیرکل / مدیر سامانه */
const ADMIN_UNLIMITED_LIMITS = {
  activeLots: null,
  tradeServices: null,
  teamMembers: null,
  listingLocales: null,
  analyticsDays: 365,
  featuredCredits: null,
  imagesPerLot: null,
  activeVideos: null,
  postsPerMonth: null,
  searchBoost: 3,
  featuredBadge: true,
  support: "dedicated",
  landingPages: null,
};

async function getActiveWorkspaceSubscription(workspaceId) {
  const now = new Date();
  return WorkspaceSubscription.findOne({
    where: {
      workspaceId,
      status: "active",
      [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }],
    },
    order: [
      ["endsAt", "DESC"],
      ["id", "DESC"],
    ],
  });
}

async function resolvePlanLimits(workspaceId, actor = null) {
  if (actor && isAdmin(actor)) {
    return {
      planId: "admin_unlimited",
      limits: { ...ADMIN_UNLIMITED_LIMITS },
      billingPeriod: "none",
      adminBypass: true,
    };
  }
  const sub = await getActiveWorkspaceSubscription(workspaceId);
  const planId = sub?.planId || PLAN_IDS.FREE;
  const plan = getPlanById(planId) || getPlanById(PLAN_IDS.FREE);
  return { planId, limits: plan.limits || {}, billingPeriod: sub?.billingPeriod || "none", adminBypass: false };
}

function limitExceededError(message) {
  const err = new Error(message);
  err.status = 403;
  err.code = "PLAN_LIMIT";
  return err;
}

async function countActiveLots(workspaceId) {
  return InventoryLot.count({
    where: {
      workspaceId,
      status: { [Op.in]: ["on_field", "harvested", "reserved"] },
    },
  });
}

async function countServices(workspaceId) {
  return TradeServiceProvider.count({
    where: {
      workspaceId,
      status: { [Op.in]: ["pending", "approved"] },
    },
  });
}

async function countTeamMembers(workspaceId) {
  return WorkspaceMember.count({
    where: { workspaceId, status: { [Op.in]: ["active", "invited"] } },
  });
}

async function countPostsThisMonth(workspaceId) {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return SupplierPost.count({
    where: {
      workspaceId,
      createdAt: { [Op.gte]: start },
    },
  });
}

/**
 * قبل از ایجاد موجودی / خدمت / عضو / پست بررسی سقف پلن
 * مدیرکل و مدیر سامانه بدون نیاز به پلن — نامحدود
 */
async function assertCanCreateLot(workspaceId, actor = null) {
  if (actor && isAdmin(actor)) return;
  const { limits } = await resolvePlanLimits(workspaceId);
  if (limits.activeLots == null) return;
  const n = await countActiveLots(workspaceId);
  if (n >= limits.activeLots) {
    throw limitExceededError(`سقف محصولات فعال پلن شما ${limits.activeLots} است. برای افزایش، اشتراک را ارتقا دهید.`);
  }
}

async function assertCanCreateService(workspaceId, actor = null) {
  if (actor && isAdmin(actor)) return;
  const { limits } = await resolvePlanLimits(workspaceId);
  if (limits.tradeServices == null) return;
  const n = await countServices(workspaceId);
  if (n >= limits.tradeServices) {
    throw limitExceededError(`سقف خدمات پلن شما ${limits.tradeServices} است.`);
  }
}

async function assertCanAddMember(workspaceId, actor = null) {
  if (actor && isAdmin(actor)) return;
  const { limits } = await resolvePlanLimits(workspaceId);
  if (limits.teamMembers == null) return;
  const n = await countTeamMembers(workspaceId);
  if (n >= limits.teamMembers) {
    throw limitExceededError(`سقف اعضای تیم پلن شما ${limits.teamMembers} است.`);
  }
}

async function assertCanCreatePost(workspaceId, actor = null) {
  if (actor && isAdmin(actor)) return;
  const { limits } = await resolvePlanLimits(workspaceId);
  if (limits.postsPerMonth == null) return;
  const n = await countPostsThisMonth(workspaceId);
  if (n >= limits.postsPerMonth) {
    throw limitExceededError(`سقف پست ماهانه پلن شما ${limits.postsPerMonth} است.`);
  }
}

async function assertListingLocales(workspaceId, localeCount, actor = null) {
  if (actor && isAdmin(actor)) return;
  const { limits } = await resolvePlanLimits(workspaceId);
  if (limits.listingLocales == null) return;
  if (Number(localeCount) > limits.listingLocales) {
    throw limitExceededError(`سقف زبان‌های آگهی پلن شما ${limits.listingLocales} است.`);
  }
}

async function countLandingPages(workspaceId) {
  const ProductLandingPage = require("../productLanding/model");
  return ProductLandingPage.count({
    where: {
      workspaceId,
      status: { [Op.in]: ["draft", "published"] },
    },
  });
}

async function assertCanCreateLandingPage(workspaceId, actor = null) {
  if (actor && isAdmin(actor)) return;
  const { limits } = await resolvePlanLimits(workspaceId);
  if (limits.landingPages == null) return;
  if (Number(limits.landingPages) <= 0) {
    throw limitExceededError(
      "لندینگ محصول در پلن فعلی فعال نیست. برای ساخت لندینگ، اشتراک را ارتقا دهید."
    );
  }
  const n = await countLandingPages(workspaceId);
  if (n >= limits.landingPages) {
    throw limitExceededError(
      `سقف لندینگ محصول پلن شما ${limits.landingPages} است. برای افزایش، اشتراک را ارتقا دهید.`
    );
  }
}

async function getWorkspaceUsage(workspaceId, actor = null) {
  const { planId, limits, billingPeriod, adminBypass } = await resolvePlanLimits(workspaceId, actor);
  const [lots, services, members, posts, landings] = await Promise.all([
    countActiveLots(workspaceId),
    countServices(workspaceId),
    countTeamMembers(workspaceId),
    countPostsThisMonth(workspaceId),
    countLandingPages(workspaceId),
  ]);
  return {
    planId,
    billingPeriod,
    limits,
    adminBypass: !!adminBypass,
    usage: {
      activeLots: lots,
      tradeServices: services,
      teamMembers: members,
      postsThisMonth: posts,
      landingPages: landings,
    },
  };
}

module.exports = {
  resolvePlanLimits,
  getActiveWorkspaceSubscription,
  assertCanCreateLot,
  assertCanCreateService,
  assertCanAddMember,
  assertCanCreatePost,
  assertListingLocales,
  assertCanCreateLandingPage,
  getWorkspaceUsage,
  countActiveLots,
  countServices,
  countTeamMembers,
  countLandingPages,
  ADMIN_UNLIMITED_LIMITS,
};
