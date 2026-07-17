/** نقش‌های سامانه: super_admin, admin, user, seller, service_provider */

const ADMIN_ROLES = new Set(["super_admin", "admin"]);
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
  return getRoleSlugs(user).includes("super_admin");
}

function isAdmin(user) {
  const roles = getRoleSlugs(user);
  return roles.some((r) => ADMIN_ROLES.has(r));
}

function isSeller(user) {
  return getRoleSlugs(user).some((r) => SELLER_ROLES.has(r));
}

/** @deprecated use isSeller */
function isSupplier(user) {
  return isSeller(user);
}

function isServiceProvider(user) {
  return getRoleSlugs(user).includes("service_provider");
}

function isUser(user) {
  return getRoleSlugs(user).includes("user");
}

/** @deprecated use isUser */
function isCustomer(user) {
  return isUser(user);
}

function canManagePublicProfile(user) {
  return isSeller(user) || isAdmin(user);
}

module.exports = {
  ADMIN_ROLES,
  SELLER_ROLES,
  normalizeRoleSlug,
  getRoleSlugs,
  isSuperAdmin,
  isAdmin,
  isSeller,
  isSupplier,
  isServiceProvider,
  isUser,
  isCustomer,
  canManagePublicProfile,
};
