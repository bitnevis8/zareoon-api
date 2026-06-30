const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

class LcRequest extends Model {}

LcRequest.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    fullName: { type: DataTypes.STRING, allowNull: false },
    company: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    tradeType: {
      type: DataTypes.ENUM("import", "export", "both"),
      allowNull: false,
      defaultValue: "import",
    },
    productDescription: { type: DataTypes.TEXT, allowNull: true },
    estimatedAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: "USD" },
    bankName: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM("pending", "contacted", "in_progress", "completed", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    adminNotes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "LcRequest",
    tableName: "lc_requests",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["user_id"] }, { fields: ["status"] }],
  }
);

module.exports = LcRequest;
