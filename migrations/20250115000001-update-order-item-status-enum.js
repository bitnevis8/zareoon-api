'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Update the ENUM values for order_items.status column
    await queryInterface.changeColumn('order_items', 'status', {
      type: Sequelize.ENUM(
        "pending",
        "approved", 
        "assigned",
        "reviewing",
        "preparing",
        "ready",
        "shipped",
        "delivered",
        "cancelled",
        "rejected",
        "processing"
      ),
      allowNull: false,
      defaultValue: "pending"
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to original ENUM values
    await queryInterface.changeColumn('order_items', 'status', {
      type: Sequelize.ENUM(
        "assigned",
        "reviewing",
        "preparing", 
        "ready",
        "shipped",
        "delivered",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "assigned"
    });
  }
};
