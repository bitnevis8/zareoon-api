const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

const SERVICE_TYPES = [
  "trade",
  "logistics",
  "customs",
  "finance",
  "inspection",
  "insurance",
  "consulting",
  "documents",
];

class ServiceRequest extends Model {}

ServiceRequest.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    serviceType: {
      type: DataTypes.ENUM(...SERVICE_TYPES),
      allowNull: false,
    },
    fullName: { type: DataTypes.STRING, allowNull: false },
    company: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    tradeType: {
      type: DataTypes.ENUM("import", "export", "both"),
      allowNull: true,
      defaultValue: "import",
    },
    productDescription: { type: DataTypes.TEXT, allowNull: true },
    estimatedAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: "USD" },
    notes: { type: DataTypes.TEXT, allowNull: true },
    details: { type: DataTypes.JSON, allowNull: true },
    status: {
      type: DataTypes.ENUM("pending", "contacted", "in_progress", "completed", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    adminNotes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "ServiceRequest",
    tableName: "service_requests",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["status"] },
      { fields: ["service_type"] },
    ],
  }
);

module.exports = ServiceRequest;
module.exports.SERVICE_TYPES = SERVICE_TYPES;
