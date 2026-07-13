const { EscrowRule } = require("./model");

const { DEFAULT_RELEASE_POLICY } = require("./constants");

const DEFAULT_RULES = [
  {
    ruleCode: "GLOBAL_30",
    name: "قانون عمومی — ۳۰٪",
    description: "بیعانه پیش‌فرض برای همه معاملات",
    targetType: "global",
    targetId: null,
    depositType: "percent",
    depositPercent: 30,
    platformFeePercent: 1.5,
    releasePolicy: DEFAULT_RELEASE_POLICY,
    priority: 0,
    isActive: true,
  },
  {
    ruleCode: "VERIFIED_SELLER_10",
    name: "فروشنده تأییدشده — ۱۰٪",
    description: "برای فروشندگان با سابقه تأییدشده",
    targetType: "seller_tier",
    targetId: "verified",
    depositType: "percent",
    depositPercent: 10,
    platformFeePercent: 1.5,
    priority: 10,
    isActive: true,
  },
];

async function seedEscrowRules() {
  for (const rule of DEFAULT_RULES) {
    const [row] = await EscrowRule.findOrCreate({
      where: { ruleCode: rule.ruleCode },
      defaults: rule,
    });
    if (rule.ruleCode === "GLOBAL_30" && !row.releasePolicy) {
      await row.update({ releasePolicy: DEFAULT_RELEASE_POLICY });
    }
  }
}

module.exports = seedEscrowRules;
