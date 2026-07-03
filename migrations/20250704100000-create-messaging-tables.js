"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("conversations", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      participant_one_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      participant_two_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      last_message_at: { type: Sequelize.DATE, allowNull: true },
      last_message_preview: { type: Sequelize.STRING(500), allowNull: true },
      last_message_type: {
        type: Sequelize.ENUM("text", "image"),
        allowNull: true,
        defaultValue: "text",
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("conversations", ["participant_one_id", "participant_two_id"], {
      unique: true,
      name: "conversations_participants_unique",
    });
    await queryInterface.addIndex("conversations", ["last_message_at"]);

    await queryInterface.createTable("messages", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      conversation_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "conversations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      sender_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      body: { type: Sequelize.TEXT, allowNull: true },
      message_type: {
        type: Sequelize.ENUM("text", "image"),
        allowNull: false,
        defaultValue: "text",
      },
      file_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "files", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("messages", ["conversation_id", "created_at"]);
    await queryInterface.addIndex("messages", ["conversation_id", "read_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("messages");
    await queryInterface.dropTable("conversations");
  },
};
