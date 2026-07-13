"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("inventory_lots", "price_currency", {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: "TOMAN",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("inventory_lots", "price_currency");
  },
};
