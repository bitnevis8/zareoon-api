const PLANS = [
  {
    id: "free",
    name: "رایگان",
    durationMonths: 0,
    bonusMonths: 0,
    priceToman: 0,
    badge: null,
    highlight: false,
    features: [
      "ثبت و نمایش آگهی",
      "نمایش شماره تماس",
      "دریافت پیام از خریداران",
      "پروفایل پایه فروشنده",
    ],
  },
  {
    id: "pro_3m",
    name: "۳ ماهه",
    durationMonths: 3,
    bonusMonths: 0,
    priceToman: 3_000_000,
    badge: null,
    highlight: false,
    features: [
      "ثبت نامحدود محصول",
      "نمایش بهتر در نتایج",
      "پشتیبانی عادی",
      "۱ ظرفیت ویدئو محصول",
    ],
  },
  {
    id: "pro_6m",
    name: "۶ ماهه",
    durationMonths: 6,
    bonusMonths: 0,
    priceToman: 5_000_000,
    badge: "پیشنهادی",
    highlight: true,
    features: [
      "ثبت نامحدود محصول",
      "نمایش بهتر در نتایج",
      "پشتیبانی ویژه",
      "۲ ظرفیت ویدئو محصول",
    ],
  },
  {
    id: "pro_12m",
    name: "۱۲ ماهه",
    durationMonths: 12,
    bonusMonths: 0,
    priceToman: 10_000_000,
    badge: null,
    highlight: false,
    features: [
      "ثبت نامحدود محصول",
      "نمایش بهتر در نتایج",
      "پشتیبانی ویژه",
      "۵ ظرفیت ویدئو محصول",
    ],
  },
];

function getPlanById(planId) {
  return PLANS.find((p) => p.id === planId) || null;
}

function planTotalMonths(plan) {
  if (!plan || plan.id === "free") return 0;
  return (plan.durationMonths || 0) + (plan.bonusMonths || 0);
}

module.exports = { PLANS, getPlanById, planTotalMonths };
