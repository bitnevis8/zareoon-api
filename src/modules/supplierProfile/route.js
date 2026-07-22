const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

router.get("/entity-schemas", controller.getEntitySchemas);
router.get("/slug-available", controller.checkSlugAvailable);
router.get("/recent-shops", controller.listRecentPublicShops);
router.get("/public/:slug", controller.optionalAuth, controller.getPublicProfile);
router.get("/public/:slug/posts", controller.getPosts);
router.get("/public/:slug/reviews", controller.getReviews);
router.get("/posts/public", controller.listPublicPosts);

router.use(authenticateUser);

router.get("/me", controller.getMyProfileSettings);
router.get("/me/social-stats", controller.getMySocialStats);
router.patch("/me", controller.updateMyProfile);
router.post("/me/request-deletion", controller.requestShopDeletion);
router.post("/me/cancel-deletion", controller.cancelShopDeletion);
router.get("/admin/shops", authorizeRole("Administrator"), controller.adminListShops);
router.patch("/admin/shops/:id", authorizeRole("Administrator"), controller.adminUpdateShop);
router.post("/posts", controller.createPost);
router.delete("/posts/:postId", controller.deletePost);
router.post("/follow/:supplierId", controller.toggleFollow);
router.post("/review/:supplierId", controller.createReview);

module.exports = router;
