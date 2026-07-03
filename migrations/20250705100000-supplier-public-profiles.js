"use strict";

const DEFAULT_HOURS = JSON.stringify({
  saturday: { closed: false, open: "08:00", close: "18:00" },
  sunday: { closed: false, open: "08:00", close: "18:00" },
  monday: { closed: false, open: "08:00", close: "18:00" },
  tuesday: { closed: false, open: "08:00", close: "18:00" },
  wednesday: { closed: false, open: "08:00", close: "18:00" },
  thursday: { closed: false, open: "08:00", close: "18:00" },
  friday: { closed: true, open: null, close: null },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "profile_slug", {
      type: Sequelize.STRING(120),
      allowNull: true,
      unique: true,
    });
    await queryInterface.addColumn("users", "headline", {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addColumn("users", "bio", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn("users", "company_name", {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addColumn("users", "public_phone", {
      type: Sequelize.STRING(30),
      allowNull: true,
    });
    await queryInterface.addColumn("users", "cover_image", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn("users", "business_hours", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn("users", "is_profile_public", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.createTable("supplier_posts", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      body: { type: Sequelize.TEXT, allowNull: false },
      image_url: { type: Sequelize.STRING(500), allowNull: true },
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
    await queryInterface.addIndex("supplier_posts", ["user_id", "created_at"]);

    await queryInterface.createTable("supplier_follows", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      follower_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      following_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
    await queryInterface.addIndex("supplier_follows", ["follower_id", "following_id"], {
      unique: true,
      name: "supplier_follows_unique",
    });
    await queryInterface.addIndex("supplier_follows", ["following_id"]);

    await queryInterface.createTable("supplier_reviews", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      supplier_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      reviewer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      order_id: { type: Sequelize.INTEGER, allowNull: true },
      rating: { type: Sequelize.TINYINT, allowNull: false },
      comment: { type: Sequelize.TEXT, allowNull: true },
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
    await queryInterface.addIndex("supplier_reviews", ["supplier_id", "reviewer_id"], {
      unique: true,
      name: "supplier_reviews_unique_reviewer",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("supplier_reviews");
    await queryInterface.dropTable("supplier_follows");
    await queryInterface.dropTable("supplier_posts");
    const cols = [
      "profile_slug",
      "headline",
      "bio",
      "company_name",
      "public_phone",
      "cover_image",
      "business_hours",
      "is_profile_public",
    ];
    for (const col of cols) {
      await queryInterface.removeColumn("users", col);
    }
  },
};
