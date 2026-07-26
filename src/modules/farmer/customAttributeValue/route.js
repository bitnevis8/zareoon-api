const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser } = require("../../user/auth/middleware");

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", authenticateUser, controller.create);
router.put("/:id", authenticateUser, controller.update);
router.delete("/:id", authenticateUser, controller.remove);

module.exports = router;
