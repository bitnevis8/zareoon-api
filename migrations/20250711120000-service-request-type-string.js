"use strict";

/** Allow new trade-service category slugs (import-export, intl-logistics, …) */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("service_requests").catch(() => null);
    if (!table) return;

    if (table.service_type && table.service_type.type.includes("ENUM")) {
      await queryInterface.changeColumn("service_requests", "service_type", {
        type: Sequelize.STRING(64),
        allowNull: false,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("service_requests").catch(() => null);
    if (!table) return;

    await queryInterface.changeColumn("service_requests", "service_type", {
      type: Sequelize.ENUM(
        "trade",
        "logistics",
        "customs",
        "finance",
        "inspection",
        "insurance",
        "consulting",
        "documents"
      ),
      allowNull: false,
    });
  },
};
