const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

class BarterNotification extends Model {}

BarterNotification.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    inventoryLotId: { type: DataTypes.INTEGER, allowNull: false },
    recipientUserId: { type: DataTypes.INTEGER, allowNull: false },
    readAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "BarterNotification",
    tableName: "barter_notifications",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["recipient_user_id"] },
      { fields: ["inventory_lot_id"] },
      { fields: ["read_at"] },
      { unique: true, fields: ["inventory_lot_id", "recipient_user_id"] },
    ],
  }
);

module.exports = { BarterNotification };
