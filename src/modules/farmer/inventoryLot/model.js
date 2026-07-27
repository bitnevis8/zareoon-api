const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");
const User = require("../../user/user/model");
const Product = require("../product/model");

class InventoryLot extends Model {}

InventoryLot.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    farmerId: { type: DataTypes.INTEGER, allowNull: false },
    workspaceId: { type: DataTypes.INTEGER, allowNull: true },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    englishName: { type: DataTypes.STRING(200), allowNull: true },
    arabicName: { type: DataTypes.STRING(200), allowNull: true },
    russianName: { type: DataTypes.STRING(200), allowNull: true },
    displayContent: { type: DataTypes.JSON, allowNull: true },
    qualityGrade: { type: DataTypes.STRING(50), allowNull: false },
    status: { type: DataTypes.ENUM("on_field", "harvested", "reserved", "sold"), allowNull: false, defaultValue: "harvested" },
    unit: { type: DataTypes.STRING(50), allowNull: false },
    packagingType: { type: DataTypes.STRING(50), allowNull: true },
    filterValues: { type: DataTypes.JSON, allowNull: true },
    hsCode: { type: DataTypes.STRING(32), allowNull: true },
    totalQuantity: { type: DataTypes.DECIMAL(18, 3), allowNull: false },
    reservedQuantity: { type: DataTypes.DECIMAL(18, 3), allowNull: false, defaultValue: 0 },
    price: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    priceCurrency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "TOMAN" },
    // Tiered pricing for different order quantities
    tieredPricing: { type: DataTypes.JSON, allowNull: true },
    // Minimum order quantity for this lot
    minimumOrderQuantity: { type: DataTypes.DECIMAL(18, 3), allowNull: true },
    /** فروش نقدی (قیمت) فعال باشد — حتی بدون قیمت می‌توان فقط معاوضه کرد */
    acceptCash: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    /** آمادگی معاوضه (کالا به کالا یا کالا به خدمات) */
    acceptBarter: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    /** product = کالا به کالا | service = کالا به خدمات */
    barterDesiredKind: {
      type: DataTypes.ENUM("product", "service"),
      allowNull: false,
      defaultValue: "product",
    },
    /** دسته کالای مورد نظر برای معاوضه (اختیاری در حالت بی‌صدا) */
    barterDesiredCategoryId: { type: DataTypes.INTEGER, allowNull: true },
    barterDesiredCategoryLabel: { type: DataTypes.STRING(255), allowNull: true },
    /** دسته/زیردسته خدمات مورد نظر (برای کالا به خدمات) */
    barterDesiredServiceCategoryId: { type: DataTypes.STRING(64), allowNull: true },
    barterDesiredServiceSubcategoryId: { type: DataTypes.STRING(64), allowNull: true },
    /** نام آزاد کالا یا خدمت مورد نظر */
    barterDesiredName: { type: DataTypes.STRING(255), allowNull: true },
    barterDesiredQuantity: { type: DataTypes.DECIMAL(18, 3), allowNull: true },
    barterDesiredUnit: { type: DataTypes.STRING(50), allowNull: true },
    /** silent = فقط روی آگهی | announce = اطلاع به فروشندگان/ارائه‌دهندگان آن دسته */
    barterAnnounceMode: {
      type: DataTypes.ENUM("silent", "announce"),
      allowNull: false,
      defaultValue: "silent",
    },
    barterNotes: { type: DataTypes.TEXT, allowNull: true },
    barterAnnouncedAt: { type: DataTypes.DATE, allowNull: true },
    areaHectare: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
    yieldEstimatePerHectare: { type: DataTypes.DECIMAL(10, 3), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    hashtags: { type: DataTypes.JSON, allowNull: true },
    locationLabel: { type: DataTypes.STRING(200), allowNull: true },
    latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    modelName: "InventoryLot",
    tableName: "inventory_lots",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["farmer_id"] },
      { fields: ["workspace_id"] },
      { fields: ["product_id"] },
      { fields: ["status"] },
      { fields: ["quality_grade"] },
      { name: "idx_lots_farmer_status_updated", fields: ["farmer_id", "status", "updated_at"] },
      { name: "idx_lots_status_updated", fields: ["status", "updated_at"] },
      { name: "idx_lots_status_product", fields: ["status", "product_id"] },
      { name: "idx_lots_product_status", fields: ["product_id", "status"] },
      { name: "idx_lots_accept_barter", fields: ["accept_barter", "status"] },
      { name: "idx_lots_barter_category", fields: ["barter_desired_category_id"] },
      { name: "idx_lots_barter_kind", fields: ["barter_desired_kind", "accept_barter"] },
      { name: "idx_lots_barter_service_cat", fields: ["barter_desired_service_category_id"] },
    ]
  }
);

module.exports = InventoryLot;

