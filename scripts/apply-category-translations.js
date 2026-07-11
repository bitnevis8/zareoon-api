/**
 * Apply title translations to catalog roots and L2 subcategories in seeder JSON files.
 */
const fs = require("fs");
const path = require("path");
const CATEGORY_TRANSLATIONS = require("./category-name-translations");
const CATEGORY_TRANSLATIONS_BY_NAME = CATEGORY_TRANSLATIONS.CATEGORY_TRANSLATIONS_BY_NAME || {};
const normCategoryName = CATEGORY_TRANSLATIONS.normCategoryName || ((value) => String(value || "").trim().toLowerCase());

const PRODUCT_DIR = path.join(__dirname, "../src/modules/farmer/product");

function isCategoryNode(node, byId, parentIds) {
  if (node.parentId == null) return true;
  const parent = byId.get(node.parentId);
  return Boolean(parent && parent.parentId == null);
}

function applyCategoryTranslations(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parentIds = new Set(nodes.map((node) => node.parentId).filter((v) => v != null));

  return nodes.map((node) => {
    if (!isCategoryNode(node, byId, parentIds)) return node;

    const tr =
      CATEGORY_TRANSLATIONS[node.id] ||
      CATEGORY_TRANSLATIONS_BY_NAME[normCategoryName(node.name)];
    if (!tr) return node;

    return {
      ...node,
      englishName: tr.englishName || node.englishName || null,
      arabicName: tr.arabicName || node.arabicName || null,
      russianName: tr.russianName || node.russianName || null,
      turkishName: tr.turkishName || node.turkishName || null,
      finnishName: tr.finnishName || node.finnishName || null,
    };
  });
}

function applyToFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn("Skip missing file:", filePath);
    return null;
  }
  const nodes = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const updated = applyCategoryTranslations(nodes);
  fs.writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  return updated;
}

function summarize(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parentIds = new Set(nodes.map((node) => node.parentId).filter((v) => v != null));
  const cats = nodes.filter((node) => isCategoryNode(node, byId, parentIds));
  const complete = cats.filter(
    (node) =>
      node.englishName &&
      node.arabicName &&
      node.russianName &&
      node.turkishName &&
      node.finnishName
  );
  return { categories: cats.length, complete: complete.length };
}

if (require.main === module) {
  const targets = [
    path.join(PRODUCT_DIR, "seederDataFinal.json"),
    path.join(PRODUCT_DIR, "seederDataNew.json"),
  ];
  for (const filePath of targets) {
    const updated = applyToFile(filePath);
    if (!updated) continue;
    const stats = summarize(updated);
    console.log(path.basename(filePath), stats);
  }
}

module.exports = { applyCategoryTranslations, applyToFile, summarize };
