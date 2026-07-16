const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class Product extends Model {}

Product.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // Deprecated: kept for backward compatibility; prefer parentId
    categoryId: { type: DataTypes.INTEGER, allowNull: true },
    parentId: { type: DataTypes.INTEGER, allowNull: true },

    // Flat display names (kept for existing UI; sourced from translations.*)
    name: { type: DataTypes.STRING(200), allowNull: false },
    englishName: { type: DataTypes.STRING(200), allowNull: true },
    arabicName: { type: DataTypes.STRING(200), allowNull: true },
    russianName: { type: DataTypes.STRING(200), allowNull: true },
    turkishName: { type: DataTypes.STRING(200), allowNull: true },
    finnishName: { type: DataTypes.STRING(200), allowNull: true },
    urduName: { type: DataTypes.STRING(200), allowNull: true },

    slug: { type: DataTypes.STRING(200), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    imageUrl: { type: DataTypes.STRING(500), allowNull: true },
    imageStatus: { type: DataTypes.STRING(32), allowNull: true },
    icon: { type: DataTypes.STRING(500), allowNull: true },

    unit: { type: DataTypes.STRING(50), allowNull: true },
    isOrderable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: true },
    homepageSortOrder: { type: DataTypes.INTEGER, allowNull: true },
    isFeatured: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    metaTitle: { type: DataTypes.STRING(255), allowNull: true },
    metaDescription: { type: DataTypes.TEXT, allowNull: true },
    validUnits: { type: DataTypes.JSON, allowNull: true },
    supplyCountry: { type: DataTypes.STRING(2), allowNull: false, defaultValue: "IR" },
    supplyCity: { type: DataTypes.STRING(120), allowNull: true },

    // Catalog schema from seederData5
    level: { type: DataTypes.INTEGER, allowNull: true },
    isLeaf: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    path: { type: DataTypes.JSON, allowNull: true },
    status: { type: DataTypes.STRING(32), allowNull: true, defaultValue: "active" },
    attributeSetId: { type: DataTypes.STRING(120), allowNull: true },
    filters: { type: DataTypes.JSON, allowNull: true },
    defaultMeasurementUnit: { type: DataTypes.STRING(50), allowNull: true },
    allowedMeasurementUnits: { type: DataTypes.JSON, allowNull: true },
    allowedPackagingTypes: { type: DataTypes.JSON, allowNull: true },
    listingPolicy: { type: DataTypes.STRING(64), allowNull: true },
    tradeCompliance: { type: DataTypes.JSON, allowNull: true },
    seo: { type: DataTypes.JSON, allowNull: true },
    translations: { type: DataTypes.JSON, allowNull: true },
    translationStatus: { type: DataTypes.JSON, allowNull: true },
    translationReview: { type: DataTypes.JSON, allowNull: true },
    unitSchemaVersion: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: "Product",
    tableName: "products",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["category_id"] },
      { fields: ["parent_id"] },
      { fields: ["is_orderable"] },
      { fields: ["is_leaf"] },
      { fields: ["level"] },
      { fields: ["name"] },
      { fields: ["slug"] },
      { fields: ["status"] },
    ],
  }
);

module.exports = Product;
