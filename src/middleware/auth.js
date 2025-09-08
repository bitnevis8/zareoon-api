const jwt = require("jsonwebtoken");
const config = require("config");

// Middleware برای احراز هویت
const authenticateToken = (req, res, next) => {
  let token = null;

  // 1. بررسی HttpOnly cookie (اولویت اول)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. بررسی Authorization header (برای mobile apps)
  else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "توکن احراز هویت یافت نشد",
      data: null,
      errors: null
    });
  }

  try {
    const secretKey = config.get("JWT_SECRET");
    const decoded = jwt.verify(token, secretKey);
    
    // اضافه کردن اطلاعات کاربر به request
    req.user = decoded;
    next();
  } catch (error) {
    console.error("❌ Token verification failed:", error.message);
    return res.status(403).json({
      success: false,
      message: "توکن نامعتبر یا منقضی شده است",
      data: null,
      errors: null
    });
  }
};

module.exports = { authenticateToken };
