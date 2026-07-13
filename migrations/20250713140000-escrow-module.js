"use strict";

/** ماژول بیعانه — جداول مستقل از درگاه پرداخت */

module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, TEXT, BOOLEAN, DECIMAL, DATE, ENUM, JSON } = Sequelize;

    await queryInterface.createTable("escrow_rules", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      rule_code: { type: STRING(64), allowNull: false, unique: true },
      name: { type: STRING(200), allowNull: false },
      description: { type: TEXT, allowNull: true },
      target_type: {
        type: ENUM("global", "seller_tier", "seller_user", "product_category"),
        allowNull: false,
        defaultValue: "global",
      },
      target_id: { type: STRING(64), allowNull: true },
      deposit_type: { type: ENUM("percent", "fixed"), allowNull: false, defaultValue: "percent" },
      deposit_percent: { type: DECIMAL(8, 4), allowNull: true },
      deposit_fixed_amount: { type: DECIMAL(18, 4), allowNull: true },
      min_deposit_amount: { type: DECIMAL(18, 4), allowNull: true },
      max_deposit_amount: { type: DECIMAL(18, 4), allowNull: true },
      currency: { type: STRING(10), allowNull: true },
      platform_fee_percent: { type: DECIMAL(8, 4), allowNull: false, defaultValue: 1.5 },
      release_policy: { type: JSON, allowNull: true },
      priority: { type: INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: DATE, allowNull: false },
      updated_at: { type: DATE, allowNull: false },
    });

    await queryInterface.createTable("escrow_agreements", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      reference_code: { type: STRING(32), allowNull: false, unique: true },
      order_id: { type: INTEGER, allowNull: true },
      buyer_id: { type: INTEGER, allowNull: false },
      seller_id: { type: INTEGER, allowNull: false },
      created_by_user_id: { type: INTEGER, allowNull: false },
      rule_id: { type: INTEGER, allowNull: true },
      title: { type: STRING(255), allowNull: false },
      description: { type: TEXT, allowNull: true },
      deal_total_amount: { type: DECIMAL(18, 4), allowNull: false },
      deposit_amount: { type: DECIMAL(18, 4), allowNull: false },
      deposit_percent: { type: DECIMAL(8, 4), allowNull: true },
      currency: { type: STRING(10), allowNull: false, defaultValue: "USD" },
      fx_rate: { type: DECIMAL(18, 8), allowNull: true },
      fx_base_currency: { type: STRING(10), allowNull: true },
      fx_quote_currency: { type: STRING(10), allowNull: true },
      fx_locked_at: { type: DATE, allowNull: true },
      platform_fee_percent: { type: DECIMAL(8, 4), allowNull: false, defaultValue: 1.5 },
      platform_fee_amount: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      locked_amount: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      released_amount: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      refunded_amount: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      fee_collected_amount: { type: DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
      status: {
        type: ENUM(
          "draft",
          "awaiting_payment",
          "funds_locked",
          "in_progress",
          "partially_released",
          "fully_released",
          "refunded",
          "cancelled",
          "expired",
          "disputed",
          "completed"
        ),
        allowNull: false,
        defaultValue: "draft",
      },
      expires_at: { type: DATE, allowNull: true },
      locked_at: { type: DATE, allowNull: true },
      completed_at: { type: DATE, allowNull: true },
      cancelled_at: { type: DATE, allowNull: true },
      metadata: { type: JSON, allowNull: true },
      created_at: { type: DATE, allowNull: false },
      updated_at: { type: DATE, allowNull: false },
    });

    await queryInterface.createTable("escrow_milestones", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      agreement_id: { type: INTEGER, allowNull: false },
      sort_order: { type: INTEGER, allowNull: false, defaultValue: 0 },
      title: { type: STRING(255), allowNull: false },
      description: { type: TEXT, allowNull: true },
      amount: { type: DECIMAL(18, 4), allowNull: false },
      percent_of_deposit: { type: DECIMAL(8, 4), allowNull: true },
      status: {
        type: ENUM("pending", "in_review", "approved", "released", "skipped"),
        allowNull: false,
        defaultValue: "pending",
      },
      requires_buyer_approval: { type: BOOLEAN, allowNull: false, defaultValue: true },
      requires_seller_confirmation: { type: BOOLEAN, allowNull: false, defaultValue: false },
      requires_admin_approval: { type: BOOLEAN, allowNull: false, defaultValue: false },
      buyer_approved_at: { type: DATE, allowNull: true },
      seller_confirmed_at: { type: DATE, allowNull: true },
      admin_approved_at: { type: DATE, allowNull: true },
      released_at: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false },
      updated_at: { type: DATE, allowNull: false },
    });

    await queryInterface.createTable("escrow_payment_intents", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      agreement_id: { type: INTEGER, allowNull: false },
      amount: { type: DECIMAL(18, 4), allowNull: false },
      currency: { type: STRING(10), allowNull: false },
      status: {
        type: ENUM("pending", "awaiting_external", "confirmed", "failed", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      due_at: { type: DATE, allowNull: true },
      confirmed_at: { type: DATE, allowNull: true },
      external_payment_ref: { type: STRING(128), allowNull: true },
      idempotency_key: { type: STRING(128), allowNull: true, unique: true },
      metadata: { type: JSON, allowNull: true },
      created_at: { type: DATE, allowNull: false },
      updated_at: { type: DATE, allowNull: false },
    });

    await queryInterface.createTable("escrow_ledger_entries", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      agreement_id: { type: INTEGER, allowNull: false },
      entry_type: { type: ENUM("hold", "release", "refund", "fee", "adjustment"), allowNull: false },
      amount: { type: DECIMAL(18, 4), allowNull: false },
      currency: { type: STRING(10), allowNull: false },
      balance_locked_after: { type: DECIMAL(18, 4), allowNull: false },
      balance_released_after: { type: DECIMAL(18, 4), allowNull: false },
      balance_refunded_after: { type: DECIMAL(18, 4), allowNull: false },
      actor_user_id: { type: INTEGER, allowNull: true },
      actor_role: { type: STRING(32), allowNull: true },
      reference_type: { type: STRING(64), allowNull: true },
      reference_id: { type: INTEGER, allowNull: true },
      idempotency_key: { type: STRING(128), allowNull: true, unique: true },
      note: { type: TEXT, allowNull: true },
      created_at: { type: DATE, allowNull: false },
    });

    await queryInterface.createTable("escrow_release_requests", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      agreement_id: { type: INTEGER, allowNull: false },
      milestone_id: { type: INTEGER, allowNull: true },
      amount: { type: DECIMAL(18, 4), allowNull: false },
      currency: { type: STRING(10), allowNull: false },
      status: {
        type: ENUM("pending", "approved", "rejected", "processing", "completed"),
        allowNull: false,
        defaultValue: "pending",
      },
      request_type: {
        type: ENUM("milestone_auto", "seller_request", "buyer_request", "admin_manual"),
        allowNull: false,
        defaultValue: "seller_request",
      },
      requested_by_user_id: { type: INTEGER, allowNull: false },
      approved_by_user_id: { type: INTEGER, allowNull: true },
      reason: { type: TEXT, allowNull: true },
      admin_notes: { type: TEXT, allowNull: true },
      completed_at: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false },
      updated_at: { type: DATE, allowNull: false },
    });

    await queryInterface.createTable("escrow_refunds", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      agreement_id: { type: INTEGER, allowNull: false },
      amount: { type: DECIMAL(18, 4), allowNull: false },
      currency: { type: STRING(10), allowNull: false },
      reason_code: { type: STRING(64), allowNull: true },
      reason: { type: TEXT, allowNull: true },
      status: {
        type: ENUM("pending", "approved", "rejected", "processing", "completed"),
        allowNull: false,
        defaultValue: "pending",
      },
      requested_by_user_id: { type: INTEGER, allowNull: false },
      approved_by_user_id: { type: INTEGER, allowNull: true },
      completed_at: { type: DATE, allowNull: true },
      created_at: { type: DATE, allowNull: false },
      updated_at: { type: DATE, allowNull: false },
    });

    await queryInterface.createTable("escrow_disputes", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      agreement_id: { type: INTEGER, allowNull: false },
      opened_by_user_id: { type: INTEGER, allowNull: false },
      opened_by_role: { type: ENUM("buyer", "seller"), allowNull: false },
      status: {
        type: ENUM(
          "filed",
          "under_review",
          "resolved_buyer",
          "resolved_seller",
          "resolved_split",
          "closed",
          "withdrawn"
        ),
        allowNull: false,
        defaultValue: "filed",
      },
      reason: { type: STRING(255), allowNull: false },
      description: { type: TEXT, allowNull: true },
      attachments: { type: JSON, allowNull: true },
      blocks_release: { type: BOOLEAN, allowNull: false, defaultValue: true },
      resolution_notes: { type: TEXT, allowNull: true },
      resolved_by_user_id: { type: INTEGER, allowNull: true },
      resolved_at: { type: DATE, allowNull: true },
      buyer_refund_percent: { type: DECIMAL(8, 4), allowNull: true },
      seller_release_percent: { type: DECIMAL(8, 4), allowNull: true },
      created_at: { type: DATE, allowNull: false },
      updated_at: { type: DATE, allowNull: false },
    });

    await queryInterface.createTable("escrow_dispute_messages", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      dispute_id: { type: INTEGER, allowNull: false },
      user_id: { type: INTEGER, allowNull: false },
      message: { type: TEXT, allowNull: false },
      attachments: { type: JSON, allowNull: true },
      created_at: { type: DATE, allowNull: false },
    });

    await queryInterface.createTable("escrow_events", {
      id: { type: INTEGER, primaryKey: true, autoIncrement: true },
      agreement_id: { type: INTEGER, allowNull: false },
      event_type: { type: STRING(64), allowNull: false },
      actor_user_id: { type: INTEGER, allowNull: true },
      actor_role: { type: STRING(32), allowNull: true },
      payload: { type: JSON, allowNull: true },
      created_at: { type: DATE, allowNull: false },
    });

    const now = new Date();
    await queryInterface.bulkInsert("escrow_rules", [
      {
        rule_code: "GLOBAL_DEFAULT_30",
        name: "بیعانه پیش‌فرض — ۳۰٪",
        description: "برای فروشندگان جدید و معاملات عمومی",
        target_type: "global",
        target_id: null,
        deposit_type: "percent",
        deposit_percent: 30,
        deposit_fixed_amount: null,
        min_deposit_amount: null,
        max_deposit_amount: null,
        currency: null,
        platform_fee_percent: 1.5,
        release_policy: null,
        priority: 0,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        rule_code: "VERIFIED_SELLER_10",
        name: "فروشنده تأییدشده — ۱۰٪",
        description: "برای فروشندگان با سابقه تأییدشده",
        target_type: "seller_tier",
        target_id: "verified",
        deposit_type: "percent",
        deposit_percent: 10,
        deposit_fixed_amount: null,
        min_deposit_amount: null,
        max_deposit_amount: null,
        currency: null,
        platform_fee_percent: 1.5,
        release_policy: null,
        priority: 10,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    const tables = [
      "escrow_events",
      "escrow_dispute_messages",
      "escrow_disputes",
      "escrow_refunds",
      "escrow_release_requests",
      "escrow_ledger_entries",
      "escrow_payment_intents",
      "escrow_milestones",
      "escrow_agreements",
      "escrow_rules",
    ];
    for (const t of tables) {
      await queryInterface.dropTable(t);
    }
  },
};
