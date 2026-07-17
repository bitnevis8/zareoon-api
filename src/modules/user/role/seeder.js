const Role = require("./model");
const UserRole = require("../userRole/model");
const seederData = require("./seederData.json");

/** Rename legacy role names in-place or merge into canonical roles. */
async function migrateLegacyRoleNames() {
  const renames = [
    { from: "customer", to: "user", nameEn: "User", nameFa: "کاربر" },
    { from: "supplier", to: "seller", nameEn: "Seller", nameFa: "فروشنده" },
    { from: "farmer", to: "seller", nameEn: "Seller", nameFa: "فروشنده" },
    { from: "loader", to: "seller", nameEn: "Seller", nameFa: "فروشنده" },
  ];

  for (const { from, to, nameEn, nameFa } of renames) {
    const oldRole = await Role.findOne({ where: { name: from } });
    if (!oldRole) continue;

    let newRole = await Role.findOne({ where: { name: to } });
    if (!newRole) {
      await oldRole.update({ name: to, nameEn, nameFa });
      continue;
    }

    if (oldRole.id === newRole.id) continue;

    const links = await UserRole.findAll({ where: { roleId: oldRole.id } });
    for (const link of links) {
      await UserRole.findOrCreate({
        where: { userId: link.userId, roleId: newRole.id },
        defaults: { userId: link.userId, roleId: newRole.id },
      });
      await link.destroy();
    }
    await oldRole.destroy();
  }
}

async function seedRoles() {
  try {
    await migrateLegacyRoleNames();

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
