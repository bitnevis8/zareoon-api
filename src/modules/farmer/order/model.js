const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");
const User = require("../../user/user/model");

class Order extends Model {}

Order.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customerId: { type: DataTypes.INTEGER, allowNull: false },
    status: { 
      type: DataTypes.ENUM("pending", "reserved", "approved", "assigned", "preparing", "ready", "shipped", "delivered", "completed", "cancelled"), 
      allowNull: false, 
      defaultValue: "pending" 
    },
    supplierId: { type: DataTypes.INTEGER, allowNull: true },
    adminNotes: { type: DataTypes.TEXT, allowNull: true },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
    approvedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: "Order",
    tableName: "orders",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["customer_id"] },
      { fields: ["status"] }
    ]
  }
);

// Associations are defined in associations.js to avoid conflicts

module.exports = Order;

