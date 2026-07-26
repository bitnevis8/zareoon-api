"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("workspaces").catch(() => null);
    if (!table) return;

    if (!table.address_text) {
      await queryInterface.addColumn("workspaces", "address_text", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!table.address_label) {
      await queryInterface.addColumn("workspaces", "address_label", {
        type: Sequelize.STRING(300),
        allowNull: true,
      });
    }
    if (!table.latitude) {
      await queryInterface.addColumn("workspaces", "latitude", {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }
    if (!table.longitude) {
      await queryInterface.addColumn("workspaces", "longitude", {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      });
    }
    if (!table.business_hours) {
      await queryInterface.addColumn("workspaces", "business_hours", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("workspaces").catch(() => null);
    if (!table) return;
    for (const col of ["business_hours", "longitude", "latitude", "address_label", "address_text"]) {
      if (table[col]) await queryInterface.removeColumn("workspaces", col);
    }
  },
};
