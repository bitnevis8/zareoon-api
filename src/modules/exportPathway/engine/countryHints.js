/**
 * Soft destination hints — NOT legal advice. Used to append warnings/documents.
 * Keys are ISO 3166-1 alpha-2.
 */
const DESTINATION_HINTS = {
  RU: {
    titleFa: "روسیه",
    forFamilies: ["agro-raw", "food-processed", "perishable-cold-chain"],
    documents: ["EAC / GOST conformity (if applicable)", "Phytosanitary Certificate"],
    warnings: ["برای مواد غذایی و کشاورزی، انطباق و گواهی بهداشت مقصد را زود بررسی کنید."],
  },
  IN: {
    titleFa: "هند",
    forFamilies: ["chemical-dangerous-goods", "fertilizer-agri-input", "minerals", "agro-raw"],
    documents: ["Import license check", "Certificate of Analysis"],
    warnings: ["برخی مواد شیمیایی و کودها در هند نیازمند مجوز واردات جداگانه هستند."],
  },
  DE: {
    titleFa: "آلمان",
    forFamilies: ["food-processed", "industrial-parts", "machinery", "textile-consumer-goods"],
    documents: ["EU labeling compliance", "CE / technical file (if applicable)"],
    warnings: ["بازار اتحادیه اروپا استاندارد برچسب و ایمنی سخت‌گیرانه‌تری دارد."],
  },
  AE: {
    titleFa: "امارات",
    forFamilies: ["food-processed", "agro-raw", "general"],
    documents: ["Halal certificate (if food)", "Certificate of Origin"],
    warnings: ["برای مواد غذایی، گواهی حلال و برچسب عربی/انگلیسی رایج است."],
  },
  TR: {
    titleFa: "ترکیه",
    forFamilies: ["textile-consumer-goods", "food-processed", "industrial-parts"],
    documents: ["Certificate of Origin", "Commercial Invoice"],
    warnings: [],
  },
  IQ: {
    titleFa: "عراق",
    forFamilies: ["food-processed", "construction-materials", "general"],
    documents: ["Certificate of Origin", "Quality inspection"],
    warnings: ["بازرسی کیفیت در مقصد یا مبدأ برای برخی کالاها رایج است."],
  },
  CN: {
    titleFa: "چین",
    forFamilies: ["minerals", "chemical-dangerous-goods", "agro-raw"],
    documents: ["Certificate of Analysis", "MSDS (if chemical)"],
    warnings: [],
  },
};

function applyDestinationHints({ destinationCountry, familyId, stepsByCode }) {
  const code = String(destinationCountry || "")
    .trim()
    .toUpperCase();
  const hint = DESTINATION_HINTS[code];
  if (!hint) return { applied: false, hint: null };

  const relevant =
    !hint.forFamilies?.length || hint.forFamilies.includes(familyId) || familyId === "general";

  if (relevant) {
    const cert = stepsByCode.certifications;
    if (cert && hint.documents?.length) {
      cert.documents = uniqueStrings([...(cert.documents || []), ...hint.documents]);
    }
    const restrictions = stepsByCode["export-restrictions"];
    if (restrictions && hint.warnings?.length) {
      restrictions.warnings = uniqueStrings([...(restrictions.warnings || []), ...hint.warnings]);
    }
  }

  return { applied: true, hint: { country: code, ...hint } };
}

function uniqueStrings(arr) {
  return [...new Set(arr.filter(Boolean))];
}

module.exports = { DESTINATION_HINTS, applyDestinationHints };
