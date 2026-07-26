/**
 * ثابت‌های دامنه Workspace / نقش‌ها / فعالیت / احراز / نشان‌ها
 *
 * سه لایه کاملاً جدا:
 * 1) PLATFORM_ROLES — کارکنان زارعون (JWT user.roles)
 * 2) WORKSPACE_ROLES — نقش داخل کسب‌وکار (workspace_members.role)
 * 3) ACTIVITY_TYPES — خریدار/فروشنده/خدمات‌دهنده (نه ACL)
 */

/** نقش‌های مدیریتی پلتفرم زارعون (+ نقش پایه کاربر) */
const PLATFORM_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SUPPORT: "support",
  CONTENT_MODERATOR: "content_moderator",
  VERIFICATION_OFFICER: "verification_officer",
  FINANCE_OFFICER: "finance_officer",
  SUBSCRIPTION_OFFICER: "subscription_officer",
  USER: "user",
};

/** نقش‌های قدیمی فعالیت — فقط برای سازگاری؛ ACL نیستند */
const LEGACY_ACTIVITY_ROLE_SLUGS = {
  SELLER: "seller",
  SERVICE_PROVIDER: "service_provider",
};

const PLATFORM_ROLE_LABELS_FA = {
  [PLATFORM_ROLES.SUPER_ADMIN]: "مدیرکل",
  [PLATFORM_ROLES.ADMIN]: "مدیر",
  [PLATFORM_ROLES.SUPPORT]: "پشتیبان",
  [PLATFORM_ROLES.CONTENT_MODERATOR]: "ناظر محتوا",
  [PLATFORM_ROLES.VERIFICATION_OFFICER]: "مسئول احراز",
  [PLATFORM_ROLES.FINANCE_OFFICER]: "مسئول مالی",
  [PLATFORM_ROLES.SUBSCRIPTION_OFFICER]: "مسئول اشتراک",
  [PLATFORM_ROLES.USER]: "کاربر",
};

/** نقش داخل Workspace */
const WORKSPACE_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  SALES: "sales",
  ORDERS_MANAGER: "orders_manager",
  PRODUCT_EDITOR: "product_editor",
  VIEWER: "viewer",
};

const WORKSPACE_ROLE_LABELS_FA = {
  [WORKSPACE_ROLES.OWNER]: "مالک",
  [WORKSPACE_ROLES.ADMIN]: "مدیر",
  [WORKSPACE_ROLES.SALES]: "کارشناس فروش",
  [WORKSPACE_ROLES.ORDERS_MANAGER]: "مدیر سفارش‌ها",
  [WORKSPACE_ROLES.PRODUCT_EDITOR]: "ویرایشگر محصولات",
  [WORKSPACE_ROLES.VIEWER]: "فقط مشاهده",
};

/**
 * مجوزهای داخل Workspace — اشتراک/مالی فقط Owner و Admin
 */
const WORKSPACE_PERMISSIONS = {
  MANAGE_BILLING: "manage_billing",
  MANAGE_MEMBERS: "manage_members",
  MANAGE_SETTINGS: "manage_settings",
  MANAGE_PRODUCTS: "manage_products",
  MANAGE_SERVICES: "manage_services",
  MANAGE_ORDERS: "manage_orders",
  MANAGE_SALES: "manage_sales",
  VIEW_ANALYTICS: "view_analytics",
  VIEW_ONLY: "view_only",
};

