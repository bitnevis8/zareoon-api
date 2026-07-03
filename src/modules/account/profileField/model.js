const { Model, DataTypes } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class AccountProfileField extends Model {}

AccountProfileField.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    accountId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "accounts", key: "id" },
    },
    fieldKey: { type: DataTypes.STRING(80), allowNull: false },
    fieldValue: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "AccountProfileField",
    tableName: "account_profile_fields",
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ["account_id", "field_key"] }],
  }
);

module.exports = AccountProfileField;
