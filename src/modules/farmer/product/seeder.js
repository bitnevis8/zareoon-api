const Product = require("./model");
const treeDataFull = require("./seederData5.json");

function tField(translations, lang, key) {
  const block = translations?.[lang];
  if (!block || typeof block !== "object") return null;
  const value = block[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapNodeToProduct(n) {
  const tr = n.translations || {};
  const faName = tField(tr, "fa", "name");
  const enName = tField(tr, "en", "name");
  const name = faName || enName || n.slug || `product-${n.id}`;

  const isLeaf = Boolean(n.isLeaf);
  const status = n.status || "active";
  const allowedUnits = Array.isArray(n.allowedMeasurementUnits) ? n.allowedMeasurementUnits : null;
  const defaultUnit = n.defaultMeasurementUnit || (allowedUnits && allowedUnits[0]) || null;

  return {
    id: n.id,
    parentId: n.parentId ?? null,
    name,
    englishName: enName,
    arabicName: tField(tr, "ar", "name"),
    russianName: tField(tr, "ru", "name"),
    turkishName: tField(tr, "tr", "name"),
    finnishName: tField(tr, "fi", "name"),
    urduName: tField(tr, "ur", "name"),
    slug: n.slug || null,
    description: tField(tr, "fa", "metaDescription") || tField(tr, "en", "metaDescription"),
    imageUrl: n.imageUrl || null,
    imageStatus: n.imageStatus || null,
    icon: n.icon || null,
    unit: defaultUnit,
    isOrderable: isLeaf,
    isActive: status === "active",
    sortOrder: Number.isFinite(n.sortOrder) ? n.sortOrder : null,
    homepageSortOrder: Number.isFinite(n.homepageSortOrder) ? n.homepageSortOrder : null,
    isFeatured: typeof n.isFeatured === "boolean" ? n.isFeatured : false,
    metaTitle: tField(tr, "fa", "metaTitle") || tField(tr, "en", "metaTitle"),
    metaDescription: tField(tr, "fa", "metaDescription") || tField(tr, "en", "metaDescription"),
    validUnits: allowedUnits,
    supplyCountry: n.supplyCountry || "IR",
    supplyCity: n.supplyCity || null,
    level: Number.isFinite(n.level) ? n.level : null,
    isLeaf,
    path: n.path || null,
    status,
    attributeSetId: n.attributeSetId || null,
    filters: Array.isArray(n.filters) ? n.filters : null,
    defaultMeasurementUnit: defaultUnit,
    allowedMeasurementUnits: allowedUnits,
    allowedPackagingTypes: Array.isArray(n.allowedPackagingTypes) ? n.allowedPackagingTypes : null,
    listingPolicy: n.listingPolicy || null,
    tradeCompliance: n.tradeCompliance || null,
    seo: n.seo || null,
    translations: tr,
    translationStatus: n.translationStatus || null,
    translationReview: n.translationReview || null,
    unitSchemaVersion: Number.isFinite(n.unitSchemaVersion) ? n.unitSchemaVersion : null,
  };
}

function sortNodesForSeeding(nodes) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depthOf = (node) => {
    if (Number.isFinite(node.level)) return node.level;
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

const seedProducts = async () => {
  console.log("🌱 Seeding Products from seederData5.json...");
  const raw = Array.isArray(treeDataFull) ? treeDataFull : treeDataFull.data || [];
  const nodes = sortNodesForSeeding(raw);

  let created = 0;
  let updated = 0;

  for (const n of nodes) {
    const data = mapNodeToProduct(n);
    const existed = await Product.findByPk(data.id);
    if (!existed) {
      await Product.create(data);
      created += 1;
    } else {
      await Product.update(data, { where: { id: data.id } });
      updated += 1;
    }
  }

  console.log(`✅ Products seeding completed! created=${created}, updated=${updated}, total=${nodes.length}`);
};

module.exports = seedProducts;
