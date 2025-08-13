const User = require("./user/model");
const Role = require("./role/model");
const UserRole = require("./userRole/model");
const { DataTypes } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

// Many-to-Many association between User and Role
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: 'userId',
  as: 'userRoles',
});
Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: 'roleId',
  as: 'users',
});

module.exports = {
  User,
  Role,
  UserRole
}; 