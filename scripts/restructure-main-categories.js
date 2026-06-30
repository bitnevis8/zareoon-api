/**
 * Restructure product seeder: 12 main roots; existing catalog under کشاورزی;
 * metal powders under فلزات و معدن.
 *
 * Main root IDs use 900001–900012 to avoid collision with livestock IDs 10001–10009.
 */
const fs = require("fs");
const path = require("path");

const seederPath = path.join(__dirname, "../src/modules/farmer/product/seederData.json");
const items = JSON.parse(fs.readFileSync(seederPath, "utf8"));

const MAIN_ROOT_SLUGS = new Set([
  "agriculture",
  "food-products",
  "chemical-petrochemical",
  "metals-mining",
  "building-materials",
  "machinery",
  "electric-electronics",
  "auto-parts",
  "apparel-textiles",
  "home-decor",
  "cosmetics-hygiene",
  "other-goods",
]);

const MAIN_ROOTS = [
  {
    id: 900001,
    name: "کشاورزی",
    slug: "agriculture",
    englishName: "Agriculture",
    description:
      "دسته اصلی «کشاورزی» شامل محصولات کشاورزی، نهاده‌ها، دام و طیور و سایر کالاهای مرتبط با تولید اولیه.",
    sortOrder: 1,
    metaTitle: "کشاورزی",
    metaDescription: "خرید و فروش محصولات و نهاده‌های کشاورزی",
    validUnits: ["kg", "ton", "pack", "box"],
  },
  {
    id: 900002,
    name: "مواد غذایی",
    slug: "food-products",
    englishName: "Food Products",
    description: "دسته اصلی «مواد غذایی» برای کالاهای غذایی فرآوری‌شده و آماده مصرف.",
    sortOrder: 2,
    metaTitle: "مواد غذایی",
    metaDescription: "خرید و فروش مواد غذایی",
    validUnits: ["kg", "ton", "pack", "box"],
  },
  {
    id: 900003,
    name: "شیمیایی و پتروشیمی",
    slug: "chemical-petrochemical",
    englishName: "Chemical & Petrochemical",
    description:
      "دسته اصلی «شیمیایی و پتروشیمی» برای مواد شیمیایی، پتروشیمی و مشتقات صنعتی.",
    sortOrder: 3,
    metaTitle: "شیمیایی و پتروشیمی",
    metaDescription: "خرید و فروش مواد شیمیایی و پتروشیمی",
    validUnits: ["kg", "ton", "pack", "l"],
  },
  {
    id: 900004,
    name: "فلزات و معدن",
    slug: "metals-mining",
    englishName: "Metals & Mining",
    description: "دسته اصلی «فلزات و معدن» شامل فلزات، مواد معدنی و پودرهای فلزی.",
    sortOrder: 4,
    metaTitle: "فلزات و معدن",
    metaDescription: "خرید و فروش فلزات، مواد معدنی و پودرهای فلزی",
    validUnits: ["kg", "ton"],
  },
  {
    id: 900005,
    name: "مصالح ساختمانی",
    slug: "building-materials",
    englishName: "Building Materials",
    description: "دسته اصلی «مصالح ساختمانی» برای سیمان، آهن، سرامیک و مصالح ساخت.",
    sortOrder: 5,
    metaTitle: "مصالح ساختمانی",
    metaDescription: "خرید و فروش مصالح ساختمانی",
    validUnits: ["kg", "ton", "pack"],
  },
  {
    id: 900006,
    name: "ماشین‌آلات",
    slug: "machinery",
    englishName: "Machinery",
    description: "دسته اصلی «ماشین‌آلات» برای تجهیزات و ماشین‌آلات صنعتی و کشاورزی.",
    sortOrder: 6,
    metaTitle: "ماشین‌آلات",
    metaDescription: "خرید و فروش ماشین‌آلات",
    validUnits: ["count", "pack"],
  },
  {
    id: 900007,
    name: "برق و الکترونیک",
    slug: "electric-electronics",
    englishName: "Electric & Electronics",
    description: "دسته اصلی «برق و الکترونیک» برای تجهیزات برقی و الکترونیکی.",
    sortOrder: 7,
    metaTitle: "برق و الکترونیک",
    metaDescription: "خرید و فروش برق و الکترونیک",
    validUnits: ["count", "pack"],
  },
  {
    id: 900008,
    name: "خودرو و قطعات",
    slug: "auto-parts",
    englishName: "Automotive & Parts",
    description: "دسته اصلی «خودرو و قطعات» برای خودرو و قطعات یدکی.",
    sortOrder: 8,
    metaTitle: "خودرو و قطعات",
    metaDescription: "خرید و فروش خودرو و قطعات",
    validUnits: ["count", "pack"],
  },
  {
    id: 900009,
    name: "پوشاک و منسوجات",
    slug: "apparel-textiles",
    englishName: "Apparel & Textiles",
    description: "دسته اصلی «پوشاک و منسوجات» برای پوشاک، پارچه و منسوجات.",
    sortOrder: 9,
    metaTitle: "پوشاک و منسوجات",
    metaDescription: "خرید و فروش پوشاک و منسوجات",
    validUnits: ["count", "pack", "kg"],
  },
  {
    id: 900010,
    name: "خانه و دکور",
    slug: "home-decor",
    englishName: "Home & Decor",
    description: "دسته اصلی «خانه و دکور» برای لوازم خانگی و دکوراسیون.",
    sortOrder: 10,
    metaTitle: "خانه و دکور",
    metaDescription: "خرید و فروش خانه و دکور",
    validUnits: ["count", "pack"],
  },
  {
    id: 900011,
    name: "آرایشی و بهداشتی",
    slug: "cosmetics-hygiene",
    englishName: "Cosmetics & Hygiene",
    description: "دسته اصلی «آرایشی و بهداشتی» برای محصولات آرایشی و بهداشتی.",
    sortOrder: 11,
    metaTitle: "آرایشی و بهداشتی",
    metaDescription: "خرید و فروش آرایشی و بهداشتی",
    validUnits: ["count", "pack", "l"],
  },
  {
    id: 900012,
    name: "سایر کالاها",
    slug: "other-goods",
    englishName: "Other Goods",
    description: "دسته اصلی «سایر کالاها» برای سایر محصولات عمده‌فروشی.",
    sortOrder: 12,
    metaTitle: "سایر کالاها",
    metaDescription: "خرید و فروش سایر کالاها",
    validUnits: ["kg", "ton", "count", "pack"],
  },
];

