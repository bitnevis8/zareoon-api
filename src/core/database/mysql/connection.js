const { Sequelize } = require("sequelize");
const config = require("config");

// تنظیمات اتصال به دیتابیس MySQL
const sequelize = new Sequelize(
  config.get("DB.NAME"),
  config.get("DB.USER"),
  config.get("DB.PASSWORD"),
  {
    host: config.get("DB.HOST"),
    dialect: "mysql",
    logging: false, // غیرفعال کردن لاگ‌های اضافی
    timezone: "+03:30", // تنظیم timezone برای ایران
    pool: {
      // هزاران کاربر همزمان: 5 خیلی کم بود؛ با ایندکس‌ها کوئری‌ها کوتاه‌تر می‌مانند
      max: 25,
      min: 2,
      acquire: 30000,
      idle: 10000,
      evict: 10000,
    },
    dialectOptions: {
      // اجازه به کوئری‌های سنگین‌تر بدون قطع زودهنگام
      connectTimeout: 20000,
    },
  }
);

module.exports = sequelize; 