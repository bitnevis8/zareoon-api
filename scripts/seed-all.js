const sequelize = require('../src/core/database/mysql/connection');
const seedUsers = require('../src/modules/user/user/seeder');
const seedRoles = require('../src/modules/user/role/seeder');
const seedUserRoles = require('../src/modules/user/userRole/seeder');
const seedProducts = require('../src/modules/farmer/product/seeder');
const seedInventoryLots = require('../src/modules/farmer/inventoryLot/seeder');
const seedOrders = require('../src/modules/farmer/order/seeder');
const seedOrderItems = require('../src/modules/farmer/orderItem/seeder');
const seedOrderRequestItems = require('../src/modules/farmer/orderRequestItem/seeder');

const seedAll = async () => {
  try {
    console.log('🚀 Starting database seeding...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Sync database
    await sequelize.sync({ force: false });
    console.log('✅ Database synchronized.');
    
    // Seed in order
    await seedRoles();
    await seedUsers();
    await seedUserRoles();
    await seedProducts();
    await seedInventoryLots();
    await seedOrders();
    await seedOrderItems();
    await seedOrderRequestItems();
    
    console.log('🎉 All seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await sequelize.close();
  }
};

seedAll();
