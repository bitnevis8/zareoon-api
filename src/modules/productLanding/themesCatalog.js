/**
 * تم‌ها / پالت‌ها / پترن‌ها — همگام با فرانت (فقط ۳ تم)
 */
const THEMES = [
  { id: "atelier", nameFa: "حرفه‌ای", nameEn: "Professional", descFa: "B2B و صادرات" },
  { id: "soft", nameFa: "نرم", nameEn: "Soft", descFa: "غذایی و مصرفی" },
  { id: "tech", nameFa: "صنعتی", nameEn: "Industrial", descFa: "فنی و ماشین‌آلات" },
];

const PALETTES = [
  { id: "forest", nameFa: "جنگل", nameEn: "Forest" },
  { id: "ink", nameFa: "مرکب", nameEn: "Ink" },
  { id: "ocean", nameFa: "اقیانوس", nameEn: "Ocean" },
  { id: "slate-night", nameFa: "شب", nameEn: "Night" },
  { id: "sand", nameFa: "شن", nameEn: "Sand" },
  { id: "berry", nameFa: "توت", nameEn: "Berry" },
  { id: "citrus", nameFa: "مرکبات", nameEn: "Citrus" },
  { id: "graphite", nameFa: "گرافیت", nameEn: "Graphite" },
  { id: "olive", nameFa: "زیتون", nameEn: "Olive" },
  { id: "royal", nameFa: "رویال", nameEn: "Royal" },
];

const PATTERNS = [
  { id: "none", nameFa: "بدون پترن", nameEn: "None" },
  { id: "dots", nameFa: "نقطه", nameEn: "Dots" },
  { id: "grid", nameFa: "شبکه", nameEn: "Grid" },
  { id: "mesh", nameFa: "مش نرم", nameEn: "Soft mesh" },
  { id: "diagonal", nameFa: "مورب", nameEn: "Diagonal" },
  { id: "waves", nameFa: "موج", nameEn: "Waves" },
  { id: "noise", nameFa: "دانه‌ای", nameEn: "Grain" },
  { id: "hex", nameFa: "شش‌ضلعی", nameEn: "Hex" },
];

const PRODUCT_DISPLAY_MODES = [
  { id: "catalog", nameFa: "کاتالوگ + لینک صفحه حرفه‌ای" },
  { id: "landing", nameFa: "ورود مستقیم به لندینگ" },
  { id: "catalog_only", nameFa: "فقط کاتالوگ" },
];

const THEME_IDS = THEMES.map((t) => t.id);
const PALETTE_IDS = PALETTES.map((p) => p.id);
const PATTERN_IDS = PATTERNS.map((p) => p.id);

const THEME_ALIASES = {
  editorial: "atelier",
  heritage: "atelier",
  export: "atelier",
  modern: "soft",
  minimal: "atelier",
  industrial: "tech",
  dark: "tech",
};

function resolveThemeId(id) {
  const raw = String(id || "atelier");
  if (THEME_ALIASES[raw]) return THEME_ALIASES[raw];
  if (THEME_IDS.includes(raw)) return raw;
  return "atelier";
}

module.exports = {
  THEMES,
  THEME_IDS,
  PALETTES,
  PALETTE_IDS,
  PATTERNS,
  PATTERN_IDS,
  PRODUCT_DISPLAY_MODES,
  THEME_ALIASES,
  resolveThemeId,
};
