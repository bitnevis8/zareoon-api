const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");
const { WORKSPACE_ROLES } = require("./constants");

class Workspace extends Model {}
class WorkspaceMember extends Model {}
class WorkspaceSubscription extends Model {}
class UserPersonVerification extends Model {}
class WorkspaceBusinessVerification extends Model {}
class WorkspaceRepresentation extends Model {}

const VERIFY_ENUM = ["none", "pending", "verified", "rejected"];

Workspace.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(160), allowNull: false },
    displayName: { type: DataTypes.STRING(160), allowNull: true },
    profileSlug: { type: DataTypes.STRING(120), allowNull: true, unique: true },
    entityType: {
      type: DataTypes.ENUM("individual", "company", "trader", "manufacturer", "distributor"),
      allowNull: false,
      defaultValue: "individual",
    },
    activityBuyer: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    activitySeller: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    activityServices: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isPublic: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    /** آدرس متنی کسب‌وکار */
    addressText: { type: DataTypes.TEXT, allowNull: true },
    addressLabel: { type: DataTypes.STRING(300), allowNull: true },
    latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    businessHours: { type: DataTypes.JSON, allowNull: true },
    createdByUserId: { type: DataTypes.INTEGER, allowNull: false },
    accountId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
  },
  {
    sequelize,
    modelName: "Workspace",
    tableName: "workspaces",
    timestamps: true,
    underscored: true,
  }
);

WorkspaceMember.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workspaceId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    role: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: WORKSPACE_ROLES.VIEWER,
    },
    status: {
      type: DataTypes.ENUM("active", "invited", "suspended", "left"),
      allowNull: false,
      defaultValue: "active",
    },
    invitedByUserId: { type: DataTypes.INTEGER, allowNull: true },
    joinedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "WorkspaceMember",
    tableName: "workspace_members",
    timestamps: true,
    underscored: true,
  }
);

WorkspaceSubscription.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workspaceId: { type: DataTypes.INTEGER, allowNull: false },
    planId: { type: DataTypes.STRING(32), allowNull: false },
    billingPeriod: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "none" },
    status: {
      type: DataTypes.ENUM("pending", "active", "expired", "canceled", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    amountToman: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    authority: { type: DataTypes.STRING(64), allowNull: true },
    refId: { type: DataTypes.STRING(64), allowNull: true },
    gateway: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "zibal" },
    startsAt: { type: DataTypes.DATE, allowNull: true },
    endsAt: { type: DataTypes.DATE, allowNull: true },
    meta: { type: DataTypes.JSON, allowNull: true },
    legacyUserSubscriptionId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: "WorkspaceSubscription",
    tableName: "workspace_subscriptions",
    timestamps: true,
    underscored: true,
  }
);

UserPersonVerification.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    mobileStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    emailStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    nationalIdStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    identityReviewStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    overallStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    meta: { type: DataTypes.JSON, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    reviewedByUserId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: "UserPersonVerification",
    tableName: "user_person_verifications",
    timestamps: true,
    underscored: true,
  }
);

WorkspaceBusinessVerification.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workspaceId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    nationalIdStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    registrationStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    licenseStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    addressStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    bankAccountStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    overallStatus: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    nationalId: { type: DataTypes.STRING(20), allowNull: true },
    registrationNumber: { type: DataTypes.STRING(80), allowNull: true },
    licenseInfo: { type: DataTypes.TEXT, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    bankAccountIban: { type: DataTypes.STRING(34), allowNull: true },
    meta: { type: DataTypes.JSON, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    reviewedByUserId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: "WorkspaceBusinessVerification",
    tableName: "workspace_business_verifications",
    timestamps: true,
    underscored: true,
  }
);

WorkspaceRepresentation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    workspaceId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM(...VERIFY_ENUM), allowNull: false, defaultValue: "none" },
    title: { type: DataTypes.STRING(120), allowNull: true },
    meta: { type: DataTypes.JSON, allowNull: true },
    reviewedAt: { type: DataTypes.DATE, allowNull: true },
    reviewedByUserId: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: "WorkspaceRepresentation",
    tableName: "workspace_representations",
    timestamps: true,
    underscored: true,
  }
);

module.exports = {
  Workspace,
  WorkspaceMember,
  WorkspaceSubscription,
  UserPersonVerification,
  WorkspaceBusinessVerification,
  WorkspaceRepresentation,
};
