const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");
const {
  AGREEMENT_STATUSES,
  MILESTONE_STATUSES,
  PAYMENT_INTENT_STATUSES,
  LEDGER_ENTRY_TYPES,
  RELEASE_REQUEST_STATUSES,
  REFUND_STATUSES,
  DISPUTE_STATUSES,
  CURRENCIES,
} = require("./constants");

class EscrowRule extends Model {}

EscrowRule.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ruleCode: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    targetType: {
      type: DataTypes.ENUM("global", "seller_tier", "seller_user", "product_category"),
      allowNull: false,
      defaultValue: "global",
    },
    targetId: { type: DataTypes.STRING(64), allowNull: true },
    depositType: { type: DataTypes.ENUM("percent", "fixed"), allowNull: false, defaultValue: "percent" },
    depositPercent: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
    depositFixedAmount: { type: DataTypes.DECIMAL(18, 4), allowNull: true },
    minDepositAmount: { type: DataTypes.DECIMAL(18, 4), allowNull: true },
    maxDepositAmount: { type: DataTypes.DECIMAL(18, 4), allowNull: true },
    currency: { type: DataTypes.STRING(10), allowNull: true },
    platformFeePercent: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 1.5 },
    releasePolicy: { type: DataTypes.JSON, allowNull: true },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    modelName: "EscrowRule",
    tableName: "escrow_rules",
    timestamps: true,
    underscored: true,
  }
);

class EscrowAgreement extends Model {}

EscrowAgreement.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    referenceCode: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    orderId: { type: DataTypes.INTEGER, allowNull: true },
    buyerId: { type: DataTypes.INTEGER, allowNull: false },
    sellerId: { type: DataTypes.INTEGER, allowNull: false },
    createdByUserId: { type: DataTypes.INTEGER, allowNull: false },
    ruleId: { type: DataTypes.INTEGER, allowNull: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    dealTotalAmount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    depositAmount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    depositPercent: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "USD" },
    fxRate: { type: DataTypes.DECIMAL(18, 8), allowNull: true },
    fxBaseCurrency: { type: DataTypes.STRING(10), allowNull: true },
    fxQuoteCurrency: { type: DataTypes.STRING(10), allowNull: true },
    fxLockedAt: { type: DataTypes.DATE, allowNull: true },
    platformFeePercent: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 1.5 },
    platformFeeAmount: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
    lockedAmount: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
    releasedAmount: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
    refundedAmount: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
    feeCollectedAmount: { type: DataTypes.DECIMAL(18, 4), allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM(...AGREEMENT_STATUSES),
      allowNull: false,
      defaultValue: "draft",
    },
    expiresAt: { type: DataTypes.DATE, allowNull: true },
    lockedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    cancelledAt: { type: DataTypes.DATE, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "EscrowAgreement",
    tableName: "escrow_agreements",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["buyer_id"] },
      { fields: ["seller_id"] },
      { fields: ["order_id"] },
      { fields: ["status"] },
      { fields: ["reference_code"], unique: true },
    ],
  }
);

class EscrowMilestone extends Model {}

EscrowMilestone.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    agreementId: { type: DataTypes.INTEGER, allowNull: false },
    sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    percentOfDeposit: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
    status: {
      type: DataTypes.ENUM(...MILESTONE_STATUSES),
      allowNull: false,
      defaultValue: "pending",
    },
    requiresBuyerApproval: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    requiresSellerConfirmation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    requiresAdminApproval: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    buyerApprovedAt: { type: DataTypes.DATE, allowNull: true },
    sellerConfirmedAt: { type: DataTypes.DATE, allowNull: true },
    adminApprovedAt: { type: DataTypes.DATE, allowNull: true },
    releasedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "EscrowMilestone",
    tableName: "escrow_milestones",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["agreement_id"] }],
  }
);

class EscrowPaymentIntent extends Model {}

EscrowPaymentIntent.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    agreementId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false },
    status: {
      type: DataTypes.ENUM(...PAYMENT_INTENT_STATUSES),
      allowNull: false,
      defaultValue: "pending",
    },
    dueAt: { type: DataTypes.DATE, allowNull: true },
    confirmedAt: { type: DataTypes.DATE, allowNull: true },
    externalPaymentRef: { type: DataTypes.STRING(128), allowNull: true },
    idempotencyKey: { type: DataTypes.STRING(128), allowNull: true, unique: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "EscrowPaymentIntent",
    tableName: "escrow_payment_intents",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["agreement_id"] }, { fields: ["status"] }],
  }
);

class EscrowLedgerEntry extends Model {}

