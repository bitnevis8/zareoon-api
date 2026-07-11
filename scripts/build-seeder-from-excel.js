/**
 * Build seederDataNew.json from categories_parent_child.xlsx
 * Structure matches legacy seederData.json; merges old items missing from Excel.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { applyCategoryTranslations } = require("./apply-category-translations");

const PRODUCT_DIR = path.join(__dirname, "../src/modules/farmer/product");
const EXCEL_PATH = path.join(PRODUCT_DIR, "categories_parent_child.xlsx");
const OLD_PATH = path.join(PRODUCT_DIR, "seederData.json");
const OUT_PATH = path.join(PRODUCT_DIR, "seederDataNew.json");
const FINAL_OUT_PATH = path.join(PRODUCT_DIR, "seederDataFinal.json");

const OLD_MAIN_ROOT_IDS = new Set([
  900001, 900002, 900003, 900004, 900005, 900006,
  900007, 900008, 900009, 900010, 900011, 900012,
]);

const ROOT_ID_START = 900001;

function normName(value) {
  return String(value || "")
    .replace(/\u200c/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const OLD_MAIN_ROOT_NAME_MAP = {
  [normName("کشاورزی")]: normName("کشاورزی"),
  [normName("مواد غذایی")]: normName("فرآورده های غذایی"),
  [normName("شیمیایی و پتروشیمی")]: normName("فلزات، مواد معدنی و شیمیایی"),
  [normName("فلزات و معدن")]: normName("فلزات، مواد معدنی و شیمیایی"),
  [normName("مصالح ساختمانی")]: normName("خانه و مصالح ساختمانی"),
  [normName("ماشین‌آلات")]: normName("ماشین آلات و تجهیزات صنعتی"),
  [normName("ماشین آلات")]: normName("ماشین آلات و تجهیزات صنعتی"),
  [normName("برق و الکترونیک")]: normName("لوازم خانگی و الکترونیکی"),
  [normName("خودرو و قطعات")]: normName("خودرو و قطعات"),
  [normName("پوشاک و منسوجات")]: normName("مد، پوشاک و پارچه"),
  [normName("خانه و دکور")]: normName("خانه و مصالح ساختمانی"),
  [normName("آرایشی و بهداشتی")]: normName("آرایشی، بهداشتی و سلامت"),
  [normName("سایر کالاها")]: normName("خانه و مصالح ساختمانی"),
};

function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function pickOldNode(candidates) {
  if (!candidates?.length) return null;
  return [...candidates].sort((a, b) => {
    const score = (node) => {
      let s = 0;
      if (node.slug && !String(node.slug).startsWith("item-")) s += 4;
      if (node.englishName) s += 2;
      if (node.imageUrl) s += 1;
      if (node.description) s += 1;
      return s;
    };
    return score(b) - score(a);
  })[0];
}

function defaultValidUnits(level) {
  if (level === "root") return ["kg", "ton", "pack", "box"];
  if (level === "category") return ["kg", "ton"];
  return ["kg", "ton", "pack"];
}

function stripToLegacyShape(node) {
  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    englishName: node.englishName || null,
    arabicName: node.arabicName || null,
    russianName: node.russianName || null,
    turkishName: node.turkishName || null,
    finnishName: node.finnishName || null,
    description: node.description || null,
    imageUrl: node.imageUrl || null,
    parentId: node.parentId ?? null,
    isActive: node.isActive !== false,
    sortOrder: node.sortOrder,
    isFeatured: Boolean(node.isFeatured),
    icon: node.icon || null,
    validUnits: node.validUnits || defaultValidUnits("product"),
    metaTitle: node.metaTitle || node.name,
    metaDescription: node.metaDescription || `خرید و فروش ${node.name}`,
    unit: node.unit || (Array.isArray(node.validUnits) ? node.validUnits[0] : "kg"),
  };
}

function buildNode({
  id,
  name,
  parentId,
  level,
  sortOrder,
  oldNode,
  groupName,
}) {
  const isRoot = level === "root";
  const isCategory = level === "category";
  const validUnits = oldNode?.validUnits || defaultValidUnits(level);
  const slug =
    oldNode?.slug && String(oldNode.slug).trim() && !String(oldNode.slug).startsWith("item-")
      ? oldNode.slug
      : oldNode?.englishName
        ? slugify(oldNode.englishName)
        : isRoot
          ? slugify(name) || `root-${id}`
          : `item-${id}`;

  let description = oldNode?.description;
  if (!description) {
    if (isRoot) {
      description = `دسته اصلی «${name}»؛ مناسب خرید و فروش عمده و جزئی.`;
    } else if (isCategory) {
      description = `دسته «${name}» شامل زیرمجموعه‌ها و محصولات مرتبط. مناسب خرید و فروش عمده و جزئی.`;
    } else {
      const en = oldNode?.englishName ? ` (${oldNode.englishName})` : "";
      description = `${name}${en} از گروه ${groupName || "محصولات"}؛ مناسب خرید و فروش عمده و جزئی.`;
    }
  }

  return stripToLegacyShape({
    id,
    name,
    slug,
    englishName: oldNode?.englishName || null,
    description,
    imageUrl: oldNode?.imageUrl || null,
    parentId,
    isActive: oldNode?.isActive !== false,
    sortOrder,
    isFeatured: oldNode?.isFeatured ?? (isRoot && sortOrder <= 2),
    icon: oldNode?.icon || null,
    validUnits,
    metaTitle: oldNode?.metaTitle || (isCategory || isRoot ? name : `خرید و فروش ${name}`),
    metaDescription:
      oldNode?.metaDescription ||
      (isCategory || isRoot
        ? `خرید و فروش ${name}`
        : `انواع ${name}؛ ثبت آگهی خرید یا فروش به صورت عمده و جزئی.`),
    unit: oldNode?.unit || validUnits[0] || "kg",
  });
}

function readExcelRows() {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const data = [];

  for (let i = 1; i < rows.length; i += 1) {
    const [parent, child, product] = rows[i].map((cell) => String(cell || "").trim());
    if (!parent || !child || !product) continue;
    data.push({ parent, child, product });
  }

  return data;
}

function indexOldByName(oldItems) {
  const byName = new Map();
  for (const item of oldItems) {
    const key = normName(item.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(item);
  }
  return byName;
}

function buildOldParentMap(oldItems) {
  const byId = new Map(oldItems.map((item) => [item.id, item]));
  return byId;
}

function findParentInNewTree(oldItem, oldById, newByNormName, newById) {
  let current = oldItem;
  const visited = new Set();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);

    const mapped = newById.get(current.id);
    if (mapped) return mapped.id;

    const byName = newByNormName.get(normName(current.name));
    if (byName) return byName.id;

    if (current.parentId == null) break;

    const parent = oldById.get(current.parentId);
    if (parent && OLD_MAIN_ROOT_IDS.has(parent.id)) {
      const mappedRootName = OLD_MAIN_ROOT_NAME_MAP[normName(parent.name)];
      if (mappedRootName) {
        const mappedRoot = newByNormName.get(mappedRootName);
        if (mappedRoot) return mappedRoot.id;
      }
    }

    current = parent;
  }

  return null;
}

const OLD_AUTO_ROOT_ID = 900008;
const AUTO_ROOT_NEW_ID = 900011;
const AUTO_TIRE_PRODUCT_IDS = new Set([200631, 200632]);

/** Supplemental catalog under کشاورزی (not in Excel). */
const AG_SUPPLEMENTAL_CATALOG = [
  {
    l2Name: "قهوه",
    oldL2Ref: 120084,
    products: [{ name: "قهوه سبز", oldRef: 120085 }],
  },
  {
    l2Name: "کاکائو",
    products: [{ name: "دانه کاکائو" }],
  },
];

/** Full 3-level catalog for خودرو و قطعات (not in Excel). */
const AUTO_PARTS_CATALOG = [
  {
    l2Name: "خودرو",
    products: [
      "خودرو سواری",
      "خودرو تجاری",
      "کامیون و کشنده",
      "اتوبوس و مینی‌بوس",
      "خودرو برقی و هیبریدی",
    ],
  },
  {
    l2Name: "قطعات موتور",
    products: [
      "موتور کامل",
      "پیستون",
      "رینگ پیستون",
      "شاتون",
      "میل‌لنگ",
      "سرسیلندر",
      "سوپاپ",
    ],
  },
  {
    l2Name: "سیستم انتقال قدرت",
    products: ["گیربکس", "کلاچ", "دیسک و صفحه", "فلایویل", "دیفرانسیل"],
  },
  {
    l2Name: "سیستم ترمز و تعلیق",
    products: ["لنت ترمز", "دیسک ترمز", "کالیپر ترمز", "کمک فنر", "جلوبندی", "فرمان"],
  },
  {
    l2Name: "قطعات برقی و الکترونیکی",
    products: ["باتری خودرو", "دینام", "استارت", "ECU", "سنسور", "چراغ خودرو"],
  },
  {
    l2Name: "قطعات مصرفی خودرو",
    products: [
      "فیلتر روغن",
      "فیلتر هوا",
      "فیلتر سوخت",
      "شمع خودرو",
      "تسمه",
      "روغن و روان‌کننده",
    ],
  },
  {
    l2Name: "لاستیک و رینگ",
    products: [
      "لاستیک سواری",
      "لاستیک کامیون",
      "لاستیک ماشین‌آلات",
      "رینگ خودرو (فولادی و آلومینیومی)",
    ],
  },
  {
    l2Name: "بدنه و قطعات ظاهری",
    products: ["سپر", "درب خودرو", "کاپوت", "گلگیر", "آینه", "شیشه خودرو"],
  },
  {
    l2Name: "لوازم جانبی خودرو",
    products: ["سیستم صوتی", "دوربین خودرو", "GPS", "کفپوش", "روکش صندلی"],
  },
];

