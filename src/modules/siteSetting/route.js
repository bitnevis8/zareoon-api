const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

router.get("/vip/public", controller.getVipPublic);

router.use(authenticateUser);
router.get("/trade", authorizeRole("Administrator"), controller.getTrade);
router.patch("/trade", authorizeRole("Administrator"), controller.patchTrade);

module.exports = router;
