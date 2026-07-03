"use strict";

/** نقش farmer → supplier (تأمین‌کننده) — سازگاری با نام‌گذاری جدید */

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const [farmerRole] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'farmer' LIMIT 1"
    );
    const [supplierRole] = await queryInterface.sequelize.query(
      "SELECT id FROM roles WHERE name = 'supplier' LIMIT 1"
    );

    if (farmerRole.length && !supplierRole.length) {
      await queryInterface.sequelize.query(
        `UPDATE roles SET name = 'supplier', name_en = 'Supplier', name_fa = 'تأمین‌کننده', updated_at = :now WHERE name = 'farmer'`,
        { replacements: { now } }
      );
    } else if (farmerRole.length && supplierRole.length) {
      const farmerId = farmerRole[0].id;
      const supplierId = supplierRole[0].id;

      const [assignments] = await queryInterface.sequelize.query(
        "SELECT user_id FROM user_roles WHERE role_id = :farmerId",
        { replacements: { farmerId } }
      );

      for (const { user_id: userId } of assignments) {
        const [dup] = await queryInterface.sequelize.query(
          "SELECT 1 FROM user_roles WHERE user_id = :userId AND role_id = :supplierId LIMIT 1",
          { replacements: { userId, supplierId } }
        );
        if (!dup.length) {
          await queryInterface.sequelize.query(
            "INSERT INTO user_roles (user_id, role_id) VALUES (:userId, :supplierId)",
            { replacements: { userId, supplierId } }
          );
        }
      }

      await queryInterface.sequelize.query("DELETE FROM user_roles WHERE role_id = :farmerId", {
        replacements: { farmerId },
      });
      await queryInterface.sequelize.query("DELETE FROM roles WHERE id = :farmerId", {
        replacements: { farmerId },
      });
    }

    await queryInterface.sequelize.query(
      `UPDATE roles SET name_en = 'Supplier', name_fa = 'تأمین‌کننده', updated_at = :now WHERE name = 'supplier'`,
      { replacements: { now } }
    );
  },

  async down() {
    // بازگشت خودکار انجام نمی‌شود
  },
};
