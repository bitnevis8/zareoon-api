const express = require("express");
const UserController = require("./controller");
const { authenticateUser, authorizeRole } = require("../auth/middleware");

const router = express.Router();
const adminOnly = [authenticateUser, authorizeRole("Administrator")];

router.get("/getAll", ...adminOnly, UserController.getAll);
router.get("/search", ...adminOnly, UserController.search);
router.get("/getOne/:id", ...adminOnly, UserController.getOne);
router.post("/create", ...adminOnly, UserController.create);
router.put("/update/:id", ...adminOnly, UserController.update);
router.delete("/delete/:id", ...adminOnly, UserController.delete);

module.exports = router;
