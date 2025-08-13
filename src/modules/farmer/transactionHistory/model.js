const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/database/mysql/connection");

class TransactionHistory extends Model {}

TransactionHistory.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    changeType: { type: DataTypes.ENUM("reserve", "release", "sell", "adjust"), allowNull: false },
    inventoryLotId: { type: DataTypes.INTEGER, allowNull: false },
    deltaQuantity: { type: DataTypes.DECIMAL(18, 3), allowNull: false },
    actorUserId: { type: DataTypes.INTEGER, allowNull: false }
  },
  {
    sequelize,
    modelName: "TransactionHistory",
    tableName: "transaction_history",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["inventory_lot_id"] },
      { fields: ["actor_user_id"] },
      { fields: ["change_type"] }
    ]
  }
);

module.exports = TransactionHistory;