/** Full 3-level catalog for آرایشی، بهداشتی و سلامت. */
const COSMETICS_HEALTH_CATALOG = [
  {
    l2Name: "محصولات آرایشی و بهداشتی",
    products: [
      "لوازم آرایشی",
      "مراقبت پوست",
      "مراقبت مو",
      "بهداشت شخصی",
      "مراقبت بدن",
      "عطر و ادکلن",
      "محصولات بهداشتی کودک",
      "محصولات اصلاح و اپیلاسیون",
      "محصولات ضدعفونی و بهداشتی",
    ],
  },
  {
    l2Name: "تجهیزات زیبایی و آرایشگاهی",
    products: [
      "تجهیزات آرایشگاهی",
      "تجهیزات سالن زیبایی",
      "دستگاه‌های مراقبت پوست",
      "دستگاه‌های مراقبت مو",
      "دستگاه‌های فیشیال",
      "دستگاه‌های اسکالپ",
      "تجهیزات لیزر و جوانسازی",
    ],
  },
  {
    l2Name: "محصولات تخصصی زیبایی",
    products: [
      "محصولات اسکالپ",
      "محصولات کابین زیبایی",
      "محصولات هوم‌کر",
      "کیت‌های کلاژن",
      "کوکتل‌های آرایشی",
      "مواد مصرفی زیبایی",
    ],
  },
  {
    l2Name: "تجهیزات پزشکی",
    products: [
      "تجهیزات پزشکی مصرفی",
      "تجهیزات پزشکی تشخیصی",
      "تجهیزات پزشکی بیمارستانی",
      "تجهیزات پزشکی خانگی",
      "تجهیزات آزمایشگاهی",
      "تجهیزات اتاق عمل",
    ],
  },
  {
    l2Name: "ارتوپدی و توانبخشی",
    products: [
      "ویلچر و تجهیزات حرکتی",
      "بریس و ارتز",
      "تجهیزات فیزیوتراپی",
      "تجهیزات توانبخشی",
      "محصولات حمایتی",
    ],
  },
];

/** Full 3-level catalog for پوشاک، نساجی و مد. */
const APPAREL_TEXTILE_FASHION_CATALOG = [
  {
    l2Name: "پوشاک",
    products: [
      "لباس زنانه",
      "لباس مردانه",
      "لباس بچگانه",
      "لباس زیر",
      "پوشاک ورزشی",
      "لباس سازمانی و فرم",
      "سایر پوشاک",
    ],
  },
  {
    l2Name: "نساجی و مواد اولیه",
    products: [
      "پارچه",
      "نخ",
      "الیاف نساجی",
      "پنبه",
      "لوازم جانبی نساجی",
      "مواد اولیه نساجی",
    ],
  },
  {
    l2Name: "اکسسوری و محصولات مد",
    products: [
      "روسری و شال",
      "کلاه",
      "دستکش",
      "کمربند",
      "اکسسوری مو",
      "سایر اکسسوری‌ها",
    ],
  },
  {
    l2Name: "ساعت، زیورآلات و عینک",
    products: ["زیورآلات", "ساعت", "عینک", "محصولات تزئینی مد"],
  },
];

/** Full 3-level catalog for کیف، کفش و محصولات چرمی. */
const BAGS_SHOES_LEATHER_CATALOG = [
  {
    l2Name: "کیف",
    products: [
      "کیف دستی",
      "کیف پول",
      "کیف زنانه",
      "کیف مردانه",
      "کیف کودک",
      "کیف سفر و کوله",
    ],
  },
  {
    l2Name: "کفش",
    products: [
      "کفش زنانه",
      "کفش مردانه",
      "کفش بچگانه",
      "کفش ورزشی",
      "صندل و دمپایی",
    ],
  },
  {
    l2Name: "محصولات چرمی",
    products: [
      "چرم طبیعی",
      "چرم مصنوعی",
      "کیف چرمی",
      "کفش چرمی",
      "سایر محصولات چرمی",
    ],
  },
];

/** Excel root name → client-facing display title */
const ROOT_DISPLAY_NAMES = {
  [normName("کشاورزی")]: "محصولات کشاورزی",
  [normName("فرآورده های غذایی")]: "مواد غذایی و نوشیدنی",
  [normName("ماشین آلات و تجهیزات صنعتی")]: "ماشین‌آلات و تجهیزات صنعتی",
  [normName("خانه و مصالح ساختمانی")]: "ساختمان و مصالح ساختمانی",
  [normName("فلزات، مواد معدنی و شیمیایی")]: "فلزات، مواد معدنی و مواد شیمیایی",
  [normName("لوازم خانگی و الکترونیکی")]: "لوازم خانگی و الکترونیک",
  [normName("مد، پوشاک و پارچه")]: "پوشاک، نساجی و مد",
  [normName("کیف و کفش")]: "کیف، کفش و محصولات چرمی",
  [normName("لوازم ورزشی، کادویی و اسباب بازی")]: "ورزش، بازی، هدایا و کودک",
  [normName("سایر کالاها")]: "سایر کالاها و محصولات عمومی",
};

function collectOldAutoSubtree(oldItems) {
  const ids = new Set();
  const queue = [OLD_AUTO_ROOT_ID];
  while (queue.length) {
    const id = queue.pop();
    if (ids.has(id)) continue;
    ids.add(id);
    for (const item of oldItems) {
      if (item.parentId === id) queue.push(item.id);
    }
  }
  return {
    ids,
    byId: new Map(oldItems.map((item) => [item.id, item])),
  };
}

function applyAutoPartsRoot(result, oldItems) {
  const { ids: autoIds, byId: oldAutoById } = collectOldAutoSubtree(oldItems);
  const byId = new Map(result.map((node) => [node.id, node]));
  const oldRoot = oldAutoById.get(OLD_AUTO_ROOT_ID);
  if (!oldRoot) return result;

  if (!byId.has(AUTO_ROOT_NEW_ID)) {
    const rootCount = result.filter((node) => node.parentId == null).length;
    const rootNode = buildNode({
      id: AUTO_ROOT_NEW_ID,
      name: oldRoot.name,
      parentId: null,
      level: "root",
      sortOrder: rootCount + 1,
      oldNode: oldRoot,
    });
    result.push(rootNode);
    byId.set(AUTO_ROOT_NEW_ID, rootNode);
  }

  const parentRemap = new Map([[OLD_AUTO_ROOT_ID, AUTO_ROOT_NEW_ID]]);

  for (const id of autoIds) {
    if (id === OLD_AUTO_ROOT_ID) continue;
    const node = byId.get(id);
    const oldNode = oldAutoById.get(id);
    if (!node || !oldNode) continue;
    node.parentId = parentRemap.get(oldNode.parentId) ?? oldNode.parentId;
  }

  for (const tireId of AUTO_TIRE_PRODUCT_IDS) {
    const tire = byId.get(tireId);
    if (tire && byId.has(200603)) {
      tire.parentId = 200603;
    }
  }

  return result;
}

function removeOrphanLegacyNodes(nodes, oldItems, excelNames) {
  const parentIdSet = new Set(nodes.map((node) => node.parentId).filter((v) => v != null));

  const toRemove = new Set();
  for (const node of nodes) {
    if (excelNames.has(normName(node.name))) continue;
    if (parentIdSet.has(node.id)) continue;

    const oldNode = oldItems.find((item) => normName(item.name) === normName(node.name));
    if (!oldNode) continue;

    const oldChildren = oldItems.filter((item) => item.parentId === oldNode.id);
    if (!oldChildren.length) continue;

    const allChildrenRelocated = oldChildren.every((child) => {
      const inTree = nodes.find((item) => normName(item.name) === normName(child.name));
      return inTree && inTree.parentId !== node.id;
    });

    if (allChildrenRelocated) toRemove.add(node.id);
  }

  if (!toRemove.size) return nodes;

  return nodes.filter((node) => !toRemove.has(node.id));
}

function fixProductGroupDescriptions(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.map((node) => {
    if (!node.parentId || !node.description) return node;
    const parent = byId.get(node.parentId);
    if (!parent) return node;

    const groupMatch = node.description.match(/از گروه ([^؛]+)/);
    if (!groupMatch) return node;
    if (normName(groupMatch[1]) === normName(parent.name)) return node;

    return {
      ...node,
      description: node.description.replace(
        /از گروه [^؛]+/,
        `از گروه ${parent.name}`
      ),
    };
  });
}

