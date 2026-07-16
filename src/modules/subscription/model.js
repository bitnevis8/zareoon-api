const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

class UserSubscription extends Model {}

UserSubscription.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    planId: { type: DataTypes.STRING(32), allowNull: false },
    status: {
      type: DataTypes.ENUM("pending", "active", "expired", "canceled", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    amountToman: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    authority: { type: DataTypes.STRING(64), allowNull: true },
    refId: { type: DataTypes.STRING(64), allowNull: true },
    gateway: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "zarinpal" },
    startsAt: { type: DataTypes.DATE, allowNull: true },
    endsAt: { type: DataTypes.DATE, allowNull: true },
    meta: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "UserSubscription",
    tableName: "user_subscriptions",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["user_id"] }, { fields: ["authority"] }, { fields: ["status"] }],
  }
);

module.exports = { UserSubscription };
