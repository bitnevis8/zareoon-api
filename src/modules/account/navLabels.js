const { resolveDisplayName, getProfileFieldsMap } = require("./profileService");
const Account = require("./model");

const ENTITY_NAV_BADGES = {
  individual: "کاربر",
  company: "شرکت",
  trader: "فروشنده",
  manufacturer: "فروشنده",
  distributor: "شرکت",
};

const SELLER_ROLE_SLUGS = new Set(["seller", "supplier", "farmer", "loader"]);

function userHasSellerRole(user) {
  return (user.userRoles || user.roles || []).some((role) => {
    const slug = String(role.nameEn || role.name || "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    return SELLER_ROLE_SLUGS.has(slug) || slug === "seller";
  });
}

async function buildAccountNav(user) {
  const account = await Account.findOne({ where: { userId: user.id } });
  const fallbackName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    `کاربر ${user.id}`;

  if (!account) {
    const isSeller = userHasSellerRole(user);
    return {
      navBadge: isSeller ? "فروشنده" : "کاربر",
      navTitle: fallbackName,
      entityType: null,
      profileSlug: null,
    };
  }

  const profileFields = await getProfileFieldsMap(account.id);
  const displayName = resolveDisplayName(user, account.entityType, profileFields, {
    displayName: account.displayName,
  });
  const navTitle = displayName || account.profileSlug || fallbackName;

  return {
    navBadge: ENTITY_NAV_BADGES[account.entityType] || "کاربر",
    navTitle,
    entityType: account.entityType,
    profileSlug: account.profileSlug,
  };
}

module.exports = {
  ENTITY_NAV_BADGES,
  buildAccountNav,
};
