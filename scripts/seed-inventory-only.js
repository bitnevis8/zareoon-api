const sequelize = require('../src/core/database/mysql/connection');
const seedInventoryLots = require('../src/modules/farmer/inventoryLot/seeder');

const seedInventoryOnly = async () => {
  try {
    console.log('🚀 Starting inventory seeding...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Seed inventory lots
    await seedInventoryLots();
    
    console.log('🎉 Inventory seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during inventory seeding:', error);
  } finally {
    await sequelize.close();
  }
};

seedInventoryOnly();
