const Account = require("../account/model");
const sequelize = require("../../core/database/mysql/connection");

/**
 * پاک‌سازی فروشگاه‌های پیش‌فرض: اسلاگ عمومی و حساب‌های نمایشی.
 */
async function seedClearDefaultShops() {
  console.log("🌱 Clearing default public shop pages (accounts)...");

  try {
    const [updated] = await Account.update(
      { profileSlug: null, isPublic: false, headline: null, bio: null, coverImage: null },
      { where: {} }
    );
    console.log(`✅ Cleared public profile fields on ${updated} account(s).`);
  } catch (e) {
    console.warn("⚠️ Account clear skipped:", e.message);
  }

  // جداول وابسته احتمالی فروشگاه عمومی
  const optionalTables = [
    "supplier_posts",
    "supplier_follows",
    "supplier_reviews",
    "account_profile_fields",
  ];
  for (const table of optionalTables) {
    try {
      await sequelize.query(`DELETE FROM \`${table}\``);
      console.log(`✅ Cleared table ${table}`);
    } catch {
      // table may not exist
    }
  }

  console.log("✅ Default shops cleanup completed!");
}

module.exports = seedClearDefaultShops;