function consolidateAgriculturalChemicals(nodes) {
  const agRoot = nodes.find(
    (node) => normName(node.name) === normName("کشاورزی") && node.parentId == null
  );
  const metalsRoot = nodes.find(
    (node) =>
      normName(node.name) === normName("فلزات، مواد معدنی و شیمیایی") && node.parentId == null
  );
  if (!agRoot || !metalsRoot) return nodes;

  const agInputs = nodes.find(
    (node) => normName(node.name) === normName("نهاده‌های کشاورزی") && node.parentId === agRoot.id
  );
  const metalAgChem = nodes.find(
    (node) =>
      normName(node.name) === normName("مواد شیمیایی کشاورزی") && node.parentId === metalsRoot.id
  );
  const chemMaterials = nodes.find(
    (node) => normName(node.name) === normName("مواد شیمیایی") && node.parentId === metalsRoot.id
  );

  if (chemMaterials) {
    for (const node of nodes) {
      if (node.parentId !== chemMaterials.id) continue;
      if (normName(node.name) !== normName("اوره")) continue;

      node.name = "اوره صنعتی";
      node.englishName = node.englishName || "Industrial Urea";
      if (!node.slug || node.slug.startsWith("item-")) node.slug = "industrial-urea";
      node.description =
        "اوره صنعتی (Industrial Urea) از گروه مواد شیمیایی؛ ماده اولیه صنعتی و پتروشیمی. برای کود کشاورزی از دسته «کود اوره» استفاده کنید.";
      node.metaTitle = "خرید و فروش اوره صنعتی";
      node.metaDescription =
        "اوره صنعتی؛ ثبت آگهی خرید یا فروش به صورت عمده برای کاربردهای صنعتی.";
    }
  }

  if (!agInputs || !metalAgChem) return nodes;

  const fertilizers = nodes.find(
    (node) => normName(node.name) === normName("کودها") && node.parentId === agInputs.id
  );
  const pesticides = nodes.find(
    (node) => normName(node.name) === normName("آفت‌کش‌ها") && node.parentId === agInputs.id
  );

  const moveRules = [
    { name: "کود", parentId: fertilizers?.id },
    { name: "آفت کش", parentId: pesticides?.id },
    { name: "سم", parentId: pesticides?.id },
    { name: "قارچ کش", parentId: pesticides?.id },
    { name: "هورمون کشاورزی", parentId: agInputs.id },
  ];

  for (const node of nodes.filter((item) => item.parentId === metalAgChem.id)) {
    const rule = moveRules.find((entry) => normName(entry.name) === normName(node.name));
    if (rule?.parentId) node.parentId = rule.parentId;
  }

  const metalAgChemChildren = nodes.filter((item) => item.parentId === metalAgChem.id);
  if (!metalAgChemChildren.length) {
    return nodes.filter((item) => item.id !== metalAgChem.id);
  }

  return nodes;
}

const LEGACY_L1_MERGE_MAP = {
  [normName("خشکبار و آجیل")]: normName("خشکبار"),
  [normName("میوه‌های درختی")]: normName("میوه"),
  [normName("میوه‌های گرمسیری و نیمه‌گرمسیری")]: normName("میوه"),
  [normName("میوه‌های بوته‌ای و توت‌سانان")]: normName("میوه"),
  [normName("سبزیجات و صیفی‌جات")]: normName("صیفی"),
  [normName("دام، طیور و آبزیان")]: normName("دامپروری"),
  [normName("خوراک دام و طیور")]: normName("دامپروری"),
  [normName("لبنیات و مشتقات")]: normName("لبنیات"),
  [normName("کنسرو و فرآورده‌های آماده")]: normName("کنسانتره و کنسرو"),
  [normName("روغن‌های خوراکی")]: normName("چاشنی و افزودنی"),
  [normName("آرد و فرآورده‌های غلات")]: normName("چاشنی و افزودنی"),
};

function findRootId(nodes, nodeId) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let current = byId.get(nodeId);
  const seen = new Set();
  while (current?.parentId != null && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return current?.id ?? null;
}

function mergeNodeUnderParent(nodes, nodeId, targetParentId, removeIds) {
  const node = nodes.find((item) => item.id === nodeId);
  if (!node || removeIds.has(nodeId)) return;

  const existing = nodes.find(
    (item) =>
      item.parentId === targetParentId &&
      normName(item.name) === normName(node.name) &&
      item.id !== nodeId &&
      !removeIds.has(item.id)
  );

  if (existing) {
    const children = nodes.filter((item) => item.parentId === nodeId);
    for (const child of children) {
      mergeNodeUnderParent(nodes, child.id, existing.id, removeIds);
    }
    removeIds.add(nodeId);
    return;
  }

  node.parentId = targetParentId;
}

function consolidateLegacyParallelCategories(nodes) {
  const removeIds = new Set();
  const roots = nodes.filter((node) => node.parentId == null);

  for (const root of roots) {
    const l1 = nodes.filter((node) => node.parentId === root.id && !removeIds.has(node.id));

    for (const legacyNode of l1) {
      const targetName = LEGACY_L1_MERGE_MAP[normName(legacyNode.name)];
      if (!targetName) continue;

      const target = l1.find(
        (node) => normName(node.name) === targetName && node.id !== legacyNode.id && !removeIds.has(node.id)
      );
      if (!target) continue;

      const children = nodes.filter((node) => node.parentId === legacyNode.id);
      for (const child of children) {
        mergeNodeUnderParent(nodes, child.id, target.id, removeIds);
      }
      removeIds.add(legacyNode.id);
    }
  }

  if (!removeIds.size) return nodes;
  return nodes.filter((node) => !removeIds.has(node.id));
}

function flattenRedundantSingleChildCategories(nodes) {
  let result = [...nodes];
  let changed = true;

  while (changed) {
    changed = false;
    const parentIdSet = new Set(result.map((node) => node.parentId).filter((v) => v != null));
    const removeIds = new Set();

    for (const node of result) {
      if (!parentIdSet.has(node.id)) continue;
      const children = result.filter((item) => item.parentId === node.id);
      if (children.length !== 1) continue;
      if (normName(children[0].name) !== normName(node.name)) continue;

      children[0].parentId = node.parentId;
      removeIds.add(node.id);
      changed = true;
    }

    if (removeIds.size) {
      result = result.filter((node) => !removeIds.has(node.id));
    }
  }

  return result;
}

function nodeQualityScore(node, nodes) {
  const parentIdSet = new Set(nodes.map((item) => item.parentId).filter((v) => v != null));
  let score = 0;
  if (parentIdSet.has(node.id)) score += 4;
  if (node.slug && !String(node.slug).startsWith("item-")) score += 6;
  if (node.englishName) score += 2;
  if (node.imageUrl) score += 1;

  let depth = 0;
  const byId = new Map(nodes.map((item) => [item.id, item]));
  let current = node;
  const seen = new Set();
  while (current?.parentId != null && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = byId.get(current.parentId);
  }
  score -= depth;
  return score;
}

function deduplicateNodesByName(nodes) {
  const grouped = new Map();
  for (const node of nodes) {
    const key = normName(node.name);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(node);
  }

  const removeIds = new Set();
  for (const [, group] of grouped) {
    if (group.length <= 1) continue;

    const ranked = group
      .map((node) => ({ node, score: nodeQualityScore(node, nodes) }))
      .sort((a, b) => b.score - a.score || a.node.id - b.node.id);

    const keep = ranked[0].node;
    for (let i = 1; i < ranked.length; i += 1) {
      const drop = ranked[i].node;
      const children = nodes.filter((item) => item.parentId === drop.id);
      for (const child of children) {
        mergeNodeUnderParent(nodes, child.id, keep.id, removeIds);
      }
      removeIds.add(drop.id);
    }
  }

  if (!removeIds.size) return nodes;
  return nodes.filter((node) => !removeIds.has(node.id));
}

function fixInputDescriptions(nodes) {
  const inputPattern = /(کود|بذر|نهال|آفت|علف|سم|هرس|خاک|کودها)/i;
  return nodes.map((node) => {
    if (!node.description || !inputPattern.test(node.name)) return node;
    if (!node.description.includes("تازه‌خوری")) return node;

    const parent = nodes.find((item) => item.id === node.parentId);
    const group = parent?.name || "نهاده‌های کشاورزی";
    const en = node.englishName ? ` (${node.englishName})` : "";

    return {
      ...node,
      description: `${node.name}${en} از گروه ${group}؛ مناسب خرید و فروش عمده و جزئی.`,
    };
  });
}

function getNodeDepth(nodeId, byId) {
  let depth = 0;
  let current = byId.get(nodeId);
  const seen = new Set();
  while (current?.parentId != null && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
}

function getAncestorAtDepth(nodeId, targetDepth, byId) {
  let current = byId.get(nodeId);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const depth = getNodeDepth(current.id, byId);
    if (depth === targetDepth) return current;
    if (current.parentId == null) return null;
    current = byId.get(current.parentId);
  }
  return null;
}

function updateProductGroupDescription(node, groupName) {
  if (!node.description) return node;
  const en = node.englishName ? ` (${node.englishName})` : "";
  if (node.description.includes("از گروه")) {
    return {
      ...node,
      description: node.description.replace(/از گروه [^؛]+/, `از گروه ${groupName}`),
    };
  }
  return {
    ...node,
    description: `${node.name}${en} از گروه ${groupName}؛ مناسب خرید و فروش عمده و جزئی.`,
  };
}

