/**
 * کاتالوگ اشتراک فروشندگان — سطوح: رایگان / برنزی / نقره‌ای / طلایی
 *
 * `limits` منبع حقیقت برای اعمال محدودیت در آینده است.
 * `features` متن نمایشی صفحهٔ قیمت‌گذاری (باید با limits هم‌خوان باشد).
 *
 * null در یک فیلد عددی = بدون سقف عملیاتی (نامحدود در UI).
 */
const PLANS = [
  {
    id: "free",
    name: "رایگان",
    durationMonths: 0,
    bonusMonths: 0,
    priceToman: 0,
    badge: null,
    highlight: false,
    limits: {
      activeLots: 3,
      imagesPerLot: 3,
      activeVideos: 0,
      postsPerMonth: 5,
      tradeServices: 1,
      listingLocales: 1,
      searchBoost: 0,
      featuredBadge: false,
      analytics: false,
      support: "standard",
    },
    features: [
      "تا ۳ موجودی فعال هم‌زمان",
      "تا ۳ تصویر برای هر محصول",
      "تا ۵ پست در ماه",
      "پروفایل فروشنده و دریافت پیام خریدار",
      "نمایش شماره تماس در آگهی",
      "۱ خدمت در صفحهٔ خدمات بازرگانی",
    ],
  },
  {
    id: "bronze",
    name: "برنزی",
    durationMonths: 1,
    bonusMonths: 0,
    priceToman: 490_000,
    badge: null,
    highlight: false,
    limits: {
      activeLots: 15,
      imagesPerLot: 6,
      activeVideos: 1,
      postsPerMonth: 20,
      tradeServices: 3,
      listingLocales: 2,
      searchBoost: 1,
      featuredBadge: false,
      analytics: false,
      support: "standard",
    },
    features: [
      "همهٔ امکانات رایگان",
      "تا ۱۵ موجودی فعال هم‌زمان",
      "تا ۶ تصویر برای هر محصول",
      "۱ ویدئو محصول فعال",
      "تا ۲۰ پست در ماه",
      "تا ۳ خدمت بازرگانی",
      "اولویت نمایش برنزی در نتایج جستجو",
      "محتوای آگهی تا ۲ زبان",
    ],
  },
  {
    id: "silver",
    name: "نقره‌ای",
    durationMonths: 1,
    bonusMonths: 0,
    priceToman: 990_000,
    badge: "پیشنهادی",
    highlight: true,
    limits: {
      activeLots: 50,
      imagesPerLot: 10,
      activeVideos: 5,
      postsPerMonth: 60,
      tradeServices: 10,
      listingLocales: 4,
      searchBoost: 2,
      featuredBadge: true,
      analytics: true,
      support: "priority",
    },
    features: [
      "همهٔ امکانات برنزی",
      "تا ۵۰ موجودی فعال هم‌زمان",
      "تا ۱۰ تصویر برای هر محصول",
      "تا ۵ ویدئو محصول فعال",
      "تا ۶۰ پست در ماه",
      "تا ۱۰ خدمت بازرگانی",
      "اولویت نمایش نقره‌ای + نشان ویژه روی پروفایل",
      "محتوای آگهی تا ۴ زبان",
      "آمار بازدید آگهی و پروفایل",
      "پشتیبانی با اولویت بالاتر",
    ],
  },
  {
    id: "gold",
    name: "طلایی",
    durationMonths: 1,
    bonusMonths: 0,
    priceToman: 1_990_000,
    badge: null,
    highlight: false,
    limits: {
      activeLots: null,
      imagesPerLot: 15,
      activeVideos: 20,
      postsPerMonth: null,
      tradeServices: null,
      listingLocales: null,
      searchBoost: 3,
      featuredBadge: true,
      analytics: true,
      support: "dedicated",
    },
    features: [
      "همهٔ امکانات نقره‌ای",
      "موجودی فعال بدون سقف",
      "تا ۱۵ تصویر برای هر محصول",
      "تا ۲۰ ویدئو محصول فعال",
      "پست ماهانه بدون سقف",
      "خدمات بازرگانی بدون سقف",
      "بالاترین اولویت نمایش + نشان طلایی",
      "محتوای آگهی در همهٔ زبان‌های سایت",
      "آمار کامل بازدید و عملکرد",
      "پشتیبانی اختصاصی فروشنده",
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
