/** وضعیت قرارداد حساب امانی */
const AGREEMENT_STATUSES = [
  "draft",
  "awaiting_signatures",
  "awaiting_payment",
  "funds_locked",
  "in_progress",
  "partially_released",
  "fully_released",
  "refunded",
  "cancelled",
  "expired",
  "disputed",
  "completed",
];

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "expired"]);

const ALLOWED_TRANSITIONS = {
  draft: ["awaiting_signatures", "cancelled"],
  awaiting_signatures: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["funds_locked", "cancelled", "expired"],
  funds_locked: ["in_progress", "disputed", "refunded", "cancelled"],
  in_progress: ["partially_released", "fully_released", "disputed", "refunded"],
  partially_released: ["fully_released", "disputed", "refunded"],
  disputed: ["in_progress", "partially_released", "fully_released", "refunded", "completed"],
  fully_released: ["completed"],
  refunded: ["completed"],
  cancelled: [],
  expired: [],
  completed: [],
};

const MILESTONE_STATUSES = ["pending", "in_review", "approved", "released", "skipped"];

const PAYMENT_INTENT_STATUSES = ["pending", "awaiting_external", "confirmed", "failed", "cancelled"];

const LEDGER_ENTRY_TYPES = ["hold", "release", "refund", "fee", "adjustment"];

const RELEASE_REQUEST_STATUSES = ["pending", "approved", "rejected", "processing", "completed"];

const REFUND_STATUSES = ["pending", "approved", "rejected", "processing", "completed"];

const DISPUTE_STATUSES = [
  "filed",
  "under_review",
  "resolved_buyer",
  "resolved_seller",
  "resolved_split",
  "closed",
  "withdrawn",
];

const DISPUTE_OPEN_STATUSES = new Set(["filed", "under_review"]);

const ACTOR_ROLES = ["buyer", "seller", "admin", "system", "payment_gateway"];

const CURRENCIES = ["IRR", "USD", "EUR", "AED", "TRY"];

const DEFAULT_PLATFORM_FEE_PERCENT = 1.5;

const DEFAULT_EXPIRY_DAYS = 14;

/** سیاست‌های پیش‌فرض آزادسازی — قابل تنظیم توسط مدیر */
const DEFAULT_RELEASE_POLICY = {
  allowFullDealHold: true,
  allowCustomDeposit: true,
  minDepositPercent: 5,
  maxDepositPercent: 100,
  releaseRequiresBuyerApproval: true,
  sellerCanRequestRelease: true,
  sellerReleaseRequiresBuyerApproval: true,
  defaultMilestonePreset: "on_delivery",
  milestonePresets: {
    on_delivery: {
      label: "یک‌مرحله‌ای — پس از تحویل",
      milestones: [
        {
          title: "تحویل نهایی",
          description: "آزادسازی پس از تأیید تحویل توسط خریدار",
          percentOfDeposit: 100,
          requiresBuyerApproval: true,
          requiresSellerConfirmation: false,
        },
      ],
    },
    standard_3: {
      label: "سه‌مرحله‌ای استاندارد (۳۰ / ۴۰ / ۳۰)",
      milestones: [
        {
          title: "شروع / پیش‌پرداخت",
          description: "پس از تأیید شروع تعهدات فروشنده",
          percentOfDeposit: 30,
          requiresBuyerApproval: true,
          requiresSellerConfirmation: true,
        },
        {
          title: "تحویل میانی",
          description: "پس از ارسال یا بارگیری",
          percentOfDeposit: 40,
          requiresBuyerApproval: true,
          requiresSellerConfirmation: false,
        },
        {
          title: "تحویل نهایی",
          description: "پس از تحویل و تأیید خریدار",
          percentOfDeposit: 30,
          requiresBuyerApproval: true,
          requiresSellerConfirmation: false,
        },
      ],
    },
    half_half: {
      label: "دو مرحله‌ای (۵۰ / ۵۰)",
      milestones: [
        {
          title: "تحویل میانی",
          description: "پس از ارسال کالا",
          percentOfDeposit: 50,
          requiresBuyerApproval: true,
          requiresSellerConfirmation: false,
        },
        {
          title: "تحویل نهایی",
          description: "پس از دریافت و بازرسی",
          percentOfDeposit: 50,
          requiresBuyerApproval: true,
          requiresSellerConfirmation: false,
        },
      ],
    },
  },
};

module.exports = {
  AGREEMENT_STATUSES,
  TERMINAL_STATUSES,
  ALLOWED_TRANSITIONS,
  MILESTONE_STATUSES,
  PAYMENT_INTENT_STATUSES,
  LEDGER_ENTRY_TYPES,
  RELEASE_REQUEST_STATUSES,
  REFUND_STATUSES,
  DISPUTE_STATUSES,
  DISPUTE_OPEN_STATUSES,
  ACTOR_ROLES,
  CURRENCIES,
  DEFAULT_PLATFORM_FEE_PERCENT,
  DEFAULT_EXPIRY_DAYS,
  DEFAULT_RELEASE_POLICY,
};
