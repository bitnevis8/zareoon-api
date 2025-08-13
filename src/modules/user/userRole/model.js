const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class UserRole extends Model {}

UserRole.init({
  userId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
  roleId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
}, {
  sequelize,
  modelName: "UserRole",
  tableName: "user_roles", // نام جدول واسط در دیتابیس
  timestamps: false, // جداول واسط معمولا نیازی به timestamp ندارند
  underscored: true,
});

module.exports = UserRole; 