'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'supplier_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    });

    await queryInterface.addColumn('orders', 'admin_notes', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('orders', 'approved_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('orders', 'approved_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    });

    // Update status enum
    await queryInterface.changeColumn('orders', 'status', {
      type: Sequelize.ENUM(
        'pending', 
        'reserved', 
        'approved', 
        'assigned', 
        'preparing', 
        'ready', 
        'shipped', 
        'delivered', 
        'completed', 
        'cancelled'
      ),
      allowNull: false,
      defaultValue: 'pending'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'supplier_id');
    await queryInterface.removeColumn('orders', 'admin_notes');
    await queryInterface.removeColumn('orders', 'approved_at');
    await queryInterface.removeColumn('orders', 'approved_by');

    // Revert status enum
    await queryInterface.changeColumn('orders', 'status', {
      type: Sequelize.ENUM('pending', 'reserved', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    });
  }
};
