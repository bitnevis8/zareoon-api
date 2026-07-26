"use strict";

/**
 * دامنه Workspace:
 * - کسب‌وکار، اعضا، اشتراک، احراز کسب‌وکار/نمایندگی
 * - احراز شخص روی جدول جدا با FK به User
 * - V1: هر کاربر حداکثر یک Workspace (Owner)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const { INTEGER, STRING, TEXT, BOOLEAN, DATE, JSON, ENUM, DECIMAL } = Sequelize;

    await qi.createTable("workspaces", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: STRING(160), allowNull: false },
      display_name: { type: STRING(160), allowNull: true },
      profile_slug: { type: STRING(120), allowNull: true, unique: true },
      entity_type: {
        type: ENUM("individual", "company", "trader", "manufacturer", "distributor"),
        allowNull: false,
        defaultValue: "individual",
      },
      /** نوع فعالیت — نقش امنیتی نیست */
      activity_buyer: { type: BOOLEAN, allowNull: false, defaultValue: true },
      activity_seller: { type: BOOLEAN, allowNull: false, defaultValue: false },
      activity_services: { type: BOOLEAN, allowNull: false, defaultValue: false },
      is_public: { type: BOOLEAN, allowNull: false, defaultValue: true },
      created_by_user_id: {
        type: INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      account_id: {
        type: INTEGER,
        allowNull: true,
        unique: true,
        references: { model: "accounts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: {
        type: DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });
    await qi.addIndex("workspaces", ["created_by_user_id"]);
    await qi.addIndex("workspaces", ["profile_slug"]);

    await qi.createTable("workspace_members", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      workspace_id: {
        type: INTEGER,
        allowNull: false,
        references: { model: "workspaces", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      user_id: {
        type: INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      /** owner | admin | sales | orders_manager | product_editor | viewer */
      role: { type: STRING(40), allowNull: false, defaultValue: "viewer" },
      status: {
        type: ENUM("active", "invited", "suspended", "left"),
        allowNull: false,
        defaultValue: "active",
      },
      invited_by_user_id: {
        type: INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      joined_at: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: {
        type: DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });
    await qi.addIndex("workspace_members", ["workspace_id", "user_id"], {
      unique: true,
      name: "workspace_members_workspace_user_unique",
    });
    await qi.addIndex("workspace_members", ["user_id"]);
    await qi.addIndex("workspace_members", ["role"]);

    await qi.createTable("workspace_subscriptions", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      workspace_id: {
        type: INTEGER,
        allowNull: false,
        references: { model: "workspaces", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      plan_id: { type: STRING(32), allowNull: false },
      /** monthly | quarterly | semiannual | annual | none */
      billing_period: { type: STRING(20), allowNull: false, defaultValue: "none" },
      status: {
        type: ENUM("pending", "active", "expired", "canceled", "failed"),
        allowNull: false,
        defaultValue: "pending",
      },
      amount_toman: { type: INTEGER, allowNull: false, defaultValue: 0 },
      authority: { type: STRING(64), allowNull: true },
      ref_id: { type: STRING(64), allowNull: true },
      gateway: { type: STRING(32), allowNull: false, defaultValue: "zibal" },
      starts_at: { type: DATE, allowNull: true },
      ends_at: { type: DATE, allowNull: true },
      meta: { type: JSON, allowNull: true },
      /** ارجاع به اشتراک قدیمی کاربر (مهاجرت) */
      legacy_user_subscription_id: { type: INTEGER, allowNull: true },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: {
        type: DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });
    await qi.addIndex("workspace_subscriptions", ["workspace_id"]);
    await qi.addIndex("workspace_subscriptions", ["status"]);
    await qi.addIndex("workspace_subscriptions", ["authority"]);

    await qi.createTable("user_person_verifications", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      mobile_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      email_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      national_id_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      identity_review_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      overall_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      meta: { type: JSON, allowNull: true },
      reviewed_at: { type: DATE, allowNull: true },
      reviewed_by_user_id: {
        type: INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: {
        type: DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    await qi.createTable("workspace_business_verifications", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      workspace_id: {
        type: INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "workspaces", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      national_id_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      registration_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      license_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      address_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      bank_account_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      overall_status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      national_id: { type: STRING(20), allowNull: true },
      registration_number: { type: STRING(80), allowNull: true },
      license_info: { type: TEXT, allowNull: true },
      address: { type: TEXT, allowNull: true },
      bank_account_iban: { type: STRING(34), allowNull: true },
      meta: { type: JSON, allowNull: true },
      reviewed_at: { type: DATE, allowNull: true },
      reviewed_by_user_id: {
        type: INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: {
        type: DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    await qi.createTable("workspace_representations", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      workspace_id: {
        type: INTEGER,
        allowNull: false,
        references: { model: "workspaces", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      user_id: {
        type: INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      status: {
        type: ENUM("none", "pending", "verified", "rejected"),
        allowNull: false,
        defaultValue: "none",
      },
      title: { type: STRING(120), allowNull: true },
      meta: { type: JSON, allowNull: true },
      reviewed_at: { type: DATE, allowNull: true },
      reviewed_by_user_id: {
        type: INTEGER,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      created_at: { type: DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: {
        type: DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });
    await qi.addIndex("workspace_representations", ["workspace_id", "user_id"], {
      unique: true,
      name: "workspace_rep_workspace_user_unique",
    });

    // لینک اختیاری از حساب فروشگاه و خدمات‌دهنده به Workspace
    const accounts = await qi.describeTable("accounts");
    if (!accounts.workspace_id) {
      await qi.addColumn("accounts", "workspace_id", {
        type: INTEGER,
        allowNull: true,
        unique: true,
        references: { model: "workspaces", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    const tsp = await qi.describeTable("trade_service_providers");
    if (!tsp.workspace_id) {
      await qi.addColumn("trade_service_providers", "workspace_id", {
        type: INTEGER,
        allowNull: true,
        references: { model: "workspaces", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await qi.addIndex("trade_service_providers", ["workspace_id"]);
    }

    // ——— Backfill V1: یک Workspace برای هر Account / کاربر فروشنده یا خدمات‌دهنده ———
    await qi.sequelize.query(`
      INSERT INTO workspaces (
        name, display_name, profile_slug, entity_type,
        activity_buyer, activity_seller, activity_services, is_public,
        created_by_user_id, account_id, created_at, updated_at
      )
      SELECT
        COALESCE(NULLIF(a.display_name, ''), NULLIF(a.profile_slug, ''), CONCAT('workspace-', a.user_id)),
        a.display_name,
        a.profile_slug,
        a.entity_type,
        1,
        1,
        0,
        a.is_public,
        a.user_id,
        a.id,
        NOW(),
        NOW()
      FROM accounts a
      WHERE a.id NOT IN (SELECT account_id FROM workspaces WHERE account_id IS NOT NULL)
    `);

    await qi.sequelize.query(`
      UPDATE accounts a
      INNER JOIN workspaces w ON w.account_id = a.id
      SET a.workspace_id = w.id
      WHERE a.workspace_id IS NULL
    `);

    await qi.sequelize.query(`
      INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at, created_at, updated_at)
      SELECT w.id, w.created_by_user_id, 'owner', 'active', NOW(), NOW(), NOW()
      FROM workspaces w
      WHERE NOT EXISTS (
        SELECT 1 FROM workspace_members m
        WHERE m.workspace_id = w.id AND m.user_id = w.created_by_user_id
      )
    `);

    await qi.sequelize.query(`
      UPDATE workspaces w
      INNER JOIN trade_service_providers t ON t.user_id = w.created_by_user_id
      SET w.activity_services = 1,
          t.workspace_id = COALESCE(t.workspace_id, w.id)
      WHERE t.workspace_id IS NULL OR t.workspace_id = w.id
    `);

    await qi.sequelize.query(`
      INSERT INTO workspace_subscriptions (
        workspace_id, plan_id, billing_period, status, amount_toman,
        authority, ref_id, gateway, starts_at, ends_at, meta,
        legacy_user_subscription_id, created_at, updated_at
      )
      SELECT
        w.id,
        us.plan_id,
        'monthly',
        us.status,
        us.amount_toman,
        us.authority,
        us.ref_id,
        us.gateway,
        us.starts_at,
        us.ends_at,
        us.meta,
        us.id,
        us.created_at,
        us.updated_at
      FROM user_subscriptions us
      INNER JOIN workspaces w ON w.created_by_user_id = us.user_id
      WHERE NOT EXISTS (
        SELECT 1 FROM workspace_subscriptions ws
        WHERE ws.legacy_user_subscription_id = us.id
      )
    `);

    await qi.sequelize.query(`
      INSERT INTO user_person_verifications (
        user_id, mobile_status, email_status, national_id_status,
        identity_review_status, overall_status, created_at, updated_at
      )
      SELECT
        u.id,
        CASE WHEN u.is_mobile_verified = 1 THEN 'verified' ELSE 'none' END,
        CASE WHEN u.is_email_verified = 1 THEN 'verified' ELSE 'none' END,
        'none',
        'none',
        CASE
          WHEN u.is_mobile_verified = 1 AND u.is_email_verified = 1 THEN 'pending'
          ELSE 'none'
        END,
        NOW(),
        NOW()
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM user_person_verifications v WHERE v.user_id = u.id
      )
    `);

    await qi.sequelize.query(`
      INSERT INTO workspace_business_verifications (workspace_id, overall_status, created_at, updated_at)
      SELECT w.id, 'none', NOW(), NOW()
      FROM workspaces w
      WHERE NOT EXISTS (
        SELECT 1 FROM workspace_business_verifications b WHERE b.workspace_id = w.id
      )
    `);

    await qi.sequelize.query(`
      INSERT INTO workspace_representations (workspace_id, user_id, status, title, created_at, updated_at)
      SELECT w.id, w.created_by_user_id, 'none', 'مالک', NOW(), NOW()
      FROM workspaces w
      WHERE NOT EXISTS (
        SELECT 1 FROM workspace_representations r
        WHERE r.workspace_id = w.id AND r.user_id = w.created_by_user_id
      )
    `);
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const tsp = await qi.describeTable("trade_service_providers").catch(() => ({}));
    if (tsp.workspace_id) await qi.removeColumn("trade_service_providers", "workspace_id");
    const accounts = await qi.describeTable("accounts").catch(() => ({}));
    if (accounts.workspace_id) await qi.removeColumn("accounts", "workspace_id");

    await qi.dropTable("workspace_representations");
    await qi.dropTable("workspace_business_verifications");
    await qi.dropTable("user_person_verifications");
    await qi.dropTable("workspace_subscriptions");
    await qi.dropTable("workspace_members");
    await qi.dropTable("workspaces");
  },
};
