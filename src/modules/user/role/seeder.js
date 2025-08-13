const Role = require("./model");
const seederData = require("./seederData.json");

async function seedRoles() {
  try {
    for (const roleData of seederData) {
      await Role.findOrCreate({
        where: { name: roleData.name },
        defaults: roleData
      });
    }
    console.log("✅ Roles seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding roles:", error);
  }
}

module.exports = seedRoles; 