function enforceExcelThreeLevelStructure(nodes) {
  let result = [...nodes];
  let changed = true;

  while (changed) {
    changed = false;
    const byId = new Map(result.map((node) => [node.id, node]));
    const parentIdSet = new Set(result.map((node) => node.parentId).filter((v) => v != null));

    for (const node of result) {
      if (!parentIdSet.has(node.id)) continue;

      const depth = getNodeDepth(node.id, byId);
      if (depth < 2) continue;

      const l2Parent = getAncestorAtDepth(node.id, 1, byId);
      if (!l2Parent) continue;

      const children = result.filter((item) => item.parentId === node.id);
      for (const child of children) {
        if (child.parentId === l2Parent.id) continue;
        child.parentId = l2Parent.id;
        Object.assign(child, updateProductGroupDescription(child, l2Parent.name));
        changed = true;
      }
    }
  }

  return result;
}

function getRootNode(nodeId, byId) {
  let current = byId.get(nodeId);
  const seen = new Set();
  while (current?.parentId != null && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return current ?? null;
}

function isAutoPartsRoot(node) {
  return node.parentId == null && normName(node.name) === normName("خودرو و قطعات");
}

function isOtherGoodsRoot(node) {
  if (node.parentId != null) return false;
  const name = normName(node.name);
  return (
    name === normName("سایر کالاها") ||
    name === normName("سایر کالاها و محصولات عمومی")
  );
}

function isInAutoPartsSubtree(nodeId, byId) {
  const root = getRootNode(nodeId, byId);
  return Boolean(root && isAutoPartsRoot(root));
}

function isInOtherGoodsSubtree(nodeId, byId) {
  const root = getRootNode(nodeId, byId);
  return Boolean(root && isOtherGoodsRoot(root));
}

function buildExcelStructureMaps(excelRows) {
  const l2ByRoot = new Map();
  const productsByL2 = new Map();
  const productOrderByL2 = new Map();
  const l2OrderByRoot = new Map();
  const rootOrder = [];

  for (const row of excelRows) {
    const nr = normName(row.parent);
    const nc = normName(row.child);
    const np = normName(row.product);
    const l2Key = `${nr}::${nc}`;

    if (!l2ByRoot.has(nr)) l2ByRoot.set(nr, new Set());
    l2ByRoot.get(nr).add(nc);

    if (!productsByL2.has(l2Key)) productsByL2.set(l2Key, new Set());
    productsByL2.get(l2Key).add(np);

    if (!productOrderByL2.has(l2Key)) productOrderByL2.set(l2Key, []);
    const order = productOrderByL2.get(l2Key);
    if (!order.includes(np)) order.push(np);

    if (!l2OrderByRoot.has(nr)) l2OrderByRoot.set(nr, []);
    const l2Order = l2OrderByRoot.get(nr);
    if (!l2Order.includes(nc)) l2Order.push(nc);

    if (!rootOrder.find((name) => normName(name) === nr)) {
      rootOrder.push(row.parent);
    }
  }

  return { l2ByRoot, productsByL2, productOrderByL2, l2OrderByRoot, rootOrder };
}

function isLegacyAutoPartsNode(oldItem, autoIds, oldById) {
  if (autoIds.has(oldItem.id)) return true;
  let current = oldItem;
  const seen = new Set();
  while (current?.parentId != null && !seen.has(current.id)) {
    seen.add(current.id);
    if (autoIds.has(current.parentId)) return true;
    current = oldById.get(current.parentId);
  }
  return false;
}

/** Keep only Excel roots, L2 categories, and products; preserve خودرو و قطعات legacy subtree. */
function pruneToExcelOnly(nodes, excelRows) {
  const { l2ByRoot, productsByL2 } = buildExcelStructureMaps(excelRows);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parentIdSet = new Set(nodes.map((node) => node.parentId).filter((v) => v != null));
  const keepIds = new Set();

  for (const node of nodes) {
    if (isInAutoPartsSubtree(node.id, byId)) {
      keepIds.add(node.id);
      continue;
    }

    if (node.parentId == null) {
      if (l2ByRoot.has(normName(node.name))) keepIds.add(node.id);
      continue;
    }

    const root = getRootNode(node.id, byId);
    if (!root || !l2ByRoot.has(normName(root.name))) continue;

    const nr = normName(root.name);
    const depth = getNodeDepth(node.id, byId);

    if (depth === 1) {
      if (l2ByRoot.get(nr)?.has(normName(node.name))) keepIds.add(node.id);
      continue;
    }

    if (depth === 2 && !parentIdSet.has(node.id)) {
      const l2 = byId.get(node.parentId);
      if (!l2) continue;
      const l2Key = `${nr}::${normName(l2.name)}`;
      if (productsByL2.get(l2Key)?.has(normName(node.name))) keepIds.add(node.id);
    }
  }

  return nodes.filter((node) => keepIds.has(node.id));
}

function reorderCatalogByExcel(nodes, excelRows) {
  const { productOrderByL2, l2OrderByRoot, rootOrder } = buildExcelStructureMaps(excelRows);
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    if (node.parentId != null || isAutoPartsRoot(node) || isOtherGoodsRoot(node)) continue;
    const index = rootOrder.findIndex((name) => normName(name) === normName(node.name));
    if (index >= 0) node.sortOrder = index + 1;
  }

  for (const node of nodes) {
    if (node.parentId == null) continue;
    const root = getRootNode(node.id, byId);
    if (!root || isAutoPartsRoot(root) || isOtherGoodsRoot(root)) continue;

    const depth = getNodeDepth(node.id, byId);
    const nr = normName(root.name);

    if (depth === 1) {
      const order = l2OrderByRoot.get(nr) || [];
      const index = order.indexOf(normName(node.name));
      if (index >= 0) node.sortOrder = index + 1;
      continue;
    }

    if (depth === 2) {
      const l2 = byId.get(node.parentId);
      if (!l2) continue;
      const l2Key = `${nr}::${normName(l2.name)}`;
      const order = productOrderByL2.get(l2Key) || [];
      const index = order.indexOf(normName(node.name));
      if (index >= 0) node.sortOrder = index + 1;
    }
  }

  return nodes;
}

function findOldItem(oldItems, ref) {
  if (typeof ref === "number") {
    return oldItems.find((item) => item.id === ref) || null;
  }
  return oldItems.find((item) => normName(item.name) === normName(ref)) || null;
}

function findAgRoot(nodes) {
  return nodes.find(
    (node) =>
      node.parentId == null &&
      (normName(node.name) === normName("کشاورزی") ||
        normName(node.name) === normName("محصولات کشاورزی"))
  );
}

function injectAgSupplementalCatalog(nodes, oldItems) {
  const agRoot = findAgRoot(nodes);
  const foodRoot = nodes.find(
    (node) =>
      node.parentId == null &&
      (normName(node.name) === normName("فرآورده های غذایی") ||
        normName(node.name) === normName("مواد غذایی و نوشیدنی"))
  );
  const drinks = nodes.find(
    (node) => node.parentId === foodRoot?.id && normName(node.name) === normName("نوشیدنی")
  );
  if (!agRoot) return nodes;

  let nextId = Math.max(...nodes.map((node) => Number(node.id)), 0) + 1;
  const agL2Count = nodes.filter((node) => node.parentId === agRoot.id).length;

  for (const [index, entry] of AG_SUPPLEMENTAL_CATALOG.entries()) {
    const oldL2 = entry.oldL2Ref ? findOldItem(oldItems, entry.oldL2Ref) : null;
    let l2Node = nodes.find(
      (node) => node.parentId === agRoot.id && normName(node.name) === normName(entry.l2Name)
    );

    if (!l2Node) {
      const l2Id = oldL2?.id && !nodes.some((n) => n.id === oldL2.id) ? oldL2.id : nextId++;
      l2Node = buildNode({
        id: l2Id,
        name: entry.l2Name,
        parentId: agRoot.id,
        level: "category",
        sortOrder: agL2Count + index + 1,
        oldNode: oldL2,
      });
      if (l2Node.description?.includes("از گروه")) {
        l2Node.description = l2Node.description.replace(/از گروه [^؛]+/, `از گروه ${agRoot.name}`);
      } else {
        l2Node.description = `دسته «${entry.l2Name}» شامل محصولات مرتبط؛ مناسب خرید و فروش عمده و جزئی.`;
      }
      nodes.push(l2Node);
    }

    const existing = new Set(
      nodes.filter((node) => node.parentId === l2Node.id).map((node) => normName(node.name))
    );

    entry.products.forEach((productEntry, productIndex) => {
      const productName = typeof productEntry === "string" ? productEntry : productEntry.name;
      const oldRef = typeof productEntry === "string" ? productEntry : productEntry.oldRef;
      if (existing.has(normName(productName))) return;

      const oldProduct = oldRef ? findOldItem(oldItems, oldRef) : findOldItem(oldItems, productName);
      const productId =
        oldProduct?.id && !nodes.some((n) => n.id === oldProduct.id) ? oldProduct.id : nextId++;
      const node = buildNode({
        id: productId,
        name: productName,
        parentId: l2Node.id,
        level: "product",
        sortOrder: productIndex + 1,
        oldNode: oldProduct,
        groupName: entry.l2Name,
      });
      if (node.description?.includes("از گروه")) {
        node.description = node.description.replace(/از گروه [^؛]+/, `از گروه ${entry.l2Name}`);
      } else if (!oldProduct) {
        node.description = `${productName} از گروه ${entry.l2Name}؛ مناسب خرید و فروش عمده و جزئی.`;
      }
      nodes.push(node);
      existing.add(normName(productName));
    });
  }

  if (drinks) {
    const coffee = nodes.find(
      (node) => node.parentId === drinks.id && normName(node.name) === normName("قهوه")
    );
    if (coffee?.description?.includes("دسته «قهوه»")) {
      coffee.description = "قهوه (Coffee) از گروه نوشیدنی؛ مناسب خرید و فروش عمده و جزئی.";
      coffee.metaDescription = "انواع قهوه؛ ثبت آگهی خرید یا فروش به صورت عمده و جزئی.";
    }
  }

  return nodes;
}

