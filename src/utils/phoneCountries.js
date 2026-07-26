/**
 * فهرست dial code کشورها — هم‌تراز فرانت برای اعتبارسنجی API
 */
const PHONE_COUNTRIES = [
  { code: "IR", dial: "98", nationalMax: 10 },
  { code: "AF", dial: "93", nationalMax: 9 },
  { code: "AE", dial: "971", nationalMax: 9 },
  { code: "TR", dial: "90", nationalMax: 10 },
  { code: "IQ", dial: "964", nationalMax: 10 },
  { code: "SA", dial: "966", nationalMax: 9 },
  { code: "QA", dial: "974", nationalMax: 8 },
  { code: "KW", dial: "965", nationalMax: 8 },
  { code: "OM", dial: "968", nationalMax: 8 },
  { code: "BH", dial: "973", nationalMax: 8 },
  { code: "PK", dial: "92", nationalMax: 10 },
  { code: "IN", dial: "91", nationalMax: 10 },
  { code: "CN", dial: "86", nationalMax: 11 },
  { code: "RU", dial: "7", nationalMax: 10 },
  { code: "DE", dial: "49", nationalMax: 11 },
  { code: "FR", dial: "33", nationalMax: 9 },
  { code: "GB", dial: "44", nationalMax: 10 },
  { code: "NL", dial: "31", nationalMax: 9 },
  { code: "BE", dial: "32", nationalMax: 9 },
  { code: "ES", dial: "34", nationalMax: 9 },
  { code: "IT", dial: "39", nationalMax: 10 },
  { code: "SE", dial: "46", nationalMax: 9 },
  { code: "NO", dial: "47", nationalMax: 8 },
  { code: "FI", dial: "358", nationalMax: 10 },
  { code: "DK", dial: "45", nationalMax: 8 },
  { code: "CH", dial: "41", nationalMax: 9 },
  { code: "AT", dial: "43", nationalMax: 10 },
  { code: "PL", dial: "48", nationalMax: 9 },
  { code: "US", dial: "1", nationalMax: 10 },
  { code: "CA", dial: "1", nationalMax: 10 },
  { code: "AU", dial: "61", nationalMax: 9 },
  { code: "NZ", dial: "64", nationalMax: 9 },
  { code: "JP", dial: "81", nationalMax: 10 },
  { code: "KR", dial: "82", nationalMax: 10 },
  { code: "MY", dial: "60", nationalMax: 10 },
  { code: "SG", dial: "65", nationalMax: 8 },
  { code: "ID", dial: "62", nationalMax: 11 },
  { code: "TH", dial: "66", nationalMax: 9 },
  { code: "VN", dial: "84", nationalMax: 9 },
  { code: "EG", dial: "20", nationalMax: 10 },
  { code: "ZA", dial: "27", nationalMax: 9 },
  { code: "BR", dial: "55", nationalMax: 11 },
  { code: "MX", dial: "52", nationalMax: 10 },
  { code: "AR", dial: "54", nationalMax: 10 },
  { code: "AM", dial: "374", nationalMax: 8 },
  { code: "AZ", dial: "994", nationalMax: 9 },
  { code: "GE", dial: "995", nationalMax: 9 },
  { code: "KZ", dial: "7", nationalMax: 10 },
  { code: "UZ", dial: "998", nationalMax: 9 },
  { code: "TJ", dial: "992", nationalMax: 9 },
  { code: "TM", dial: "993", nationalMax: 8 },
  { code: "KG", dial: "996", nationalMax: 9 },
];

const ALL_CODES = PHONE_COUNTRIES.map((c) => c.code);

function getCountry(code) {
  return PHONE_COUNTRIES.find((c) => c.code === String(code || "").toUpperCase()) || null;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

/** ایران 09… یا +98… → 09… ؛ بقیه E.164 با + */
function normalizePhoneNumber(countryCode, nationalDigits) {
  const digits = String(nationalDigits || "").replace(/\D/g, "");
  const country = getCountry(countryCode);
  if (!country) return null;
  if (country.code === "IR") {
    let n = digits;
    if (n.startsWith("98")) n = n.slice(2);
    if (n.startsWith("0")) n = n.slice(1);
    if (n.length === 10 && n.startsWith("9")) return `0${n}`;
    if (n.length === 11 && n.startsWith("09")) return n;
    return null;
  }
  const max = country.nationalMax || 12;
  if (digits.length < 6 || digits.length > max + 4) return null;
  let national = digits;
  if (national.startsWith(country.dial)) national = national.slice(country.dial.length);
  if (!national) return null;
  return `+${country.dial}${national}`;
}

function detectPhoneCountry(stored) {
  const s = String(stored || "").trim();
  if (/^09\d{9}$/.test(s)) return "IR";
  if (s.startsWith("+")) {
    const rest = s.slice(1).replace(/\D/g, "");
    const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      if (rest.startsWith(c.dial)) return c.code;
    }
  }
  return null;
}

function isIranMobile(stored) {
  return /^09\d{9}$/.test(String(stored || "").trim());
}

module.exports = {
  PHONE_COUNTRIES,
  ALL_PHONE_COUNTRY_CODES: ALL_CODES,
  getCountry,
  isValidEmail,
  normalizePhoneNumber,
  detectPhoneCountry,
  isIranMobile,
};
