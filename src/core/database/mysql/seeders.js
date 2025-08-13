const sequelize = require("./connection");

// Import user module seeders
const seedRoles = require("../../../modules/user/role/seeder");
const seedUsers = require("../../../modules/user/user/seeder");
const seedUserRoles = require("../../../modules/user/userRole/seeder");

// Articles module removed

// Import location module seeders
const seedLocations = require("../../../modules/location/seeder");
// Import farmer module seeders
// Product categories merged into products
const seedProducts = require("../../../modules/farmer/product/seeder");
const seedAttributeDefinitions = require("../../../modules/farmer/customAttributeDefinition/seeder");
const seedAttributeValues = require("../../../modules/farmer/customAttributeValue/seeder");
const seedInventoryLots = require("../../../modules/farmer/inventoryLot/seeder");
const seedOrders = require("../../../modules/farmer/order/seeder");
const seedOrderItems = require("../../../modules/farmer/orderItem/seeder");
const seedTransactionHistory = require("../../../modules/farmer/transactionHistory/seeder");

// Group seeders by module for better organization and control
const userSeeders = [seedRoles, seedUsers, seedUserRoles];

async function runSeederGroup(seeders, groupName) {
  console.log(`\nRunning ${groupName} Seeders...`);
  for (const seeder of seeders) {
    try {
      await seeder();
      console.log(`✅ ${seeder.name} completed successfully`);
    } catch (error) {
      console.error(`❌ Error in ${seeder.name}:`, error);
      throw error; // Re-throw to stop the seeding process
    }
  }
  console.log(`✅ ${groupName} Seeding completed\n`);
}

async function runSeeders() {
  try {
    console.log("🌱 Starting database seeding...\n");

    // 1. Run user module seeders (Roles, Users, UserRoles)
    await runSeederGroup(userSeeders, "User Data");

    // 2. Run Locations (independent entities)
    // await runSeederGroup([seedLocations], "Location Data");

  // 3. Run Farmer module (Products only; categories merged)
  await runSeederGroup([seedProducts, seedAttributeDefinitions], "Farmer Product Data");

    // 4. Run Farmer inventory and orders (optional empty)
    await runSeederGroup([seedInventoryLots, seedOrders, seedOrderItems, seedAttributeValues, seedTransactionHistory], "Farmer Operational Data");

    console.log("\n✅ All database seeding completed successfully!");
  } catch (error) {
    console.error("\n❌ Database seeding failed:", error);
    process.exit(1);
  }
}

module.exports = runSeeders; 