function findAutoRoot(nodes) {
  return nodes.find(
    (node) => node.parentId == null && normName(node.name) === normName("خودرو و قطعات")
  );
}

const AUTO_L2_OLD_NAME_ALIASES = {
  [normName("قطعات مصرفی خودرو")]: normName("لوازم یدکی مصرفی"),
};

const AUTO_PRODUCT_OLD_NAME_ALIASES = {
  [normName("باتری خودرو")]: normName("باتری"),
  [normName("رینگ خودرو (فولادی و آلومینیومی)")]: normName("رینگ فولادی"),
};

function injectAutoPartsCatalog(nodes, oldItems) {
  const autoRoot = findAutoRoot(nodes);
  if (!autoRoot) return nodes;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const removeIds = new Set(
    nodes
      .filter((node) => isInAutoPartsSubtree(node.id, byId) && node.id !== autoRoot.id)
      .map((node) => node.id)
  );
  const result = nodes.filter((node) => !removeIds.has(node.id));

  let nextId = Math.max(...result.map((node) => Number(node.id)), 0) + 1;

  for (const [l2Index, entry] of AUTO_PARTS_CATALOG.entries()) {
    const oldL2Key = AUTO_L2_OLD_NAME_ALIASES[normName(entry.l2Name)] || normName(entry.l2Name);
    const oldL2 =
      findOldItem(oldItems, entry.l2Name) ||
      oldItems.find((item) => normName(item.name) === oldL2Key) ||
      null;

    const l2Id = oldL2?.id && !result.some((n) => n.id === oldL2.id) ? oldL2.id : nextId++;
    const l2Node = buildNode({
      id: l2Id,
      name: entry.l2Name,
      parentId: autoRoot.id,
      level: "category",
      sortOrder: l2Index + 1,
      oldNode: oldL2 && normName(oldL2.name) === normName(entry.l2Name) ? oldL2 : null,
      groupName: autoRoot.name,
    });
    l2Node.description = `دسته «${entry.l2Name}» از گروه خودرو و قطعات؛ مناسب خرید و فروش عمده و جزئی.`;
    l2Node.metaTitle = `خرید و فروش ${entry.l2Name}`;
    l2Node.metaDescription = `انواع ${entry.l2Name}؛ ثبت آگهی خرید یا فروش به صورت عمده و جزئی.`;
    result.push(l2Node);

    const seenProducts = new Set();
    entry.products.forEach((productName, productIndex) => {
      const lookupName =
        AUTO_PRODUCT_OLD_NAME_ALIASES[normName(productName)] || normName(productName);
      const oldProduct =
        findOldItem(oldItems, productName) ||
        oldItems.find((item) => normName(item.name) === lookupName) ||
        null;

      if (seenProducts.has(normName(productName))) return;
      const productId =
        oldProduct?.id && !result.some((n) => n.id === oldProduct.id) ? oldProduct.id : nextId++;
      const node = buildNode({
        id: productId,
        name: productName,
        parentId: l2Node.id,
        level: "product",
        sortOrder: productIndex + 1,
        oldNode: oldProduct,
        groupName: entry.l2Name,
      });
      if (node.description?.includes("از گروه")) {
        node.description = node.description.replace(/از گروه [^؛]+/, `از گروه ${entry.l2Name}`);
      }
      result.push(node);
      seenProducts.add(normName(productName));
    });
  }

  return result;
}

const COSMETICS_HEALTH_ROOT_NAMES = new Set([
  normName("آرایشی، بهداشتی و سلامت"),
  normName("آرایشی و بهداشتی"),
]);

function findCosmeticsHealthRoot(nodes) {
  return nodes.find(
    (node) => node.parentId == null && COSMETICS_HEALTH_ROOT_NAMES.has(normName(node.name))
  );
}

function isInCosmeticsHealthSubtree(nodeId, byId) {
  const root = getRootNode(nodeId, byId);
  return Boolean(root && COSMETICS_HEALTH_ROOT_NAMES.has(normName(root.name)));
}

const COSMETICS_L2_OLD_NAME_ALIASES = {
  [normName("محصولات آرایشی و بهداشتی")]: normName("آرایشی و بهداشتی"),
  [normName("تجهیزات زیبایی و آرایشگاهی")]: normName("تجهیزات آرایشی و مراقبت شخصی"),
  [normName("ارتوپدی و توانبخشی")]: normName("تجهیزات ارتوپدی و توانبخشی"),
};

const COSMETICS_PRODUCT_OLD_NAME_ALIASES = {
  [normName("مراقبت پوست")]: normName("محصولات پوستی"),
  [normName("مراقبت مو")]: normName("محصولات مو"),
  [normName("مراقبت بدن")]: normName("مراقبت و بهداشت بدن"),
  [normName("لوازم آرایشی")]: normName("سایر محصولات آرایشی"),
  [normName("محصولات بهداشتی کودک")]: normName("سایر محصولات بهداشتی"),
  [normName("تجهیزات پزشکی تشخیصی")]: normName("تجهیزات پزشکی تخصصی"),
  [normName("ویلچر و تجهیزات حرکتی")]: normName("تجهیزات ارتوپدی و حرکتی"),
};

function injectCosmeticsHealthCatalog(nodes, oldItems) {
  const healthRoot = findCosmeticsHealthRoot(nodes);
  if (!healthRoot) return nodes;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const removeIds = new Set(
    nodes
      .filter((node) => isInCosmeticsHealthSubtree(node.id, byId) && node.id !== healthRoot.id)
      .map((node) => node.id)
  );
  const result = nodes.filter((node) => !removeIds.has(node.id));

  let nextId = Math.max(...result.map((node) => Number(node.id)), 0) + 1;
  const groupLabel = healthRoot.name;

  for (const [l2Index, entry] of COSMETICS_HEALTH_CATALOG.entries()) {
    const oldL2Key = COSMETICS_L2_OLD_NAME_ALIASES[normName(entry.l2Name)] || normName(entry.l2Name);
    const oldL2 =
      findOldItem(oldItems, entry.l2Name) ||
      oldItems.find((item) => normName(item.name) === oldL2Key) ||
      null;

    const l2Id = oldL2?.id && !result.some((n) => n.id === oldL2.id) ? oldL2.id : nextId++;
    const l2Node = buildNode({
      id: l2Id,
      name: entry.l2Name,
      parentId: healthRoot.id,
      level: "category",
      sortOrder: l2Index + 1,
      oldNode: oldL2 && normName(oldL2.name) === normName(entry.l2Name) ? oldL2 : null,
      groupName: groupLabel,
    });
    l2Node.description = `دسته «${entry.l2Name}» از گروه ${groupLabel}؛ مناسب خرید و فروش عمده و جزئی.`;
    l2Node.metaTitle = `خرید و فروش ${entry.l2Name}`;
    l2Node.metaDescription = `انواع ${entry.l2Name}؛ ثبت آگهی خرید یا فروش به صورت عمده و جزئی.`;
    result.push(l2Node);

    const seenProducts = new Set();
    entry.products.forEach((productName, productIndex) => {
      const lookupName =
        COSMETICS_PRODUCT_OLD_NAME_ALIASES[normName(productName)] || normName(productName);
      const oldProduct =
        findOldItem(oldItems, productName) ||
        oldItems.find((item) => normName(item.name) === lookupName) ||
        null;

      if (seenProducts.has(normName(productName))) return;
      const productId =
        oldProduct?.id && !result.some((n) => n.id === oldProduct.id) ? oldProduct.id : nextId++;
      const node = buildNode({
        id: productId,
        name: productName,
        parentId: l2Node.id,
        level: "product",
        sortOrder: productIndex + 1,
        oldNode: oldProduct,
        groupName: entry.l2Name,
      });
      if (node.description?.includes("از گروه")) {
        node.description = node.description.replace(/از گروه [^؛]+/, `از گروه ${entry.l2Name}`);
      }
      result.push(node);
      seenProducts.add(normName(productName));
    });
  }

  return result;
}

const APPAREL_ROOT_NAMES = new Set([
  normName("پوشاک، نساجی و مد"),
  normName("مد، پوشاک و پارچه"),
]);

function findApparelRoot(nodes) {
  return nodes.find(
    (node) => node.parentId == null && APPAREL_ROOT_NAMES.has(normName(node.name))
  );
}

function isInApparelSubtree(nodeId, byId) {
  const root = getRootNode(nodeId, byId);
  return Boolean(root && APPAREL_ROOT_NAMES.has(normName(root.name)));
}

const APPAREL_L2_OLD_NAME_ALIASES = {
  [normName("نساجی و مواد اولیه")]: normName("نساجی، پارچه و چرم"),
  [normName("اکسسوری و محصولات مد")]: normName("اکسسوری و مد"),
};

