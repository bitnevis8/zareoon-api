const {
  VERIFICATION_LEVELS,
  VERIFICATION_LEVEL_LABELS_FA,
  PERSON_VERIFICATION_LEVELS,
  BUSINESS_VERIFICATION_LEVELS,
} = require("./constants");

/** ترتیب پله‌ها */
const LEVEL_ORDER = [
  VERIFICATION_LEVELS.BASIC,
  VERIFICATION_LEVELS.STANDARD,
  VERIFICATION_LEVELS.ENHANCED,
  VERIFICATION_LEVELS.FULL,
];

const LEVEL_STEP_NUMBER = {
  [VERIFICATION_LEVELS.BASIC]: 1,
  [VERIFICATION_LEVELS.STANDARD]: 2,
  [VERIFICATION_LEVELS.ENHANCED]: 3,
  [VERIFICATION_LEVELS.FULL]: 4,
};

/**
 * هر سطح = الزامات تجمعی (فیلدها و مدارک سطح‌های پایین‌تر + جدید)
 * fields: کلیدهای application
 * documentKinds: kindهای الزامی مدارک
 */
const PERSON_LEVEL_REQUIREMENTS = {
  [VERIFICATION_LEVELS.BASIC]: {
    step: 1,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.basic,
    titleFa: "هویت پایه",
    iconKey: "person_basic",
    fields: ["firstName", "lastName", "nationalId"],
    documentKinds: ["national_id_front"],
    summaryFa: "نام، نام‌خانوادگی، کد ملی و تصویر روی کارت ملی",
  },
  [VERIFICATION_LEVELS.STANDARD]: {
    step: 2,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.standard,
    titleFa: "هویت استاندارد",
    iconKey: "person_standard",
    fields: ["firstName", "lastName", "nationalId", "birthDate", "fatherName"],
    documentKinds: ["national_id_front", "national_id_back"],
    summaryFa: "اطلاعات پایه + تاریخ تولد، نام پدر و پشت کارت ملی",
  },
  [VERIFICATION_LEVELS.ENHANCED]: {
    step: 3,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.enhanced,
    titleFa: "هویت پیشرفته",
    iconKey: "person_enhanced",
    fields: [
      "firstName",
      "lastName",
      "nationalId",
      "birthDate",
      "fatherName",
      "address",
      "postalCode",
      "city",
      "province",
    ],
    documentKinds: ["national_id_front", "national_id_back", "selfie_with_id"],
    summaryFa: "اطلاعات استاندارد + آدرس کامل و سلفی با کارت",
  },
  [VERIFICATION_LEVELS.FULL]: {
    step: 4,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.full,
    titleFa: "هویت کامل",
    iconKey: "person_full",
    fields: [
      "firstName",
      "lastName",
      "nationalId",
      "birthDate",
      "fatherName",
      "address",
      "postalCode",
      "city",
      "province",
      "nationalCardSerial",
      "occupation",
    ],
    documentKinds: ["national_id_front", "national_id_back", "selfie_with_id", "video_intro"],
    summaryFa: "همه اطلاعات + سریال کارت و ویدیوی معرفی کوتاه",
  },
};

const BUSINESS_INDIVIDUAL_LEVEL_REQUIREMENTS = {
  [VERIFICATION_LEVELS.BASIC]: {
    step: 1,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.basic,
    titleFa: "کسب‌وکار حقیقی — پایه",
    iconKey: "business_basic",
    fields: ["legalName", "nationalId"],
    documentKinds: ["owner_national_id_front"],
    summaryFa: "نام کسب‌وکار، کد ملی صاحب و تصویر روی کارت ملی",
  },
  [VERIFICATION_LEVELS.STANDARD]: {
    step: 2,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.standard,
    titleFa: "کسب‌وکار حقیقی — استاندارد",
    iconKey: "business_standard",
    fields: ["legalName", "nationalId", "tradeName", "address", "city", "province", "phone"],
    documentKinds: ["owner_national_id_front", "owner_national_id_back"],
    summaryFa: "پایه + نام تجاری، آدرس، تلفن و پشت کارت ملی",
  },
  [VERIFICATION_LEVELS.ENHANCED]: {
    step: 3,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.enhanced,
    titleFa: "کسب‌وکار حقیقی — پیشرفته",
    iconKey: "business_enhanced",
    fields: [
      "legalName",
      "nationalId",
      "tradeName",
      "address",
      "city",
      "province",
      "phone",
      "postalCode",
      "email",
      "licenseNumber",
    ],
    documentKinds: [
      "owner_national_id_front",
      "owner_national_id_back",
      "selfie_with_id",
      "license",
      "address_proof",
    ],
    summaryFa: "استاندارد + کدپستی، ایمیل، مجوز صنفی، سلفی و مدرک آدرس",
  },
  [VERIFICATION_LEVELS.FULL]: {
    step: 4,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.full,
    titleFa: "کسب‌وکار حقیقی — کامل",
    iconKey: "business_full",
    fields: [
      "legalName",
      "nationalId",
      "tradeName",
      "address",
      "city",
      "province",
      "phone",
      "postalCode",
      "email",
      "licenseNumber",
      "bankName",
      "bankAccountIban",
      "accountHolderName",
    ],
    documentKinds: [
      "owner_national_id_front",
      "owner_national_id_back",
      "selfie_with_id",
      "license",
      "address_proof",
      "iban_proof",
      "video_intro",
    ],
    summaryFa: "پیشرفته + شبا، نام بانک، دارنده حساب، تأییدیه شبا و ویدیو",
  },
};

