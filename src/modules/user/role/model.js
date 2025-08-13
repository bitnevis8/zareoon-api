const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class Role extends Model {}
Role.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    nameEn: { type: DataTypes.STRING, allowNull: true, unique: false },
    nameFa: { type: DataTypes.STRING, allowNull: true, unique: false },
  },
  {
    sequelize,
    modelName: "Role",
    tableName: "roles",
    timestamps: true,
    underscored: true
  }
);

module.exports = Role; 