const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");
const User = require("../../user/user/model");
const Product = require("../product/model");

class InventoryLot extends Model {}

InventoryLot.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    farmerId: { type: DataTypes.INTEGER, allowNull: false },
    workspaceId: { type: DataTypes.INTEGER, allowNull: true },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    englishName: { type: DataTypes.STRING(200), allowNull: true },
    arabicName: { type: DataTypes.STRING(200), allowNull: true },
    russianName: { type: DataTypes.STRING(200), allowNull: true },
    displayContent: { type: DataTypes.JSON, allowNull: true },
    qualityGrade: { type: DataTypes.STRING(50), allowNull: false },
    status: { type: DataTypes.ENUM("on_field", "harvested", "reserved", "sold"), allowNull: false, defaultValue: "harvested" },
    unit: { type: DataTypes.STRING(50), allowNull: false },
    packagingType: { type: DataTypes.STRING(50), allowNull: true },
    filterValues: { type: DataTypes.JSON, allowNull: true },
    hsCode: { type: DataTypes.STRING(32), allowNull: true },
    totalQuantity: { type: DataTypes.DECIMAL(18, 3), allowNull: false },
    reservedQuantity: { type: DataTypes.DECIMAL(18, 3), allowNull: false, defaultValue: 0 },
    price: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    priceCurrency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "TOMAN" },
    // Tiered pricing for different order quantities
    tieredPricing: { type: DataTypes.JSON, allowNull: true },
    // Minimum order quantity for this lot
    minimumOrderQuantity: { type: DataTypes.DECIMAL(18, 3), allowNull: true },
    areaHectare: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
    yieldEstimatePerHectare: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    hashtags: { type: DataTypes.JSON, allowNull: true },
    locationLabel: { type: DataTypes.STRING(200), allowNull: true },
    latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
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
      { fields: ["workspace_id"] },
      { fields: ["product_id"] },
      { fields: ["status"] },
      { fields: ["quality_grade"] },
      { name: "idx_lots_farmer_status_updated", fields: ["farmer_id", "status", "updated_at"] },
      { name: "idx_lots_status_updated", fields: ["status", "updated_at"] },
      { name: "idx_lots_status_product", fields: ["status", "product_id"] },
      { name: "idx_lots_product_status", fields: ["product_id", "status"] },
    ]
  }
);

module.exports = InventoryLot;

