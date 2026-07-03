"use strict";

/** بازطراحی نقش‌ها: مدیر کل، مدیر، کارمند، تامین‌کننده، کاربر معمولی */

const ROLE_ROWS = [
  { name: "super_admin", name_en: "Super Admin", name_fa: "مدیر کل" },
  { name: "admin", name_en: "Admin", name_fa: "مدیر" },
  { name: "employee", name_en: "Employee", name_fa: "کارمند" },
  { name: "farmer", name_en: "Supplier", name_fa: "تامین کننده" },
  { name: "customer", name_en: "Customer", name_fa: "کاربر معمولی" },
];

const LEGACY_TO_TARGET = {
  loader: "farmer",
  driver: "employee",
  administrator: "admin",
};

async function getRoleIdMap(queryInterface) {
  const [rows] = await queryInterface.sequelize.query("SELECT id, name FROM roles");
  const map = new Map();
  for (const row of rows) map.set(row.name, row.id);
  return map;
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    for (const role of ROLE_ROWS) {
      const [existing] = await queryInterface.sequelize.query(
        "SELECT id FROM roles WHERE name = :name LIMIT 1",
        { replacements: { name: role.name } }
      );
      if (existing.length) {
        await queryInterface.sequelize.query(
          `UPDATE roles SET name_en = :nameEn, name_fa = :nameFa, updated_at = :now WHERE name = :name`,
          { replacements: { name: role.name, nameEn: role.name_en, nameFa: role.name_fa, now } }
        );
      } else {
        await queryInterface.sequelize.query(
          `INSERT INTO roles (name, name_en, name_fa, created_at, updated_at) VALUES (:name, :nameEn, :nameFa, :now, :now)`,
          { replacements: { name: role.name, nameEn: role.name_en, nameFa: role.name_fa, now } }
        );
      }
    }

    const roleMap = await getRoleIdMap(queryInterface);

    for (const [legacy, target] of Object.entries(LEGACY_TO_TARGET)) {
      const legacyId = roleMap.get(legacy);
      const targetId = roleMap.get(target);
      if (!legacyId || !targetId || legacyId === targetId) continue;

      const [assignments] = await queryInterface.sequelize.query(
        "SELECT user_id FROM user_roles WHERE role_id = :legacyId",
        { replacements: { legacyId } }
      );

      for (const { user_id: userId } of assignments) {
        const [dup] = await queryInterface.sequelize.query(
          "SELECT 1 FROM user_roles WHERE user_id = :userId AND role_id = :targetId LIMIT 1",
          { replacements: { userId, targetId } }
        );
        if (!dup.length) {
          await queryInterface.sequelize.query(
            "INSERT INTO user_roles (user_id, role_id) VALUES (:userId, :targetId)",
            { replacements: { userId, targetId } }
          );
        }
      }

      await queryInterface.sequelize.query("DELETE FROM user_roles WHERE role_id = :legacyId", {
        replacements: { legacyId },
      });
      await queryInterface.sequelize.query("DELETE FROM roles WHERE id = :legacyId", {
        replacements: { legacyId },
      });
    }

    for (const obsolete of ["loader", "driver"]) {
      const id = roleMap.get(obsolete);
      if (!id) continue;
      await queryInterface.sequelize.query("DELETE FROM user_roles WHERE role_id = :id", { replacements: { id } });
      await queryInterface.sequelize.query("DELETE FROM roles WHERE id = :id", { replacements: { id } });
    }
  },

  async down() {
    // نقش‌های قدیمی به‌صورت خودکار بازگردانده نمی‌شوند
  },
};
