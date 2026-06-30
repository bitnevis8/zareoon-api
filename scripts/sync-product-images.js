/**
 * همگام‌سازی imageUrl محصولات از فایل‌های آپلودشده
 * NODE_ENV=development node scripts/sync-product-images.js
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const { Op } = require('sequelize');
const Product = require('../src/modules/farmer/product/model');
const File = require('../src/modules/fileUpload/model');
const sequelize = require('../src/core/database/mysql/connection');

(async () => {
  try {
    await sequelize.authenticate();
    const files = await File.findAll({
      where: { module: 'products', mimeType: { [Op.like]: 'image/%' } },
      order: [['createdAt', 'DESC']],
    });

    const latestByProduct = {};
    for (const f of files) {
      if (!f.entityId || latestByProduct[f.entityId]) continue;
      latestByProduct[f.entityId] = f.downloadUrl;
    }

    let updated = 0;
    for (const [productId, url] of Object.entries(latestByProduct)) {
      const [count] = await Product.update({ imageUrl: url }, { where: { id: productId } });
      if (count) {
        updated++;
        console.log(`✅ product ${productId} → ${url}`);
      }
    }

    console.log(`Done. ${updated} product(s) updated.`);
    await sequelize.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
