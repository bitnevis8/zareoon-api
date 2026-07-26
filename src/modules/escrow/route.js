const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

router.get("/rules", controller.listRules);
router.get("/settings", controller.getSettings);
router.post("/rules", authenticateUser, authorizeRole("Administrator"), controller.createRule);
router.put("/settings", authenticateUser, authorizeRole("Administrator"), controller.updateSettings);
router.put("/rules/:id", authenticateUser, authorizeRole("Administrator"), controller.updateRule);

router.post("/calculate-deposit", controller.previewDeposit);
router.post("/payments/zibal/verify-public", controller.verifyZibalPaymentPublic);

router.use(authenticateUser);

router.get("/agreements", controller.listAgreements);
router.post("/agreements", controller.createAgreement);
router.get("/agreements/:id", controller.getAgreement);
router.post("/agreements/:id/activate", controller.activateAgreement);
router.get("/agreements/:id/contract", controller.getContract);
router.post("/agreements/:id/sign/request-otp", controller.requestSignOtp);
router.post("/agreements/:id/sign/verify", controller.verifySignOtp);
router.post("/agreements/:id/payment-intents", controller.createPaymentIntent);
router.post("/agreements/:id/payments/zibal/start", controller.startZibalPayment);
router.post("/agreements/:id/confirm-payment", authorizeRole("Administrator"), controller.confirmPayment);
router.post("/agreements/:id/milestones/:milestoneId/confirm", controller.confirmMilestone);
router.post("/agreements/:id/release-requests", controller.requestRelease);
router.post("/agreements/:id/refunds", controller.requestRefund);
router.post("/agreements/:id/disputes", controller.openDispute);
router.post("/agreements/:id/cancel", controller.cancelAgreement);

router.post("/payments/zibal/verify", controller.verifyZibalPayment);

router.post("/release-requests/:releaseId/approve", controller.approveRelease);
router.post("/refunds/:refundId/approve", authorizeRole("Administrator"), controller.approveRefund);
router.post("/disputes/:disputeId/resolve", authorizeRole("Administrator"), controller.resolveDispute);
router.post("/disputes/:disputeId/messages", controller.addDisputeMessage);

module.exports = router;
