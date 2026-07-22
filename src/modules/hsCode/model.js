const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

/** تعرفه گمرکی ایران — سال ۱۴۰۵ */
class HsCode extends Model {}

HsCode.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    hsCode: {
      type: DataTypes.STRING(16),
      allowNull: false,
      unique: true,
      comment: "کد تعرفه (HS Code)",
    },
    descriptionFa: {
      type: DataTypes.STRING(800),
      allowNull: false,
      comment: "شرح فارسی ردیف تعرفه",
    },
    customsDuty: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 4,
      comment: "نرخ حقوق گمرکی (درصد)",
    },
    commercialProfit: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "نرخ سود بازرگانی (درصد)",
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1405,
      comment: "سال تعرفه",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "HsCode",
    tableName: "hs_codes",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["hs_code"] },
      { fields: ["year"] },
      { fields: ["is_active"] },
    ],
  }
);

module.exports = HsCode;
