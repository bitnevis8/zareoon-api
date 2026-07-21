const User = require("../user/model");
const Role = require("../role/model");
const UserRole = require("./model");
const rawData = require("./seederData.json");
const { Op } = require("sequelize");

const SEED_EMAILS = [
  "bitnevis@yahoo.com",
  "rahimi@zareoon.ir",
  "palizvan@zareoon.ir",
  "khatina@zareoon.ir",
  "mahavi@zareoon.ir",
];

const seedUserRoles = async () => {
  try {
    // نقش فروشنده پیش‌فرض را از کاربران seed بردار
    const sellerRole = await Role.findOne({ where: { name: "seller" } });
    if (sellerRole) {
      const seedUsers = await User.findAll({
        where: { email: { [Op.in]: SEED_EMAILS } },
        attributes: ["id"],
      });
      const userIds = seedUsers.map((u) => u.id);
      if (userIds.length) {
        const removed = await UserRole.destroy({
          where: { roleId: sellerRole.id, userId: { [Op.in]: userIds } },
        });
        console.log(`✅ Removed seller role from ${removed} seed user mapping(s)`);
      }
    }

    const records = Array.isArray(rawData) ? rawData : [];
    for (const rec of records) {
      let userId = rec.userId;
      let roleId = rec.roleId;

      if ((!userId || !roleId) && rec.role) {
        let user = null;

        if (rec.email) {
          user = await User.findOne({ where: { email: rec.email } });
        } else if (rec.mobile) {
          user = await User.findOne({ where: { mobile: rec.mobile } });
        }

        const role = await Role.findOne({ where: { name: rec.role } });
        if (!user || !role) {
          console.warn(`⚠️ Skip mapping: user/role not found for`, rec);
          continue;
        }
        userId = user.id;
        roleId = role.id;
      }

      if (!userId || !roleId) {
        console.warn(`⚠️ Invalid user-role record, skipping:`, rec);
        continue;
      }

      await UserRole.findOrCreate({
        where: { userId, roleId },
        defaults: { userId, roleId },
      });
    }
    console.log("✅ User roles seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding user roles:", error);
    throw error;
  }
};

module.exports = seedUserRoles;
