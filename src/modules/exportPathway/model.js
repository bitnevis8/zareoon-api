const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");
const {
  PROJECT_STATUSES,
  STEP_STATUSES,
  TRANSPORT_MODES,
  INCOTERMS,
  PAYMENT_METHODS,
  CUSTOMER_TYPES,
  EXPORT_FAMILIES,
} = require("./constants");

class ExportProject extends Model {}

ExportProject.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    referenceCode: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    workspaceId: { type: DataTypes.INTEGER, allowNull: false },
    ownerUserId: { type: DataTypes.INTEGER, allowNull: false },
    createdByUserId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    status: {
      type: DataTypes.ENUM(...PROJECT_STATUSES),
      allowNull: false,
      defaultValue: "active",
    },
    exportFamily: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "general",
      validate: { isIn: [EXPORT_FAMILIES] },
    },
    templateVersion: { type: DataTypes.STRING(32), allowNull: false },
    inventoryLotId: { type: DataTypes.INTEGER, allowNull: true },
    productId: { type: DataTypes.INTEGER, allowNull: true },
    /** Snapshot: name, unit, tradeCompliance, rootCategoryId, ... */
    productSnapshot: { type: DataTypes.JSON, allowNull: true },
    originCountry: { type: DataTypes.STRING(8), allowNull: false, defaultValue: "IR" },
    originCity: { type: DataTypes.STRING(120), allowNull: true },
    destinationCountry: { type: DataTypes.STRING(8), allowNull: true },
    destinationCity: { type: DataTypes.STRING(120), allowNull: true },
    quantity: { type: DataTypes.DECIMAL(18, 3), allowNull: true },
    unit: { type: DataTypes.STRING(50), allowNull: true },
    estimatedValue: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "USD" },
    customerType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "unknown",
      validate: { isIn: [CUSTOMER_TYPES] },
    },
    packagingType: { type: DataTypes.STRING(80), allowNull: true },
    transportMode: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "unspecified",
      validate: { isIn: [TRANSPORT_MODES] },
    },
    incoterm: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "unspecified",
      validate: { isIn: [INCOTERMS] },
    },
    paymentMethod: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "unspecified",
      validate: { isIn: [PAYMENT_METHODS] },
    },
    plannedShipDate: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    flags: { type: DataTypes.JSON, allowNull: true },
    matchedRuleIds: { type: DataTypes.JSON, allowNull: true },
    pathwaySnapshot: { type: DataTypes.JSON, allowNull: true },
    progressPercent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalCostRecorded: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
    completedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "ExportProject",
    tableName: "export_projects",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["workspace_id"] },
      { fields: ["owner_user_id"] },
      { fields: ["status"] },
      { fields: ["inventory_lot_id"] },
      { fields: ["product_id"] },
      { fields: ["reference_code"], unique: true },
    ],
  }
);

class ExportStepInstance extends Model {}

ExportStepInstance.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    projectId: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING(64), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    phase: { type: DataTypes.STRING(32), allowNull: false },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: {
      type: DataTypes.ENUM(...STEP_STATUSES),
      allowNull: false,
      defaultValue: "locked",
    },
    dependencies: { type: DataTypes.JSON, allowNull: true },
    documents: { type: DataTypes.JSON, allowNull: true },
    warnings: { type: DataTypes.JSON, allowNull: true },
    serviceLinks: { type: DataTypes.JSON, allowNull: true },
    toolLinks: { type: DataTypes.JSON, allowNull: true },
    helpContent: { type: DataTypes.TEXT, allowNull: true },
    responsibleParty: { type: DataTypes.STRING(32), allowNull: true },
    estimatedDuration: { type: DataTypes.STRING(64), allowNull: true },
    requiredOutput: { type: DataTypes.STRING(80), allowNull: true },
    templateSnapshot: { type: DataTypes.JSON, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    costAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    costCurrency: { type: DataTypes.STRING(10), allowNull: true },
    providerId: { type: DataTypes.INTEGER, allowNull: true },
    providerName: { type: DataTypes.STRING(200), allowNull: true },
    toolOutputs: { type: DataTypes.JSON, allowNull: true },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "ExportStepInstance",
    tableName: "export_step_instances",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["project_id"] },
      { fields: ["status"] },
      { unique: true, fields: ["project_id", "code"], name: "uniq_export_step_project_code" },
    ],
  }
);

class ExportDocument extends Model {}

ExportDocument.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    projectId: { type: DataTypes.INTEGER, allowNull: false },
    stepInstanceId: { type: DataTypes.INTEGER, allowNull: true },
    workspaceId: { type: DataTypes.INTEGER, allowNull: false },
    uploadedByUserId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    docType: { type: DataTypes.STRING(80), allowNull: true },
    fileUrl: { type: DataTypes.STRING(500), allowNull: true },
    fileUploadId: { type: DataTypes.INTEGER, allowNull: true },
    status: {
      type: DataTypes.ENUM("pending", "uploaded", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "ExportDocument",
    tableName: "export_documents",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["project_id"] }, { fields: ["step_instance_id"] }],
  }
);

class ExportServiceRequest extends Model {}

ExportServiceRequest.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    projectId: { type: DataTypes.INTEGER, allowNull: false },
    stepInstanceId: { type: DataTypes.INTEGER, allowNull: true },
    workspaceId: { type: DataTypes.INTEGER, allowNull: false },
    requestedByUserId: { type: DataTypes.INTEGER, allowNull: false },
    serviceKey: { type: DataTypes.STRING(80), allowNull: true },
    categoryId: { type: DataTypes.STRING(80), allowNull: true },
    subcategoryId: { type: DataTypes.STRING(80), allowNull: true },
    providerId: { type: DataTypes.INTEGER, allowNull: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM("draft", "sent", "quoted", "accepted", "rejected", "cancelled"),
      allowNull: false,
      defaultValue: "sent",
    },
    quoteAmount: { type: DataTypes.DECIMAL(18, 2), allowNull: true },
    quoteCurrency: { type: DataTypes.STRING(10), allowNull: true },
    meta: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "ExportServiceRequest",
    tableName: "export_service_requests",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["project_id"] }, { fields: ["workspace_id"] }, { fields: ["status"] }],
  }
);

class ExportProgressLog extends Model {}

ExportProgressLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    projectId: { type: DataTypes.INTEGER, allowNull: false },
    stepInstanceId: { type: DataTypes.INTEGER, allowNull: true },
    workspaceId: { type: DataTypes.INTEGER, allowNull: false },
    actorUserId: { type: DataTypes.INTEGER, allowNull: true },
    action: { type: DataTypes.STRING(80), allowNull: false },
    fromStatus: { type: DataTypes.STRING(40), allowNull: true },
    toStatus: { type: DataTypes.STRING(40), allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: true },
    meta: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "ExportProgressLog",
    tableName: "export_progress_logs",
    timestamps: true,
    underscored: true,
    updatedAt: false,
    indexes: [{ fields: ["project_id"] }, { fields: ["created_at"] }],
  }
);

module.exports = {
  ExportProject,
  ExportStepInstance,
  ExportDocument,
  ExportServiceRequest,
  ExportProgressLog,
};
