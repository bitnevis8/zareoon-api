const express = require("express");
const router = express.Router();
const hsCodeController = require("./controller");

router.get("/search", hsCodeController.search);
router.get("/getByCode/:code", hsCodeController.getByCode);
router.get("/getAll", hsCodeController.getAll);

module.exports = router;
