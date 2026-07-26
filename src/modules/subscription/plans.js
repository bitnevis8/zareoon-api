/**
 * سازگاری با مسیر قدیمی /subscription
 * حقیقت پلن‌ها در workspace/plans است؛ اینجا شکل قدیمی (قیمت ماهانه) برمی‌گردد.
 */
const {
  PLANS: WORKSPACE_PLANS,
  PLAN_IDS,
  BILLING_PERIODS,
  getPlanById: getWorkspacePlan,
  planTotalMonths: workspacePlanTotalMonths,
  PLAN_MONTHLY_PRICE_TOMAN,
  publicPlan: workspacePublicPlan,
  priceForPlanPeriod,
} = require("../workspace/plans");

const PLANS = WORKSPACE_PLANS.map((p) => ({
  id: p.id,
  name: p.name,
  durationMonths: p.id === PLAN_IDS.FREE ? 0 : 1,
  bonusMonths: 0,
  priceToman: PLAN_MONTHLY_PRICE_TOMAN[p.id] || 0,
  badge: p.highlight ? "پیشنهادی" : null,
  highlight: p.highlight,
  limits: p.limits,
  features: p.features,
  badgeKind: p.badgeKind,
}));

function getPlanById(planId) {
  const p = getWorkspacePlan(planId);
  if (!p) return null;
  return PLANS.find((x) => x.id === p.id) || null;
}

function planTotalMonths(plan) {
  return workspacePlanTotalMonths(plan, BILLING_PERIODS.MONTHLY);
}

module.exports = {
  PLANS,
  getPlanById,
  planTotalMonths,
  PLAN_IDS,
  BILLING_PERIODS,
  priceForPlanPeriod,
  workspacePublicPlan,
};
