const rateLimit = require("express-rate-limit");

const RATE_LIMIT_MESSAGE = {
  status: 429,
  success: false,
  message: "تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.",
};

/**
 * IP واقعی کاربر — اولویت با Cloudflare، بعد X-Real-IP، بعد req.ip (با trust proxy)
 */
function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) {
    return cf.trim().split(",")[0].trim();
  }
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.trim()) {
    return real.trim().split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function keyGenerator(req) {
  return clientIp(req);
}

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
  keyGenerator,
  // keyGenerator سفارشی؛ هشدار پیش‌فرض express-rate-limit را خاموش می‌کنیم
  validate: { keyGeneratorIpFallback: false },
};

/** لاگین / احراز — ۵ درخواست در دقیقه */
const loginLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  max: 5,
});

/** آپلود فایل/عکس — ۲۰ درخواست در دقیقه (فقط write) */
const uploadLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  max: 20,
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
});

/** ثبت/ویرایش محصول — ۱۰ درخواست در دقیقه (فقط write) */
const productWriteLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  max: 10,
  skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
});

/** جستجو — ۱۰۰ درخواست در دقیقه */
const searchLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  max: 100,
});

module.exports = {
  clientIp,
  loginLimiter,
  uploadLimiter,
  productWriteLimiter,
  searchLimiter,
};
