const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

class SiteSetting extends Model {}

SiteSetting.init(
  {
    key: { type: DataTypes.STRING(64), primaryKey: true },
    value: { type: DataTypes.JSON, allowNull: false },
  },
  {
    sequelize,
    modelName: "SiteSetting",
    tableName: "site_settings",
    timestamps: true,
    underscored: true,
  }
);

module.exports = SiteSetting;
