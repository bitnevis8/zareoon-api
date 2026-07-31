const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class InventoryLotDailyPrice extends Model {}

InventoryLotDailyPrice.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    inventoryLotId: { type: DataTypes.INTEGER, allowNull: false },
    /** تاریخ میلادی روز (YYYY-MM-DD) — در UI شمسی انتخاب می‌شود */
    priceDate: { type: DataTypes.DATEONLY, allowNull: false },
    price: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
  },
  {
    sequelize,
    modelName: "InventoryLotDailyPrice",
    tableName: "inventory_lot_daily_prices",
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ["inventory_lot_id", "price_date"], name: "uq_lot_daily_price_date" },
      { fields: ["price_date"], name: "idx_lot_daily_price_date" },
    ],
  }
);

module.exports = InventoryLotDailyPrice;
