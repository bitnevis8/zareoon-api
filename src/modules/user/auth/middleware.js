// src/modules/user/auth/middleware.js

const { jwtVerify } = require("jose");
const config = require("config");
const { isAdmin, getRoleSlugs, normalizeRoleSlug } = require("../../../utils/roles");

const authenticateUser = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "احراز هویت انجام نشده است" });
    }

    const { payload } = await jwtVerify(token, new TextEncoder().encode(config.get("JWT_SECRET")));

    req.user = payload;
    req.user.userId = payload.userId || payload.id;
    req.user.id = req.user.userId;

    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);
    return res.status(401).json({
      success: false,
      message: "توکن نامعتبر است، لطفاً دوباره وارد شوید",
    });
  }
};

const ADMIN_ROLE_ALIASES = new Set(["administrator", "admin", "super_admin", "super admin", "superadmin"]);

const authorizeRole = (requiredRole) => (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "احراز هویت انجام نشده است." });
    }

    const required = (requiredRole || "").toLowerCase().trim().replace(/\s+/g, "_");

    if (ADMIN_ROLE_ALIASES.has(required)) {
      if (!isAdmin(req.user)) {
        return res.status(403).json({
          success: false,
          message: "دسترسی غیرمجاز: این عملیات فقط برای مدیر مجاز است",
        });
      }
      return next();
    }

    const slugs = getRoleSlugs(req.user);
    const requiredSlug = normalizeRoleSlug({ name: requiredRole, nameEn: requiredRole });

    if (!slugs.includes(requiredSlug)) {
      return res.status(403).json({
        success: false,
        message: `دسترسی غیرمجاز: این عملیات فقط برای نقش ${requiredRole} مجاز است`,
      });
    }

    next();
  } catch (error) {
    console.error("Role verification failed:", error.message);
    return res.status(500).json({ success: false, message: "خطای داخلی سرور", error });
  }
};

module.exports = {
  authenticateUser,
  authorizeRole,
};
