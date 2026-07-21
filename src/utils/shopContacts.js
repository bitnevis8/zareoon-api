/**
 * نرمال‌سازی اطلاعات تماس فروشگاه
 * phones ≤ 3، emails ≤ 3، پیام‌رسان‌ها اختیاری
 */

const MAX_PHONES = 3;
const MAX_EMAILS = 3;

const MESSENGER_KEYS = ["whatsapp", "telegram", "eitaa", "rubika"];

function cleanStr(value, max = 80) {
  if (value == null) return "";
  return String(value).trim().slice(0, max);
}

function cleanList(list, maxItems, maxLen) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const v = cleanStr(item, maxLen);
    if (!v) continue;
    if (!out.includes(v)) out.push(v);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * از دادهٔ ذخیره‌شده یا فیلدهای قدیمی، شیء یکدست بساز
 */
function normalizeShopContacts(raw, legacy = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  let phones = cleanList(src.phones, MAX_PHONES, 30);
  let emails = cleanList(src.emails, MAX_EMAILS, 120);

  if (!phones.length) {
    const legacyPhones = [legacy.publicPhone, legacy.publicLandline].filter(Boolean);
    phones = cleanList(legacyPhones, MAX_PHONES, 30);
  }
  if (!emails.length && legacy.publicEmail) {
    emails = cleanList([legacy.publicEmail], MAX_EMAILS, 120);
  }

  const messengersIn = src.messengers && typeof src.messengers === "object" ? src.messengers : src;
  const messengers = {};
  for (const key of MESSENGER_KEYS) {
    const v = cleanStr(messengersIn[key], 80);
    if (v) messengers[key] = v;
  }

  return { phones, emails, messengers };
}

/** برای سازگاری با فیلدهای قدیمی */
function legacyFromContacts(contacts) {
  const c = normalizeShopContacts(contacts);
  return {
    publicPhone: c.phones[0] || null,
    publicLandline: c.phones[1] || null,
    publicEmail: c.emails[0] || null,
  };
}

function applyShopContactsToAccountPatch(body, accountUpdates) {
  if (body.shopContacts === undefined && body.phones === undefined && body.emails === undefined) {
    // فیلدهای تکی قدیمی
    if (body.publicPhone !== undefined || body.publicLandline !== undefined || body.publicEmail !== undefined) {
      return false;
    }
    return false;
  }

  const incoming =
    body.shopContacts && typeof body.shopContacts === "object"
      ? body.shopContacts
      : {
          phones: body.phones,
          emails: body.emails,
          messengers: body.messengers,
        };

  const normalized = normalizeShopContacts(incoming);
  accountUpdates.shopContacts = normalized;
  const legacy = legacyFromContacts(normalized);
  accountUpdates.publicPhone = legacy.publicPhone;
  accountUpdates.publicLandline = legacy.publicLandline;
  accountUpdates.publicEmail = legacy.publicEmail;
  return true;
}

module.exports = {
  MAX_PHONES,
  MAX_EMAILS,
  MESSENGER_KEYS,
  normalizeShopContacts,
  legacyFromContacts,
  applyShopContactsToAccountPatch,
};
