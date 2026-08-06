const express = require("express");
const router = express.Router();
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");
const controller = require("./controller");

router.get("/templates", controller.listTemplates);

router.use(authenticateUser);

router.get("/admin/catalog", authorizeRole("Administrator"), controller.getAdminCatalog);
router.put("/admin/catalog", authorizeRole("Administrator"), controller.saveAdminCatalog);
router.post("/admin/catalog/reset", authorizeRole("Administrator"), controller.resetAdminCatalog);

router.get("/", controller.list);
router.post("/preview", controller.preview);
router.post("/", controller.create);
router.get("/:id", controller.getById);
router.patch("/:id", controller.update);
router.delete("/:id", controller.remove);
router.patch("/:id/steps/:stepId", controller.updateStep);
router.post("/:id/service-requests", controller.createServiceRequest);
router.post("/:id/documents", controller.addDocument);

module.exports = router;
