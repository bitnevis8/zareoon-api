/** تعریف فیلدهای پویا بر اساس entity_type */

const ENTITY_TYPE_LABELS = {
  individual: "شخص حقیقی",
  company: "شرکت",
  trader: "تاجر مستقل",
  manufacturer: "تولیدکننده / کارگاه",
  distributor: "پخش‌کننده",
};

const FIELD_TYPES = {
  text: "text",
  textarea: "textarea",
  number: "number",
};

/** @type {Record<string, Array<{key:string, label:string, type:string, placeholder?:string}>>} */
const ENTITY_FIELD_SCHEMAS = {
  individual: [
    { key: "workExperience", label: "تجربه کاری", type: FIELD_TYPES.textarea, placeholder: "سابقه و حوزه فعالیت" },
    { key: "skills", label: "مهارت‌ها", type: FIELD_TYPES.text, placeholder: "مثلاً: بسته‌بندی، صادرات، کیفیت‌سنجی" },
    { key: "productFocus", label: "محصولات / تمرکز", type: FIELD_TYPES.textarea, placeholder: "محصولات محدود، دست‌ساز یا تخصصی" },
    { key: "individualCredibility", label: "اعتبار فردی", type: FIELD_TYPES.textarea, placeholder: "گواهی‌ها، همکاری‌ها، معرفی کوتاه" },
    { key: "nationalIdPassport", label: "کد ملی / پاسپورت (اختیاری)", type: FIELD_TYPES.text },
  ],
  company: [
    { key: "companyName", label: "نام شرکت", type: FIELD_TYPES.text },
    { key: "commercialRegistration", label: "ثبت تجاری", type: FIELD_TYPES.text },
    { key: "registrationNumber", label: "شماره ثبت", type: FIELD_TYPES.text },
    { key: "taxNumber", label: "شماره مالیاتی", type: FIELD_TYPES.text },
    { key: "factory", label: "کارخانه / واحد تولید", type: FIELD_TYPES.text },
    { key: "productionCapacity", label: "ظرفیت تولید", type: FIELD_TYPES.text },
    { key: "teamDescription", label: "تیم", type: FIELD_TYPES.textarea },
    { key: "certificates", label: "گواهی‌ها و مجوزها", type: FIELD_TYPES.textarea },
  ],
  trader: [
    { key: "tradeLicense", label: "مجوز کسب‌وکار / بازرگانی", type: FIELD_TYPES.text },
    { key: "mainProducts", label: "محصولات اصلی", type: FIELD_TYPES.textarea },
    { key: "markets", label: "بازارهای هدف", type: FIELD_TYPES.text, placeholder: "داخلی، صادرات، منطقه‌ای" },
    { key: "yearsInBusiness", label: "سال‌های فعالیت", type: FIELD_TYPES.text },
    { key: "credibilityNotes", label: "اعتبار و سوابق", type: FIELD_TYPES.textarea },
  ],
  manufacturer: [
    { key: "workshopName", label: "نام کارگاه / واحد", type: FIELD_TYPES.text },
    { key: "productionCapacity", label: "ظرفیت تولید", type: FIELD_TYPES.text },
    { key: "mainProducts", label: "محصولات تولیدی", type: FIELD_TYPES.textarea },
    { key: "certifications", label: "گواهی‌ها", type: FIELD_TYPES.textarea },
    { key: "equipment", label: "تجهیزات", type: FIELD_TYPES.textarea },
  ],
  distributor: [
    { key: "companyName", label: "نام شرکت / برند", type: FIELD_TYPES.text },
    { key: "distributionRegion", label: "منطقه پخش", type: FIELD_TYPES.text },
    { key: "warehouseCapacity", label: "ظرفیت انبار", type: FIELD_TYPES.text },
    { key: "brandsRepresented", label: "برندهای نمایندگی", type: FIELD_TYPES.textarea },
    { key: "fleetSize", label: "ناوگان / لجستیک", type: FIELD_TYPES.text },
  ],
};

function getSchemaForEntity(entityType) {
  return ENTITY_FIELD_SCHEMAS[entityType] || ENTITY_FIELD_SCHEMAS.individual;
}

function pickProfileFields(entityType, rawData) {
  const schema = getSchemaForEntity(entityType);
  const keys = new Set(schema.map((f) => f.key));
  const out = {};
  for (const [key, value] of Object.entries(rawData || {})) {
    if (keys.has(key) && value != null && String(value).trim() !== "") {
      out[key] = String(value).trim().slice(0, 5000);
    }
  }
  return out;
}

module.exports = {
  ENTITY_TYPE_LABELS,
  ENTITY_FIELD_SCHEMAS,
  FIELD_TYPES,
  getSchemaForEntity,
  pickProfileFields,
};
