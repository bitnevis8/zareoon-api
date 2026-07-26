/** نقش‌های سامانه: پلتفرم + فعالیت (سازگاری) + جدا از Workspace */

const { PLATFORM_ROLES } = require("../modules/workspace/constants");

const ADMIN_ROLES = new Set([PLATFORM_ROLES.SUPER_ADMIN, PLATFORM_ROLES.ADMIN, "admin"]);
const PLATFORM_STAFF_ROLES = new Set([
  PLATFORM_ROLES.SUPER_ADMIN,
  PLATFORM_ROLES.ADMIN,
  PLATFORM_ROLES.SUPPORT,
  PLATFORM_ROLES.CONTENT_MODERATOR,
  PLATFORM_ROLES.VERIFICATION_OFFICER,
  PLATFORM_ROLES.FINANCE_OFFICER,
  PLATFORM_ROLES.SUBSCRIPTION_OFFICER,
]);
const SELLER_ROLES = new Set(["seller"]);
const LEGACY_ADMIN_ALIASES = new Set(["administrator"]);

function normalizeRoleSlug(role) {
  const raw = (role?.name || role?.nameEn || "").toLowerCase().trim().replace(/\s+/g, "_");
  if (LEGACY_ADMIN_ALIASES.has(raw)) return "admin";
  if (raw === "superadmin") return "super_admin";
  if (raw === "farmer" || raw === "loader" || raw === "supplier") return "seller";
  if (raw === "customer" || raw === "regular_user") return "user";
  return raw;
}

function getRoleSlugs(user) {
  return (user?.roles || []).map(normalizeRoleSlug).filter(Boolean);
}

function isSuperAdmin(user) {
  return getRoleSlugs(user).includes(PLATFORM_ROLES.SUPER_ADMIN);
}

function isAdmin(user) {
  const roles = getRoleSlugs(user);
  return roles.some((r) => ADMIN_ROLES.has(r) || r === PLATFORM_ROLES.SUPER_ADMIN);
}

function isPlatformStaff(user) {
  return getRoleSlugs(user).some((r) => PLATFORM_STAFF_ROLES.has(r));
}

function isSeller(user) {
  return getRoleSlugs(user).some((r) => SELLER_ROLES.has(r));
}

function isSupplier(user) {
  return isSeller(user);
}

function isServiceProvider(user) {
  return getRoleSlugs(user).includes("service_provider");
}

function isUser(user) {
  return getRoleSlugs(user).includes(PLATFORM_ROLES.USER);
}

function isCustomer(user) {
  return isUser(user);
}

function canManagePublicProfile(user) {
  return isSeller(user) || isAdmin(user);
}

module.exports = {
  ADMIN_ROLES,
  PLATFORM_STAFF_ROLES,
  SELLER_ROLES,
  PLATFORM_ROLES,
  normalizeRoleSlug,
  getRoleSlugs,
  isSuperAdmin,
  isAdmin,
  isPlatformStaff,
  isSeller,
  isSupplier,
  isServiceProvider,
  isUser,
  isCustomer,
  canManagePublicProfile,
};
