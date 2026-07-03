/**
 * One-time migration: add profile fields to users table.
 * Run: node scripts/migrate-user-profile-fields.js
 */
const sequelize = require("../src/core/database/mysql/connection");

const columns = [
  ["father_name", "VARCHAR(255) NULL"],
  ["national_id", "VARCHAR(50) NULL"],
  ["address", "TEXT NULL"],
  ["postal_code", "VARCHAR(20) NULL"],
];

async function migrate() {
  try {
    await sequelize.authenticate();
    for (const [name, definition] of columns) {
      try {
        await sequelize.query(`ALTER TABLE users ADD COLUMN ${name} ${definition}`);
        console.log(`✅ Added column ${name}`);
      } catch (error) {
        if (String(error.message).includes("Duplicate column")) {
          console.log(`ℹ️ Column ${name} already exists`);
        } else {
          throw error;
        }
      }
    }
    console.log("✅ User profile fields migration completed.");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
