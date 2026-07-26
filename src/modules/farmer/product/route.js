const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../../user/auth/middleware");

router.get("/", controller.list);
// Export قبل از /:id تا با پارامتر اشتباه گرفته نشود
router.get("/export/english-csv/all", authenticateUser, authorizeRole("Administrator"), controller.exportEnglishCsv);
router.get("/:id", controller.getById);
router.get("/:id/order-history", controller.orderHistory);
router.get("/:id/cart-items", controller.cartItemsForProduct);
router.get("/:id/hierarchical-stock", controller.getHierarchicalStock);

router.post("/", authenticateUser, controller.create);
router.put("/:id", authenticateUser, controller.update);
router.delete("/:id", authenticateUser, controller.remove);

module.exports = router;
