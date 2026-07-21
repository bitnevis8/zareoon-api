const { Op } = require("sequelize");
const { SlugChangeRequest, SlugAlias } = require("./model");
const Account = require("../account/model");
const TradeServiceProvider = require("../tradeServiceProvider/model");
const { assertPublicSlugAvailable, slugify } = require("../../utils/publicPageSlug");

const COOLDOWN_DAYS = 20;
const NOTICE_DAYS = 7;
const ALIAS_RESERVE_DAYS = 30;

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function expireDueAliases() {
  const now = new Date();
  await SlugAlias.update(
    { status: "freed", freedAt: now },
    {
      where: {
        status: "active",
        lockedByAdmin: false,
        expiresAt: { [Op.lte]: now },
      },
    }
  );
}

async function isSlugTakenByAliasOrPending(slug, { excludeUserId = null } = {}) {
  await expireDueAliases();
  const normalized = String(slug || "").toLowerCase();

  const aliasHit = await SlugAlias.findOne({
    where: { fromSlug: normalized, status: "active" },
    attributes: ["id", "userId"],
  });
  if (aliasHit) {
    if (excludeUserId && Number(aliasHit.userId) === Number(excludeUserId)) {
      // کاربر خودش آدرس قدیم را دارد — برای انتخاب مجدد همان اسلاگ قدیم مجاز نیست چون هنوز رزرو است
    }
    return true;
  }

  const pendingHit = await SlugChangeRequest.findOne({
    where: { toSlug: normalized, status: "pending" },
    attributes: ["id", "userId"],
  });
  if (pendingHit) {
    if (excludeUserId && Number(pendingHit.userId) === Number(excludeUserId)) return false;
    return true;
  }
  return false;
}

async function getPendingForUser(userId) {
  await applyDueChangesForUser(userId);
  return findPendingRequest(userId);
}

async function findPendingRequest(userId) {
  return SlugChangeRequest.findOne({
    where: { userId, status: "pending" },
    order: [["id", "DESC"]],
  });
}

/**
 * اعمال تغییراتی که موعدشان رسیده
 */
async function applyDueChangesForUser(userId = null) {
  const where = {
    status: "pending",
    scheduledAt: { [Op.lte]: new Date() },
  };
  if (userId) where.userId = userId;

  const due = await SlugChangeRequest.findAll({ where, limit: 50 });
  for (const req of due) {
    await applySlugChange(req);
  }
}

async function applySlugChange(request) {
  if (!request || request.status !== "pending") return null;

  const account = await Account.findOne({ where: { userId: request.userId } });
  if (!account) {
    await request.update({ status: "cancelled", cancelledAt: new Date() });
    return null;
  }

  const fromSlug = String(request.fromSlug || "").toLowerCase();
  const toSlug = String(request.toSlug || "").toLowerCase();

  // اگر کاربر در این فاصله اسلاگ را دستی عوض کرده، لغو
  if (account.profileSlug && String(account.profileSlug).toLowerCase() !== fromSlug) {
    await request.update({ status: "cancelled", cancelledAt: new Date() });
    return null;
  }

  await account.update({
    profileSlug: toSlug,
    lastSlugChangedAt: new Date(),
  });
  await TradeServiceProvider.update({ profileSlug: toSlug }, { where: { userId: request.userId } });

  await SlugAlias.create({
    userId: request.userId,
    fromSlug,
    toSlug,
    status: "active",
    lockedByAdmin: false,
    expiresAt: addDays(new Date(), ALIAS_RESERVE_DAYS),
  });

  await request.update({ status: "applied", appliedAt: new Date() });
  return request;
}

