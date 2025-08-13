const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");
const Order = require("../order/model");
const InventoryLot = require("../inventoryLot/model");

class OrderItem extends Model {}

OrderItem.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    inventoryLotId: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(18, 3), allowNull: false },
    // Supplier processing status for this allocation (per inventory lot)
    status: {
      type: DataTypes.ENUM(
        "assigned",
        "reviewing",
        "preparing",
        "ready",
        "shipped",
        "delivered",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "assigned",
    },
    statusNotes: { type: DataTypes.STRING(1000), allowNull: true }
  },
  {
    sequelize,
    modelName: "OrderItem",
    tableName: "order_items",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["order_id"] },
      { fields: ["inventory_lot_id"] }
    ]
  }
);

module.exports = OrderItem;

