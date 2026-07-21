const Account = require("../modules/account/model");
const TradeServiceProvider = require("../modules/tradeServiceProvider/model");
const {
  getReservedSlugSet,
  matchesBlockedPatterns,
  getDefaultReservedSlugs,
} = require("./reservedUsernamesCatalog");

/** پیش‌فرض؛ مقدار واقعی از تنظیمات سایت خوانده می‌شود */
const DEFAULT_MIN_SLUG_LENGTH = 5;
const DEFAULT_MAX_SLUG_LENGTH = 30;
const MIN_SLUG_LENGTH = DEFAULT_MIN_SLUG_LENGTH;

/** رزروهای حیاتی اگر فایل کاتالوگ لود نشود */
const FALLBACK_RESERVED = new Set([
  "admin",
  "api",
  "auth",
  "cart",
  "dashboard",
  "login",
  "register",
  "providers",
  "tamin",
  "trade-services",
  "www",
  "support",
  "zareoon",
  "null",
  "undefined",
]);

function getReservedSlugsSet() {
  try {
    const fromFile = getReservedSlugSet();
    if (fromFile && fromFile.size) return fromFile;
  } catch (err) {
    console.error("reserved catalog load failed:", err.message);
  }
  return FALLBACK_RESERVED;
}

async function loadSlugLengthRules() {
  try {
    const { getPublicPageSlugRules } = require("../modules/siteSetting/service");
    return await getPublicPageSlugRules();
  } catch {
    return { minLength: DEFAULT_MIN_SLUG_LENGTH, maxLength: DEFAULT_MAX_SLUG_LENGTH };
  }
}

/** فقط انگلیسی، عدد و خط تیره */
function slugify(text, maxLength = DEFAULT_MAX_SLUG_LENGTH) {
  if (!text) return "";
  const max = Number.isFinite(Number(maxLength)) ? Math.max(5, Math.floor(Number(maxLength))) : DEFAULT_MAX_SLUG_LENGTH;
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max);
}

function hasNonEnglishChars(raw) {
  const s = String(raw || "").trim();
  if (!s) return false;
  return /[^a-zA-Z0-9\s-]/.test(s);
}

/**
 * @param {string} raw
 * @param {string[]} blockedList
 * @param {{ minLength?: number, maxLength?: number }} rules
 */
function validatePublicSlug(raw, blockedList = [], rules = {}) {
  const minLength = Number.isFinite(Number(rules.minLength))
    ? Math.floor(Number(rules.minLength))
    : DEFAULT_MIN_SLUG_LENGTH;
  const maxLength = Number.isFinite(Number(rules.maxLength))
    ? Math.floor(Number(rules.maxLength))
    : DEFAULT_MAX_SLUG_LENGTH;

  const input = String(raw || "").trim();
  if (!input) {
    return { ok: false, slug: "", message: "نام صفحه الزامی است", rules: { minLength, maxLength } };
  }
  if (hasNonEnglishChars(input)) {
    return {
      ok: false,
      slug: slugify(input, maxLength),
      message: "فقط حروف انگلیسی، عدد و خط تیره مجاز است",
      rules: { minLength, maxLength },
    };
  }

  const slug = slugify(input, maxLength);
  if (!slug || slug.length < minLength) {
    return {
      ok: false,
      slug,
      message: `نام صفحه باید حداقل ${minLength} حرف انگلیسی باشد`,
      rules: { minLength, maxLength },
    };
  }
  if (slug.length > maxLength) {
    return {
      ok: false,
      slug,
      message: `نام صفحه حداکثر ${maxLength} حرف می‌تواند باشد`,
      rules: { minLength, maxLength },
    };
  }

  const reserved = getReservedSlugsSet();
  if (reserved.has(slug)) {
    return { ok: false, slug, message: "این نام مجاز نیست", rules: { minLength, maxLength } };
  }

  if (matchesBlockedPatterns(slug)) {
    return { ok: false, slug, message: "این نام مجاز نیست", rules: { minLength, maxLength } };
  }

  const blocked = new Set(
    (blockedList || []).map((w) => String(w || "").trim().toLowerCase()).filter(Boolean)
  );
  if (blocked.has(slug)) {
    return { ok: false, slug, message: "این نام مجاز نیست", rules: { minLength, maxLength } };
  }
  if (/^\d+$/.test(slug)) {
    return { ok: false, slug, message: "نام صفحه نمی‌تواند فقط عدد باشد", rules: { minLength, maxLength } };
  }
  return { ok: true, slug, rules: { minLength, maxLength } };
}

async function loadBlockedPageSlugs() {
  try {
    const { getBlockedPageSlugs } = require("../modules/siteSetting/service");
    return await getBlockedPageSlugs();
  } catch {
    return [];
  }
}

async function isPublicSlugAvailable(slug, opts = {}) {
  const { excludeAccountId = null, excludeProviderId = null, excludeUserId = null } = opts;

  const accountHit = await Account.findOne({
    where: { profileSlug: slug },
    attributes: ["id", "userId"],
  });
  if (accountHit) {
    const sameAccount = excludeAccountId && Number(accountHit.id) === Number(excludeAccountId);
    const sameUser = excludeUserId && Number(accountHit.userId) === Number(excludeUserId);
    if (!sameAccount && !sameUser) return false;
  }

  const providerHit = await TradeServiceProvider.findOne({
    where: { profileSlug: slug },
    attributes: ["id", "userId"],
  });
  if (providerHit) {
    const sameProvider = excludeProviderId && Number(providerHit.id) === Number(excludeProviderId);
    const sameUser = excludeUserId && Number(providerHit.userId) === Number(excludeUserId);
    if (!sameProvider && !sameUser) return false;
  }

  try {
    const { isSlugTakenByAliasOrPending } = require("../modules/publicSlug/service");
    if (await isSlugTakenByAliasOrPending(slug, { excludeUserId })) return false;
  } catch {
    // ماژول هنوز لود نشده
  }

  return true;
}

async function assertPublicSlugAvailable(raw, opts = {}) {
  const blocked = await loadBlockedPageSlugs();
  const rules = await loadSlugLengthRules();
  const validated = validatePublicSlug(raw, blocked, rules);
  if (!validated.ok) {
    const err = new Error(validated.message);
    err.statusCode = 400;
    err.code = "INVALID_SLUG";
    throw err;
  }
  const available = await isPublicSlugAvailable(validated.slug, opts);
  if (!available) {
    const err = new Error("این نام قبلاً رزرو شده است");
    err.statusCode = 409;
    err.code = "SLUG_TAKEN";
    throw err;
  }
  return validated.slug;
}

function listReservedSlugs() {
  try {
    return getDefaultReservedSlugs();
  } catch {
    return [...FALLBACK_RESERVED].sort();
  }
}

/** سازگاری با کد قبلی */
const RESERVED_SLUGS = {
  has(slug) {
    return getReservedSlugsSet().has(String(slug || "").toLowerCase());
  },
  get size() {
    return getReservedSlugsSet().size;
  },
  [Symbol.iterator]() {
    return getReservedSlugsSet()[Symbol.iterator]();
  },
};

module.exports = {
  MIN_SLUG_LENGTH,
  DEFAULT_MIN_SLUG_LENGTH,
  DEFAULT_MAX_SLUG_LENGTH,
  RESERVED_SLUGS,
  slugify,
  hasNonEnglishChars,
  validatePublicSlug,
  loadSlugLengthRules,
  isPublicSlugAvailable,
  assertPublicSlugAvailable,
  loadBlockedPageSlugs,
  listReservedSlugs,
};
