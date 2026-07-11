"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("products", "turkish_name", {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addColumn("products", "finnish_name", {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("products", "finnish_name");
    await queryInterface.removeColumn("products", "turkish_name");
  },
};
