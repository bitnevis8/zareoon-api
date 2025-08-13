const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class Cart extends Model {}
Cart.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customerId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM("active", "checked_out", "cancelled"), allowNull: false, defaultValue: "active" },
  },
  {
    sequelize,
    modelName: "Cart",
    tableName: "carts",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["customer_id"] },
      { fields: ["status"] },
    ],
  }
);

class CartItem extends Model {}
CartItem.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cartId: { type: DataTypes.INTEGER, allowNull: false },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    qualityGrade: { type: DataTypes.STRING(50), allowNull: false },
    unit: { type: DataTypes.STRING(50), allowNull: true },
    quantity: { type: DataTypes.DECIMAL(18, 3), allowNull: false },
  },
  {
    sequelize,
    modelName: "CartItem",
    tableName: "cart_items",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["cart_id"] },
      { fields: ["product_id"] },
      { fields: ["quality_grade"] },
    ],
  }
);

module.exports = { Cart, CartItem };

