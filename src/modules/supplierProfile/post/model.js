const { Model, DataTypes } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class SupplierPost extends Model {}

SupplierPost.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    workspaceId: { type: DataTypes.INTEGER, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: false },
    imageUrl: { type: DataTypes.STRING(500), allowNull: true },
    imageUrls: { type: DataTypes.JSON, allowNull: true },
    hashtags: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "SupplierPost",
    tableName: "supplier_posts",
    timestamps: true,
    underscored: true,
  }
);

module.exports = SupplierPost;
