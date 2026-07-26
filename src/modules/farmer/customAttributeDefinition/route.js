const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../../user/auth/middleware");

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", authenticateUser, authorizeRole("Administrator"), controller.create);
router.put("/:id", authenticateUser, authorizeRole("Administrator"), controller.update);
router.delete("/:id", authenticateUser, authorizeRole("Administrator"), controller.remove);

module.exports = router;
