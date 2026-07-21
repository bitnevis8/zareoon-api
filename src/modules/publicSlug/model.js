const { Model, DataTypes } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

class SlugChangeRequest extends Model {}

SlugChangeRequest.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    accountId: { type: DataTypes.INTEGER, allowNull: true },
    fromSlug: { type: DataTypes.STRING(120), allowNull: false },
    toSlug: { type: DataTypes.STRING(120), allowNull: false },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    scheduledAt: { type: DataTypes.DATE, allowNull: false },
    cancelledAt: { type: DataTypes.DATE, allowNull: true },
    appliedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "SlugChangeRequest",
    tableName: "slug_change_requests",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["status"] },
      { fields: ["to_slug"] },
      { fields: ["from_slug"] },
    ],
  }
);

class SlugAlias extends Model {}

SlugAlias.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    fromSlug: { type: DataTypes.STRING(120), allowNull: false },
    toSlug: { type: DataTypes.STRING(120), allowNull: false },
    /** active | freed */
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active",
    },
    lockedByAdmin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    freedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "SlugAlias",
    tableName: "slug_aliases",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["from_slug"] },
      { fields: ["to_slug"] },
      { fields: ["status"] },
      { fields: ["user_id"] },
    ],
  }
);

module.exports = { SlugChangeRequest, SlugAlias };
