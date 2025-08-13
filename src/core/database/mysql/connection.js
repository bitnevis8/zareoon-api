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
      max: 5, // حداکثر تعداد connections
      min: 0, // حداقل تعداد connections
      acquire: 30000, // حداکثر زمان برای گرفتن connection (میلی‌ثانیه)
      idle: 10000 // حداکثر زمان idle بودن connection (میلی‌ثانیه)
    }
  }
);

module.exports = sequelize; 