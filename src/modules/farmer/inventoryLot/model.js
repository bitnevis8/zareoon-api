const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");
const User = require("../../user/user/model");
const Product = require("../product/model");

class InventoryLot extends Model {}

InventoryLot.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    farmerId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    qualityGrade: { type: DataTypes.STRING(50), allowNull: false },
    status: { type: DataTypes.ENUM("on_field", "harvested", "reserved", "sold"), allowNull: false, defaultValue: "harvested" },
    unit: { type: DataTypes.STRING(50), allowNull: false },
    totalQuantity: { type: DataTypes.DECIMAL(18, 3), allowNull: false },
    reservedQuantity: { type: DataTypes.DECIMAL(18, 3), allowNull: false, defaultValue: 0 },
    price: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    areaHectare: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
    yieldEstimatePerHectare: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    modelName: "InventoryLot",
    tableName: "inventory_lots",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["farmer_id"] },
      { fields: ["product_id"] },
      { fields: ["status"] },
      { fields: ["quality_grade"] }
    ]
  }
);

module.exports = InventoryLot;

