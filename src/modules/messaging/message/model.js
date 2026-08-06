const { Model, DataTypes } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class Message extends Model {}

Message.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    conversationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "conversations", key: "id" },
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    body: { type: DataTypes.TEXT, allowNull: true },
    /** Translated delivery text for peer (original stays in `body`). */
    translatedBody: { type: DataTypes.TEXT, allowNull: true },
    sourceLang: { type: DataTypes.STRING(8), allowNull: true },
    targetLang: { type: DataTypes.STRING(8), allowNull: true },
    translationStatus: {
      type: DataTypes.ENUM("none", "ok", "failed", "skipped"),
      allowNull: false,
      defaultValue: "none",
    },
    translationModel: { type: DataTypes.STRING(120), allowNull: true },
    messageType: {
      type: DataTypes.ENUM("text", "image"),
      allowNull: false,
      defaultValue: "text",
    },
    fileId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "files", key: "id" },
    },
    readAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "Message",
    tableName: "messages",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["conversation_id", "created_at"] },
      { fields: ["conversation_id", "read_at"] },
      { name: "idx_messages_conv_unread", fields: ["conversation_id", "read_at", "sender_id"] },
      { name: "idx_messages_created_at", fields: ["created_at"] },
    ],
  }
);

module.exports = Message;
