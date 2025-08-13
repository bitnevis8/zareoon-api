const Product = require("./model");
const treeDataFull = require("./seederData.json");

const seedProducts = async () => {
  console.log("🌱 Seeding Products...");
  // Build a set of IDs that appear as parent (to detect leaves)
  const nodes = Array.isArray(treeDataFull) ? treeDataFull : (treeDataFull.data || []);
  const parentIds = new Set(nodes.map(n => n.parentId).filter(v => v !== null && v !== undefined));

  for (const n of nodes) {
    const isLeaf = !parentIds.has(n.id);
    const data = {
      id: n.id,
      parentId: n.parentId || null,
      name: n.name,
      englishName: n.englishName || null,
      slug: n.slug || null,
      description: n.description || null,
      imageUrl: n.imageUrl || null,
      isActive: typeof n.isActive === 'boolean' ? n.isActive : true,
      sortOrder: Number.isFinite(n.sortOrder) ? n.sortOrder : null,
      isFeatured: typeof n.isFeatured === 'boolean' ? n.isFeatured : false,
      icon: n.icon || null,
      metaTitle: n.metaTitle || null,
      metaDescription: n.metaDescription || null,
      validUnits: n.validUnits || null,
      // Leaf nodes are orderable by default in unified model
      isOrderable: Boolean(isLeaf),
      unit: n.unit || (Array.isArray(n.validUnits) && n.validUnits.includes("Kilogram") ? "kg" : null),
    };
    const existed = await Product.findByPk(data.id);
    if (!existed) await Product.create(data); else await Product.update(data, { where: { id: data.id } });
  }
  console.log("✅ Products seeding completed!");
};

module.exports = seedProducts;

