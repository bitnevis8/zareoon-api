const { Model, DataTypes } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class TradeProviderReview extends Model {}

TradeProviderReview.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    providerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "trade_service_providers", key: "id" },
    },
    reviewerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    rating: { type: DataTypes.TINYINT, allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "TradeProviderReview",
    tableName: "trade_provider_reviews",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["provider_id", "reviewer_id"] },
      { fields: ["provider_id"] },
    ],
  }
);

module.exports = TradeProviderReview;
