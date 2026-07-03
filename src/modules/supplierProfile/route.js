const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser } = require("../user/auth/middleware");

router.get("/entity-schemas", controller.getEntitySchemas);
router.get("/public/:slug", controller.optionalAuth, controller.getPublicProfile);
router.get("/public/:slug/posts", controller.getPosts);
router.get("/public/:slug/reviews", controller.getReviews);

router.use(authenticateUser);

router.get("/me", controller.getMyProfileSettings);
router.patch("/me", controller.updateMyProfile);
router.post("/posts", controller.createPost);
router.delete("/posts/:postId", controller.deletePost);
router.post("/follow/:supplierId", controller.toggleFollow);
router.post("/review/:supplierId", controller.createReview);

module.exports = router;
