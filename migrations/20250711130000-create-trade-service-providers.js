"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("trade_service_providers", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: { type: Sequelize.INTEGER, allowNull: true },
      entity_type: {
        type: Sequelize.ENUM("company", "individual"),
        allowNull: false,
        defaultValue: "company",
      },
      display_name: { type: Sequelize.STRING, allowNull: false },
      contact_name: { type: Sequelize.STRING, allowNull: false },
      phone: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: true },
      category_id: { type: Sequelize.STRING(64), allowNull: false },
      subcategory_ids: { type: Sequelize.JSON, allowNull: true },
      countries_routes: { type: Sequelize.TEXT, allowNull: true },
      services_offered: { type: Sequelize.TEXT, allowNull: true },
      licenses: { type: Sequelize.TEXT, allowNull: true },
      experience_years: { type: Sequelize.INTEGER, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      admin_notes: { type: Sequelize.TEXT, allowNull: true },
      rating: { type: Sequelize.DECIMAL(3, 2), allowNull: true },
      review_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("trade_service_providers", ["category_id"]);
    await queryInterface.addIndex("trade_service_providers", ["status"]);
    await queryInterface.addIndex("trade_service_providers", ["user_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("trade_service_providers");
  },
};
