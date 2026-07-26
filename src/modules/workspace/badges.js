const {
  PUBLIC_BADGE_KINDS,
  VERIFICATION_STATUS,
  VERIFICATION_LEVELS,
  VERIFICATION_LEVEL_LABELS_FA,
} = require("./constants");
const { getPlanById, PLAN_IDS } = require("./plans");

function normalizeLevel(level) {
  const v = String(level || VERIFICATION_LEVELS.NONE).toLowerCase();
  if (Object.values(VERIFICATION_LEVELS).includes(v)) return v;
  return VERIFICATION_LEVELS.NONE;
}

function personBadgeLabel(level) {
  const lv = normalizeLevel(level);
  if (lv === VERIFICATION_LEVELS.BASIC) return "هویت پایه";
  if (lv === VERIFICATION_LEVELS.STANDARD) return "هویت تأییدشده";
  if (lv === VERIFICATION_LEVELS.ENHANCED) return "هویت پیشرفته";
  if (lv === VERIFICATION_LEVELS.FULL) return "هویت کامل";
  return "هویت تأییدشده";
}

function businessBadgeLabel(level) {
  const lv = normalizeLevel(level);
  if (lv === VERIFICATION_LEVELS.BASIC) return "کسب‌وکار پایه";
  if (lv === VERIFICATION_LEVELS.STANDARD) return "کسب‌وکار تأییدشده";
  if (lv === VERIFICATION_LEVELS.ENHANCED) return "کسب‌وکار پیشرفته";
  if (lv === VERIFICATION_LEVELS.FULL) return "کسب‌وکار کامل";
  return "کسب‌وکار تأییدشده";
}

/**
 * نشان‌ها عمداً شبیه هم نیستند و از هم مشتق نمی‌شوند.
 * اشتراک طلایی ≠ هویت تأییدشده ≠ کسب‌وکار تأییدشده
 */
function buildPublicBadges({
  planId = PLAN_IDS.FREE,
  personOverall = VERIFICATION_STATUS.NONE,
  businessOverall = VERIFICATION_STATUS.NONE,
  representationStatus = VERIFICATION_STATUS.NONE,
  personLevel = VERIFICATION_LEVELS.NONE,
  businessLevel = VERIFICATION_LEVELS.NONE,
} = {}) {
  const plan = getPlanById(planId);
  const badges = [];

  if (plan && plan.id !== PLAN_IDS.FREE && plan.badgeKind) {
    badges.push({
      kind: PUBLIC_BADGE_KINDS.PLAN_MEMBER,
      planId: plan.id,
      tone: plan.badgeKind,
      labelFa:
        plan.id === PLAN_IDS.GOLD
          ? "عضو طلایی"
          : plan.id === PLAN_IDS.SILVER
            ? "عضو نقره‌ای"
            : "عضو برنزی",
      labelEn: `${plan.nameEn} member`,
      meaningFa: "فقط نشان اشتراک است؛ به‌معنای احراز هویت یا تضمین نیست.",
    });
  }

  if (personOverall === VERIFICATION_STATUS.VERIFIED) {
    const level = normalizeLevel(personLevel) || VERIFICATION_LEVELS.STANDARD;
    badges.push({
      kind: PUBLIC_BADGE_KINDS.IDENTITY_VERIFIED,
      tone: "identity",
      level,
      levelLabelFa: VERIFICATION_LEVEL_LABELS_FA[level],
      labelFa: personBadgeLabel(level),
      labelEn: "Identity verified",
      meaningFa: "اطلاعات هویتی شخص بررسی و تأیید شده است.",
    });
  }

  if (businessOverall === VERIFICATION_STATUS.VERIFIED) {
    const level = normalizeLevel(businessLevel) || VERIFICATION_LEVELS.STANDARD;
    badges.push({
      kind: PUBLIC_BADGE_KINDS.BUSINESS_VERIFIED,
      tone: "business",
      level,
      levelLabelFa: VERIFICATION_LEVEL_LABELS_FA[level],
      labelFa: businessBadgeLabel(level),
      labelEn: "Business verified",
      meaningFa: "اطلاعات شرکت/کسب‌وکار بررسی و تأیید شده است.",
    });
  }

  if (representationStatus === VERIFICATION_STATUS.VERIFIED) {
    badges.push({
      kind: PUBLIC_BADGE_KINDS.REPRESENTATION_VERIFIED,
      tone: "representation",
      labelFa: "نمایندگی تأییدشده",
      labelEn: "Authorized representative",
      meaningFa: "اجازه فعالیت این شخص از طرف کسب‌وکار تأیید شده است.",
    });
  }

  return badges;
}

module.exports = { buildPublicBadges, normalizeLevel, personBadgeLabel, businessBadgeLabel };
