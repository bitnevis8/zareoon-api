const mysqlConnection = require("./mysql/connection");
const mongoDBConnection = require("./mongodb/connection");
const seedMySQLDatabase = require("./mysql/seeders");
const seedMongoDB = require("./mongodb/seeders");

// Import MySQL models
require("../../modules/user/user/model");
require("../../modules/user/role/model");
require("../../modules/user/userRole/model");
// require("../../modules/aryafoulad/missionOrder/model");
// require("../../modules/aryafoulad/rateSettings/model");
// require("../../modules/aryafoulad/warehouseModule/warehouse/model");
// require("../../modules/aryafoulad/warehouseModule/inventory/model");

// Articles module removed

// Import Location module models
require("../../modules/location/model");
require("../../modules/hsCode/model");
// Import Farmer module models (categories merged into Product)
require("../../modules/farmer/product/model");
require("../../modules/farmer/customAttributeDefinition/model");
require("../../modules/farmer/inventoryLot/model");
require("../../modules/farmer/customAttributeValue/model");
require("../../modules/farmer/order/model");
require("../../modules/farmer/orderItem/model");
  require("../../modules/farmer/orderRequestItem/model");
require("../../modules/farmer/transactionHistory/model");
require("../../modules/lcRequest/model");
require("../../modules/serviceRequest/model");
require("../../modules/applicantRequest/model");
require("../../modules/tradeServiceProvider/model");
require("../../modules/siteSetting/model");
require("../../modules/messaging/conversation/model");
require("../../modules/messaging/message/model");
require("../../modules/supplierProfile/post/model");
require("../../modules/supplierProfile/follow/model");
require("../../modules/supplierProfile/review/model");
require("../../modules/tradeServiceProvider/review/model");
require("../../modules/publicSlug/model");
require("../../modules/account/model");
require("../../modules/account/profileField/model");
require("../../modules/escrow/model");
require("../../modules/subscription/model");

// Import and define all associations
const defineAssociations = require("../../modules/associations");

/**
 * راه‌اندازی اتصال به دیتابیس‌ها و اجرای migrations
 * @param {Object} options - تنظیمات راه‌اندازی
 * @param {boolean} options.force - آیا جداول موجود حذف و دوباره ساخته شوند
 * @param {boolean} options.seed - آیا داده‌های اولیه وارد شوند
 * @param {boolean} options.useMongoDB - آیا از MongoDB استفاده شود
 */
const initializeDatabase = async (options = { force: false, seed: false, useMongoDB: false }) => {
  try {
    // اتصال و راه‌اندازی MySQL
    await mysqlConnection.authenticate();
    console.log("✅ MySQL Connection has been established successfully.");

    // تعریف تمام ارتباطات بین مدل‌ها
    console.log("🔗 Defining model associations...");
    defineAssociations();
    console.log("✅ All associations defined successfully.");

    if (options.force) {
      // غیرفعال کردن موقت Foreign Key Checks
      await mysqlConnection.query('SET FOREIGN_KEY_CHECKS = 0');
      await mysqlConnection.sync({ force: true });
      await mysqlConnection.query('SET FOREIGN_KEY_CHECKS = 1');
    } else {
      await mysqlConnection.sync();
      // ستون‌های جدید احراز هویت (اگر هنوز نیستند)
      const alters = [
        "ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN sms_daily_count INT NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN sms_daily_date DATE NULL",
        "ALTER TABLE trade_service_providers ADD COLUMN profile_slug VARCHAR(120) NULL",
        "ALTER TABLE trade_service_providers ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1",
        "CREATE UNIQUE INDEX trade_service_providers_profile_slug_unique ON trade_service_providers (profile_slug)",
        "ALTER TABLE accounts ADD COLUMN can_hide_public_page TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE accounts ADD COLUMN latitude DECIMAL(10,7) NULL",
        "ALTER TABLE accounts ADD COLUMN longitude DECIMAL(10,7) NULL",
        "ALTER TABLE accounts ADD COLUMN address_label VARCHAR(300) NULL",
        "ALTER TABLE accounts ADD COLUMN business_hours JSON NULL",
        "ALTER TABLE trade_service_providers ADD COLUMN business_hours JSON NULL",
        "ALTER TABLE trade_service_providers ADD COLUMN latitude DECIMAL(10,7) NULL",
        "ALTER TABLE trade_service_providers ADD COLUMN longitude DECIMAL(10,7) NULL",
        "ALTER TABLE trade_service_providers ADD COLUMN address_label VARCHAR(300) NULL",
        "ALTER TABLE accounts ADD COLUMN shop_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'",
        "ALTER TABLE accounts ADD COLUMN deletion_requested_at DATETIME NULL",
        "ALTER TABLE trade_service_providers ADD COLUMN page_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'",
        "ALTER TABLE trade_service_providers ADD COLUMN deletion_requested_at DATETIME NULL",
        "ALTER TABLE accounts ADD COLUMN last_slug_changed_at DATETIME NULL",
        "ALTER TABLE accounts ADD COLUMN public_landline VARCHAR(30) NULL",
        "ALTER TABLE accounts ADD COLUMN public_email VARCHAR(120) NULL",
        "ALTER TABLE accounts ADD COLUMN shop_contacts JSON NULL",
        "ALTER TABLE accounts ADD COLUMN display_name VARCHAR(120) NULL",
      ];
      for (const sql of alters) {
        try {
          await mysqlConnection.query(sql);
        } catch (e) {
          if (!/Duplicate column|ER_DUP_FIELDNAME|Duplicate key name|ER_DUP_KEYNAME/i.test(e.message || "")) {
            console.warn("⚠️ Auth column alter skipped:", e.message);
          }
        }
      }
    }

    try {
      const seedEscrowRules = require("../../modules/escrow/seeder");
      await seedEscrowRules();
    } catch (e) {
      console.warn("⚠️ Escrow rules seed skipped:", e.message);
    }
    
    console.log(`✅ MySQL Database ${options.force ? "recreated" : "synchronized"} successfully.`);

    if (options.seed) {
      await seedMySQLDatabase();
      console.log("✅ MySQL Database seeded successfully.");
    }

    // اتصال و راه‌اندازی MongoDB
    if (options.useMongoDB) {
      await mongoDBConnection.connect();
      await mongoDBConnection.authenticate();
      
      if (options.seed) {
        await seedMongoDB();
        console.log("✅ MongoDB Database seeded successfully.");
      }
    }

  } catch (error) {
    console.error("❌ Unable to initialize database:", error);
    throw error;
  }
};

module.exports = initializeDatabase; 