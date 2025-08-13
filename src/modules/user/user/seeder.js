const User = require("./model");
const seederData = require("./seederData.json");

async function seedUsers() {
  try {
    for (const userData of seederData) {
      await User.findOrCreate({
        where: { email: userData.email },
        defaults: userData
      });
    }
    console.log("✅ Users seeded successfully");
  } catch (error) {
    console.error("❌ Error seeding users:", error);
  }
}

module.exports = seedUsers;
