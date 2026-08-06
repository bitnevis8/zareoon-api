/**
 * Logical service keys → real trade L1/L2 in Zareoon catalog.
 * Deep-link: /trade-services/{categoryId}?sub={sub}
 */
const SERVICE_MAP = {
  "goods-preparation": {
    categoryId: "packaging-prep",
    sub: "goods-preparation",
    titleFa: "آماده‌سازی کالا و مشخصات",
  },
  "laboratory-testing": {
    categoryId: "inspection-standards",
    sub: "testing",
    titleFa: "آزمون و آزمایش کالا",
  },
  "quality-inspection": {
    categoryId: "inspection-standards",
    sub: "quality-control",
    titleFa: "کنترل کیفیت",
  },
  "export-packaging": {
    categoryId: "packaging-prep",
    sub: "export-packaging",
    titleFa: "بسته‌بندی صادراتی",
  },
  "destination-labeling": {
    categoryId: "packaging-prep",
    sub: "commercial-labeling",
    titleFa: "لیبل و چاپ تجاری",
  },
  "customs-clearance": {
    categoryId: "customs-clearance",
    sub: "customs-brokerage",
    titleFa: "ترخیص و کارگزاری گمرکی",
  },
  "international-logistics": {
    categoryId: "intl-logistics",
    sub: null,
    titleFa: "حمل‌ونقل بین‌المللی",
  },
  "sea-freight": {
    categoryId: "intl-logistics",
    sub: "sea-freight",
    titleFa: "حمل دریایی",
  },
  "air-freight": {
    categoryId: "intl-logistics",
    sub: "air-freight",
    titleFa: "حمل هوایی",
  },
  "cold-chain-logistics": {
    categoryId: "intl-logistics",
    sub: "cold-chain",
    titleFa: "زنجیره سرد",
  },
  "dangerous-goods-logistics": {
    categoryId: "intl-logistics",
    sub: "dangerous-goods",
    titleFa: "حمل کالای خطرناک",
  },
  "cargo-insurance": {
    categoryId: "insurance-risk",
    sub: "cargo-insurance",
    titleFa: "بیمه باربری",
  },
  "export-consulting": {
    categoryId: "import-export",
    sub: "export-mgmt",
    titleFa: "مدیریت صادرات",
  },
  "find-buyer": {
    categoryId: "import-export",
    sub: "find-buyer",
    titleFa: "پیدا کردن خریدار خارجی",
  },
  "export-compliance": {
    categoryId: "export-compliance",
    sub: "export-regulations",
    titleFa: "انطباق مقررات صادرات",
  },
  "legal-contract": {
    categoryId: "legal-trade",
    sub: "sales-contracts",
    titleFa: "قرارداد فروش",
  },
  "payment-and-escrow": {
    categoryId: "intl-finance",
    sub: "letter-of-credit",
    titleFa: "خدمات مالی و LC",
  },
  "trade-documents": {
    categoryId: "trade-documents",
    sub: "shipping-docs",
    titleFa: "اسناد حمل و بازرگانی",
  },
  "intl-certificates": {
    categoryId: "intl-certificates",
    sub: "product-certificates",
    titleFa: "گواهینامه‌های بین‌المللی",
  },
  "market-development": {
    categoryId: "market-development",
    sub: "buyer-acquisition",
    titleFa: "توسعه بازار و جذب خریدار",
  },
};

function resolveServiceLinks(keys = []) {
  const out = [];
  const seen = new Set();
  for (const key of keys) {
    const mapped = SERVICE_MAP[key];
    if (!mapped) continue;
    const fingerprint = `${mapped.categoryId}:${mapped.sub || ""}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const path = mapped.sub
      ? `/trade-services/${mapped.categoryId}?sub=${encodeURIComponent(mapped.sub)}`
      : `/trade-services/${mapped.categoryId}`;
    out.push({
      key,
      categoryId: mapped.categoryId,
      subcategoryId: mapped.sub,
      titleFa: mapped.titleFa || key,
      href: path,
    });
  }
  return out;
}

module.exports = { SERVICE_MAP, resolveServiceLinks };
