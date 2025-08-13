const express = require("express");
const router = express.Router();
const controller = require("./controller");

router.get("/me", controller.getMyCart);
router.post("/add", controller.addItem);
router.put("/item/:id", controller.updateItem);
router.delete("/item/:id", controller.removeItem);
router.post("/checkout", controller.checkout);

module.exports = router;

