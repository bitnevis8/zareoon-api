const { initializeDatabase } = require("../src/core/database/init");
const Role = require("../src/modules/user/role/model");

async function addUserRole() {
  try {
    console.log("🚀 Adding User role...");
    
    // Initialize database
    await initializeDatabase({ 
      force: false,
      seed: false,
      useMongoDB: false
    });
    
    console.log("✅ Database initialized");
    
    // Check if User role exists
    const existingRole = await Role.findOne({ where: { name: "user" } });
    
    if (existingRole) {
      console.log("✅ User role already exists");
    } else {
      // Create User role
      await Role.create({
        name: "user",
        nameEn: "User",
        nameFa: "کاربر",
        description: "کاربر عادی سیستم"
      });
      console.log("✅ User role created successfully");
    }
    
    console.log("✅ Process completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to add User role:", error);
    process.exit(1);
  }
}

addUserRole();
