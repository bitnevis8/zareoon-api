'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inventory_lots', 'tiered_pricing', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Tiered pricing structure for different order quantities'
    });

    await queryInterface.addColumn('inventory_lots', 'minimum_order_quantity', {
      type: Sequelize.DECIMAL(18, 3),
      allowNull: true,
      comment: 'Minimum order quantity for this inventory lot'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('inventory_lots', 'tiered_pricing');
    await queryInterface.removeColumn('inventory_lots', 'minimum_order_quantity');
  }
};
