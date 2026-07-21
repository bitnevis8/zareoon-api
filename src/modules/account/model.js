const { Model, DataTypes } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

const ENTITY_TYPES = ["individual", "company", "trader", "manufacturer", "distributor"];

class Account extends Model {}

Account.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "users", key: "id" },
    },
    entityType: {
      type: DataTypes.ENUM(...ENTITY_TYPES),
      allowNull: false,
      defaultValue: "individual",
    },
    profileSlug: { type: DataTypes.STRING(120), allowNull: true, unique: true },
    headline: { type: DataTypes.STRING(200), allowNull: true },
    bio: { type: DataTypes.TEXT, allowNull: true },
    publicPhone: { type: DataTypes.STRING(30), allowNull: true },
    publicLandline: { type: DataTypes.STRING(30), allowNull: true },
    publicEmail: { type: DataTypes.STRING(120), allowNull: true },
    /** { phones[], emails[], messengers: { whatsapp, telegram, eitaa, rubika } } */
    shopContacts: { type: DataTypes.JSON, allowNull: true },
    coverImage: { type: DataTypes.STRING(500), allowNull: true },
    businessHours: { type: DataTypes.JSON, allowNull: true },
    country: { type: DataTypes.STRING(100), allowNull: true },
    latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    addressLabel: { type: DataTypes.STRING(300), allowNull: true },
    isPublic: { type: DataTypes.BOOLEAN, defaultValue: true },
    /** اگر true باشد کاربر می‌تواند صفحه را خصوصی کند؛ پیش‌فرض فقط ادمین می‌دهد */
    canHidePublicPage: { type: DataTypes.BOOLEAN, defaultValue: false },
    /**
     * ACTIVE | INACTIVE | SUSPENDED | CLOSED | PENDING_DELETION | ARCHIVED
     */
    shopStatus: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    deletionRequestedAt: { type: DataTypes.DATE, allowNull: true },
    /** آخرین باری که اسلاگ واقعاً عوض شده (برای محدودیت ۲۰ روزه) */
    lastSlugChangedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "Account",
    tableName: "accounts",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Account;
module.exports.ENTITY_TYPES = ENTITY_TYPES;