async function scheduleSlugChange(userId, rawNewSlug) {
  await applyDueChangesForUser(userId);
  const account = await Account.findOne({ where: { userId } });
  if (!account?.profileSlug) {
    const err = new Error("ابتدا یک آدرس صفحه داشته باشید");
    err.statusCode = 400;
    throw err;
  }

  const current = String(account.profileSlug).toLowerCase();
  const toSlug = await assertPublicSlugAvailable(rawNewSlug, {
    excludeAccountId: account.id,
    excludeUserId: userId,
  });

  if (toSlug === current) {
    const err = new Error("آدرس جدید با آدرس فعلی یکسان است");
    err.statusCode = 400;
    throw err;
  }

  const existingPending = await findPendingRequest(userId);
  if (existingPending) {
    const err = new Error("یک درخواست تغییر آدرس در جریان است. ابتدا آن را لغو کنید یا منتظر اعمال بمانید.");
    err.statusCode = 409;
    throw err;
  }

  if (await isSlugTakenByAliasOrPending(toSlug, { excludeUserId: userId })) {
    const err = new Error("این نام قبلاً رزرو شده است");
    err.statusCode = 409;
    throw err;
  }

  if (account.lastSlugChangedAt) {
    const unlockAt = addDays(new Date(account.lastSlugChangedAt), COOLDOWN_DAYS);
    if (Date.now() < unlockAt.getTime()) {
      const err = new Error(
        `آدرس صفحه فقط هر ${COOLDOWN_DAYS} روز یک‌بار قابل تغییر است. دفعه بعد از تاریخ ${unlockAt.toLocaleDateString("fa-IR")} می‌توانید درخواست دهید.`
      );
      err.statusCode = 429;
      err.unlockAt = unlockAt;
      throw err;
    }
  }

  const scheduledAt = addDays(new Date(), NOTICE_DAYS);
  const row = await SlugChangeRequest.create({
    userId,
    accountId: account.id,
    fromSlug: current,
    toSlug,
    status: "pending",
    scheduledAt,
  });

  return {
    request: row,
    noticeDays: NOTICE_DAYS,
    cooldownDays: COOLDOWN_DAYS,
    message: `درخواست ثبت شد. از ${scheduledAt.toLocaleDateString("fa-IR")} آدرس از «${current}» به «${toSlug}» تغییر می‌کند. تا آن زمان می‌توانید لغو کنید.`,
  };
}

async function cancelSlugChange(userId) {
  const pending = await findPendingRequest(userId);
  if (!pending) {
    const err = new Error("درخواست فعالی برای لغو وجود ندارد");
    err.statusCode = 404;
    throw err;
  }
  await pending.update({ status: "cancelled", cancelledAt: new Date() });
  return pending;
}

async function resolveSlug(rawSlug) {
  await expireDueAliases();
  await applyDueChangesForUser();

  const slug = slugify(rawSlug);
  if (!slug) return { type: "not_found" };

  const account = await Account.findOne({ where: { profileSlug: slug }, attributes: ["id", "profileSlug"] });
  if (account) return { type: "current", slug };

  const provider = await TradeServiceProvider.findOne({
    where: { profileSlug: slug },
    attributes: ["id", "profileSlug"],
  });
  if (provider) return { type: "current", slug };

  const alias = await SlugAlias.findOne({
    where: { fromSlug: slug, status: "active" },
  });
  if (alias?.toSlug) {
    return { type: "redirect", from: slug, to: String(alias.toSlug).toLowerCase() };
  }

  return { type: "not_found" };
}

async function listAliasesForAdmin({ status } = {}) {
  await expireDueAliases();
  const where = {};
  if (status) where.status = status;
  return SlugAlias.findAll({
    where,
    order: [["id", "DESC"]],
    limit: 500,
  });
}

async function adminFreeAlias(id) {
  const row = await SlugAlias.findByPk(id);
  if (!row) {
    const err = new Error("یافت نشد");
    err.statusCode = 404;
    throw err;
  }
  await row.update({ status: "freed", freedAt: new Date(), lockedByAdmin: false });
  return row;
}

async function adminLockAlias(id, locked = true) {
  const row = await SlugAlias.findByPk(id);
  if (!row) {
    const err = new Error("یافت نشد");
    err.statusCode = 404;
    throw err;
  }
  await row.update({ lockedByAdmin: !!locked });
  return row;
}

function formatPendingBanner(pending) {
  if (!pending) return null;
  const when = pending.scheduledAt ? new Date(pending.scheduledAt) : null;
  const dateFa = when ? when.toLocaleDateString("fa-IR") : "";
  return {
    id: pending.id,
    fromSlug: pending.fromSlug,
    toSlug: pending.toSlug,
    scheduledAt: pending.scheduledAt,
    message: `تا تاریخ ${dateFa} آدرس صفحه شما از «${pending.fromSlug}» به «${pending.toSlug}» تغییر می‌کند. اگر منصرف شده‌اید می‌توانید لغو کنید.`,
  };
}

module.exports = {
  COOLDOWN_DAYS,
  NOTICE_DAYS,
  ALIAS_RESERVE_DAYS,
  expireDueAliases,
  isSlugTakenByAliasOrPending,
  getPendingForUser,
  applyDueChangesForUser,
  applySlugChange,
  scheduleSlugChange,
  cancelSlugChange,
  resolveSlug,
  listAliasesForAdmin,
  adminFreeAlias,
  adminLockAlias,
  formatPendingBanner,
};
