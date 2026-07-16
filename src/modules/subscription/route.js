const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser } = require("../user/auth/middleware");

router.get("/plans", controller.listPlans);
router.get("/me", authenticateUser, controller.mySubscription);
router.post("/checkout", authenticateUser, controller.startCheckout);
router.post("/verify", authenticateUser, controller.verifyCheckout);
// Callback از درگاه ممکن است بدون توکن فرانت بیاید؛ authority کافی است
router.get("/verify", controller.verifyCheckout);
router.post("/verify-public", controller.verifyCheckout);

module.exports = router;
