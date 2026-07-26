const express = require("express");
const bodyParser = require("body-parser");
const config = require("config");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const baseRouter = require("./src/core/baseRouter");
const initializeDatabase = require("./src/core/database/init");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

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
    return host === "localhost" || host === "127.0.0.1" || /^192\.168\./.test(host);
  } catch {
    return false;
  }
}

//------------------------------------------------------------------------------------startServer
const startServer = async () => {
  try {
    // پیش‌فرض: force + seed فعال (مثل قبل). برای غیرفعال‌کردن دائمی داده:
    //   DB_FORCE_SYNC=false
    //   DB_SEED=false
    const forceDb = process.env.DB_FORCE_SYNC !== "false";
    const seedDb = process.env.DB_SEED !== "false";
    if (forceDb || seedDb) {
      console.warn(
        `⚠️ DB sync: force=${forceDb}, seed=${seedDb} — برای حفظ داده روی استارت بعدی: DB_FORCE_SYNC=false DB_SEED=false`
      );
    }
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

    // اعتماد به پراکسی برای Rate Limiting صحیح
    app.set('trust proxy', 1); 

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: SERVER_CONFIG.NODE_ENV === "production" ? 1500 : 5000,
      message: {
        status: 429,
        success: false,
        message: "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.",
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);

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
    app.listen(SERVER_CONFIG.PORT, () => {
      console.log(
        `🚀 Zareoon API SERVER listening on: ${SERVER_CONFIG.IP}:${SERVER_CONFIG.PORT} in ${SERVER_CONFIG.NODE_ENV} mode`
      );
    });

  } catch (error) {
    console.error("❌ Server failed to start:", error);
    process.exit(1);
  }
};

// اجرای سرور
startServer();