const BUSINESS_COMPANY_LEVEL_REQUIREMENTS = {
  [VERIFICATION_LEVELS.BASIC]: {
    step: 1,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.basic,
    titleFa: "کسب‌وکار حقوقی — پایه",
    iconKey: "business_basic",
    fields: ["legalName"],
    requireAnyOf: [["nationalId", "registrationNumber"]],
    documentKinds: ["national_id_cert"],
    summaryFa: "نام قانونی شرکت، شناسه ملی یا شماره ثبت، گواهی شناسه ملی",
  },
  [VERIFICATION_LEVELS.STANDARD]: {
    step: 2,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.standard,
    titleFa: "کسب‌وکار حقوقی — استاندارد",
    iconKey: "business_standard",
    fields: ["legalName", "tradeName", "address", "city", "province"],
    requireAnyOf: [["nationalId", "registrationNumber"]],
    documentKinds: ["national_id_cert", "registration_gazette"],
    summaryFa: "پایه + نام تجاری، آدرس و روزنامه رسمی / آگهی تأسیس",
  },
  [VERIFICATION_LEVELS.ENHANCED]: {
    step: 3,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.enhanced,
    titleFa: "کسب‌وکار حقوقی — پیشرفته",
    iconKey: "business_enhanced",
    fields: [
      "legalName",
      "tradeName",
      "address",
      "city",
      "province",
      "economicCode",
      "phone",
      "email",
      "ceoName",
      "licenseNumber",
    ],
    requireAnyOf: [["nationalId", "registrationNumber"]],
    documentKinds: ["national_id_cert", "registration_gazette", "license", "address_proof"],
    summaryFa: "استاندارد + کد اقتصادی، تماس، مدیرعامل، مجوز و مدرک آدرس",
  },
  [VERIFICATION_LEVELS.FULL]: {
    step: 4,
    labelFa: VERIFICATION_LEVEL_LABELS_FA.full,
    titleFa: "کسب‌وکار حقوقی — کامل",
    iconKey: "business_full",
    fields: [
      "legalName",
      "tradeName",
      "address",
      "city",
      "province",
      "economicCode",
      "phone",
      "email",
      "ceoName",
      "ceoNationalId",
      "licenseNumber",
      "bankName",
      "bankAccountIban",
      "accountHolderName",
    ],
    requireAnyOf: [["nationalId", "registrationNumber"]],
    documentKinds: [
      "national_id_cert",
      "registration_gazette",
      "license",
      "address_proof",
      "iban_proof",
      "video_intro",
    ],
    summaryFa: "پیشرفته + کد ملی مدیرعامل، شبا، تأییدیه بانکی و ویدیوی معرفی",
  },
};

/** سازگاری با کد قدیمی — پیش‌فرض حقوقی */
const BUSINESS_LEVEL_REQUIREMENTS = BUSINESS_COMPANY_LEVEL_REQUIREMENTS;

function isIndividualEntity(entityType) {
  return String(entityType || "").toLowerCase() === "individual";
}

function normalizeBusinessEntityType(entityType) {
  return isIndividualEntity(entityType) ? "individual" : "company";
}

