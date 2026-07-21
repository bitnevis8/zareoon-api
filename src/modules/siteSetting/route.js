const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

router.get("/vip/public", controller.getVipPublic);
router.get("/languages/public", controller.getLanguagesPublic);
router.get("/public-page-slug-rules/public", controller.getSlugRulesPublic);

router.use(authenticateUser);
router.get("/trade", authorizeRole("Administrator"), controller.getTrade);
router.patch("/trade", authorizeRole("Administrator"), controller.patchTrade);
router.get("/languages", authorizeRole("Administrator"), controller.getLanguages);
router.patch("/languages", authorizeRole("Administrator"), controller.patchLanguages);
router.get("/blocked-page-slugs", authorizeRole("Administrator"), controller.getBlockedSlugs);
router.patch("/blocked-page-slugs", authorizeRole("Administrator"), controller.patchBlockedSlugs);
router.get("/blocked-page-slugs/export", authorizeRole("Administrator"), controller.exportBlockedSlugs);
router.post("/blocked-page-slugs/import", authorizeRole("Administrator"), controller.importBlockedSlugs);
router.post("/blocked-page-slugs/reset", authorizeRole("Administrator"), controller.resetBlockedSlugs);

module.exports = router;
