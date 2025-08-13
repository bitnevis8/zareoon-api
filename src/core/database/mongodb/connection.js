const mongoose = require("mongoose");
const config = require("config");

/**
 * کلاس مدیریت اتصال به MongoDB
 */
class MongoDBConnection {
  constructor() {
    this.mongoose = mongoose;
    this.isConnected = false;
  }

  /**
   * برقراری اتصال به دیتابیس
   */
  async connect() {
    try {
      if (this.isConnected) {
        console.log("📝 MongoDB is already connected.");
        return;
      }

      await this.mongoose.connect(config.get("MONGODB_URI"), {
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        family: 4
      });

      this.isConnected = true;
      console.log("✅ MongoDB Connection has been established successfully.");

      // رویدادهای connection
      this.mongoose.connection.on("error", (err) => {
        console.error("❌ MongoDB connection error:", err);
        this.isConnected = false;
      });

      this.mongoose.connection.on("disconnected", () => {
        console.log("⚠️ MongoDB disconnected");
        this.isConnected = false;
      });

      // مدیریت بستن اتصال در هنگام خروج از برنامه
      process.on("SIGINT", async () => {
        await this.close();
        process.exit(0);
      });

    } catch (error) {
      console.error("❌ Unable to connect to MongoDB:", error);
      throw error;
    }
  }

  /**
   * بستن اتصال به دیتابیس
   */
  async close() {
    try {
      await this.mongoose.connection.close();
      this.isConnected = false;
      console.log("✅ MongoDB Connection closed.");
    } catch (error) {
      console.error("❌ Error closing MongoDB connection:", error);
      throw error;
    }
  }

  /**
   * بررسی وضعیت اتصال
   */
  async authenticate() {
    try {
      await this.mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      console.error("❌ MongoDB authentication failed:", error);
      throw error;
    }
  }
}

// ایجاد یک نمونه از کلاس اتصال
const mongoDBConnection = new MongoDBConnection();

module.exports = mongoDBConnection; 