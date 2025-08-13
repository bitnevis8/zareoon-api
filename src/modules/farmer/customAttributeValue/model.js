const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");
const InventoryLot = require("../inventoryLot/model");
const CustomAttributeDefinition = require("../customAttributeDefinition/model");

class CustomAttributeValue extends Model {}

CustomAttributeValue.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    inventoryLotId: { type: DataTypes.INTEGER, allowNull: false },
    attributeDefinitionId: { type: DataTypes.INTEGER, allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: true }
  },
  {
    sequelize,
    modelName: "CustomAttributeValue",
    tableName: "custom_attribute_values",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["inventory_lot_id"] },
      { fields: ["attribute_definition_id"] }
    ]
  }
);

module.exports = CustomAttributeValue;

