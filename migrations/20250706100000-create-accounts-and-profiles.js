"use strict";

const ENTITY_TYPES = ["individual", "company", "trader", "manufacturer", "distributor"];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("accounts", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      entity_type: {
        type: Sequelize.ENUM(...ENTITY_TYPES),
        allowNull: false,
        defaultValue: "individual",
      },
      profile_slug: { type: Sequelize.STRING(120), allowNull: true, unique: true },
      headline: { type: Sequelize.STRING(200), allowNull: true },
      bio: { type: Sequelize.TEXT, allowNull: true },
      public_phone: { type: Sequelize.STRING(30), allowNull: true },
      cover_image: { type: Sequelize.STRING(500), allowNull: true },
      business_hours: { type: Sequelize.JSON, allowNull: true },
      country: { type: Sequelize.STRING(100), allowNull: true },
      is_public: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("accounts", ["profile_slug"]);
    await queryInterface.addIndex("accounts", ["entity_type"]);

    await queryInterface.createTable("account_profile_fields", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "accounts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      field_key: { type: Sequelize.STRING(80), allowNull: false },
      field_value: { type: Sequelize.TEXT, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("account_profile_fields", ["account_id", "field_key"], {
      unique: true,
      name: "account_profile_fields_unique",
    });

    // انتقال داده از users (در صورت وجود ستون‌ها)
    const usersTable = await queryInterface.describeTable("users");
    if (usersTable.profile_slug) {
      await queryInterface.sequelize.query(`
        INSERT INTO accounts (user_id, entity_type, profile_slug, headline, bio, public_phone, cover_image, business_hours, is_public, created_at, updated_at)
        SELECT id,
          CASE WHEN company_name IS NOT NULL AND company_name != '' THEN 'company' ELSE 'individual' END,
          profile_slug, headline, bio, public_phone, cover_image, business_hours,
          COALESCE(is_profile_public, 1), created_at, updated_at
        FROM users
        WHERE profile_slug IS NOT NULL OR headline IS NOT NULL OR bio IS NOT NULL OR company_name IS NOT NULL
      `);

      await queryInterface.sequelize.query(`
        INSERT INTO account_profile_fields (account_id, field_key, field_value, created_at, updated_at)
        SELECT a.id, 'companyName', u.company_name, NOW(), NOW()
        FROM users u
        INNER JOIN accounts a ON a.user_id = u.id
        WHERE u.company_name IS NOT NULL AND u.company_name != ''
      `);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("account_profile_fields");
    await queryInterface.dropTable("accounts");
  },
};
