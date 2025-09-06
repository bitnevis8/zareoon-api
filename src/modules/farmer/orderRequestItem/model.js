const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class OrderRequestItem extends Model {}

OrderRequestItem.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    inventoryLotId: { type: DataTypes.INTEGER, allowNull: true },
    qualityGrade: { type: DataTypes.STRING(50), allowNull: false },
    unit: { type: DataTypes.STRING(50), allowNull: true },
    quantity: { type: DataTypes.DECIMAL(18, 3), allowNull: false },
  },
  {
    sequelize,
    modelName: "OrderRequestItem",
    tableName: "order_request_items",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["order_id"] },
      { fields: ["product_id"] },
      { fields: ["inventory_lot_id"] },
      { fields: ["quality_grade"] },
    ],
  }
);

module.exports = OrderRequestItem;

