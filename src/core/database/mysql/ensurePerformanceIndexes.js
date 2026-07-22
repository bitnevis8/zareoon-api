/**
 * ایندکس‌ها و FULLTEXT امن و idempotent — روی هر استارت API اعمال می‌شود.
 * پارتیشن‌بندی ماهانه/سالانه روی جداول زنده فعلاً اعمال نمی‌شود
 * (نیاز به تغییر PRIMARY KEY و ریسک شکستن FK دارد).
 */

const INDEXES = [
  // files — کاور تصاویر موجودی/محصول (بدون underscored → camelCase)
  {
    table: "files",
    name: "idx_files_module_entity_created",
    sql: "CREATE INDEX idx_files_module_entity_created ON files (module, entityId, createdAt)",
  },
  {
    table: "files",
    name: "idx_files_uploader",
    sql: "CREATE INDEX idx_files_uploader ON files (uploaderId)",
  },

  // inventory_lots — ویترین، داشبورد، فیلتر وضعیت
  {
    table: "inventory_lots",
    name: "idx_lots_farmer_status_updated",
    sql: "CREATE INDEX idx_lots_farmer_status_updated ON inventory_lots (farmer_id, status, updated_at)",
  },
  {
    table: "inventory_lots",
    name: "idx_lots_status_updated",
    sql: "CREATE INDEX idx_lots_status_updated ON inventory_lots (status, updated_at)",
  },
  {
    table: "inventory_lots",
    name: "idx_lots_status_product",
    sql: "CREATE INDEX idx_lots_status_product ON inventory_lots (status, product_id)",
  },
  {
    table: "inventory_lots",
    name: "idx_lots_product_status",
    sql: "CREATE INDEX idx_lots_product_status ON inventory_lots (product_id, status)",
  },

  // products — لیست کاتالوگ و صفحه اصلی
  {
    table: "products",
    name: "idx_products_homepage",
    sql: "CREATE INDEX idx_products_homepage ON products (homepage_sort_order, sort_order, id)",
  },
  {
    table: "products",
    name: "idx_products_parent_orderable_active",
    sql: "CREATE INDEX idx_products_parent_orderable_active ON products (parent_id, is_orderable, is_active)",
  },
  {
    table: "products",
    name: "idx_products_status_leaf",
    sql: "CREATE INDEX idx_products_status_leaf ON products (status, is_leaf)",
  },

  // orders
  {
    table: "orders",
    name: "idx_orders_supplier_id",
    sql: "CREATE INDEX idx_orders_supplier_id ON orders (supplier_id)",
  },
  {
    table: "orders",
    name: "idx_orders_supplier_status",
    sql: "CREATE INDEX idx_orders_supplier_status ON orders (supplier_id, status)",
  },
  {
    table: "order_items",
    name: "idx_order_items_product_id",
    sql: "CREATE INDEX idx_order_items_product_id ON order_items (product_id)",
  },

  // accounts — فروشگاه‌های عمومی
  {
    table: "accounts",
    name: "idx_accounts_public_shop_created",
    sql: "CREATE INDEX idx_accounts_public_shop_created ON accounts (is_public, shop_status, created_at, id)",
  },
  {
    table: "accounts",
    name: "idx_accounts_profile_slug_lower",
    sql: "CREATE INDEX idx_accounts_profile_slug ON accounts (profile_slug)",
  },

  // messaging inbox
  {
    table: "conversations",
    name: "idx_conversations_p1_updated",
    sql: "CREATE INDEX idx_conversations_p1_updated ON conversations (participant_one_id, updated_at)",
  },
  {
    table: "conversations",
    name: "idx_conversations_p2_updated",
    sql: "CREATE INDEX idx_conversations_p2_updated ON conversations (participant_two_id, updated_at)",
  },
  {
    table: "messages",
    name: "idx_messages_conv_unread",
    sql: "CREATE INDEX idx_messages_conv_unread ON messages (conversation_id, read_at, sender_id)",
  },
  {
    table: "messages",
    name: "idx_messages_created_at",
    sql: "CREATE INDEX idx_messages_created_at ON messages (created_at)",
  },

  // social
  {
    table: "supplier_reviews",
    name: "idx_reviews_supplier_created",
    sql: "CREATE INDEX idx_reviews_supplier_created ON supplier_reviews (supplier_id, created_at)",
  },
  {
    table: "supplier_posts",
    name: "idx_posts_created",
    sql: "CREATE INDEX idx_posts_created ON supplier_posts (created_at)",
  },

  // trade providers
  {
    table: "trade_service_providers",
    name: "idx_tsp_public_list",
    sql: "CREATE INDEX idx_tsp_public_list ON trade_service_providers (status, is_public, page_status, id)",
  },

  // users — فیلتر فعال
  {
    table: "users",
    name: "idx_users_active",
    sql: "CREATE INDEX idx_users_active ON users (is_active)",
  },
  {
    table: "user_roles",
    name: "idx_user_roles_user",
    sql: "CREATE INDEX idx_user_roles_user ON user_roles (user_id)",
  },
  {
    table: "user_roles",
    name: "idx_user_roles_role",
    sql: "CREATE INDEX idx_user_roles_role ON user_roles (role_id)",
  },

  // applicant notifications
  {
    table: "applicant_request_notifications",
    name: "idx_arn_recipient_unread",
    sql: "CREATE INDEX idx_arn_recipient_unread ON applicant_request_notifications (recipient_user_id, read_at, id)",
  },
];

