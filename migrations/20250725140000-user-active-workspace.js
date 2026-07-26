"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.describeTable("users");
    if (!users.active_workspace_id) {
      await queryInterface.addColumn("users", "active_workspace_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "workspaces", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await queryInterface.addIndex("users", ["active_workspace_id"]);
    }

    // برای کاربرانی که فقط یک عضویت دارند، همان را فعال کن
    await queryInterface.sequelize.query(`
      UPDATE users u
      INNER JOIN (
        SELECT user_id, MIN(workspace_id) AS workspace_id
        FROM workspace_members
        WHERE status = 'active'
        GROUP BY user_id
        HAVING COUNT(*) = 1
      ) m ON m.user_id = u.id
      SET u.active_workspace_id = m.workspace_id
      WHERE u.active_workspace_id IS NULL
    `);
  },

  async down(queryInterface) {
    const users = await queryInterface.describeTable("users").catch(() => ({}));
    if (users.active_workspace_id) {
      await queryInterface.removeColumn("users", "active_workspace_id");
    }
  },
};
