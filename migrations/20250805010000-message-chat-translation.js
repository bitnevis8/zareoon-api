"use strict";

/** Chat translation fields for capability-0 (ParsPack AI Studio). */
module.exports = {
  async up(queryInterface, Sequelize) {
    const desc = await queryInterface.describeTable("messages").catch(() => null);
    if (!desc) return;

    if (!desc.translated_body) {
      await queryInterface.addColumn("messages", "translated_body", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!desc.source_lang) {
      await queryInterface.addColumn("messages", "source_lang", {
        type: Sequelize.STRING(8),
        allowNull: true,
      });
    }
    if (!desc.target_lang) {
      await queryInterface.addColumn("messages", "target_lang", {
        type: Sequelize.STRING(8),
        allowNull: true,
      });
    }
    if (!desc.translation_status) {
      await queryInterface.addColumn("messages", "translation_status", {
        type: Sequelize.ENUM("none", "ok", "failed", "skipped"),
        allowNull: false,
        defaultValue: "none",
      });
    }
    if (!desc.translation_model) {
      await queryInterface.addColumn("messages", "translation_model", {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const desc = await queryInterface.describeTable("messages").catch(() => null);
    if (!desc) return;
    for (const col of [
      "translation_model",
      "translation_status",
      "target_lang",
      "source_lang",
      "translated_body",
    ]) {
      if (desc[col]) await queryInterface.removeColumn("messages", col);
    }
  },
};
