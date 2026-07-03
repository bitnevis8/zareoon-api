const { Model, DataTypes } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class Conversation extends Model {}

Conversation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    participantOneId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    participantTwoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    lastMessageAt: { type: DataTypes.DATE, allowNull: true },
    lastMessagePreview: { type: DataTypes.STRING(500), allowNull: true },
    lastMessageType: {
      type: DataTypes.ENUM("text", "image"),
      allowNull: true,
      defaultValue: "text",
    },
  },
  {
    sequelize,
    modelName: "Conversation",
    tableName: "conversations",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["participant_one_id", "participant_two_id"],
        name: "conversations_participants_unique",
      },
      { fields: ["last_message_at"] },
    ],
  }
);

module.exports = Conversation;
