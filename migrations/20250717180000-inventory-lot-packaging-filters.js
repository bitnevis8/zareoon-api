"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("inventory_lots");
    if (!table.packaging_type) {
      await queryInterface.addColumn("inventory_lots", "packaging_type", {
        type: Sequelize.STRING(50),
        allowNull: true,
      });
    }
    if (!table.filter_values) {
      await queryInterface.addColumn("inventory_lots", "filter_values", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    if (!table.hs_code) {
      await queryInterface.addColumn("inventory_lots", "hs_code", {
        type: Sequelize.STRING(32),
        allowNull: true,
      });
    }

    const products = await queryInterface.describeTable("products");
    if (products.unit_schema_version && products.unit_schema_version.type !== "STRING") {
      try {
        await queryInterface.changeColumn("products", "unit_schema_version", {
          type: Sequelize.STRING(16),
          allowNull: true,
        });
      } catch (_) {
        // Some dialects may already be compatible; ignore.
      }
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("inventory_lots");
    if (table.hs_code) await queryInterface.removeColumn("inventory_lots", "hs_code");
    if (table.filter_values) await queryInterface.removeColumn("inventory_lots", "filter_values");
    if (table.packaging_type) await queryInterface.removeColumn("inventory_lots", "packaging_type");
  },
};
