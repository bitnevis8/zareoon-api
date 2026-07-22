"use strict";

/**
 * ایندکس‌گذاری عملکردی + FULLTEXT
 * ترجیحاً از ensurePerformanceIndexes در استارت API استفاده می‌شود.
 * این فایل برای اجرای دستی / CI است.
 */

const {
  INDEXES,
  FULLTEXT,
} = require("../src/core/database/mysql/ensurePerformanceIndexes");

async function tryCreate(queryInterface, item) {
  try {
    await queryInterface.sequelize.query(item.sql);
    console.log(`✅ ${item.name}`);
  } catch (e) {
    const msg = e.message || String(e);
    if (/Duplicate key name|ER_DUP_KEYNAME|already exists/i.test(msg)) {
      console.log(`⏭️  ${item.name} exists`);
      return;
    }
    console.warn(`⚠️  ${item.name}:`, msg);
  }
}

module.exports = {
  async up(queryInterface) {
    for (const item of [...INDEXES, ...FULLTEXT]) {
      await tryCreate(queryInterface, item);
    }
  },

  async down(queryInterface) {
    for (const item of [...FULLTEXT, ...INDEXES].reverse()) {
      try {
        await queryInterface.sequelize.query(
          `DROP INDEX \`${item.name}\` ON \`${item.table}\``
        );
      } catch (_) {
        /* ignore */
      }
    }
  },
};
