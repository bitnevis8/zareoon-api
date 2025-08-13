const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class CustomAttributeDefinition extends Model {}

CustomAttributeDefinition.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    categoryId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    type: { type: DataTypes.ENUM("text", "number", "boolean", "date", "select"), allowNull: false, defaultValue: "text" },
    options: { type: DataTypes.JSON, allowNull: true }
  },
  {
    sequelize,
    modelName: "CustomAttributeDefinition",
    tableName: "custom_attribute_definitions",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["category_id"] },
      { unique: false, fields: ["name"] }
    ]
  }
);

module.exports = CustomAttributeDefinition;

