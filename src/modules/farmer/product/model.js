const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class Product extends Model {}

Product.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    // Deprecated: kept temporarily for backward compatibility with existing UI; prefer parentId
    categoryId: { type: DataTypes.INTEGER, allowNull: true },
    // Hierarchical self-reference to build category tree within products
    parentId: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    englishName: { type: DataTypes.STRING(200), allowNull: true },
    slug: { type: DataTypes.STRING(200), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    imageUrl: { type: DataTypes.STRING(500), allowNull: true },
    unit: { type: DataTypes.STRING(50), allowNull: true }, // default unit (for orderable items)
    // If false => behaves like a category (non-orderable node). If true => actual product that can be ordered
    isOrderable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    // Optional catalog flags and metadata
    isActive: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
    sortOrder: { type: DataTypes.INTEGER, allowNull: true },
    isFeatured: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
    icon: { type: DataTypes.STRING(500), allowNull: true },
    metaTitle: { type: DataTypes.STRING(255), allowNull: true },
    metaDescription: { type: DataTypes.TEXT, allowNull: true },
    // Valid units applicable to children or this item (mainly for non-orderable/category-like nodes)
    validUnits: { type: DataTypes.JSON, allowNull: true }
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
      { fields: ["name"] },
      { fields: ["slug"] }
    ]
  }
);

module.exports = Product;

