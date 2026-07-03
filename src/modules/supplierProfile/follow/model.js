const { Model, DataTypes } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class SupplierFollow extends Model {}

SupplierFollow.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    followerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    followingId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
  },
  {
    sequelize,
    modelName: "SupplierFollow",
    tableName: "supplier_follows",
    timestamps: true,
    updatedAt: false,
    underscored: true,
  }
);

module.exports = SupplierFollow;
