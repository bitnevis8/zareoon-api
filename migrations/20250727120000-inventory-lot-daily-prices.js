"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("inventory_lot_daily_prices", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      inventory_lot_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "inventory_lots", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      price_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: "Gregorian civil date (YYYY-MM-DD)",
      },
      price: {
        type: Sequelize.DECIMAL(18, 2),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("inventory_lot_daily_prices", ["inventory_lot_id", "price_date"], {
      unique: true,
      name: "uq_lot_daily_price_date",
    });
    await queryInterface.addIndex("inventory_lot_daily_prices", ["price_date"], {
      name: "idx_lot_daily_price_date",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("inventory_lot_daily_prices");
  },
};
