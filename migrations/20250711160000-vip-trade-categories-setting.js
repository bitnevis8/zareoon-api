"use strict";

const DEFAULT_VIP = {
  "inspection-standards": {
    enabled: true,
    exclusiveProviderIds: [],
    message: {
      fa: "این بخش VIP است و عضویت در آن امکان‌پذیر نیست.",
      en: "This is a VIP section. Membership is not available.",
      ru: "Это VIP-раздел. Регистрация недоступна.",
    },
  },
};

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert("site_settings", [
      {
        key: "vipTradeCategories",
        value: JSON.stringify(DEFAULT_VIP),
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("site_settings", { key: "vipTradeCategories" });
  },
};
