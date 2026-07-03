const { resolveDisplayName, getProfileFieldsMap } = require("./profileService");
const Account = require("./model");

const ENTITY_NAV_BADGES = {
  individual: "یوزر",
  company: "کمپانی",
  trader: "ساپلایر",
  manufacturer: "ساپلایر",
  distributor: "کمپانی",
};

const SUPPLIER_ROLE_SLUGS = new Set(["supplier", "farmer", "loader"]);

function userHasSupplierRole(user) {
  return (user.userRoles || user.roles || []).some((role) => {
    const slug = String(role.nameEn || role.name || "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    return SUPPLIER_ROLE_SLUGS.has(slug);
  });
}

async function buildAccountNav(user) {
  const account = await Account.findOne({ where: { userId: user.id } });
  const fallbackName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    `کاربر ${user.id}`;

  if (!account) {
    const isSupplier = userHasSupplierRole(user);
    return {
      navBadge: isSupplier ? "ساپلایر" : "یوزر",
      navTitle: fallbackName,
      entityType: null,
      profileSlug: null,
    };
  }

  const profileFields = await getProfileFieldsMap(account.id);
  const displayName = resolveDisplayName(user, account.entityType, profileFields);
  const navTitle = displayName || account.profileSlug || fallbackName;

  return {
    navBadge: ENTITY_NAV_BADGES[account.entityType] || "یوزر",
    navTitle,
    entityType: account.entityType,
    profileSlug: account.profileSlug,
  };
}

module.exports = {
  ENTITY_NAV_BADGES,
  buildAccountNav,
};
