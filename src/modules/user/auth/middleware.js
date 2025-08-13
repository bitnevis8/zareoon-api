// src/modules/user/auth/middleware.js

const { jwtVerify } = require("jose");
const config = require("config");
const cookieParser = require("cookie-parser");
// 📌 بررسی احراز هویت کاربر
const authenticateUser = async (req, res, next) => {
  try {
    console.log('=== Authentication Debug ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request Method:', req.method);
    console.log('All Cookies:', req.cookies);
    console.log('Cookie Header:', req.headers.cookie);
    console.log('Authorization Header:', req.headers.authorization);
    console.log('=========================');
    
    // گرفتن توکن از کوکی‌های درخواست
    const token = req.cookies?.token;
    if (!token) {
      console.log('No token found in cookies');
      return res
        .status(401)
        .json({ success: false, message: "احراز هویت انجام نشده است" });
    }

    console.log('Token found:', token);

    // بررسی اعتبار توکن
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(config.get("JWT.KEY"))
    );

    console.log('Token payload:', payload);

    // ذخیره اطلاعات کاربر در req برای استفاده در کنترلرها
    req.user = payload;

    next(); // ادامه پردازش درخواست
  } catch (error) {
    console.error("JWT verification failed:", error.message);
    return res.status(401).json({
      success: false,
      message: "توکن نامعتبر است، لطفاً دوباره وارد شوید",
    });
  }
};

// 📌 بررسی نقش مدیر (Admin)
const authorizeRole = (requiredRole) => (req, res, next) => {
  try {
    // بررسی وجود کاربر در درخواست (بعد از احراز هویت)
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "احراز هویت انجام نشده است." });
    }

    console.log(req.user); // برای دیباگ

    // بررسی نقش کاربر (مدیر یا نه)
    // با توجه به رابطه چند به چند، req.user.roles اکنون یک آرایه از نقش‌ها است.
    const hasRequiredRole = req.user.roles.some(role => role.nameEn === requiredRole);

    if (!hasRequiredRole) {
      return res.status(403).json({
        success: false,
        message: `دسترسی غیرمجاز: این عملیات فقط برای نقش ${requiredRole} مجاز است`,
      });
    }

    // ادامه پردازش اگر کاربر مدیر باشد
    next();
  } catch (error) {
    console.error("admin verification failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "خطای داخلی سرور", error });
  }
};

module.exports = {
  authenticateUser,
  authorizeRole
};
