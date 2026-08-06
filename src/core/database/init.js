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
require("../../modules/farmer/inventoryLot/dailyPriceModel");
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
require("../../modules/workspace/model");
require("../../modules/productLanding/model");
require("../../modules/productLanding/templateModel");
require("../../modules/barter/model");
require("../../modules/exportPathway/model");

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
      console.log("⏳ FORCE_SYNC: dropping & recreating all tables...");
      await mysqlConnection.query("SET FOREIGN_KEY_CHECKS = 0");
      await mysqlConnection.sync({ force: true });
      await mysqlConnection.query("SET FOREIGN_KEY_CHECKS = 1");
      console.log("✅ FORCE_SYNC finished.");
    } else {
      // sequelize.sync() روی دیتابیس بزرگ / با قفل متادیتا اغلب گیر می‌کند.
      // وقتی FORCE_SYNC=false فقط ALTER سبک + ایندکس؛ ساخت جدول جدید با FORCE_SYNC=true یک‌بار.
      console.log("ℹ️ FORCE_SYNC=false — از sequelize.sync رد شد (جلوگیری از هنگ).");
      console.log("⏳ Checking optional ALTER/INDEX statements...");
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
        "ALTER TABLE users ADD COLUMN active_workspace_id INT NULL",
        "ALTER TABLE workspaces ADD COLUMN address_text TEXT NULL",
        "ALTER TABLE workspaces ADD COLUMN address_label VARCHAR(300) NULL",
        "ALTER TABLE workspaces ADD COLUMN latitude DECIMAL(10,7) NULL",
        "ALTER TABLE workspaces ADD COLUMN longitude DECIMAL(10,7) NULL",
        "ALTER TABLE workspaces ADD COLUMN business_hours JSON NULL",
        "ALTER TABLE product_landing_pages ADD COLUMN template_id INT NULL",
        "ALTER TABLE inventory_lots ADD COLUMN accept_cash TINYINT(1) NOT NULL DEFAULT 1",
        "ALTER TABLE inventory_lots ADD COLUMN accept_barter TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE inventory_lots ADD COLUMN barter_desired_kind VARCHAR(16) NOT NULL DEFAULT 'product'",
        "ALTER TABLE inventory_lots ADD COLUMN barter_desired_category_id INT NULL",
        "ALTER TABLE inventory_lots ADD COLUMN barter_desired_category_label VARCHAR(255) NULL",
        "ALTER TABLE inventory_lots ADD COLUMN barter_desired_service_category_id VARCHAR(64) NULL",
        "ALTER TABLE inventory_lots ADD COLUMN barter_desired_service_subcategory_id VARCHAR(64) NULL",
        "ALTER TABLE inventory_lots ADD COLUMN barter_desired_name VARCHAR(255) NULL",
        "ALTER TABLE inventory_lots ADD COLUMN barter_desired_quantity DECIMAL(18,3) NULL",
        "ALTER TABLE inventory_lots ADD COLUMN barter_desired_unit VARCHAR(50) NULL",
        "ALTER TABLE inventory_lots ADD COLUMN barter_announce_mode VARCHAR(16) NOT NULL DEFAULT 'silent'",
        "ALTER TABLE inventory_lots ADD COLUMN barter_notes TEXT NULL",
        "ALTER TABLE inventory_lots ADD COLUMN barter_announced_at DATETIME NULL",
        "CREATE INDEX idx_lots_accept_barter ON inventory_lots (accept_barter, status)",
        "CREATE INDEX idx_lots_barter_category ON inventory_lots (barter_desired_category_id)",
        "CREATE INDEX idx_lots_barter_kind ON inventory_lots (barter_desired_kind, accept_barter)",
        "CREATE INDEX idx_lots_barter_service_cat ON inventory_lots (barter_desired_service_category_id)",
        `CREATE TABLE IF NOT EXISTS inventory_lot_daily_prices (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          inventory_lot_id INT NOT NULL,
          price_date DATE NOT NULL,
          price DECIMAL(18,2) NOT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_lot_daily_price_date (inventory_lot_id, price_date),
          KEY idx_lot_daily_price_date (price_date),
          CONSTRAINT fk_lot_daily_prices_lot FOREIGN KEY (inventory_lot_id) REFERENCES inventory_lots(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        "ALTER TABLE inventory_lots ADD COLUMN fx_rate_source VARCHAR(16) NULL",
        "ALTER TABLE inventory_lots ADD COLUMN fx_rate_manual DECIMAL(18,2) NULL",
        `CREATE TABLE IF NOT EXISTS export_projects (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          reference_code VARCHAR(32) NOT NULL,
          workspace_id INT NOT NULL,
          owner_user_id INT NOT NULL,
          created_by_user_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          status ENUM('draft','active','on_hold','completed','cancelled') NOT NULL DEFAULT 'active',
          export_family VARCHAR(64) NOT NULL DEFAULT 'general',
          template_version VARCHAR(32) NOT NULL,
          inventory_lot_id INT NULL,
          product_id INT NULL,
          product_snapshot JSON NULL,
          origin_country VARCHAR(8) NOT NULL DEFAULT 'IR',
          origin_city VARCHAR(120) NULL,
          destination_country VARCHAR(8) NULL,
          destination_city VARCHAR(120) NULL,
          quantity DECIMAL(18,3) NULL,
          unit VARCHAR(50) NULL,
          estimated_value DECIMAL(18,2) NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'USD',
          customer_type VARCHAR(32) NOT NULL DEFAULT 'unknown',
          packaging_type VARCHAR(80) NULL,
          transport_mode VARCHAR(32) NOT NULL DEFAULT 'unspecified',
          incoterm VARCHAR(16) NOT NULL DEFAULT 'unspecified',
          payment_method VARCHAR(32) NOT NULL DEFAULT 'unspecified',
          planned_ship_date DATE NULL,
          notes TEXT NULL,
          flags JSON NULL,
          matched_rule_ids JSON NULL,
          pathway_snapshot JSON NULL,
          progress_percent INT NOT NULL DEFAULT 0,
          total_cost_recorded DECIMAL(18,2) NOT NULL DEFAULT 0,
          completed_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_export_projects_ref (reference_code),
          KEY idx_export_projects_workspace (workspace_id),
          KEY idx_export_projects_owner (owner_user_id),
          KEY idx_export_projects_status (status),
          KEY idx_export_projects_lot (inventory_lot_id),
          KEY idx_export_projects_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS export_step_instances (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          code VARCHAR(64) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NULL,
          phase VARCHAR(32) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          required TINYINT(1) NOT NULL DEFAULT 1,
          status ENUM('locked','ready','in_progress','waiting_for_provider','waiting_for_document','needs_revision','completed','optional','not_applicable') NOT NULL DEFAULT 'locked',
          dependencies JSON NULL,
          documents JSON NULL,
          warnings JSON NULL,
          service_links JSON NULL,
          tool_links JSON NULL,
          help_content TEXT NULL,
          responsible_party VARCHAR(32) NULL,
          estimated_duration VARCHAR(64) NULL,
          required_output VARCHAR(80) NULL,
          template_snapshot JSON NULL,
          notes TEXT NULL,
          cost_amount DECIMAL(18,2) NULL,
          cost_currency VARCHAR(10) NULL,
          provider_id INT NULL,
          provider_name VARCHAR(200) NULL,
          tool_outputs JSON NULL,
          started_at DATETIME NULL,
          completed_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_export_step_project_code (project_id, code),
          KEY idx_export_steps_project (project_id),
          KEY idx_export_steps_status (status),
          CONSTRAINT fk_export_steps_project FOREIGN KEY (project_id) REFERENCES export_projects(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS export_documents (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          step_instance_id INT NULL,
          workspace_id INT NOT NULL,
          uploaded_by_user_id INT NOT NULL,
          title VARCHAR(255) NOT NULL,
          doc_type VARCHAR(80) NULL,
          file_url VARCHAR(500) NULL,
          file_upload_id INT NULL,
          status ENUM('pending','uploaded','approved','rejected') NOT NULL DEFAULT 'pending',
          notes TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_export_docs_project (project_id),
          KEY idx_export_docs_step (step_instance_id),
          CONSTRAINT fk_export_docs_project FOREIGN KEY (project_id) REFERENCES export_projects(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS export_service_requests (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          step_instance_id INT NULL,
          workspace_id INT NOT NULL,
          requested_by_user_id INT NOT NULL,
          service_key VARCHAR(80) NULL,
          category_id VARCHAR(80) NULL,
          subcategory_id VARCHAR(80) NULL,
          provider_id INT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NULL,
          status ENUM('draft','sent','quoted','accepted','rejected','cancelled') NOT NULL DEFAULT 'sent',
          quote_amount DECIMAL(18,2) NULL,
          quote_currency VARCHAR(10) NULL,
          meta JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_export_sr_project (project_id),
          KEY idx_export_sr_workspace (workspace_id),
          KEY idx_export_sr_status (status),
          CONSTRAINT fk_export_sr_project FOREIGN KEY (project_id) REFERENCES export_projects(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS export_progress_logs (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          project_id INT NOT NULL,
          step_instance_id INT NULL,
          workspace_id INT NOT NULL,
          actor_user_id INT NULL,
          action VARCHAR(80) NOT NULL,
          from_status VARCHAR(40) NULL,
          to_status VARCHAR(40) NULL,
          message TEXT NULL,
          meta JSON NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_export_logs_project (project_id),
          KEY idx_export_logs_created (created_at),
          CONSTRAINT fk_export_logs_project FOREIGN KEY (project_id) REFERENCES export_projects(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        "ALTER TABLE messages ADD COLUMN translated_body TEXT NULL",
        "ALTER TABLE messages ADD COLUMN source_lang VARCHAR(8) NULL",
        "ALTER TABLE messages ADD COLUMN target_lang VARCHAR(8) NULL",
        "ALTER TABLE messages ADD COLUMN translation_status ENUM('none','ok','failed','skipped') NOT NULL DEFAULT 'none'",
        "ALTER TABLE messages ADD COLUMN translation_model VARCHAR(120) NULL",
      ];
      for (const sql of alters) {
        try {
          await mysqlConnection.query(sql);
        } catch (e) {
          if (!/Duplicate column|ER_DUP_FIELDNAME|Duplicate key name|ER_DUP_KEYNAME|already exists|ER_TABLE_EXISTS_ERROR/i.test(e.message || "")) {
            console.warn("⚠️ Auth column alter skipped:", e.message);
          }
        }
      }
      console.log("✅ Optional ALTER/INDEX pass finished.");

      try {
        const { ensureSystemTemplates } = require("../../modules/productLanding/controller");
        await ensureSystemTemplates();
      } catch (e) {
        console.warn("⚠️ Landing templates seed skipped:", e.message);
      }
    }

    try {
      console.log("⏳ Ensuring performance indexes...");
      const { ensurePerformanceIndexes } = require("./mysql/ensurePerformanceIndexes");
      await ensurePerformanceIndexes(mysqlConnection);
      console.log("✅ Performance indexes OK.");
    } catch (e) {
      console.warn("⚠️ Performance indexes skipped:", e.message);
    }

    try {
      const seedEscrowRules = require("../../modules/escrow/seeder");
      await seedEscrowRules();
    } catch (e) {
      console.warn("⚠️ Escrow rules seed skipped:", e.message);
    }

    // Warm ParsPack model catalog (non-blocking for chat translate)
    setImmediate(() => {
      try {
        const { isAiEnabled, resolveChatTranslateModelId } = require("../../modules/ai");
        if (!isAiEnabled()) return;
        resolveChatTranslateModelId({ force: true }).catch((e) => {
          console.warn("⚠️ ParsPack model resolve skipped:", e.message);
        });
      } catch (e) {
        console.warn("⚠️ AI warm-up skipped:", e.message);
      }
    });
    
    console.log(`✅ MySQL Database ${options.force ? "recreated" : "synchronized"} successfully.`);

    if (options.seed) {
      console.log("⏳ SEED=true — سیدر کامل ممکن است چند دقیقه طول بکشد (محصولات / HS / …)");
      await seedMySQLDatabase();
      console.log("✅ MySQL Database seeded successfully.");
    } else {
      console.log("ℹ️ SEED=false — سیدر کامل اجرا نشد.");
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