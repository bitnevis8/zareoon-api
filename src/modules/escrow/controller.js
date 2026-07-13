const { isAdmin } = require("../../utils/roles");
const {
  EscrowRule,
  EscrowAgreement,
  EscrowDispute,
  EscrowDisputeMessage,
} = require("./model");
const escrowService = require("./escrowService");

function handleError(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message || "خطای داخلی سرور",
  });
}

const listRules = async (req, res) => {
  try {
    const rules = await EscrowRule.findAll({
      where: { isActive: true },
      order: [["priority", "DESC"], ["id", "ASC"]],
    });
    res.json({ success: true, data: rules });
  } catch (e) {
    handleError(res, e);
  }
};

const createRule = async (req, res) => {
  try {
    const rule = await EscrowRule.create(req.body);
    res.status(201).json({ success: true, data: rule });
  } catch (e) {
    handleError(res, e);
  }
};

const previewDeposit = async (req, res) => {
  try {
    const { dealTotalAmount, currency = "IRR", sellerId, holdMode, depositPercent, depositAmount } = req.body;
    const data = await escrowService.previewDeposit({
      dealTotalAmount,
      currency,
      sellerId,
      holdMode,
      depositPercent,
      depositAmount,
    });
    res.json({ success: true, data });
  } catch (e) {
    handleError(res, e);
  }
};

const createAgreement = async (req, res) => {
  try {
    const agreement = await escrowService.createAgreement(req.body, req.user);
    res.status(201).json({ success: true, data: agreement });
  } catch (e) {
    handleError(res, e);
  }
};

const activateAgreement = async (req, res) => {
  try {
    const agreement = await escrowService.activateAgreement(req.params.id, req.user);
    res.json({ success: true, data: agreement });
  } catch (e) {
    handleError(res, e);
  }
};

const listAgreements = async (req, res) => {
  try {
    const result = await escrowService.listAgreements(req.user, {
      status: req.query.status,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, data: result.rows, meta: { total: result.count } });
  } catch (e) {
    handleError(res, e);
  }
};

const getAgreement = async (req, res) => {
  try {
    const data = await escrowService.getAgreementDetail(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (e) {
    handleError(res, e);
  }
};

const createPaymentIntent = async (req, res) => {
  try {
    const intent = await escrowService.createPaymentIntent(req.params.id, req.user, req.body);
    res.status(201).json({ success: true, data: intent });
  } catch (e) {
    handleError(res, e);
  }
};

const confirmPayment = async (req, res) => {
  try {
    const result = await escrowService.confirmPayment({
      agreementId: req.params.id,
      paymentIntentId: req.body.paymentIntentId,
      externalPaymentRef: req.body.externalPaymentRef,
      amount: req.body.amount,
      idempotencyKey: req.body.idempotencyKey,
      actorUser: req.user,
    });
    res.json({ success: true, data: result, message: "پرداخت تأیید و وجه قفل شد" });
  } catch (e) {
    handleError(res, e);
  }
};

const confirmMilestone = async (req, res) => {
  try {
    const milestone = await escrowService.confirmMilestone(
      req.params.id,
      req.params.milestoneId,
      req.user,
      req.body
    );
    res.json({ success: true, data: milestone });
  } catch (e) {
    handleError(res, e);
  }
};

const requestRelease = async (req, res) => {
  try {
    const release = await escrowService.requestRelease(req.params.id, req.user, req.body);
    res.status(201).json({ success: true, data: release });
  } catch (e) {
    handleError(res, e);
  }
};

const approveRelease = async (req, res) => {
  try {
    const release = await escrowService.approveReleaseRequest(req.params.releaseId, req.user, req.body);
    res.json({ success: true, data: release });
  } catch (e) {
    handleError(res, e);
  }
};

const requestRefund = async (req, res) => {
  try {
    const refund = await escrowService.requestRefund(req.params.id, req.user, req.body);
    res.status(201).json({ success: true, data: refund });
  } catch (e) {
    handleError(res, e);
  }
};

const approveRefund = async (req, res) => {
  try {
    const refund = await escrowService.approveRefund(req.params.refundId, req.user);
    res.json({ success: true, data: refund });
  } catch (e) {
    handleError(res, e);
  }
};

const openDispute = async (req, res) => {
  try {
    const dispute = await escrowService.openDispute(req.params.id, req.user, req.body);
    res.status(201).json({ success: true, data: dispute });
  } catch (e) {
    handleError(res, e);
  }
};

const resolveDispute = async (req, res) => {
  try {
    const dispute = await escrowService.resolveDispute(req.params.disputeId, req.user, req.body);
    res.json({ success: true, data: dispute });
  } catch (e) {
    handleError(res, e);
  }
};

const addDisputeMessage = async (req, res) => {
  try {
    const dispute = await EscrowDispute.findByPk(req.params.disputeId);
    if (!dispute) return res.status(404).json({ success: false, message: "اختلاف یافت نشد" });
    const agreement = await EscrowAgreement.findByPk(dispute.agreementId);
    const uid = req.user.id || req.user.userId;
    if (!isAdmin(req.user) && uid !== agreement.buyerId && uid !== agreement.sellerId) {
      return res.status(403).json({ success: false, message: "دسترسی غیرمجاز" });
    }
    const msg = await EscrowDisputeMessage.create({
      disputeId: dispute.id,
      userId: uid,
      message: req.body.message,
      attachments: req.body.attachments || null,
    });
    res.status(201).json({ success: true, data: msg });
  } catch (e) {
    handleError(res, e);
  }
};

const cancelAgreement = async (req, res) => {
  try {
    const agreement = await escrowService.cancelAgreement(req.params.id, req.user, req.body);
    res.json({ success: true, data: agreement });
  } catch (e) {
    handleError(res, e);
  }
};

const getSettings = async (req, res) => {
  try {
    const data = await escrowService.getEscrowSettings();
    res.json({ success: true, data });
  } catch (e) {
    handleError(res, e);
  }
};

const updateSettings = async (req, res) => {
  try {
    const data = await escrowService.updateEscrowSettings(req.user, req.body);
    res.json({ success: true, data, message: "تنظیمات بیعانه ذخیره شد" });
  } catch (e) {
    handleError(res, e);
  }
};

const updateRule = async (req, res) => {
  try {
    const rule = await escrowService.updateEscrowRule(req.user, req.params.id, req.body);
    res.json({ success: true, data: rule, message: "قانون به‌روزرسانی شد" });
  } catch (e) {
    handleError(res, e);
  }
};

module.exports = {
  listRules,
  createRule,
  previewDeposit,
  createAgreement,
  activateAgreement,
  listAgreements,
  getAgreement,
  createPaymentIntent,
  confirmPayment,
  confirmMilestone,
  requestRelease,
  approveRelease,
  requestRefund,
  approveRefund,
  openDispute,
  resolveDispute,
  addDisputeMessage,
  cancelAgreement,
  getSettings,
  updateSettings,
  updateRule,
};
