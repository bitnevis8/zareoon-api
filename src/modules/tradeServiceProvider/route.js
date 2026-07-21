const express = require("express");
const { jwtVerify } = require("jose");
const config = require("config");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) token = authHeader.substring(7);
    }
    if (token) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(config.get("JWT_SECRET")));
      req.user = payload;
      req.user.userId = payload.userId || payload.id;
      req.user.id = req.user.userId;
    }
  } catch {
    // guest allowed
  }
  next();
};

router.get("/public", controller.listPublic);
router.get("/public/:id", optionalAuth, controller.getOnePublic);
router.get("/slug-available", controller.checkSlugAvailable);
// هر کاربر لاگین‌شده (نقش پیش‌فرض user) می‌تواند خدمات‌دهنده شود — بدون نیاز به نقش قبلی
router.post("/", authenticateUser, controller.create);

router.use(authenticateUser);
router.get("/mine", controller.getMine);
router.patch("/mine", controller.updateMine);
router.patch("/mine/visibility", controller.updateVisibility);
router.post("/mine/request-deletion", controller.requestDeletion);
router.post("/mine/cancel-deletion", controller.cancelDeletion);
router.post("/:id/reviews", controller.createReview);
router.get("/stats/pending-count", authorizeRole("Administrator"), controller.countPending);
router.get("/", authorizeRole("Administrator"), controller.list);
router.get("/:id", authorizeRole("Administrator"), controller.getOne);
router.patch("/:id/status", authorizeRole("Administrator"), controller.updateStatus);

module.exports = router;
