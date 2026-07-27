const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

/**
 * قالب لندینگ = فقط Recipe (ترتیب بلوک‌ها)
 * isSystem: قالب پیش‌فرض سایت (مدیر می‌سازد)
 * workspaceId: قالب سفارشی کاربر (ذخیرهٔ شخصی)
 */
class LandingTemplate extends Model {}

LandingTemplate.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    slug: { type: DataTypes.STRING(80), allowNull: false },
    nameFa: { type: DataTypes.STRING(160), allowNull: false },
    nameEn: { type: DataTypes.STRING(160), allowNull: true },
    category: { type: DataTypes.STRING(60), allowNull: true },
    descriptionFa: { type: DataTypes.STRING(500), allowNull: true },
    themeIdDefault: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "atelier" },
    /** { blocks: [{ type, variant, props, responsive, hidden }] } */
    recipe: { type: DataTypes.JSON, allowNull: false, defaultValue: { blocks: [] } },
    thumbnailUrl: { type: DataTypes.STRING(500), allowNull: true },
    isSystem: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
    workspaceId: { type: DataTypes.INTEGER, allowNull: true },
    createdByUserId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: "LandingTemplate",
    tableName: "landing_templates",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["slug"] },
      { fields: ["is_system", "is_published"] },
      { fields: ["workspace_id"] },
      { fields: ["category"] },
      { unique: true, fields: ["slug", "workspace_id"], name: "uniq_landing_tpl_slug_ws" },
    ],
  }
);

module.exports = LandingTemplate;
