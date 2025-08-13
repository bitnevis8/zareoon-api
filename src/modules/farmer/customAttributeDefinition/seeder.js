const CustomAttributeDefinition = require("./model");
const seederData = require("./seederData.json");
const Product = require("../product/model");

const seedCustomAttributeDefinitions = async () => {
  console.log("🌱 Seeding Custom Attribute Definitions...");
  const defs = seederData.data || seederData;
  for (const d of defs) {
    let resolvedCategoryId = d.categoryId;
    let resolvedProductId = d.productId;
    try {
      if (!resolvedCategoryId && d.categorySlug) {
        const p = await Product.findOne({ where: { slug: d.categorySlug } });
        resolvedCategoryId = p?.id;
      }
      if (!resolvedCategoryId && d.categoryEnglishName) {
        const p = await Product.findOne({ where: { englishName: d.categoryEnglishName } });
        resolvedCategoryId = p?.id;
      }
      if (!resolvedCategoryId && d.categoryName) {
        const p = await Product.findOne({ where: { name: d.categoryName } });
        resolvedCategoryId = p?.id;
      }
      if (!resolvedProductId && d.productSlug) {
        const p = await Product.findOne({ where: { slug: d.productSlug } });
        resolvedProductId = p?.id;
      }
      if (!resolvedProductId && d.productEnglishName) {
        const p = await Product.findOne({ where: { englishName: d.productEnglishName } });
        resolvedProductId = p?.id;
      }
      if (!resolvedProductId && d.productName) {
        const p = await Product.findOne({ where: { name: d.productName } });
        resolvedProductId = p?.id;
      }
    } catch (e) {
      console.warn("Failed to resolve category for attribute def:", d, e.message);
    }

    if (!resolvedCategoryId && !resolvedProductId) {
      console.warn(`⚠️ Skipping attribute def id=${d.id} name="${d.name}" due to unknown category/product`);
      continue;
    }

    const data = { id: d.id, categoryId: resolvedCategoryId || null, productId: resolvedProductId || null, name: d.name, type: d.type || "text", options: d.options || null };
    const existed = await CustomAttributeDefinition.findByPk(data.id);
    if (!existed) await CustomAttributeDefinition.create(data); else await CustomAttributeDefinition.update(data, { where: { id: data.id } });
  }
  console.log("✅ Custom Attribute Definitions seeding completed!");
};

module.exports = seedCustomAttributeDefinitions;

