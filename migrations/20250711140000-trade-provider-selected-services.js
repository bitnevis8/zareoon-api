"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("trade_service_providers").catch(() => null);
    if (!table) return;
    if (!table.selected_services) {
      await queryInterface.addColumn("trade_service_providers", "selected_services", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("trade_service_providers").catch(() => null);
    if (!table?.selected_services) return;
    await queryInterface.removeColumn("trade_service_providers", "selected_services");
  },
};
