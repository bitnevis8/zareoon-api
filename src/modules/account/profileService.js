const Account = require("./model");
const AccountProfileField = require("./profileField/model");
const User = require("../user/user/model");
const sequelize = require("../../core/database/mysql/connection");
const { Op } = require("sequelize");
const { isSupplier } = require("../../utils/roles");
const { slugify, ensureUniqueSlug } = require("../supplierProfile/utils");
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

async function getOrCreateAccountForUser(user, { entityType, profileSlug } = {}) {
  let account = await Account.findOne({ where: { userId: user.id } });
  if (!account) {
    try {
      account = await Account.create({
        userId: user.id,
        entityType: entityType || "individual",
        isPublic: true,
        canHidePublicPage: false,
        profileSlug: profileSlug || null,
      });
    } catch (error) {
      // Race / leftover row: unique user_id — re-fetch instead of crashing
      if (error?.name === "SequelizeUniqueConstraintError" || error?.parent?.code === "ER_DUP_ENTRY") {
        account = await Account.findOne({ where: { userId: user.id } });
      }
      if (!account) throw error;
    }
  }
  if (profileSlug && !account.profileSlug) {
    await account.update({ profileSlug });
  }
  // دیگر slug خودکار نمی‌سازیم — کاربر باید نام را انتخاب کند
  return account;
}

function userIsSupplierRole(user) {
  const roles = (user.userRoles || []).map((r) => ({ name: r.name, nameEn: r.nameEn }));
  return isSupplier({ roles });
}

/**
 * صفحه عمومی فقط با profileSlug انگلیسی (نه id عددی، نه username).
 */
async function findPublicAccountBySlugOrId(slugOrId) {
  const raw = decodeURIComponent(String(slugOrId || "")).trim();
  if (!raw || /^\d+$/.test(raw)) return null;

  const Role = require("../user/role/model");
  const found = await Account.findOne({
    where: {
      profileSlug: { [Op.ne]: null },
      [Op.and]: [
        sequelize.where(sequelize.fn("LOWER", sequelize.col("profile_slug")), raw.toLowerCase()),
      ],
    },
    include: [
      {
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
      },
    ],
  });

  if (!found?.user || !found.profileSlug) return null;
  return { account: found, user: found.user };
}

/** @deprecated alias — همان findPublicAccountBySlugOrId */
async function findSupplierBySlugOrId(slugOrId) {
  return findPublicAccountBySlugOrId(slugOrId);
}

/** داخلی/ادمین: یافتن حساب با slug یا id (نه برای URL عمومی) */
async function findAccountBySlugOrId(slugOrId, includeUser = true) {
  const Role = require("../user/role/model");
  const isNumeric = /^\d+$/.test(String(slugOrId));
  const slug = decodeURIComponent(String(slugOrId || "")).trim();

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
    return Account.findOne({
      where: { id: Number(slugOrId) },
      include,
    });
  }

  if (!slug) return null;

  return Account.findOne({
    where: sequelize.where(sequelize.fn("LOWER", sequelize.col("profile_slug")), slug.toLowerCase()),
    include,
  });
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
    publicLandline: account.publicLandline || null,
    publicEmail: account.publicEmail || null,
    shopContacts: (() => {
      const { normalizeShopContacts } = require("../../utils/shopContacts");
      return normalizeShopContacts(account.shopContacts, {
        publicPhone: account.publicPhone,
        publicLandline: account.publicLandline,
        publicEmail: account.publicEmail,
      });
    })(),
    coverImage: account.coverImage,
    businessHours: account.businessHours || DEFAULT_BUSINESS_HOURS,
    country: account.country,
    latitude: account.latitude != null ? Number(account.latitude) : null,
    longitude: account.longitude != null ? Number(account.longitude) : null,
    addressLabel: account.addressLabel || null,
    isPublic: account.isPublic,
    canHidePublicPage: !!account.canHidePublicPage,
    shopStatus: account.shopStatus || "ACTIVE",
    deletionRequestedAt: account.deletionRequestedAt || null,
    profileFields,
    profileUrl: account.profileSlug ? `/${account.profileSlug}` : null,
    memberSince: account.createdAt || user.createdAt,
  };
}

/**
 * تغییر نمایش عمومی صفحه کاربر (فروشگاه + خدمات هم‌زمان).
 * کاربر فقط اگر canHidePublicPage داشته باشد می‌تواند خصوصی کند.
 */
async function setUserPageVisibility(userId, isPublic, { requirePermission = true } = {}) {
  const account = await Account.findOne({ where: { userId } });
  if (!account) {
    const err = new Error("حساب یافت نشد");
    err.statusCode = 404;
    throw err;
  }
  const nextPublic = !!isPublic;
  if (requirePermission && !nextPublic && !account.canHidePublicPage) {
    const err = new Error("اجازه خصوصی‌سازی صفحه را ندارید. این مجوز فقط توسط مدیریت داده می‌شود.");
    err.statusCode = 403;
    throw err;
  }
  await account.update({ isPublic: nextPublic });
  const TradeServiceProvider = require("../tradeServiceProvider/model");
  await TradeServiceProvider.update({ isPublic: nextPublic }, { where: { userId } });
  return account;
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
  setUserPageVisibility,
  resolveDisplayName,
  slugify,
  ensureUniqueSlug,
};
