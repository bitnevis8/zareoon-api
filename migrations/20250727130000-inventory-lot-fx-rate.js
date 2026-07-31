"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("inventory_lots", "fx_rate_source", {
      type: Sequelize.STRING(16),
      allowNull: true,
      comment: "manual | zareoon",
    });
    await queryInterface.addColumn("inventory_lots", "fx_rate_manual", {
      type: Sequelize.DECIMAL(18, 2),
      allowNull: true,
      comment: "Toman per 1 unit of price currency",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("inventory_lots", "fx_rate_manual");
    await queryInterface.removeColumn("inventory_lots", "fx_rate_source");
  },
};
