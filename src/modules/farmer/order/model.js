const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");
const User = require("../../user/user/model");

class Order extends Model {}

Order.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customerId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM("pending", "reserved", "completed", "cancelled"), allowNull: false, defaultValue: "pending" },
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

module.exports = Order;

