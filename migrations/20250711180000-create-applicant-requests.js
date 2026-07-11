"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("applicant_requests", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      request_type: {
        type: Sequelize.ENUM("product", "service"),
        allowNull: false,
      },
      product_category_id: { type: Sequelize.INTEGER, allowNull: true },
      service_category_id: { type: Sequelize.STRING(64), allowNull: true },
      service_subcategory_id: { type: Sequelize.STRING(64), allowNull: true },
      category_label: { type: Sequelize.STRING(255), allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      quantity: { type: Sequelize.DECIMAL(18, 3), allowNull: true },
      unit: { type: Sequelize.STRING(50), allowNull: true },
      phone: { type: Sequelize.STRING(32), allowNull: false },
      company: { type: Sequelize.STRING(255), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      details: { type: Sequelize.JSON, allowNull: true },
      status: {
        type: Sequelize.ENUM("open", "closed", "fulfilled", "cancelled"),
        allowNull: false,
        defaultValue: "open",
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("applicant_requests", ["user_id"]);
    await queryInterface.addIndex("applicant_requests", ["request_type"]);
    await queryInterface.addIndex("applicant_requests", ["product_category_id"]);
    await queryInterface.addIndex("applicant_requests", ["service_category_id"]);
    await queryInterface.addIndex("applicant_requests", ["status"]);

    await queryInterface.createTable("applicant_request_notifications", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      request_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "applicant_requests", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      recipient_user_id: { type: Sequelize.INTEGER, allowNull: false },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("applicant_request_notifications", ["recipient_user_id"]);
    await queryInterface.addIndex("applicant_request_notifications", ["request_id"]);
    await queryInterface.addIndex("applicant_request_notifications", ["read_at"]);
    await queryInterface.addIndex(
      "applicant_request_notifications",
      ["request_id", "recipient_user_id"],
      { unique: true, name: "applicant_request_notifications_request_recipient_unique" }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("applicant_request_notifications");
    await queryInterface.dropTable("applicant_requests");
  },
};
