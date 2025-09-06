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
    "http://192.168.43.80:3001"
  ]
};

//------------------------------------------------------------------------------------startServer
const startServer = async () => {
  try {
    // اتصال به دیتابیس‌ها
    await initializeDatabase({ 
      force: true,  // تغییر از true به false
      seed: true,
      useMongoDB: false
    });
    console.log("✅ Databases initialized successfully!");

    const app = express();

    // اعتماد به پراکسی برای Rate Limiting صحیح
    app.set('trust proxy', 1); 

    // تنظیمات Rate Limiting
    // const limiter = rateLimit({
    //   windowMs: 15 * 60 * 100000, // 15 minutes
    //   max: 5000, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    //   message: {
    //     status: 429,
    //     success: false,
    //     message: "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید."
    //   },
    //   standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    //   legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // });

    // app.use(limiter);

    // تنظیمات امنیتی
    // app.use(helmet({
    //   contentSecurityPolicy: {
    //     directives: {
    //       defaultSrc: ["'self'"],
    //       scriptSrc: ["'self'", "'unsafe-inline'"],
    //       styleSrc: ["'self'", "'unsafe-inline'"],
    //       imgSrc: ["'self'", "data:", "https:"],
    //       connectSrc: ["'self'"],
    //       fontSrc: ["'self'", "https:", "data:"],
    //       objectSrc: ["'none'"],
    //       mediaSrc: ["'self'"],
    //       frameSrc: ["'none'"],
    //     },
    //   },
    //   xssFilter: true,
    //   noSniff: true,
    //   frameguard: { action: 'deny' },
    //   hsts: {
    //     maxAge: 31536000,
    //     includeSubDomains: true,
    //   },
    // }));
    
    // تنظیمات CORS
    app.use(
      cors({
        origin: function (origin, callback) {
          if (!origin) {
            return callback(null, true);
          }

          const allowedOrigins = ALLOWED_ORIGINS[SERVER_CONFIG.NODE_ENV];
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`Origin ${origin} not allowed by CORS`));
          }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
          "Content-Type", 
          "Authorization", 
          "X-Guest-Access",
          "Accept",
          "Origin"
        ],
        exposedHeaders: ["Set-Cookie"],
        credentials: true,
        maxAge: 86400,
      })
    );

    // میدلورهای پردازش داده
    app.use(cookieParser());
    app.use(bodyParser.json({ limit: '200mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '200mb' }));

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
