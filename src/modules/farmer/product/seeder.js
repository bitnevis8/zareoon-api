const fs = require("fs");
const path = require("path");
const Product = require("./model");
const treeDataFull = require("./seederData.json");

const MAIN_ROOT_IDS = new Set([
  900001, 900002, 900003, 900004, 900005, 900006,
  900007, 900008, 900009, 900010, 900011, 900012,
]);

function extractTranslationObjects(content) {
  const results = [];
  const chunks = content.split(/\n  \},?\n/);
  for (const chunk of chunks) {
    const id = chunk.match(/"id"\s*:\s*(\d+)/)?.[1];
    const slug = chunk.match(/"slug"\s*:\s*"([^"]+)"/)?.[1];
    const englishName = chunk.match(/"englishName"\s*:\s*"([^"]+)"/)?.[1];
    const arabicName = chunk.match(/"arabicName"\s*:\s*"([^"]+)"/)?.[1];
    const russianName = chunk.match(/"russianName"\s*:\s*"([^"]+)"/)?.[1];
    if (!id && !slug) continue;
    results.push({
      id: id ? Number(id) : null,
      slug,
      englishName: englishName || null,
      arabicName: arabicName || null,
      russianName: russianName || null,
    });
  }
  return results;
}

function loadTranslationOverlays() {
  const byId = new Map();
  const bySlug = new Map();
  const dir = path.join(__dirname, "temp translates");

  if (!fs.existsSync(dir)) return { byId, bySlug };

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const nodes = extractTranslationObjects(content);
    for (const item of nodes) {
      const overlay = pickDefined({
        englishName: item.englishName,
        arabicName: item.arabicName,
        russianName: item.russianName,
      });
      if (item.id != null) {
        byId.set(item.id, { ...(byId.get(item.id) || {}), ...overlay });
      }
      if (item.slug) {
        bySlug.set(item.slug, { ...(bySlug.get(item.slug) || {}), ...overlay });
      }
    }
  }

  return { byId, bySlug };
}

function pickDefined(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value != null && value !== "") out[key] = value;
  }
  return out;
}

function resolveTranslations(node, overlays) {
  const byId = overlays.byId.get(node.id) || {};
  const bySlug = node.slug ? overlays.bySlug.get(node.slug) || {} : {};
  return { ...bySlug, ...byId };
}

const seedProducts = async () => {
  console.log("🌱 Seeding Products...");
  const overlays = loadTranslationOverlays();
  const nodes = Array.isArray(treeDataFull) ? treeDataFull : treeDataFull.data || [];
  const parentIds = new Set(nodes.map((n) => n.parentId).filter((v) => v !== null && v !== undefined));

  for (const n of nodes) {
    const isLeaf = !parentIds.has(n.id);
    const isOrderable = MAIN_ROOT_IDS.has(n.id) ? false : Boolean(isLeaf);
    const tr = resolveTranslations(n, overlays);
    const data = {
      id: n.id,
      parentId: n.parentId || null,
      name: n.name,
      englishName: n.englishName || tr.englishName || null,
      arabicName: n.arabicName || tr.arabicName || null,
      russianName: n.russianName || tr.russianName || null,
      slug: n.slug || null,
      description: n.description || null,
      imageUrl: n.imageUrl || null,
      isActive: typeof n.isActive === "boolean" ? n.isActive : true,
      sortOrder: Number.isFinite(n.sortOrder) ? n.sortOrder : null,
      homepageSortOrder: Number.isFinite(n.homepageSortOrder) ? n.homepageSortOrder : null,
      isFeatured: typeof n.isFeatured === "boolean" ? n.isFeatured : false,
      icon: n.icon || null,
      metaTitle: n.metaTitle || null,
      metaDescription: n.metaDescription || null,
      validUnits: n.validUnits || null,
      isOrderable,
      unit: n.unit || (Array.isArray(n.validUnits) && n.validUnits.includes("Kilogram") ? "kg" : null),
      supplyCountry: n.supplyCountry || "IR",
      supplyCity: n.supplyCity || null,
    };
    const existed = await Product.findByPk(data.id);
    if (!existed) await Product.create(data);
    else await Product.update(data, { where: { id: data.id } });
  }
  console.log("✅ Products seeding completed!");
};

module.exports = seedProducts;
