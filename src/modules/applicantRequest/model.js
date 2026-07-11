const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

const REQUEST_TYPES = ["product", "service"];
const REQUEST_STATUSES = ["open", "closed", "fulfilled", "cancelled"];

class ApplicantRequest extends Model {}

ApplicantRequest.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    requestType: {
      type: DataTypes.ENUM(...REQUEST_TYPES),
      allowNull: false,
    },
    productCategoryId: { type: DataTypes.INTEGER, allowNull: true },
    serviceCategoryId: { type: DataTypes.STRING(64), allowNull: true },
    serviceSubcategoryId: { type: DataTypes.STRING(64), allowNull: true },
    categoryLabel: { type: DataTypes.STRING(255), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    quantity: { type: DataTypes.DECIMAL(18, 3), allowNull: true },
    unit: { type: DataTypes.STRING(50), allowNull: true },
    phone: { type: DataTypes.STRING(32), allowNull: false },
    allowPhoneContact: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    company: { type: DataTypes.STRING(255), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    details: { type: DataTypes.JSON, allowNull: true },
    status: {
      type: DataTypes.ENUM(...REQUEST_STATUSES),
      allowNull: false,
      defaultValue: "open",
    },
  },
  {
    sequelize,
    modelName: "ApplicantRequest",
    tableName: "applicant_requests",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["user_id"] },
      { fields: ["request_type"] },
      { fields: ["product_category_id"] },
      { fields: ["service_category_id"] },
      { fields: ["status"] },
    ],
  }
);

class ApplicantRequestNotification extends Model {}

ApplicantRequestNotification.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    requestId: { type: DataTypes.INTEGER, allowNull: false },
    recipientUserId: { type: DataTypes.INTEGER, allowNull: false },
    readAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "ApplicantRequestNotification",
    tableName: "applicant_request_notifications",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["recipient_user_id"] },
      { fields: ["request_id"] },
      { fields: ["read_at"] },
      { unique: true, fields: ["request_id", "recipient_user_id"] },
    ],
  }
);

module.exports = {
  ApplicantRequest,
  ApplicantRequestNotification,
  REQUEST_TYPES,
  REQUEST_STATUSES,
};
