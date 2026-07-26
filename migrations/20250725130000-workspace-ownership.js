"use strict";

/**
 * مالکیت داده روی Workspace + ستون‌های لازم برای enforce و سفارش
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const qi = queryInterface;
    const { INTEGER } = Sequelize;

    const lots = await qi.describeTable("inventory_lots");
    if (!lots.workspace_id) {
      await qi.addColumn("inventory_lots", "workspace_id", {
        type: INTEGER,
        allowNull: true,
        references: { model: "workspaces", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await qi.addIndex("inventory_lots", ["workspace_id"]);
    }

    const posts = await qi.describeTable("supplier_posts");
    if (!posts.workspace_id) {
      await qi.addColumn("supplier_posts", "workspace_id", {
        type: INTEGER,
        allowNull: true,
        references: { model: "workspaces", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await qi.addIndex("supplier_posts", ["workspace_id"]);
    }

    const orders = await qi.describeTable("orders");
    if (!orders.seller_workspace_id) {
      await qi.addColumn("orders", "seller_workspace_id", {
        type: INTEGER,
        allowNull: true,
        references: { model: "workspaces", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
      await qi.addIndex("orders", ["seller_workspace_id"]);
    }

    // Backfill lots از farmer → workspace
    await qi.sequelize.query(`
      UPDATE inventory_lots il
      INNER JOIN workspaces w ON w.created_by_user_id = il.farmer_id
      SET il.workspace_id = w.id
      WHERE il.workspace_id IS NULL
    `);

    await qi.sequelize.query(`
      UPDATE inventory_lots il
      INNER JOIN accounts a ON a.user_id = il.farmer_id AND a.workspace_id IS NOT NULL
      SET il.workspace_id = a.workspace_id
      WHERE il.workspace_id IS NULL
    `);

    await qi.sequelize.query(`
      UPDATE supplier_posts sp
      INNER JOIN workspaces w ON w.created_by_user_id = sp.user_id
      SET sp.workspace_id = w.id
      WHERE sp.workspace_id IS NULL
    `);

    await qi.sequelize.query(`
      UPDATE orders o
      INNER JOIN workspaces w ON w.created_by_user_id = o.supplier_id
      SET o.seller_workspace_id = w.id
      WHERE o.seller_workspace_id IS NULL AND o.supplier_id IS NOT NULL
    `);

    await qi.sequelize.query(`
      UPDATE trade_service_providers t
      INNER JOIN workspaces w ON w.created_by_user_id = t.user_id
      SET t.workspace_id = COALESCE(t.workspace_id, w.id),
          w.activity_services = 1
      WHERE t.user_id IS NOT NULL
    `);

    await qi.sequelize.query(`
      UPDATE workspaces w
      INNER JOIN inventory_lots il ON il.workspace_id = w.id
      SET w.activity_seller = 1
      WHERE w.activity_seller = 0
    `);
  },

  async down(queryInterface) {
    const qi = queryInterface;
    const orders = await qi.describeTable("orders").catch(() => ({}));
    if (orders.seller_workspace_id) await qi.removeColumn("orders", "seller_workspace_id");
    const posts = await qi.describeTable("supplier_posts").catch(() => ({}));
    if (posts.workspace_id) await qi.removeColumn("supplier_posts", "workspace_id");
    const lots = await qi.describeTable("inventory_lots").catch(() => ({}));
    if (lots.workspace_id) await qi.removeColumn("inventory_lots", "workspace_id");
  },
};
