const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");

const L1_CATEGORY_IDS = [
  "import-export",
  "intl-logistics",
  "customs-clearance",
  "intl-finance",
  "inspection-standards",
  "insurance-risk",
  "legal-trade",
  "market-development",
  "packaging-prep",
  "specialized-trade",
];

class TradeServiceProvider extends Model {}

TradeServiceProvider.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    entityType: {
      type: DataTypes.ENUM("company", "individual"),
      allowNull: false,
      defaultValue: "company",
    },
    displayName: { type: DataTypes.STRING, allowNull: false },
    logoUrl: { type: DataTypes.STRING(512), allowNull: true },
    contactName: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    categoryId: { type: DataTypes.STRING(64), allowNull: false },
    subcategoryIds: { type: DataTypes.JSON, allowNull: true },
    selectedServices: { type: DataTypes.JSON, allowNull: true },
    countriesRoutes: { type: DataTypes.TEXT, allowNull: true },
    servicesOffered: { type: DataTypes.TEXT, allowNull: true },
    licenses: { type: DataTypes.TEXT, allowNull: true },
    experienceYears: { type: DataTypes.INTEGER, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    adminNotes: { type: DataTypes.TEXT, allowNull: true },
    pendingChanges: { type: DataTypes.JSON, allowNull: true },
    documentUrls: { type: DataTypes.JSON, allowNull: true },
    rating: { type: DataTypes.DECIMAL(3, 2), allowNull: true, defaultValue: null },
    reviewCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    profileSlug: { type: DataTypes.STRING(120), allowNull: true, unique: true },
    isPublic: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    /**
     * ACTIVE | INACTIVE | SUSPENDED | CLOSED | PENDING_DELETION | ARCHIVED
     */
    pageStatus: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "ACTIVE",
    },
    deletionRequestedAt: { type: DataTypes.DATE, allowNull: true },
    businessHours: { type: DataTypes.JSON, allowNull: true },
    latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    addressLabel: { type: DataTypes.STRING(300), allowNull: true },
  },
  {
    sequelize,
    modelName: "TradeServiceProvider",
    tableName: "trade_service_providers",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["category_id"] },
      { fields: ["status"] },
      { fields: ["user_id"] },
      { fields: ["profile_slug"] },
      { fields: ["is_public"] },
    ],
  }
);

module.exports = TradeServiceProvider;
module.exports.L1_CATEGORY_IDS = L1_CATEGORY_IDS;
