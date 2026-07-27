const express = require("express");
const router = express.Router();
const c = require("./controller");
const { authenticateUser, optionalAuthenticateUser, authorizeRole } = require("../user/auth/middleware");

router.get("/themes", c.themes);
router.get("/public/:shopSlug/:landingSlug", optionalAuthenticateUser, c.getPublic);
router.get("/resolve-products", c.resolveByProducts);
router.get("/resolve-products/:productId", c.resolveByProducts);

router.use(authenticateUser);

router.get("/templates", c.listTemplates);
router.get("/templates/:id", c.getTemplate);
router.post("/templates/mine", c.saveAsMyTemplate);

router.get("/admin/templates", authorizeRole("admin"), c.adminListTemplates);
router.post("/admin/templates", authorizeRole("admin"), c.adminCreateTemplate);
router.patch("/admin/templates/:id", authorizeRole("admin"), c.adminUpdateTemplate);
router.delete("/admin/templates/:id", authorizeRole("admin"), c.adminDeleteTemplate);

router.get("/mine", c.listMine);
router.get("/mine/:id", c.getMine);
router.post("/mine", c.create);
router.patch("/mine/:id", c.update);
router.delete("/mine/:id", c.remove);

module.exports = router;
