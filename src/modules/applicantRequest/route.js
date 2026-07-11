const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser } = require("../user/auth/middleware");

router.use(authenticateUser);

router.post("/", controller.create);
router.get("/mine", controller.listMine);
router.get("/notifications/unread-count", controller.unreadCount);
router.get("/notifications", controller.listNotifications);
router.patch("/notifications/read-all", controller.markAllNotificationsRead);
router.patch("/notifications/:id/read", controller.markNotificationRead);
router.get("/:id", controller.getById);

module.exports = router;
