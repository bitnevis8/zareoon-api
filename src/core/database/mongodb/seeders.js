const mongoose = require("mongoose");

// تابع اصلی برای seed کردن دیتابیس MongoDB
const seedMongoDB = async () => {
  try {
    console.log("🌱 Starting MongoDB database seeding...\n");

    // اینجا می‌توانید seeders جدید را اضافه کنید
    // مثال:
    // await seedCollectionName();

    console.log("\n✨ All MongoDB seed data inserted successfully!");
  } catch (error) {
    console.error("\n❌ MongoDB database seeding failed:", error);
    throw error;
  }
};

module.exports = seedMongoDB; 