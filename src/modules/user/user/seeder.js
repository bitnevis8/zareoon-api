const User = require("./model");
const seederData = require("./seederData.json");

async function seedUsers() {
  try {
    for (const userData of seederData) {
      // اگر ایمیل دارد، بر اساس ایمیل جستجو کن
      if (userData.email) {
        await User.findOrCreate({
          where: { email: userData.email },
          defaults: userData
        });
      } 
      // اگر ایمیل ندارد، بر اساس موبایل جستجو کن
      else if (userData.mobile) {
        await User.findOrCreate({
          where: { mobile: userData.mobile },
          defaults: userData
        });
      }
    }
    console.log("✅ Users seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding users:", error);
  }
}

module.exports = seedUsers;
