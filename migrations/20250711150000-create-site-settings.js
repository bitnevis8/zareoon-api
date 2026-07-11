"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("site_settings", {
      key: {
        type: Sequelize.STRING(64),
        primaryKey: true,
        allowNull: false,
      },
      value: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.bulkInsert("site_settings", [
      {
        key: "tradeProvidersAutoApprove",
        value: JSON.stringify(false),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("site_settings");
  },
};
