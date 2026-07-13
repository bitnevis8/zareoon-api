"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("trade_service_providers", "pending_changes", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn("trade_service_providers", "document_urls", {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("trade_service_providers", "document_urls");
    await queryInterface.removeColumn("trade_service_providers", "pending_changes");
  },
};
