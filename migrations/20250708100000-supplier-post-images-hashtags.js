"use strict";

/** پست تأمین‌کننده: چند تصویر + هشتگ */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("supplier_posts", "image_urls", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn("supplier_posts", "hashtags", {
      type: Sequelize.JSON,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE supplier_posts
      SET image_urls = JSON_ARRAY(image_url)
      WHERE image_url IS NOT NULL AND image_url != '' AND image_urls IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("supplier_posts", "hashtags");
    await queryInterface.removeColumn("supplier_posts", "image_urls");
  },
};
