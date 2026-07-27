const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");
const { THEME_IDS } = require("./themesCatalog");

class ProductLandingPage extends Model {}

ProductLandingPage.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workspaceId: { type: DataTypes.INTEGER, allowNull: false },
    ownerUserId: { type: DataTypes.INTEGER, allowNull: false },
    inventoryLotId: { type: DataTypes.INTEGER, allowNull: true },
    productId: { type: DataTypes.INTEGER, allowNull: true },
    /** قالب مبدأ (Recipe) — اختیاری */
    templateId: { type: DataTypes.INTEGER, allowNull: true },
    slug: { type: DataTypes.STRING(80), allowNull: false },
    themeId: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "atelier",
    },
    status: {
      type: DataTypes.ENUM("draft", "published", "archived"),
      allowNull: false,
      defaultValue: "draft",
    },
    /**
     * v2: { version:2, templateId, themeId, blocks:[{id,type,variant,hidden,props,responsive}], meta }
     * v1 قدیمی هنگام خواندن مهاجرت می‌شود
     */
    content: { type: DataTypes.JSON, allowNull: true },
    publishedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "ProductLandingPage",
    tableName: "product_landing_pages",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["workspace_id"] },
      { fields: ["inventory_lot_id"] },
      { fields: ["template_id"] },
      { fields: ["status"] },
      { unique: true, fields: ["workspace_id", "slug"], name: "uniq_landing_ws_slug" },
    ],
  }
);

ProductLandingPage.THEME_IDS = THEME_IDS;

module.exports = ProductLandingPage;
