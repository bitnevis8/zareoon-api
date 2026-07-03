const Role = require("./model");
const seederData = require("./seederData.json");

async function seedRoles() {
  try {
    for (const roleData of seederData) {
      const [role, created] = await Role.findOrCreate({
        where: { name: roleData.name },
        defaults: roleData,
      });
      if (!created) {
        await role.update({
          nameEn: roleData.nameEn,
          nameFa: roleData.nameFa,
        });
      }
    }
    console.log("✅ Roles seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding roles:", error);
  }
}

module.exports = seedRoles; 