const APPAREL_PRODUCT_OLD_NAME_ALIASES = {
  [normName("لباس سازمانی و فرم")]: normName("لباس سازمانی"),
  [normName("سایر پوشاک")]: normName("سایر انواع پوشاک"),
  [normName("لوازم جانبی نساجی")]: normName("لوازم جانبی پوشاک"),
};

function injectApparelTextileFashionCatalog(nodes, oldItems) {
  const root = findApparelRoot(nodes);
  if (!root) return nodes;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const removeIds = new Set(
    nodes
      .filter((node) => isInApparelSubtree(node.id, byId) && node.id !== root.id)
      .map((node) => node.id)
  );
  const result = nodes.filter((node) => !removeIds.has(node.id));

  let nextId = Math.max(...result.map((node) => Number(node.id)), 0) + 1;
  const groupLabel = root.name;

  for (const [l2Index, entry] of APPAREL_TEXTILE_FASHION_CATALOG.entries()) {
    const oldL2Key = APPAREL_L2_OLD_NAME_ALIASES[normName(entry.l2Name)] || normName(entry.l2Name);
    const oldL2 =
      findOldItem(oldItems, entry.l2Name) ||
      oldItems.find((item) => normName(item.name) === oldL2Key) ||
      null;

    const l2Id = oldL2?.id && !result.some((n) => n.id === oldL2.id) ? oldL2.id : nextId++;
    const l2Node = buildNode({
      id: l2Id,
      name: entry.l2Name,
      parentId: root.id,
      level: "category",
      sortOrder: l2Index + 1,
      oldNode: oldL2 && normName(oldL2.name) === normName(entry.l2Name) ? oldL2 : null,
      groupName: groupLabel,
    });
    l2Node.description = `دسته «${entry.l2Name}» از گروه ${groupLabel}؛ مناسب خرید و فروش عمده و جزئی.`;
    l2Node.metaTitle = `خرید و فروش ${entry.l2Name}`;
    l2Node.metaDescription = `انواع ${entry.l2Name}؛ ثبت آگهی خرید یا فروش به صورت عمده و جزئی.`;
    result.push(l2Node);

    const seenProducts = new Set();
    entry.products.forEach((productName, productIndex) => {
      const lookupName =
        APPAREL_PRODUCT_OLD_NAME_ALIASES[normName(productName)] || normName(productName);
      const oldProduct =
        findOldItem(oldItems, productName) ||
        oldItems.find((item) => normName(item.name) === lookupName) ||
        null;

      if (seenProducts.has(normName(productName))) return;
      const productId =
        oldProduct?.id && !result.some((n) => n.id === oldProduct.id) ? oldProduct.id : nextId++;
      const node = buildNode({
        id: productId,
        name: productName,
        parentId: l2Node.id,
        level: "product",
        sortOrder: productIndex + 1,
        oldNode: oldProduct,
        groupName: entry.l2Name,
      });
      if (node.description?.includes("از گروه")) {
        node.description = node.description.replace(/از گروه [^؛]+/, `از گروه ${entry.l2Name}`);
      }
      result.push(node);
      seenProducts.add(normName(productName));
    });
  }

  return result;
}

const BAGS_SHOES_ROOT_NAMES = new Set([
  normName("کیف، کفش و محصولات چرمی"),
  normName("کیف و کفش"),
]);

function findBagsShoesLeatherRoot(nodes) {
  return nodes.find(
    (node) => node.parentId == null && BAGS_SHOES_ROOT_NAMES.has(normName(node.name))
  );
}

function isInBagsShoesLeatherSubtree(nodeId, byId) {
  const root = getRootNode(nodeId, byId);
  return Boolean(root && BAGS_SHOES_ROOT_NAMES.has(normName(root.name)));
}

const BAGS_SHOES_L2_OLD_NAME_ALIASES = {
  [normName("کیف")]: normName("کیف و چمدان"),
};

const BAGS_SHOES_PRODUCT_OLD_NAME_ALIASES = {
  [normName("کیف سفر و کوله")]: normName("کوله پشتی"),
};

function injectBagsShoesLeatherCatalog(nodes, oldItems) {
  const root = findBagsShoesLeatherRoot(nodes);
  if (!root) return nodes;

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const removeIds = new Set(
    nodes
      .filter((node) => isInBagsShoesLeatherSubtree(node.id, byId) && node.id !== root.id)
      .map((node) => node.id)
  );
  const result = nodes.filter((node) => !removeIds.has(node.id));

  let nextId = Math.max(...result.map((node) => Number(node.id)), 0) + 1;
  const groupLabel = root.name;

  for (const [l2Index, entry] of BAGS_SHOES_LEATHER_CATALOG.entries()) {
    const oldL2Key = BAGS_SHOES_L2_OLD_NAME_ALIASES[normName(entry.l2Name)] || normName(entry.l2Name);
    const oldL2 =
      findOldItem(oldItems, entry.l2Name) ||
      oldItems.find((item) => normName(item.name) === oldL2Key) ||
      null;

    const l2Id = oldL2?.id && !result.some((n) => n.id === oldL2.id) ? oldL2.id : nextId++;
    const l2Node = buildNode({
      id: l2Id,
      name: entry.l2Name,
      parentId: root.id,
      level: "category",
      sortOrder: l2Index + 1,
      oldNode: oldL2 && normName(oldL2.name) === normName(entry.l2Name) ? oldL2 : null,
      groupName: groupLabel,
    });
    l2Node.description = `دسته «${entry.l2Name}» از گروه ${groupLabel}؛ مناسب خرید و فروش عمده و جزئی.`;
    l2Node.metaTitle = `خرید و فروش ${entry.l2Name}`;
    l2Node.metaDescription = `انواع ${entry.l2Name}؛ ثبت آگهی خرید یا فروش به صورت عمده و جزئی.`;
    result.push(l2Node);

    const seenProducts = new Set();
    entry.products.forEach((productName, productIndex) => {
      const lookupName =
        BAGS_SHOES_PRODUCT_OLD_NAME_ALIASES[normName(productName)] || normName(productName);
      const oldProduct =
        findOldItem(oldItems, productName) ||
        oldItems.find((item) => normName(item.name) === lookupName) ||
        null;

      if (seenProducts.has(normName(productName))) return;
      const productId =
        oldProduct?.id && !result.some((n) => n.id === oldProduct.id) ? oldProduct.id : nextId++;
      const node = buildNode({
        id: productId,
        name: productName,
        parentId: l2Node.id,
        level: "product",
        sortOrder: productIndex + 1,
        oldNode: oldProduct,
        groupName: entry.l2Name,
      });
      if (node.description?.includes("از گروه")) {
        node.description = node.description.replace(/از گروه [^؛]+/, `از گروه ${entry.l2Name}`);
      }
      result.push(node);
      seenProducts.add(normName(productName));
    });
  }

  return result;
}

/** Full catalog for سایر کالاها — includes free-form listing entry points. */
const OTHER_GOODS_CATALOG = [
  {
    l2Name: "ثبت کالای دلخواه",
    products: [
      "کالای عمده (نام دلخواه)",
      "درخواست خرید کالا",
      "درخواست فروش کالا",
    ],
  },
  {
    l2Name: "بسته‌بندی و ملزومات",
    products: [
      "جعبه و کارتن",
      "نایلون و سلفون",
      "پالت و بسته‌بندی صنعتی",
      "سایر ملزومات بسته‌بندی",
    ],
  },
  {
    l2Name: "کاغذ، مقوا و لوازم اداری",
    products: [
      "کاغذ",
      "مقوا",
      "لوازم اداری",
      "سایر کاغذ و لوازم اداری",
    ],
  },
  {
    l2Name: "کالاهای متفرقه",
    products: [
      "کالاهای صنعتی متفرقه",
      "کالاهای مصرفی متفرقه",
      "سایر کالاها",
    ],
  },
];

const OTHER_GOODS_ROOT_NAMES = new Set([
  normName("سایر کالاها"),
  normName("سایر کالاها و محصولات عمومی"),
]);

const OTHER_GOODS_L2_OLD_NAME_ALIASES = {
  [normName("بسته‌بندی")]: normName("بسته‌بندی و ملزومات"),
  [normName("کاغذ و مقوا")]: normName("کاغذ، مقوا و لوازم اداری"),
  [normName("لوازم اداری")]: normName("کاغذ، مقوا و لوازم اداری"),
};

const OTHER_GOODS_PRODUCT_OLD_NAME_ALIASES = {
  [normName("جعبه مقوایی")]: normName("جعبه و کارتن"),
  [normName("نایلون بسته‌بندی")]: normName("نایلون و سلفون"),
  [normName("پالت چوبی")]: normName("پالت و بسته‌بندی صنعتی"),
  [normName("کاغذ A4")]: normName("کاغذ"),
  [normName("مقوای صنعتی")]: normName("مقوا"),
  [normName("خودکار")]: normName("لوازم اداری"),
  [normName("پوشه بایگانی")]: normName("لوازم اداری"),
  [normName("کاغذ کپی")]: normName("کاغذ"),
};

const OTHER_GOODS_CUSTOM_PRODUCTS = new Set([
  normName("کالای عمده (نام دلخواه)"),
  normName("درخواست خرید کالا"),
  normName("درخواست فروش کالا"),
]);

