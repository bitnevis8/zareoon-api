const { formatHashtags } = require("./hashtags");

const LOCALE_CODES = ["fa", "en", "es", "ar", "nl", "tr", "ru", "ur", "fi"];

const EMPTY_LOCALE = () => ({ title: "", description: "", hashtags: [] });

function normalizeHashtagsList(raw) {
  return formatHashtags(Array.isArray(raw) ? raw : []);
}

function normalizeDisplayContent(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const code of LOCALE_CODES) {
    const src = source[code] || {};
    out[code] = {
      title: String(src.title || "").trim(),
      description: String(src.description || "").trim(),
      hashtags: normalizeHashtagsList(src.hashtags),
    };
  }
  return out;
}

function legacyToDisplayContent(lot = {}) {
  if (lot.displayContent && typeof lot.displayContent === "object") {
    return normalizeDisplayContent(lot.displayContent);
  }

  return normalizeDisplayContent({
    fa: {
      title: "",
      description: lot.description || "",
      hashtags: lot.hashtags || [],
    },
    en: { title: lot.englishName || "", description: "", hashtags: [] },
    ar: { title: lot.arabicName || "", description: "", hashtags: [] },
    ru: { title: lot.russianName || "", description: "", hashtags: [] },
  });
}

function displayContentToLegacyFields(displayContent) {
  const dc = normalizeDisplayContent(displayContent);
  return {
    displayContent: dc,
    description: dc.fa.description || null,
    hashtags: dc.fa.hashtags.length ? dc.fa.hashtags : null,
    englishName: dc.en.title || null,
    arabicName: dc.ar.title || null,
    russianName: dc.ru.title || null,
  };
}

function applyDisplayContentToPayload(payload, body) {
  if (body.displayContent === undefined) return payload;
  const legacy = displayContentToLegacyFields(body.displayContent);
  return { ...payload, ...legacy };
}

function attachDisplayContentToLot(lot) {
  const plain = lot?.toJSON ? lot.toJSON() : { ...lot };
  return {
    ...plain,
    displayContent: legacyToDisplayContent(plain),
    hashtags: formatHashtags(plain.hashtags),
  };
}

module.exports = {
  LOCALE_CODES,
  normalizeDisplayContent,
  legacyToDisplayContent,
  displayContentToLegacyFields,
  applyDisplayContentToPayload,
  attachDisplayContentToLot,
};