function getBusinessRequirement(level, entityType = "company") {
  const lv = normalizeVerifiedLevel(level);
  const map = isIndividualEntity(entityType)
    ? BUSINESS_INDIVIDUAL_LEVEL_REQUIREMENTS
    : BUSINESS_COMPANY_LEVEL_REQUIREMENTS;
  return map[lv] || null;
}

function getBusinessRequirementsMap(entityType = "company") {
  return isIndividualEntity(entityType)
    ? BUSINESS_INDIVIDUAL_LEVEL_REQUIREMENTS
    : BUSINESS_COMPANY_LEVEL_REQUIREMENTS;
}

function levelIndex(level) {
  const i = LEVEL_ORDER.indexOf(String(level || "").toLowerCase());
  return i;
}

function normalizeVerifiedLevel(level) {
  const v = String(level || VERIFICATION_LEVELS.NONE).toLowerCase();
  if (LEVEL_ORDER.includes(v)) return v;
  return VERIFICATION_LEVELS.NONE;
}

/** سطح بعدی قابل درخواست پس از سطح تأییدشده فعلی */
function getNextRequestableLevel(verifiedLevel) {
  const cur = normalizeVerifiedLevel(verifiedLevel);
  if (cur === VERIFICATION_LEVELS.NONE) return VERIFICATION_LEVELS.BASIC;
  const idx = levelIndex(cur);
  if (idx < 0 || idx >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

function isLevelUnlocked(targetLevel, verifiedLevel) {
  const next = getNextRequestableLevel(verifiedLevel);
  return next === targetLevel;
}

function isLevelCompleted(targetLevel, verifiedLevel) {
  const t = levelIndex(targetLevel);
  const v = levelIndex(normalizeVerifiedLevel(verifiedLevel));
  return t >= 0 && v >= t;
}

function getPersonRequirement(level) {
  return PERSON_LEVEL_REQUIREMENTS[normalizeVerifiedLevel(level)] || null;
}

function validateApplicationFields(application, requirement) {
  const missing = [];
  for (const key of requirement.fields || []) {
    const val = application?.[key];
    if (val == null || String(val).trim() === "") missing.push(key);
  }
  if (Array.isArray(requirement.requireAnyOf)) {
    for (const group of requirement.requireAnyOf) {
      const ok = group.some((k) => application?.[k] != null && String(application[k]).trim() !== "");
      if (!ok) missing.push(group.join("|"));
    }
  }
  return missing;
}

function validateDocuments(documents, requirement) {
  const kinds = new Set(
    (Array.isArray(documents) ? documents : [])
      .map((d) => d?.kind)
      .filter(Boolean)
      .map(String)
  );
  const missing = (requirement.documentKinds || []).filter((k) => !kinds.has(k));
  return missing;
}

function mapLevels(reqMap) {
  return BUSINESS_VERIFICATION_LEVELS.map((lv) => ({
    level: lv,
    ...reqMap[lv],
  }));
}

function publicRequirementsPayload() {
  return {
    person: PERSON_VERIFICATION_LEVELS.map((lv) => ({
      level: lv,
      ...PERSON_LEVEL_REQUIREMENTS[lv],
    })),
    business: mapLevels(BUSINESS_COMPANY_LEVEL_REQUIREMENTS),
    businessByEntity: {
      individual: mapLevels(BUSINESS_INDIVIDUAL_LEVEL_REQUIREMENTS),
      company: mapLevels(BUSINESS_COMPANY_LEVEL_REQUIREMENTS),
    },
    labels: VERIFICATION_LEVEL_LABELS_FA,
    order: LEVEL_ORDER,
  };
}

module.exports = {
  LEVEL_ORDER,
  LEVEL_STEP_NUMBER,
  PERSON_LEVEL_REQUIREMENTS,
  BUSINESS_LEVEL_REQUIREMENTS,
  BUSINESS_INDIVIDUAL_LEVEL_REQUIREMENTS,
  BUSINESS_COMPANY_LEVEL_REQUIREMENTS,
  levelIndex,
  normalizeVerifiedLevel,
  getNextRequestableLevel,
  isLevelUnlocked,
  isLevelCompleted,
  isIndividualEntity,
  normalizeBusinessEntityType,
  getPersonRequirement,
  getBusinessRequirement,
  getBusinessRequirementsMap,
  validateApplicationFields,
  validateDocuments,
  publicRequirementsPayload,
};
