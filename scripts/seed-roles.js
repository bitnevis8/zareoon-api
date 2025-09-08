const config = require("config");
const { initializeDatabase } = require("../src/core/database/init");
const seedRoles = require("../src/modules/user/role/seeder");

async function runRoleSeeder() {
  try {
    console.log("🚀 Starting role seeder...");
    
    // Initialize database
    await initializeDatabase({ 
      force: false,  // Don't recreate tables
      seed: false,   // Don't run all seeders
      useMongoDB: false
    });
    
    console.log("✅ Database initialized");
    
    // Run role seeder
    await seedRoles();
    
    console.log("✅ Role seeder completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Role seeder failed:", error);
    process.exit(1);
  }
}

runRoleSeeder();
