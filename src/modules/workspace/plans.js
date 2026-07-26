/**
 * پلن متعلق به Workspace است؛ امکانات از دوره پرداخت جداست.
 * قیمت = ترکیب planId × billingPeriod
 */

const PLAN_IDS = {
  FREE: "free",
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
};

const BILLING_PERIODS = {
  NONE: "none",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  SEMIANNUAL: "semiannual",
  ANNUAL: "annual",
};

const BILLING_PERIOD_META = {
  [BILLING_PERIODS.NONE]: { months: 0, labelFa: "—" },
  [BILLING_PERIODS.MONTHLY]: { months: 1, labelFa: "ماهانه" },
  [BILLING_PERIODS.QUARTERLY]: { months: 3, labelFa: "سه‌ماهه" },
  [BILLING_PERIODS.SEMIANNUAL]: { months: 6, labelFa: "شش‌ماهه" },
  [BILLING_PERIODS.ANNUAL]: { months: 12, labelFa: "سالانه" },
};

/** null = بدون سقف */
const PLANS = [
  {
    id: PLAN_IDS.FREE,
    name: "رایگان",
    nameEn: "Free",
    highlight: false,
    badgeKind: null,
    limits: {
      activeLots: 3,
      tradeServices: 1,
      teamMembers: 1,
      listingLocales: 1,
      analyticsDays: 0,
      featuredCredits: 0,
      imagesPerLot: 3,
      activeVideos: 0,
      postsPerMonth: 5,
      searchBoost: 0,
      featuredBadge: false,
      support: "standard",
    },
    features: [
      "تا ۳ محصول فعال",
      "۱ خدمت",
      "۱ عضو تیم (مالک)",
      "۱ زبان",
      "بدون آمار پیشرفته",
    ],
  },
  {
    id: PLAN_IDS.BRONZE,
    name: "برنزی",
    nameEn: "Bronze",
    highlight: false,
    badgeKind: "bronze",
    limits: {
      activeLots: 25,
      tradeServices: 5,
      teamMembers: 2,
      listingLocales: 2,
      analyticsDays: 30,
      featuredCredits: 2,
      imagesPerLot: 6,
      activeVideos: 2,
      postsPerMonth: 20,
      searchBoost: 1,
      featuredBadge: false,
      support: "standard",
    },
    features: [
      "تا ۲۵ محصول فعال",
      "تا ۵ خدمت",
      "تا ۲ عضو تیم",
      "تا ۲ زبان",
      "آمار ۳۰ روزه",
      "۲ اعتبار ویژه‌سازی",
    ],
  },
  {
    id: PLAN_IDS.SILVER,
    name: "نقره‌ای",
    nameEn: "Silver",
    highlight: true,
    badgeKind: "silver",
    limits: {
      activeLots: 100,
      tradeServices: 20,
      teamMembers: 5,
      listingLocales: 4,
      analyticsDays: 180,
      featuredCredits: 8,
      imagesPerLot: 10,
      activeVideos: 8,
      postsPerMonth: 60,
      searchBoost: 2,
      featuredBadge: true,
      support: "priority",
    },
    features: [
      "تا ۱۰۰ محصول فعال",
      "تا ۲۰ خدمت",
      "تا ۵ عضو تیم",
      "تا ۴ زبان",
      "آمار ۱۸۰ روزه",
      "۸ اعتبار ویژه‌سازی",
      "نشان ویژه پروفایل",
    ],
  },
  {
    id: PLAN_IDS.GOLD,
    name: "طلایی",
    nameEn: "Gold",
    highlight: false,
    badgeKind: "gold",
    limits: {
      activeLots: null,
      tradeServices: null,
      teamMembers: 20,
      listingLocales: null,
      analyticsDays: 365,
      featuredCredits: 30,
      imagesPerLot: 15,
      activeVideos: 20,
      postsPerMonth: null,
      searchBoost: 3,
      featuredBadge: true,
      support: "dedicated",
    },
    features: [
      "محصول بدون سقف",
      "خدمت بدون سقف",
      "تا ۲۰ عضو تیم",
      "همه زبان‌های سایت",
      "آمار ۳۶۵ روزه",
      "۳۰ اعتبار ویژه‌سازی",
      "بالاترین اولویت نمایش",
    ],
  },
];

/**
 * قیمت پایه ماهانه (تومان) — دوره‌های بلندتر می‌توانند تخفیف داشته باشند
 */
const PLAN_MONTHLY_PRICE_TOMAN = {
  [PLAN_IDS.FREE]: 0,
  [PLAN_IDS.BRONZE]: 490_000,
  [PLAN_IDS.SILVER]: 990_000,
  [PLAN_IDS.GOLD]: 1_990_000,
};

/** ضریب دوره نسبت به ماهانه (تخفیف دوره‌های بلندتر) */
const PERIOD_PRICE_MULTIPLIER = {
  [BILLING_PERIODS.NONE]: 0,
  [BILLING_PERIODS.MONTHLY]: 1,
  [BILLING_PERIODS.QUARTERLY]: 2.7,
  [BILLING_PERIODS.SEMIANNUAL]: 5.1,
  [BILLING_PERIODS.ANNUAL]: 9.5,
};

function getPlanById(planId) {
  return PLANS.find((p) => p.id === planId) || null;
}

function getBillingPeriodMeta(period) {
  return BILLING_PERIOD_META[period] || BILLING_PERIOD_META[BILLING_PERIODS.NONE];
}

function priceForPlanPeriod(planId, billingPeriod) {
  if (planId === PLAN_IDS.FREE || billingPeriod === BILLING_PERIODS.NONE) return 0;
  const monthly = PLAN_MONTHLY_PRICE_TOMAN[planId] || 0;
  const mult = PERIOD_PRICE_MULTIPLIER[billingPeriod] ?? 1;
  return Math.round(monthly * mult);
}

function periodMonths(billingPeriod) {
  return getBillingPeriodMeta(billingPeriod).months || 0;
}

/** سازگاری با کد قدیمی اشتراک کاربر که durationMonths می‌خواست */
function planTotalMonths(plan, billingPeriod = BILLING_PERIODS.MONTHLY) {
  if (!plan || plan.id === PLAN_IDS.FREE) return 0;
  if (billingPeriod) return periodMonths(billingPeriod);
  return 1;
}

function publicPlan(plan, billingPeriod = BILLING_PERIODS.MONTHLY) {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    nameEn: plan.nameEn,
    highlight: plan.highlight,
    badgeKind: plan.badgeKind,
    limits: plan.limits,
    features: plan.features,
    billingPeriod,
    billingPeriodLabel: getBillingPeriodMeta(billingPeriod).labelFa,
    priceToman: priceForPlanPeriod(plan.id, billingPeriod),
    durationMonths: periodMonths(billingPeriod),
  };
}

module.exports = {
  PLAN_IDS,
  BILLING_PERIODS,
  BILLING_PERIOD_META,
  PLANS,
  PLAN_MONTHLY_PRICE_TOMAN,
  PERIOD_PRICE_MULTIPLIER,
  getPlanById,
  getBillingPeriodMeta,
  priceForPlanPeriod,
  periodMonths,
  planTotalMonths,
  publicPlan,
};
