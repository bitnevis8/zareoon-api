const express = require("express");
const RoleController = require("./controller");
const { authenticateUser, authorizeRole } = require("../auth/middleware");

const router = express.Router();
const adminOnly = [authenticateUser, authorizeRole("Administrator")];

router.get("/getAll", ...adminOnly, RoleController.getAll);
router.get("/getOne/:id", ...adminOnly, RoleController.getOne);
router.post("/create", ...adminOnly, RoleController.create);
router.put("/update/:id", ...adminOnly, RoleController.update);
router.delete("/delete/:id", ...adminOnly, RoleController.delete);

module.exports = router;
