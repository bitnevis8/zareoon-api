const express = require("express");
const multer = require("multer");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

router.use(authenticateUser);
router.use(authorizeRole("Administrator"));

router.get("/sections", controller.listSections);
router.get("/export/full", controller.exportFull);
router.get("/export/:section", controller.exportSection);
router.post("/import/full", upload.single("file"), controller.importFull);
router.post("/import/:section", upload.single("file"), controller.importSection);

module.exports = router;
