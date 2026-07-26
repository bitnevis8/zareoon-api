const config = require("config");

/**
 * خواندن کلید JWT با سازگاری JWT.KEY و JWT_SECRET
 * (در production.json فقط JWT.KEY ست شده بود و کد JWT_SECRET می‌خواند → کلید ضعیف پیش‌فرض)
 */
function getJwtSecret() {
  try {
    if (config.has("JWT.KEY")) {
      const key = config.get("JWT.KEY");
      if (key && String(key).trim()) return String(key);
    }
  } catch {
    /* ignore */
  }
  try {
    if (config.has("JWT_SECRET")) {
      return String(config.get("JWT_SECRET"));
    }
  } catch {
    /* ignore */
  }
  throw new Error("JWT secret is not configured (JWT.KEY or JWT_SECRET)");
}

module.exports = { getJwtSecret };
