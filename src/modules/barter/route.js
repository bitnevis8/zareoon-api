const express = require("express");
const router = express.Router();
const { authenticateUser } = require("../user/auth/middleware");
const controller = require("./controller");

router.get("/offers", controller.listPublicOffers);
router.get("/offers/:id", controller.getOffer);

router.get("/notifications/unread-count", authenticateUser, controller.unreadCount);
router.get("/notifications", authenticateUser, controller.listNotifications);
router.patch("/notifications/read-all", authenticateUser, controller.markAllNotificationsRead);
router.patch("/notifications/:id/read", authenticateUser, controller.markNotificationRead);
router.get("/inbox", authenticateUser, controller.listInbox);

module.exports = router;