function injectOtherGoodsCatalog(nodes, oldItems) {
  let root = nodes.find(
    (node) => node.parentId == null && OTHER_GOODS_ROOT_NAMES.has(normName(node.name))
  );

  let result = [...nodes];
  let nextId = Math.max(...result.map((node) => Number(node.id)), 0) + 1;

  if (!root) {
    const oldRoot =
      oldItems.find((item) => item.id === 900012 && item.parentId == null) ||
      oldItems.find(
        (item) => item.parentId == null && normName(item.name) === normName("سایر کالاها")
      ) ||
      null;

    const rootId = oldRoot?.id && !result.some((n) => n.id === oldRoot.id) ? oldRoot.id : nextId++;
    root = buildNode({
      id: rootId,
      name: "سایر کالاها",
      parentId: null,
      level: "root",
      sortOrder: 12,
      oldNode: oldRoot,
    });
    root.slug = oldRoot?.slug || "other-goods";
    root.englishName = oldRoot?.englishName || "Other Goods & General Products";
    root.description =
      "دسته اصلی «سایر کالاها و محصولات عمومی» برای کالاهایی که در سایر دسته‌ها نیستند؛ هنگام ثبت آگهی نام دقیق کالا را در توضیحات وارد کنید.";
    root.metaTitle = "سایر کالاها و محصولات عمومی";
    root.metaDescription = "ثبت و خرید و فروش کالاهای متفرقه و عمومی";
    result.push(root);
  } else {
    root.sortOrder = Math.max(root.sortOrder || 0, 12);
  }

  const byId = new Map(result.map((node) => [node.id, node]));
  const removeIds = new Set(
    result
      .filter((node) => isInOtherGoodsSubtree(node.id, byId) && node.id !== root.id)
      .map((node) => node.id)
  );
  result = result.filter((node) => !removeIds.has(node.id));

  const groupLabel = "سایر کالاها و محصولات عمومی";

  for (const [l2Index, entry] of OTHER_GOODS_CATALOG.entries()) {
    const oldL2Key = OTHER_GOODS_L2_OLD_NAME_ALIASES[normName(entry.l2Name)] || normName(entry.l2Name);
    const oldL2 =
      findOldItem(oldItems, entry.l2Name) ||
      oldItems.find((item) => normName(item.name) === oldL2Key) ||
      null;

    const l2Id = oldL2?.id && !result.some((n) => n.id === oldL2.id) ? oldL2.id : nextId++;
    const l2Node = buildNode({
      id: l2Id,
      name: entry.l2Name,
      parentId: root.id,
      level: "category",
      sortOrder: l2Index + 1,
      oldNode: oldL2 && normName(oldL2.name) === normName(entry.l2Name) ? oldL2 : null,
      groupName: groupLabel,
    });
    l2Node.description = `دسته «${entry.l2Name}» از گروه ${groupLabel}؛ مناسب خرید و فروش عمده و جزئی.`;
    l2Node.metaTitle = `خرید و فروش ${entry.l2Name}`;
    l2Node.metaDescription = `انواع ${entry.l2Name}؛ ثبت آگهی خرید یا فروش به صورت عمده و جزئی.`;
    result.push(l2Node);

    const seenProducts = new Set();
    entry.products.forEach((productName, productIndex) => {
      const lookupName =
        OTHER_GOODS_PRODUCT_OLD_NAME_ALIASES[normName(productName)] || normName(productName);
      const oldProduct =
        findOldItem(oldItems, productName) ||
        oldItems.find((item) => normName(item.name) === lookupName) ||
        null;

      if (seenProducts.has(normName(productName))) return;
      const productId =
        oldProduct?.id && !result.some((n) => n.id === oldProduct.id) ? oldProduct.id : nextId++;
      const node = buildNode({
        id: productId,
        name: productName,
        parentId: l2Node.id,
        level: "product",
        sortOrder: productIndex + 1,
        oldNode: oldProduct,
        groupName: entry.l2Name,
      });
      if (OTHER_GOODS_CUSTOM_PRODUCTS.has(normName(productName))) {
        node.description =
          `${productName} از گروه ${entry.l2Name}؛ برای ثبت کالایی که در فهرست نیست این گزینه را انتخاب کنید و نام دقیق کالا را در توضیحات آگهی بنویسید.`;
      } else if (node.description?.includes("از گروه")) {
        node.description = node.description.replace(/از گروه [^؛]+/, `از گروه ${entry.l2Name}`);
      }
      result.push(node);
      seenProducts.add(normName(productName));
    });
  }

  return result;
}

function relocateSesameToKeshbar(nodes) {
  const agRoot = findAgRoot(nodes);
  if (!agRoot) return nodes;

  const sesame = nodes.find((node) => normName(node.name) === normName("کنجد"));
  const keshbar = nodes.find(
    (node) => node.parentId === agRoot.id && normName(node.name) === normName("خشکبار")
  );
  if (!sesame || !keshbar) return nodes;

  sesame.parentId = keshbar.id;
  if (sesame.description?.includes("از گروه")) {
    sesame.description = sesame.description.replace(/از گروه [^؛]+/, "از گروه خشکبار");
  }

  const oilSeeds = nodes.find(
    (node) => node.parentId === agRoot.id && normName(node.name) === normName("دانه‌های روغنی")
  );
  if (oilSeeds) {
    const hasChildren = nodes.some((node) => node.parentId === oilSeeds.id);
    if (!hasChildren) {
      return nodes.filter((node) => node.id !== oilSeeds.id);
    }
  }

  return nodes;
}

function applyRootDisplayNames(nodes) {
  return nodes.map((node) => {
    if (node.parentId != null) return node;

    const displayName = ROOT_DISPLAY_NAMES[normName(node.name)];
    if (!displayName || displayName === node.name) return node;

    const updated = { ...node, name: displayName };
    if (updated.metaTitle === node.name || updated.metaTitle?.includes(node.name)) {
      updated.metaTitle = displayName;
    }
    if (updated.description?.includes(`«${node.name}»`)) {
      updated.description = updated.description.replace(`«${node.name}»`, `«${displayName}»`);
    } else if (updated.description?.startsWith(`دسته اصلی «${node.name}»`)) {
      updated.description = `دسته اصلی «${displayName}»؛ مناسب خرید و فروش عمده و جزئی.`;
    }
    if (updated.metaDescription === `خرید و فروش ${node.name}`) {
      updated.metaDescription = `خرید و فروش ${displayName}`;
    }
    return updated;
  });
}

const ROOT_ID_BASE = 900001;
const ROOT_ID_MAX = 900099;
const CATEGORY_ID_BASE = 910001;
const CATEGORY_ID_MAX = 919999;
const PRODUCT_ID_BASE = 920001;

function sortNodesBfs(nodes) {
  const byParent = new Map();
  for (const node of nodes) {
    const key = node.parentId ?? "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(node);
  }
  for (const children of byParent.values()) {
    children.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, "fa"));
  }

  const sorted = [];
  const walk = (parentKey) => {
    for (const child of byParent.get(parentKey) || []) {
      sorted.push(child);
      walk(child.id);
    }
  };
  walk("root");
  return sorted;
}

function standardizeIds(nodes) {
  const parentIdSet = new Set(nodes.map((node) => node.parentId).filter((v) => v != null));
  const hasChildren = (id) => parentIdSet.has(id);

  const roots = nodes
    .filter((node) => node.parentId == null)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, "fa"));

  let nextRootId = ROOT_ID_BASE;
  let nextCategoryId = CATEGORY_ID_BASE;
  let nextProductId = PRODUCT_ID_BASE;
  const idMap = new Map();

  for (const root of roots) {
    if (nextRootId > ROOT_ID_MAX) {
      throw new Error("Too many root categories for ID range");
    }
    idMap.set(root.id, nextRootId++);
  }

  const queue = [...roots];
  while (queue.length) {
    const parent = queue.shift();
    const children = nodes
      .filter((node) => node.parentId === parent.id)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, "fa"));

    for (const child of children) {
      let newId;
      if (hasChildren(child.id)) {
        if (nextCategoryId > CATEGORY_ID_MAX) {
          throw new Error("Too many subcategories for ID range");
        }
        newId = nextCategoryId++;
      } else {
        newId = nextProductId++;
      }
      idMap.set(child.id, newId);
      queue.push(child);
    }
  }

  if (idMap.size !== nodes.length) {
    throw new Error(`ID mapping incomplete: ${idMap.size}/${nodes.length}`);
  }

  return nodes.map((node) => ({
    ...node,
    id: idMap.get(node.id),
    parentId: node.parentId == null ? null : idMap.get(node.parentId),
  }));
}

