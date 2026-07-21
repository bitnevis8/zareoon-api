const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

router.get("/resolve/:slug", controller.getResolve);

router.use(authenticateUser);
router.get("/mine/pending", controller.getMinePending);
router.post("/mine/schedule", controller.postSchedule);
router.post("/mine/cancel", controller.postCancel);

router.get("/admin/aliases", authorizeRole("Administrator"), controller.adminList);
router.post("/admin/aliases/:id/free", authorizeRole("Administrator"), controller.adminFree);
router.patch("/admin/aliases/:id/lock", authorizeRole("Administrator"), controller.adminLock);

module.exports = router;