const FULLTEXT = [
  {
    table: "products",
    name: "ft_products_names",
    sql: "CREATE FULLTEXT INDEX ft_products_names ON products (name, english_name, arabic_name, russian_name, turkish_name, finnish_name, urdu_name, slug)",
  },
  {
    table: "hs_codes",
    name: "ft_hs_description",
    sql: "CREATE FULLTEXT INDEX ft_hs_description ON hs_codes (description_fa)",
  },
  {
    table: "supplier_posts",
    name: "ft_posts_body",
    sql: "CREATE FULLTEXT INDEX ft_posts_body ON supplier_posts (body)",
  },
  {
    table: "users",
    name: "ft_users_identity",
    sql: "CREATE FULLTEXT INDEX ft_users_identity ON users (first_name, last_name, username)",
  },
  {
    table: "inventory_lots",
    name: "ft_lots_names",
    sql: "CREATE FULLTEXT INDEX ft_lots_names ON inventory_lots (english_name, arabic_name, russian_name, description, location_label)",
  },
];

async function indexExists(sequelize, table, name) {
  const [rows] = await sequelize.query(
    `SELECT 1 AS ok
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = :table
       AND index_name = :name
     LIMIT 1`,
    { replacements: { table, name } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function tableExists(sequelize, table) {
  const [rows] = await sequelize.query(
    `SELECT 1 AS ok
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = :table
     LIMIT 1`,
    { replacements: { table } }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function ensurePerformanceIndexes(sequelize) {
  let created = 0;
  let skipped = 0;

  for (const item of [...INDEXES, ...FULLTEXT]) {
    try {
      if (!(await tableExists(sequelize, item.table))) {
        skipped += 1;
        continue;
      }
      if (await indexExists(sequelize, item.table, item.name)) {
        skipped += 1;
        continue;
      }
      await sequelize.query(item.sql);
      created += 1;
      console.log(`✅ Index created: ${item.name}`);
    } catch (e) {
      const msg = e.message || String(e);
      if (/Duplicate key name|ER_DUP_KEYNAME|already exists/i.test(msg)) {
        skipped += 1;
        continue;
      }
      // FULLTEXT ممکن است روی نسخه/کالیشن خاص fail شود — نباید استارت را بشکند
      console.warn(`⚠️ Index skipped (${item.name}):`, msg);
    }
  }

  console.log(`📊 Performance indexes: ${created} created, ${skipped} already present/skipped`);
  return { created, skipped };
}

module.exports = {
  ensurePerformanceIndexes,
  INDEXES,
  FULLTEXT,
};