function sortNodesForSeeding(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthOf = (node) => {
    let depth = 0;
    let current = node;
    const seen = new Set();
    while (current?.parentId != null && !seen.has(current.id)) {
      seen.add(current.id);
      depth += 1;
      current = byId.get(current.parentId);
    }
    return depth;
  };

  return [...nodes].sort(
    (a, b) => depthOf(a) - depthOf(b) || (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id
  );
}

function main() {
  const excelRows = readExcelRows();
  const oldItems = JSON.parse(fs.readFileSync(OLD_PATH, "utf8"));
  const oldByName = indexOldByName(oldItems);
  const oldById = buildOldParentMap(oldItems);

  const excelNames = new Set();
  const rootsOrder = [];
  const categoriesOrder = [];
  const categoryKeySet = new Set();

  for (const row of excelRows) {
    excelNames.add(normName(row.parent));
    excelNames.add(normName(row.child));
    excelNames.add(normName(row.product));

    if (!rootsOrder.find((r) => normName(r) === normName(row.parent))) {
      rootsOrder.push(row.parent);
    }

    const catKey = `${normName(row.parent)}::${normName(row.child)}`;
    if (!categoryKeySet.has(catKey)) {
      categoryKeySet.add(catKey);
      categoriesOrder.push({ parent: row.parent, child: row.child });
    }
  }

  const usedIds = new Set();
  const newByNormName = new Map();
  const newById = new Map();
  let nextId = Math.max(...oldItems.map((item) => Number(item.id)), ROOT_ID_START) + 1;

  function allocateId(preferredNodes) {
    const oldNode = pickOldNode(preferredNodes);
    if (oldNode && !usedIds.has(oldNode.id) && !OLD_MAIN_ROOT_IDS.has(oldNode.id)) {
      usedIds.add(oldNode.id);
      return oldNode.id;
    }
    while (usedIds.has(nextId) || OLD_MAIN_ROOT_IDS.has(nextId)) nextId += 1;
    const id = nextId;
    usedIds.add(id);
    nextId += 1;
    return id;
  }

  let result = [];

  const rootIdByNorm = new Map();
  rootsOrder.forEach((rootName, index) => {
    const id = ROOT_ID_START + index;
    usedIds.add(id);
    const oldNode = pickOldNode(oldByName.get(normName(rootName)));
    const node = buildNode({
      id,
      name: rootName,
      parentId: null,
      level: "root",
      sortOrder: index + 1,
      oldNode,
    });
    result.push(node);
    rootIdByNorm.set(normName(rootName), id);
    newByNormName.set(normName(rootName), node);
    newById.set(id, node);
  });

  const categoryIdByKey = new Map();
  categoriesOrder.forEach(({ parent, child }, index) => {
    const parentId = rootIdByNorm.get(normName(parent));
    const key = `${normName(parent)}::${normName(child)}`;
    const oldNode = pickOldNode(oldByName.get(normName(child)));
    const id = allocateId(oldByName.get(normName(child)));
    const node = buildNode({
      id,
      name: child,
      parentId,
      level: "category",
      sortOrder: index + 1,
      oldNode,
    });
    result.push(node);
    categoryIdByKey.set(key, id);
    newByNormName.set(normName(child), node);
    newById.set(id, node);
  });

  const productsByCategory = new Map();
  for (const row of excelRows) {
    const key = `${normName(row.parent)}::${normName(row.child)}`;
    if (!productsByCategory.has(key)) productsByCategory.set(key, []);
    productsByCategory.get(key).push(row.product);
  }

  for (const [key, products] of productsByCategory.entries()) {
    const parentId = categoryIdByKey.get(key);
    const childName = categoriesOrder.find(
      (c) => `${normName(c.parent)}::${normName(c.child)}` === key
    )?.child;

    products.forEach((productName, index) => {
      const oldNode = pickOldNode(oldByName.get(normName(productName)));
      const id = allocateId(oldByName.get(normName(productName)));
      const node = buildNode({
        id,
        name: productName,
        parentId,
        level: "product",
        sortOrder: index + 1,
        oldNode,
        groupName: childName,
      });
      result.push(node);
      newByNormName.set(normName(productName), node);
      newById.set(id, node);
    });
  }

  const oldParentIds = new Set(oldItems.map((item) => item.parentId).filter((v) => v != null));
  const oldLeaves = oldItems.filter((item) => !oldParentIds.has(item.id));

  const { ids: autoLegacyIds } = collectOldAutoSubtree(oldItems);

  const extras = [];
  for (const oldItem of oldItems) {
    const key = normName(oldItem.name);
    if (excelNames.has(key)) continue;
    if (OLD_MAIN_ROOT_IDS.has(oldItem.id) && oldItem.parentId == null) continue;
    if (!isLegacyAutoPartsNode(oldItem, autoLegacyIds, oldById)) continue;
    extras.push(oldItem);
  }

  extras.sort((a, b) => {
    const depth = (item) => {
      let d = 0;
      let cur = item;
      const seen = new Set();
      while (cur?.parentId != null && !seen.has(cur.id)) {
        seen.add(cur.id);
        d += 1;
        cur = oldById.get(cur.parentId);
      }
      return d;
    };
    return depth(a) - depth(b);
  });

  for (const oldItem of extras) {
    if (usedIds.has(oldItem.id)) continue;

    const parentId = findParentInNewTree(oldItem, oldById, newByNormName, newById);
    if (parentId == null) {
      const firstRoot = result.find((n) => n.parentId == null);
      if (!firstRoot) continue;
      console.warn(`Orphan "${oldItem.name}" attached to root "${firstRoot.name}"`);
    }

    const isCategory = oldParentIds.has(oldItem.id);
    const parentNode = result.find((n) => n.id === (parentId ?? findParentInNewTree(oldItem, oldById, newByNormName, newById)));
    const siblings = result.filter((n) => n.parentId === (parentId ?? parentNode?.id));
    const node = buildNode({
      id: oldItem.id,
      name: oldItem.name,
      parentId: parentId ?? parentNode?.id ?? result[0].id,
      level: isCategory ? "category" : "product",
      sortOrder: siblings.length + 1,
      oldNode: oldItem,
      groupName: parentNode?.name,
    });

    usedIds.add(node.id);
    result.push(node);
    newByNormName.set(normName(node.name), node);
    newById.set(node.id, node);
  }

  applyAutoPartsRoot(result, oldItems);

  result = removeOrphanLegacyNodes(result, oldItems, excelNames);
  result = consolidateAgriculturalChemicals(result);
  result = consolidateLegacyParallelCategories(result);
  result = flattenRedundantSingleChildCategories(result);
  result = deduplicateNodesByName(result);
  result = flattenRedundantSingleChildCategories(result);
  result = enforceExcelThreeLevelStructure(result);
  result = deduplicateNodesByName(result);
  result = flattenRedundantSingleChildCategories(result);
  result = pruneToExcelOnly(result, excelRows);
  result = injectAgSupplementalCatalog(result, oldItems);
  result = injectAutoPartsCatalog(result, oldItems);
  result = injectCosmeticsHealthCatalog(result, oldItems);
  result = injectApparelTextileFashionCatalog(result, oldItems);
  result = injectBagsShoesLeatherCatalog(result, oldItems);
  result = injectOtherGoodsCatalog(result, oldItems);
  result = relocateSesameToKeshbar(result);
  result = applyRootDisplayNames(result);
  result = reorderCatalogByExcel(result, excelRows);
  result = fixProductGroupDescriptions(result);
  result = fixInputDescriptions(result);

  let normalized = standardizeIds(result);
  normalized = sortNodesBfs(normalized);
  normalized = applyCategoryTranslations(normalized);

  const idCounts = normalized.reduce((map, item) => {
    map.set(item.id, (map.get(item.id) || 0) + 1);
    return map;
  }, new Map());
  const duplicates = [...idCounts.entries()].filter(([, count]) => count > 1);
  if (duplicates.length) {
    console.error("Duplicate IDs:", duplicates);
    process.exit(1);
  }

  const output = `${JSON.stringify(normalized, null, 2)}\n`;
  fs.writeFileSync(OUT_PATH, output, "utf8");
  fs.writeFileSync(FINAL_OUT_PATH, output, "utf8");

  const roots = normalized.filter((n) => n.parentId == null);
  const parentIds = new Set(normalized.map((n) => n.parentId).filter((v) => v != null));
  const leaves = normalized.filter((n) => !parentIds.has(n.id));
  const byId = new Map(normalized.map((n) => [n.id, n]));
  const depthDist = {};
  let maxDepth = 0;
  let deepCategories = 0;
  for (const node of normalized) {
    const depth = getNodeDepth(node.id, byId);
    depthDist[depth] = (depthDist[depth] || 0) + 1;
    if (depth > maxDepth) maxDepth = depth;
    if (parentIds.has(node.id) && depth >= 2) deepCategories += 1;
  }

  console.log("Excel rows:", excelRows.length);
  console.log("Old items:", oldItems.length);
  console.log("Extra auto-parts items kept:", extras.length);
  console.log("Output:", OUT_PATH);
  console.log("Final:", FINAL_OUT_PATH);
  console.log("Total:", normalized.length, "| roots:", roots.length, "| leaves:", leaves.length);
  console.log("ID ranges: roots", ROOT_ID_BASE, "-", roots[roots.length - 1]?.id);
  console.log(
    "categories",
    Math.min(...normalized.filter((n) => parentIds.has(n.id)).map((n) => n.id)),
    "-",
    Math.max(...normalized.filter((n) => parentIds.has(n.id)).map((n) => n.id))
  );
  console.log(
    "products",
    Math.min(...leaves.map((n) => n.id)),
    "-",
    Math.max(...leaves.map((n) => n.id))
  );
  console.log("Roots:", roots.map((r) => `${r.id}:${r.name}`).join(" | "));
  console.log("Depth distribution:", depthDist, "| max:", maxDepth, "| categories at depth>=2:", deepCategories);
}

main();