const WORKSPACE_ROLE_PERMISSIONS = {
  [WORKSPACE_ROLES.OWNER]: Object.values(WORKSPACE_PERMISSIONS),
  [WORKSPACE_ROLES.ADMIN]: [
    WORKSPACE_PERMISSIONS.MANAGE_BILLING,
    WORKSPACE_PERMISSIONS.MANAGE_MEMBERS,
    WORKSPACE_PERMISSIONS.MANAGE_SETTINGS,
    WORKSPACE_PERMISSIONS.MANAGE_PRODUCTS,
    WORKSPACE_PERMISSIONS.MANAGE_SERVICES,
    WORKSPACE_PERMISSIONS.MANAGE_ORDERS,
    WORKSPACE_PERMISSIONS.MANAGE_SALES,
    WORKSPACE_PERMISSIONS.VIEW_ANALYTICS,
    WORKSPACE_PERMISSIONS.VIEW_ONLY,
  ],
  [WORKSPACE_ROLES.SALES]: [
    WORKSPACE_PERMISSIONS.MANAGE_SALES,
    WORKSPACE_PERMISSIONS.VIEW_ONLY,
  ],
  [WORKSPACE_ROLES.ORDERS_MANAGER]: [
    WORKSPACE_PERMISSIONS.MANAGE_ORDERS,
    WORKSPACE_PERMISSIONS.VIEW_ONLY,
  ],
  [WORKSPACE_ROLES.PRODUCT_EDITOR]: [
    WORKSPACE_PERMISSIONS.MANAGE_PRODUCTS,
    WORKSPACE_PERMISSIONS.VIEW_ONLY,
  ],
  [WORKSPACE_ROLES.VIEWER]: [WORKSPACE_PERMISSIONS.VIEW_ONLY],
};

function workspaceRoleHasPermission(role, permission) {
  const list = WORKSPACE_ROLE_PERMISSIONS[role] || [];
  return list.includes(permission);
}

/** نوع فعالیت — نه نقش امنیتی */
const ACTIVITY_TYPES = {
  BUYER: "buyer",
  SELLER: "seller",
  SERVICES: "services",
};

const VERIFICATION_STATUS = {
  NONE: "none",
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
};

/**
 * درجات احراز پس از تأیید — جدا از وضعیت pending/verified
 * basic → standard → enhanced → full
 */
const VERIFICATION_LEVELS = {
  NONE: "none",
  BASIC: "basic",
  STANDARD: "standard",
  ENHANCED: "enhanced",
  FULL: "full",
};

const VERIFICATION_LEVEL_LABELS_FA = {
  [VERIFICATION_LEVELS.NONE]: "بدون درجه",
  [VERIFICATION_LEVELS.BASIC]: "پایه",
  [VERIFICATION_LEVELS.STANDARD]: "استاندارد",
  [VERIFICATION_LEVELS.ENHANCED]: "پیشرفته",
  [VERIFICATION_LEVELS.FULL]: "کامل",
};

const PERSON_VERIFICATION_LEVELS = [
  VERIFICATION_LEVELS.BASIC,
  VERIFICATION_LEVELS.STANDARD,
  VERIFICATION_LEVELS.ENHANCED,
  VERIFICATION_LEVELS.FULL,
];

const BUSINESS_VERIFICATION_LEVELS = [
  VERIFICATION_LEVELS.BASIC,
  VERIFICATION_LEVELS.STANDARD,
  VERIFICATION_LEVELS.ENHANCED,
  VERIFICATION_LEVELS.FULL,
];

/**
 * نشان‌های عمومی — عمداً جدا و غیرقابل اشتباه
 * membershipPlan ≠ هویت تأییدشده ≠ کسب‌وکار تأییدشده
 */
const PUBLIC_BADGE_KINDS = {
  PLAN_MEMBER: "plan_member", // عضو برنزی/نقره‌ای/طلایی = فقط اشتراک
  IDENTITY_VERIFIED: "identity_verified", // احراز شخص
  BUSINESS_VERIFIED: "business_verified", // احراز کسب‌وکار
  REPRESENTATION_VERIFIED: "representation_verified", // نمایندگی (اختیاری در UI)
};

module.exports = {
  PLATFORM_ROLES,
  PLATFORM_ROLE_LABELS_FA,
  LEGACY_ACTIVITY_ROLE_SLUGS,
  WORKSPACE_ROLES,
  WORKSPACE_ROLE_LABELS_FA,
  WORKSPACE_PERMISSIONS,
  WORKSPACE_ROLE_PERMISSIONS,
  workspaceRoleHasPermission,
  ACTIVITY_TYPES,
  VERIFICATION_STATUS,
  VERIFICATION_LEVELS,
  VERIFICATION_LEVEL_LABELS_FA,
  PERSON_VERIFICATION_LEVELS,
  BUSINESS_VERIFICATION_LEVELS,
  PUBLIC_BADGE_KINDS,
};
