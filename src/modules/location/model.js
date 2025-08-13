const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

/**
 * Location (Country Division)
 * divisionType:
 * 0: Country
 * 1: Province (استان)
 * 2: County (شهرستان)
 * 3: District (بخش)
 * 4: Rural District (دهستان)
 * 5: City (شهر)
 * 6: Village (آبادی)
 */
class Location extends Model {}

Location.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      comment: "شناسه یکتا برگرفته از فایل مرکز آمار"
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "locations",
        key: "id"
      },
      onDelete: "SET NULL",
      comment: "شناسه واحد بالادستی"
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      comment: "نام فارسی"
    },
    displayName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: "نام نمایشی شامل نوع تقسیمات کشوری"
    },
    displayNameFull: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "نام نمایشی کامل شامل تمام سلسله مراتب"
    },
    displayNameFull2: {
      type: DataTypes.STRING(300),
      allowNull: true,
      comment: "نام نمایشی شامل خود و والد"
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "کد محل طبق فایل مرکز آمار"
    },
    divisionType: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: { min: 0, max: 6 },
      comment: "نوع تقسیمات کشوری (0-6)"
    },
    divisionTypeName: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "نام نوع تقسیمات کشوری"
    },
    slug: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "نامک URL"
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true
    },
    population: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    area: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    extra: {
      type: DataTypes.JSON,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    sequelize,
    modelName: "Location",
    tableName: "locations",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["division_type"] },
      { fields: ["parent_id"] },
      { fields: ["code"] },
      { fields: ["slug"] }
    ]
  }
);

module.exports = Location; 