const AGRICULTURE_ROOT = 900001;
const METALS_ROOT = 900004;
const OLD_ROOT_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 120084]);
const REMOVE_IDS = new Set([13]);
const LEGACY_MAIN_ROOT_IDS = new Set([
  10000, 10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008, 10009, 10010, 10011,
]);

const WHEAT_DUPLICATE_REMAP = {
  1103: 1109,
  1104: 1110,
  1105: 1111,
  1106: 1112,
};

function dedupeLegacyIds(items) {
  const seen = new Set();
  return items.map((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      return item;
    }

    const newId = WHEAT_DUPLICATE_REMAP[item.id];
    if (!newId || item.parentId !== 1001) {
      throw new Error(`Unhandled duplicate id ${item.id} (${item.name})`);
    }

    return { ...item, id: newId };
  });
}

function buildRootNode(def) {
  return {
    id: def.id,
    name: def.name,
    slug: def.slug,
    englishName: def.englishName,
    description: def.description,
    imageUrl: def.imageUrl || null,
    parentId: null,
    isActive: true,
    sortOrder: def.sortOrder,
    isFeatured: def.sortOrder <= 2,
    icon: null,
    validUnits: def.validUnits,
    metaTitle: def.metaTitle,
    metaDescription: def.metaDescription,
    unit: def.validUnits[0] || "kg",
  };
}

// Drop incorrectly prepended main roots (and old root id 13).
const catalog = items.filter((item) => {
  if (REMOVE_IDS.has(item.id)) return false;
  if (item.parentId == null && MAIN_ROOT_SLUGS.has(item.slug)) return false;
  if (LEGACY_MAIN_ROOT_IDS.has(item.id) && item.parentId == null) return false;
  return true;
});

const updated = catalog.map((item) => {
  const next = { ...item };

  if (OLD_ROOT_IDS.has(next.id)) {
    next.parentId = AGRICULTURE_ROOT;
  }

  if (next.parentId === 10000) {
    next.parentId = AGRICULTURE_ROOT;
  }

  if (next.id === 13001) {
    next.parentId = METALS_ROOT;
    next.description =
      "پودرهای فلزی (Metal Powders) از گروه فلزات و معدن؛ مناسب کاربردهای صنعتی، متالورژی و تولید.";
  }

  if (next.id === 13002) {
    next.description =
      "پودر آلومینیوم (Aluminum Powder) از گروه پودرهای فلزی؛ مناسب کاربردهای صنعتی و تولیدی.";
  }

  return next;
});

const newRoots = MAIN_ROOTS.map(buildRootNode);
const result = dedupeLegacyIds([...newRoots, ...updated]);

const idCounts = result.reduce((map, item) => {
  map.set(item.id, (map.get(item.id) || 0) + 1);
  return map;
}, new Map());
const duplicates = [...idCounts.entries()].filter(([, count]) => count > 1);
if (duplicates.length) {
  console.error("Duplicate IDs remain:", duplicates);
  process.exit(1);
}

const roots = result.filter((x) => x.parentId == null);
const underAg = result.filter((x) => x.parentId === AGRICULTURE_ROOT);
const underMetals = result.filter((x) => x.parentId === METALS_ROOT);
const goat = result.find((x) => x.id === 10003);
const goatKids = result.filter((x) => x.parentId === 10003);

if (roots.length !== 12) {
  console.error("Expected 12 main roots, got", roots.length);
  process.exit(1);
}

if (goat?.name !== "بز" || goatKids.some((x) => !x.name.includes("بز"))) {
  console.error("Goat category integrity check failed:", goat?.name, goatKids.map((x) => x.name));
  process.exit(1);
}

fs.writeFileSync(seederPath, JSON.stringify(result, null, 2) + "\n", "utf8");

console.log("Main roots:", roots.map((r) => `${r.id}:${r.name}`).join(" | "));
console.log("Under کشاورزی:", underAg.length, "→", underAg.map((x) => x.name).join(", "));
console.log("Under فلزات:", underMetals.map((x) => x.name).join(", "));
console.log("Goat (id 10003) parent:", goat?.parentId, "children:", goatKids.map((x) => x.name).join(", "));
console.log("Total items:", result.length);
