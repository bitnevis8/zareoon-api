/** نقش‌های فعال سامانه — slug در فیلد name جدول roles */

const ADMIN_ROLES = new Set(["super_admin", "admin"]);
const SUPPLIER_ROLES = new Set(["supplier", "farmer", "loader"]);
const LEGACY_ADMIN_ALIASES = new Set(["administrator"]);

function normalizeRoleSlug(role) {
  const raw = (role?.name || role?.nameEn || "").toLowerCase().trim().replace(/\s+/g, "_");
  if (LEGACY_ADMIN_ALIASES.has(raw)) return "admin";
  if (raw === "superadmin") return "super_admin";
  if (raw === "farmer") return "supplier";
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
  return roles.some((r) => ADMIN_ROLES.has(r) || LEGACY_ADMIN_ALIASES.has(r));
}

function isEmployee(user) {
  return getRoleSlugs(user).includes("employee");
}

function isSupplier(user) {
  return getRoleSlugs(user).some((r) => SUPPLIER_ROLES.has(r));
}

function isCustomer(user) {
  return getRoleSlugs(user).includes("customer");
}

/** ویرایش صفحه عمومی — تأمین‌کننده یا مدیر */
function canManagePublicProfile(user) {
  return isSupplier(user) || isAdmin(user);
}

module.exports = {
  ADMIN_ROLES,
  SUPPLIER_ROLES,
  normalizeRoleSlug,
  getRoleSlugs,
  isSuperAdmin,
  isAdmin,
  isEmployee,
  isSupplier,
  isCustomer,
  canManagePublicProfile,
};