EscrowLedgerEntry.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    agreementId: { type: DataTypes.INTEGER, allowNull: false },
    entryType: { type: DataTypes.ENUM(...LEDGER_ENTRY_TYPES), allowNull: false },
    amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false },
    balanceLockedAfter: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    balanceReleasedAfter: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    balanceRefundedAfter: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    actorUserId: { type: DataTypes.INTEGER, allowNull: true },
    actorRole: { type: DataTypes.STRING(32), allowNull: true },
    referenceType: { type: DataTypes.STRING(64), allowNull: true },
    referenceId: { type: DataTypes.INTEGER, allowNull: true },
    idempotencyKey: { type: DataTypes.STRING(128), allowNull: true, unique: true },
    note: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    modelName: "EscrowLedgerEntry",
    tableName: "escrow_ledger_entries",
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [{ fields: ["agreement_id"] }, { fields: ["entry_type"] }],
  }
);

class EscrowReleaseRequest extends Model {}

EscrowReleaseRequest.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    agreementId: { type: DataTypes.INTEGER, allowNull: false },
    milestoneId: { type: DataTypes.INTEGER, allowNull: true },
    amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false },
    status: {
      type: DataTypes.ENUM(...RELEASE_REQUEST_STATUSES),
      allowNull: false,
      defaultValue: "pending",
    },
    requestType: {
      type: DataTypes.ENUM("milestone_auto", "seller_request", "buyer_request", "admin_manual"),
      allowNull: false,
      defaultValue: "seller_request",
    },
    requestedByUserId: { type: DataTypes.INTEGER, allowNull: false },
    approvedByUserId: { type: DataTypes.INTEGER, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    adminNotes: { type: DataTypes.TEXT, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "EscrowReleaseRequest",
    tableName: "escrow_release_requests",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["agreement_id"] }, { fields: ["status"] }],
  }
);

class EscrowRefund extends Model {}

EscrowRefund.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    agreementId: { type: DataTypes.INTEGER, allowNull: false },
    amount: { type: DataTypes.DECIMAL(18, 4), allowNull: false },
    currency: { type: DataTypes.STRING(10), allowNull: false },
    reasonCode: { type: DataTypes.STRING(64), allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM(...REFUND_STATUSES),
      allowNull: false,
      defaultValue: "pending",
    },
    requestedByUserId: { type: DataTypes.INTEGER, allowNull: false },
    approvedByUserId: { type: DataTypes.INTEGER, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "EscrowRefund",
    tableName: "escrow_refunds",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["agreement_id"] }, { fields: ["status"] }],
  }
);

class EscrowDispute extends Model {}

EscrowDispute.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    agreementId: { type: DataTypes.INTEGER, allowNull: false },
    openedByUserId: { type: DataTypes.INTEGER, allowNull: false },
    openedByRole: { type: DataTypes.ENUM("buyer", "seller"), allowNull: false },
    status: {
      type: DataTypes.ENUM(...DISPUTE_STATUSES),
      allowNull: false,
      defaultValue: "filed",
    },
    reason: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    attachments: { type: DataTypes.JSON, allowNull: true },
    blocksRelease: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    resolutionNotes: { type: DataTypes.TEXT, allowNull: true },
    resolvedByUserId: { type: DataTypes.INTEGER, allowNull: true },
    resolvedAt: { type: DataTypes.DATE, allowNull: true },
    buyerRefundPercent: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
    sellerReleasePercent: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
  },
  {
    sequelize,
    modelName: "EscrowDispute",
    tableName: "escrow_disputes",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["agreement_id"] }, { fields: ["status"] }],
  }
);

class EscrowDisputeMessage extends Model {}

EscrowDisputeMessage.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    disputeId: { type: DataTypes.INTEGER, allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    attachments: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "EscrowDisputeMessage",
    tableName: "escrow_dispute_messages",
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [{ fields: ["dispute_id"] }],
  }
);

class EscrowEvent extends Model {}

EscrowEvent.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    agreementId: { type: DataTypes.INTEGER, allowNull: false },
    eventType: { type: DataTypes.STRING(64), allowNull: false },
    actorUserId: { type: DataTypes.INTEGER, allowNull: true },
    actorRole: { type: DataTypes.STRING(32), allowNull: true },
    payload: { type: DataTypes.JSON, allowNull: true },
  },
  {
    sequelize,
    modelName: "EscrowEvent",
    tableName: "escrow_events",
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [{ fields: ["agreement_id"] }, { fields: ["event_type"] }],
  }
);

module.exports = {
  EscrowRule,
  EscrowAgreement,
  EscrowMilestone,
  EscrowPaymentIntent,
  EscrowLedgerEntry,
  EscrowReleaseRequest,
  EscrowRefund,
  EscrowDispute,
  EscrowDisputeMessage,
  EscrowEvent,
  CURRENCIES,
};
