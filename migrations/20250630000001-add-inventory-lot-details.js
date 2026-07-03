'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('inventory_lots', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Supplier custom description for this inventory lot',
    });

    await queryInterface.addColumn('inventory_lots', 'location_label', {
      type: Sequelize.STRING(200),
      allowNull: true,
      comment: 'Title for location e.g. loading point',
    });

    await queryInterface.addColumn('inventory_lots', 'latitude', {
      type: Sequelize.DECIMAL(10, 7),
      allowNull: true,
    });

    await queryInterface.addColumn('inventory_lots', 'longitude', {
      type: Sequelize.DECIMAL(10, 7),
      allowNull: true,
    });

    const table = await queryInterface.describeTable('custom_attribute_definitions');
    if (!table.product_id) {
      await queryInterface.addColumn('custom_attribute_definitions', 'product_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      });
    }

    if (table.category_id && table.category_id.allowNull === false) {
      await queryInterface.changeColumn('custom_attribute_definitions', 'category_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('inventory_lots', 'description');
    await queryInterface.removeColumn('inventory_lots', 'location_label');
    await queryInterface.removeColumn('inventory_lots', 'latitude');
    await queryInterface.removeColumn('inventory_lots', 'longitude');

    const table = await queryInterface.describeTable('custom_attribute_definitions');
    if (table.product_id) {
      await queryInterface.removeColumn('custom_attribute_definitions', 'product_id');
    }
  },
};
