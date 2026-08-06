const TEMPLATE_VERSION = "1.0.0";

const PROJECT_STATUSES = [
  "draft",
  "active",
  "on_hold",
  "completed",
  "cancelled",
];

const STEP_STATUSES = [
  "locked",
  "ready",
  "in_progress",
  "waiting_for_provider",
  "waiting_for_document",
  "needs_revision",
  "completed",
  "optional",
  "not_applicable",
];

const TRANSPORT_MODES = ["sea", "air", "road", "rail", "multimodal", "unspecified"];

const INCOTERMS = [
  "EXW",
  "FCA",
  "FAS",
  "FOB",
  "CFR",
  "CIF",
  "CPT",
  "CIP",
  "DAP",
  "DPU",
  "DDP",
  "unspecified",
];

const PAYMENT_METHODS = [
  "advance",
  "cad",
  "lc",
  "open_account",
  "escrow",
  "barter",
  "unspecified",
];

const CUSTOMER_TYPES = [
  "importer",
  "distributor",
  "manufacturer",
  "retailer",
  "government",
  "unknown",
];

const EXPORT_FAMILIES = [
  "agro-raw",
  "food-processed",
  "perishable-cold-chain",
  "fertilizer-agri-input",
  "chemical-dangerous-goods",
  "minerals",
  "industrial-parts",
  "machinery",
  "construction-materials",
  "textile-consumer-goods",
  "general",
];

const PHASES = [
  { id: "prepare", titleFa: "آماده‌سازی کالا و بازار", order: 1 },
  { id: "compliance", titleFa: "انطباق و مجوزها", order: 2 },
  { id: "commercial", titleFa: "مذاکره و قرارداد", order: 3 },
  { id: "logistics", titleFa: "بسته‌بندی و لجستیک", order: 4 },
  { id: "customs", titleFa: "گمرک و اسناد", order: 5 },
  { id: "shipment", titleFa: "حمل و تحویل", order: 6 },
  { id: "aftercare", titleFa: "پس از ارسال", order: 7 },
];

const DISCLAIMER_FA =
  "مسیر نمایش‌داده‌شده یک راهنمای عملیاتی زارعُون است و جایگزین مشاوره حقوقی، گمرکی یا مجوز قطعی نیست. الزامات نهایی باید با گمرک، سازمان‌های مسئول و متخصص مربوطه بررسی شود.";

module.exports = {
  TEMPLATE_VERSION,
  PROJECT_STATUSES,
  STEP_STATUSES,
  TRANSPORT_MODES,
  INCOTERMS,
  PAYMENT_METHODS,
  CUSTOMER_TYPES,
  EXPORT_FAMILIES,
  PHASES,
  DISCLAIMER_FA,
};
