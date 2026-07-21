/** وضعیت‌های چرخهٔ حیات صفحه فروشگاه / خدمات */
const PAGE_STATUSES = Object.freeze([
  "ACTIVE",
  "INACTIVE",
  "SUSPENDED",
  "CLOSED",
  "PENDING_DELETION",
  "ARCHIVED",
]);

const DEFAULT_PAGE_STATUS = "ACTIVE";

/** برای بازدیدکنندهٔ عمومی قابل نمایش است */
const PUBLIC_VISIBLE = new Set(["ACTIVE", "PENDING_DELETION", "CLOSED", "SUSPENDED"]);

/** سفارش / تماس تجاری فعال */
const ORDERS_ALLOWED = new Set(["ACTIVE"]);

const STATUS_MESSAGES_FA = {
  ACTIVE: null,
  INACTIVE: "این صفحه هنوز فعال نشده و پس از تأیید مدیریت در دسترس عموم قرار می‌گیرد.",
  SUSPENDED: "این صفحه موقتاً توسط مدیریت تعلیق شده و امکان سفارش غیرفعال است.",
  CLOSED: "این صفحه بسته شده و فعلاً امکان سفارش ندارد.",
  PENDING_DELETION:
    "درخواست بستن این صفحه ثبت شده است. تا پایان مهلت بررسی، صفحه قابل مشاهده است ولی امکان سفارش وجود ندارد.",
  ARCHIVED: "این صفحه بایگانی شده و دیگر در دسترس نیست.",
};

const CREATE_NOTICE_SHOP_FA =
  "خوش آمدید! فروشگاهتان آماده است. فقط یک نکتهٔ دوستانه: اگر روزی خواستید صفحه‌تان را ببندید، برای آرامش خاطر خریداران بلافاصله حذف نمی‌شود و مدتی با پیام مناسب نمایش داده می‌ماند.";

const CREATE_NOTICE_SERVICES_FA =
  "صفحه خدماتتان ساخته شد. اگر بعداً بخواهید آن را ببندید، برای امنیت و رضایت مراجعان بلافاصله حذف نمی‌شود و مدتی با پیام مناسب در دسترس می‌ماند.";

function normalizePageStatus(value, fallback = DEFAULT_PAGE_STATUS) {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  return PAGE_STATUSES.includes(raw) ? raw : fallback;
}

function isPubliclyVisible(status) {
  return PUBLIC_VISIBLE.has(normalizePageStatus(status));
}

function canAcceptOrders(status) {
  return ORDERS_ALLOWED.has(normalizePageStatus(status));
}

function statusPublicMessage(status) {
  const key = normalizePageStatus(status);
  return STATUS_MESSAGES_FA[key] || null;
}

function initialStatusFromAutoApprove(autoApprove) {
  return autoApprove ? "ACTIVE" : "INACTIVE";
}

/**
 * اگر مهلت حذف گذشته باشد، به ARCHIVED تبدیل می‌کند.
 * @returns {Promise<{ changed: boolean, status: string }>}
 */
async function maybeArchiveExpired(record, graceDays) {
  const status = normalizePageStatus(record.pageStatus || record.shopStatus);
  if (status !== "PENDING_DELETION") {
    return { changed: false, status };
  }
  const requestedAt = record.deletionRequestedAt ? new Date(record.deletionRequestedAt) : null;
  if (!requestedAt || Number.isNaN(requestedAt.getTime())) {
    return { changed: false, status };
  }
  const days = Number(graceDays);
  const grace = Number.isFinite(days) && days > 0 ? days : 30;
  const deadline = new Date(requestedAt.getTime() + grace * 24 * 60 * 60 * 1000);
  if (Date.now() < deadline.getTime()) {
    return { changed: false, status };
  }

  const patch = {
    isPublic: false,
    deletionRequestedAt: record.deletionRequestedAt,
  };
  if (record.shopStatus !== undefined) {
    patch.shopStatus = "ARCHIVED";
    await record.update(patch);
    return { changed: true, status: "ARCHIVED" };
  }
  patch.pageStatus = "ARCHIVED";
  await record.update(patch);
  return { changed: true, status: "ARCHIVED" };
}

function publicLifecyclePayload(status, { deletionRequestedAt = null, graceDays = 30 } = {}) {
  const normalized = normalizePageStatus(status);
  let deletionEndsAt = null;
  if (normalized === "PENDING_DELETION" && deletionRequestedAt) {
    const start = new Date(deletionRequestedAt);
    if (!Number.isNaN(start.getTime())) {
      deletionEndsAt = new Date(start.getTime() + Number(graceDays || 30) * 24 * 60 * 60 * 1000).toISOString();
    }
  }
  return {
    pageStatus: normalized,
    canOrder: canAcceptOrders(normalized),
    statusMessage: statusPublicMessage(normalized),
    deletionRequestedAt: deletionRequestedAt || null,
    deletionEndsAt,
  };
}

module.exports = {
  PAGE_STATUSES,
  DEFAULT_PAGE_STATUS,
  CREATE_NOTICE_SHOP_FA,
  CREATE_NOTICE_SERVICES_FA,
  normalizePageStatus,
  isPubliclyVisible,
  canAcceptOrders,
  statusPublicMessage,
  initialStatusFromAutoApprove,
  maybeArchiveExpired,
  publicLifecyclePayload,
};
