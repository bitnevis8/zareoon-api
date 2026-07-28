const path = require("path");
const fs = require("fs");

/** بارگذاری .env پنل میزبانی (مثلاً Pachim) قبل از config */
(function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  try {
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = val;
    }
  } catch (e) {
    console.warn("⚠️ .env load skipped:", e.message);
  }
})();

const express = require("express");
const bodyParser = require("body-parser");
const config = require("config");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const baseRouter = require("./src/core/baseRouter");
const initializeDatabase = require("./src/core/database/init");
const helmet = require("helmet");
const {
  loginLimiter,
  uploadLimiter,
  productWriteLimiter,
  searchLimiter,
} = require("./src/middleware/rateLimiters");

// تنظیمات سرور
const SERVER_CONFIG = {
  IP: config.get("SERVER.IP"),
  PORT: config.get("SERVER.PORT"),
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// تنظیمات محیط‌های مختلف
const ALLOWED_ORIGINS = {
  production: [
    "https://zareoon.ir",
    "https://www.zareoon.ir",
    "https://api.zareoon.ir"
  ],
  development: [
    "http://localhost:3003",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:3000",
    "http://127.0.0.1:3003",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://127.0.0.1:3000",
    "http://192.168.43.80:3001"
  ]
};

function isDevLocalOrigin(origin) {
  try {
    const u = new URL(origin);
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "10.0.2.2") return true;
    // LAN رایج: 192.168.* / 10.* / 172.16–31.*
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function isTruthyEnv(value) {
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function isFalsyEnv(value) {
  const v = String(value).trim().toLowerCase();
  return v === "0" || v === "false" || v === "no" || v === "off";
}

/**
 * خواندن بولین از env (اولویت) یا config فایل محیط (development/production).
 * Env اگر ست شده باشد همیشه بر config غلبه می‌کند.
 */
function readDbBootstrapFlag(configKey, envKey, defaultValue) {
  if (process.env[envKey] !== undefined && String(process.env[envKey]).trim() !== "") {
    if (isTruthyEnv(process.env[envKey])) return true;
    if (isFalsyEnv(process.env[envKey])) return false;
  }
  if (config.has(configKey)) {
    return Boolean(config.get(configKey));
  }
  return defaultValue;
}

//------------------------------------------------------------------------------------startServer
const startServer = async () => {
  try {
    // DB.FORCE_SYNC / DB.SEED در api/config/{development|production}.json
    // override موقت: DB_FORCE_SYNC=true|false  و  DB_SEED=true|false
    const forceDb = readDbBootstrapFlag("DB.FORCE_SYNC", "DB_FORCE_SYNC", false);
    const seedDb = readDbBootstrapFlag("DB.SEED", "DB_SEED", SERVER_CONFIG.NODE_ENV !== "production");

    console.log(
      `DB bootstrap [${SERVER_CONFIG.NODE_ENV}]: FORCE_SYNC=${forceDb} SEED=${seedDb}` +
        (forceDb ? " ⚠️ جداول drop و recreate می‌شوند" : "")
    );

    await initializeDatabase({
      force: forceDb,
      seed: seedDb,
      useMongoDB: false,
    });
    console.log("✅ Databases initialized successfully!");

    try {
      const { initRedis } = require("./src/core/cache/cacheService");
      await initRedis();
    } catch (e) {
      console.warn("⚠️ Cache/Redis init skipped:", e.message);
    }

    const app = express();

    // باید قبل از rate limiter باشد — IP واقعی پشت Cloudflare / nginx
    app.set("trust proxy", true);

    // Rate limit جداگانه (نه یک سقف سراسری برای کل API)
    app.use("/user/auth/login", loginLimiter);
    app.use("/user/auth/check-identifier", loginLimiter);
    app.use("/user/auth/verify-code", loginLimiter);
    app.use("/user/auth/resend-code", loginLimiter);
    app.use("/user/auth/send-code-for-registration", loginLimiter);
    app.use("/user/auth/forgot-password", loginLimiter);
    app.use("/user/auth/register", loginLimiter);
    app.use("/user/auth/complete-registration", loginLimiter);

    app.use("/file-upload", uploadLimiter);

    app.use("/supplier/product", productWriteLimiter);
    app.use("/farmer/product", productWriteLimiter);

    app.use("/location/search", searchLimiter);
    app.use("/hs-code/search", searchLimiter);
    app.use("/user/user/search", searchLimiter);
    app.use("/messaging/users/search", searchLimiter);

    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
      })
    );
    
    // تنظیمات CORS
    app.use(
      cors({
        origin: function (origin, callback) {
          if (!origin) {
            return callback(null, true);
          }

          const allowedOrigins = ALLOWED_ORIGINS[SERVER_CONFIG.NODE_ENV] || ALLOWED_ORIGINS.development;
          if (allowedOrigins.includes(origin)) {
            return callback(null, true);
          }
          // توسعه: هر origin لوکال (localhost / 127.0.0.1 / LAN) مجاز
          if (SERVER_CONFIG.NODE_ENV !== "production" && isDevLocalOrigin(origin)) {
            return callback(null, true);
          }
          console.warn(`CORS blocked origin: ${origin}`);
          return callback(null, false);
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "X-Guest-Access",
          "X-Workspace-Id",
          "Accept",
          "Origin",
          "Cache-Control",
          "Pragma",
        ],
        exposedHeaders: ["Set-Cookie"],
        credentials: true,
        maxAge: 86400,
      })
    );

    // میدلورهای پردازش داده
    app.use(cookieParser());
    app.use(bodyParser.json({ limit: "5mb" }));
    app.use(bodyParser.urlencoded({ extended: true, limit: "5mb" }));

    // مسیرهای API
    app.use("/", baseRouter);

    // راه‌اندازی سرور
    app.listen(SERVER_CONFIG.PORT, "0.0.0.0", () => {
      console.log(
        `🚀 Zareoon API SERVER listening on: 0.0.0.0:${SERVER_CONFIG.PORT} (${SERVER_CONFIG.IP}) in ${SERVER_CONFIG.NODE_ENV} mode`
      );
    });

  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
};

// اجرای سرور
startServer();
