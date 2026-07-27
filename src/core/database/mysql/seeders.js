const sequelize = require("./connection");

// Import user module seeders
const seedRoles = require("../../../modules/user/role/seeder");
const seedUsers = require("../../../modules/user/user/seeder");
const seedUserRoles = require("../../../modules/user/userRole/seeder");

// Articles module removed

// Import location module seeders
const seedLocations = require("../../../modules/location/seeder");
const seedHsCodes = require("../../../modules/hsCode/seeder");
// Import farmer module seeders
// Product categories merged into products
const seedProducts = require("../../../modules/farmer/product/seeder");
const seedAttributeDefinitions = require("../../../modules/farmer/customAttributeDefinition/seeder");
const seedInventoryLots = require("../../../modules/farmer/inventoryLot/seeder");
const seedTradeServiceProviders = require("../../../modules/tradeServiceProvider/seeder");
const seedClearDefaultShops = require("../../../modules/account/clearDefaultShopsSeeder");
const seedZareoonOfficial = require("../../../modules/zareoonOfficial/seeder");
const seedAryaFouladOfficial = require("../../../modules/aryaFouladOfficial/seeder");

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

    // 2b. HS customs tariffs 1405
    await runSeederGroup([seedHsCodes], "HS Code Tariffs");

  // 3. Run Farmer module (Products only; categories merged)
  await runSeederGroup([seedProducts, seedAttributeDefinitions], "Farmer Product Data");

    // 4. Clear demo shops / inventory / VIP locks, then seed official providers
    await runSeederGroup(
      [
        seedInventoryLots,
        seedClearDefaultShops,
        seedTradeServiceProviders,
        seedZareoonOfficial,
        seedAryaFouladOfficial,
      ],
      "Clear Defaults + Official Providers"
    );

    console.log("\n✅ All database seeding completed successfully!");
  } catch (error) {
    console.error("\n❌ Database seeding failed:", error);
    process.exit(1);
  }
}

module.exports = runSeeders; 