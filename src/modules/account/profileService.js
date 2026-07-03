const Account = require("./model");
const AccountProfileField = require("./profileField/model");
const User = require("../user/user/model");
const sequelize = require("../../core/database/mysql/connection");
const { Op } = require("sequelize");
const { isSupplier } = require("../../utils/roles");
const { generateProfileSlug, slugify, ensureUniqueSlug } = require("../supplierProfile/utils");
const { pickProfileFields } = require("./entitySchemas");

const DEFAULT_BUSINESS_HOURS = {
  saturday: { closed: false, open: "08:00", close: "18:00" },
  sunday: { closed: false, open: "08:00", close: "18:00" },
  monday: { closed: false, open: "08:00", close: "18:00" },
  tuesday: { closed: false, open: "08:00", close: "18:00" },
  wednesday: { closed: false, open: "08:00", close: "18:00" },
  thursday: { closed: false, open: "08:00", close: "18:00" },
  friday: { closed: true, open: null, close: null },
};

async function getProfileFieldsMap(accountId) {
  const rows = await AccountProfileField.findAll({ where: { accountId } });
  return Object.fromEntries(rows.map((r) => [r.fieldKey, r.fieldValue]));
}

async function saveProfileFields(accountId, entityType, data) {
  const picked = pickProfileFields(entityType, data);
  const keys = Object.keys(picked);

  if (keys.length === 0) {
    await AccountProfileField.destroy({ where: { accountId } });
    return {};
  }

  await AccountProfileField.destroy({
    where: {
      accountId,
      fieldKey: { [require("sequelize").Op.notIn]: keys },
    },
  });

  for (const [fieldKey, fieldValue] of Object.entries(picked)) {
    const [row] = await AccountProfileField.findOrCreate({
      where: { accountId, fieldKey },
      defaults: { fieldValue },
    });
    if (row.fieldValue !== fieldValue) {
      await row.update({ fieldValue });
    }
  }

  return picked;
}

async function getOrCreateAccountForUser(user, { entityType } = {}) {
  let account = await Account.findOne({ where: { userId: user.id } });
  if (!account) {
    account = await Account.create({
      userId: user.id,
      entityType: entityType || "individual",
      isPublic: true,
    });
  }
  if (!account.profileSlug) {
    const slug = await generateProfileSlug(user);
    await account.update({ profileSlug: slug });
  }
  return account;
}

function userIsSupplierRole(user) {
  const roles = (user.userRoles || []).map((r) => ({ name: r.name, nameEn: r.nameEn }));
  return isSupplier({ roles });
}

async function findUserBySlugOrId(slugOrId) {
  const slug = decodeURIComponent(String(slugOrId || "")).trim();
  if (!slug) return null;

  const Role = require("../user/role/model");
  const roleInclude = {
    model: Role,
    as: "userRoles",
    attributes: ["id", "name", "nameEn", "nameFa"],
    through: { attributes: [] },
  };

  const isNumeric = /^\d+$/.test(slug);
  if (isNumeric) {
    return User.findOne({
      where: { id: Number(slug), isActive: true },
      include: [roleInclude],
    });
  }

  const byUsername = await User.findOne({
    where: { username: slug, isActive: true },
    include: [roleInclude],
  });
  if (byUsername) return byUsername;

  return User.findOne({
    where: {
      isActive: true,
      [Op.and]: [sequelize.where(sequelize.fn("LOWER", sequelize.col("username")), slug.toLowerCase())],
    },
    include: [roleInclude],
  });
}

/** یافتن حساب عمومی از slug، username یا شناسه کاربر (بدون محدودیت نقش) */
async function findPublicAccountBySlugOrId(slugOrId) {
  const slug = decodeURIComponent(String(slugOrId || "")).trim();
  if (!slug) return null;

  let account = await findAccountBySlugOrId(slug);
  if (account?.user) {
    return { account, user: account.user };
  }

  const user = await findUserBySlugOrId(slug);
  if (!user) return null;

  account = await getOrCreateAccountForUser(user);
  return { account, user };
}

/** @deprecated alias — همان findPublicAccountBySlugOrId */
async function findSupplierBySlugOrId(slugOrId) {
  return findPublicAccountBySlugOrId(slugOrId);
}

async function findAccountBySlugOrId(slugOrId, includeUser = true) {
  const isNumeric = /^\d+$/.test(String(slugOrId));
  const Role = require("../user/role/model");

  const userInclude = includeUser
    ? {
        model: User,
        as: "user",
        where: { isActive: true },
        required: true,
        include: [
          {
            model: Role,
            as: "userRoles",
            attributes: ["id", "name", "nameEn", "nameFa"],
            through: { attributes: [] },
          },
        ],
      }
    : null;

  const include = userInclude ? [userInclude] : [];

  if (isNumeric) {
    const byUser = await Account.findOne({
      where: { userId: Number(slugOrId) },
      include,
    });
    if (byUser) return byUser;
  }

  const slug = decodeURIComponent(String(slugOrId || "")).trim();

  const bySlug = await Account.findOne({
    where: isNumeric ? { id: Number(slugOrId) } : { profileSlug: slug },
    include,
  });
  if (bySlug) return bySlug;

  if (!isNumeric && slug) {
    return Account.findOne({
      where: sequelize.where(sequelize.fn("LOWER", sequelize.col("profile_slug")), slug.toLowerCase()),
      include,
    });
  }

  return null;
}

function resolveDisplayName(user, entityType, profileFields) {
  if (entityType === "company" || entityType === "distributor") {
    return profileFields.companyName || [user.firstName, user.lastName].filter(Boolean).join(" ");
  }
  if (entityType === "manufacturer" && profileFields.workshopName) {
    return profileFields.workshopName;
  }
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || `کاربر ${user.id}`;
}

async function formatAccountPublic(account, user) {
  const profileFields = await getProfileFieldsMap(account.id);
  const displayName = resolveDisplayName(user, account.entityType, profileFields);

  return {
    id: user.id,
    accountId: account.id,
    userId: user.id,
    entityType: account.entityType,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName,
    username: user.username,
    avatar: user.avatar,
    profileSlug: account.profileSlug,
    headline: account.headline,
    bio: account.bio,
    publicPhone: account.publicPhone,
    coverImage: account.coverImage,
    businessHours: account.businessHours || DEFAULT_BUSINESS_HOURS,
    country: account.country,
    isPublic: account.isPublic,
    profileFields,
    profileUrl: account.profileSlug ? `/tamin/${account.profileSlug}` : null,
    memberSince: account.createdAt || user.createdAt,
  };
}

module.exports = {
  DEFAULT_BUSINESS_HOURS,
  getProfileFieldsMap,
  saveProfileFields,
  getOrCreateAccountForUser,
  findAccountBySlugOrId,
  findPublicAccountBySlugOrId,
  findSupplierBySlugOrId,
  formatAccountPublic,
  resolveDisplayName,
  slugify,
  ensureUniqueSlug,
};
