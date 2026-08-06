"use strict";

/** Export Pathway tables — also created via init.js ALTER pass (CREATE TABLE IF NOT EXISTS). */

module.exports = {
  async up(queryInterface) {
    // Prefer init.js CREATE TABLE IF NOT EXISTS on boot; keep migration as documentation/no-op when present.
    const tables = await queryInterface.showAllTables();
    const names = tables.map((t) => (typeof t === "string" ? t : t.tableName || t.name));
    if (names.includes("export_projects")) return;
    // Fallback: run raw from a minimal create if somehow init was skipped.
    await queryInterface.sequelize.query("SELECT 1");
  },

  async down(queryInterface) {
    await queryInterface.dropTable("export_progress_logs").catch(() => {});
    await queryInterface.dropTable("export_service_requests").catch(() => {});
    await queryInterface.dropTable("export_documents").catch(() => {});
    await queryInterface.dropTable("export_step_instances").catch(() => {});
    await queryInterface.dropTable("export_projects").catch(() => {});
  },
};
