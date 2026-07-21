const {
  scheduleSlugChange,
  cancelSlugChange,
  getPendingForUser,
  formatPendingBanner,
  resolveSlug,
  listAliasesForAdmin,
  adminFreeAlias,
  adminLockAlias,
  COOLDOWN_DAYS,
  NOTICE_DAYS,
  ALIAS_RESERVE_DAYS,
} = require("./service");

function userIdOf(req) {
  return req.user?.userId || req.user?.id || null;
}

const getMinePending = async (req, res) => {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ success: false, message: "احراز هویت لازم است" });
    const pending = await getPendingForUser(userId);
    res.json({
      success: true,
      data: {
        pending: formatPendingBanner(pending),
        rules: {
          cooldownDays: COOLDOWN_DAYS,
          noticeDays: NOTICE_DAYS,
          aliasReserveDays: ALIAS_RESERVE_DAYS,
        },
      },
    });
  } catch (error) {
    console.error("publicSlug getMinePending:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت وضعیت آدرس" });
  }
};

const postSchedule = async (req, res) => {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ success: false, message: "احراز هویت لازم است" });
    const result = await scheduleSlugChange(userId, req.body?.slug || req.body?.profileSlug || "");
    res.json({
      success: true,
      data: {
        pending: formatPendingBanner(result.request),
        ...result,
      },
      message: result.message,
    });
  } catch (error) {
    console.error("publicSlug postSchedule:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || "خطا" });
  }
};

const postCancel = async (req, res) => {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ success: false, message: "احراز هویت لازم است" });
    await cancelSlugChange(userId);
    res.json({ success: true, message: "تغییر آدرس لغو شد. آدرس فعلی شما بدون تغییر می‌ماند." });
  } catch (error) {
    console.error("publicSlug postCancel:", error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || "خطا" });
  }
};

const getResolve = async (req, res) => {
  try {
    const result = await resolveSlug(req.params.slug);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("publicSlug getResolve:", error);
    res.status(500).json({ success: false, message: "خطا در بررسی آدرس" });
  }
};

const adminList = async (req, res) => {
  try {
    const items = await listAliasesForAdmin({ status: req.query.status || undefined });
    res.json({ success: true, data: items });
  } catch (error) {
    console.error("publicSlug adminList:", error);
    res.status(500).json({ success: false, message: "خطا در دریافت آدرس‌های رزرو" });
  }
};

const adminFree = async (req, res) => {
  try {
    const row = await adminFreeAlias(req.params.id);
    res.json({ success: true, data: row, message: "آدرس آزاد شد" });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message || "خطا" });
  }
};

const adminLock = async (req, res) => {
  try {
    const locked = req.body?.locked !== false;
    const row = await adminLockAlias(req.params.id, locked);
    res.json({
      success: true,
      data: row,
      message: locked ? "آدرس قفل شد و خودکار آزاد نمی‌شود" : "قفل برداشته شد",
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message || "خطا" });
  }
};

module.exports = {
  getMinePending,
  postSchedule,
  postCancel,
  getResolve,
  adminList,
  adminFree,
  adminLock,
};
