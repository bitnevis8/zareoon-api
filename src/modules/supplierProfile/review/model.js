const { Model, DataTypes } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class SupplierReview extends Model {}

SupplierReview.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    reviewerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    orderId: { type: DataTypes.INTEGER, allowNull: true },
    rating: { type: DataTypes.TINYINT, allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "SupplierReview",
    tableName: "supplier_reviews",
    timestamps: true,
    underscored: true,
  }
);

module.exports = SupplierReview;
