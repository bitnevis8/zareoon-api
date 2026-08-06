/** Supported chat translation targets — matches Zareoon locales. */
const CHAT_TRANSLATE_LANGUAGES = [
  { code: "en", labelFa: "انگلیسی", labelEn: "English", dir: "ltr" },
  { code: "fa", labelFa: "فارسی", labelEn: "Persian", dir: "rtl" },
  { code: "ar", labelFa: "عربی", labelEn: "Arabic", dir: "rtl" },
  { code: "ru", labelFa: "روسی", labelEn: "Russian", dir: "ltr" },
  { code: "tr", labelFa: "ترکی", labelEn: "Turkish", dir: "ltr" },
  { code: "fi", labelFa: "فنلاندی", labelEn: "Finnish", dir: "ltr" },
  { code: "ur", labelFa: "اردو", labelEn: "Urdu", dir: "rtl" },
];

const LANG_NAME = Object.fromEntries(
  CHAT_TRANSLATE_LANGUAGES.map((l) => [l.code, l.labelEn])
);

const TRANSLATION_STATUSES = ["none", "ok", "failed", "skipped"];

module.exports = {
  CHAT_TRANSLATE_LANGUAGES,
  LANG_NAME,
  TRANSLATION_STATUSES,
};
