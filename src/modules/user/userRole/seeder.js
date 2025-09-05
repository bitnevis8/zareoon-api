const User = require("../user/model");
const Role = require("../role/model");
const UserRole = require("./model");
const rawData = require("./seederData.json");

const seedUserRoles = async () => {
  try {
    const records = Array.isArray(rawData) ? rawData : [];
    for (const rec of records) {
      let userId = rec.userId;
      let roleId = rec.roleId;

      if ((!userId || !roleId) && rec.role) {
        let user = null;
        
        // اگر ایمیل دارد، بر اساس ایمیل جستجو کن
        if (rec.email) {
          user = await User.findOne({ where: { email: rec.email } });
        }
        // اگر موبایل دارد، بر اساس موبایل جستجو کن
        else if (rec.mobile) {
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
        defaults: { userId, roleId }
      });
    }
    console.log("✅ User roles seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding user roles:", error);
    throw error;
  }
};

module.exports = seedUserRoles;