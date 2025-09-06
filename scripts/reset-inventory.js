const sequelize = require('../src/core/database/mysql/connection');
const InventoryLot = require('../src/modules/farmer/inventoryLot/model');

const resetInventory = async () => {
  try {
    console.log('🚀 Resetting inventory table...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Drop and recreate inventory lots table
    await InventoryLot.drop();
    console.log('✅ Inventory lots table dropped.');
    
    await InventoryLot.sync();
    console.log('✅ Inventory lots table created.');
    
    console.log('🎉 Inventory reset completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during inventory reset:', error);
  } finally {
    await sequelize.close();
  }
};

resetInventory();
