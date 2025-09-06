const express = require("express");
const router = express.Router();
const controller = require("./controller");

router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", controller.getById);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);
// Export CSV of all products (and categories) with english names
router.get("/export/english-csv/all", controller.exportEnglishCsv);
// Order history for a given product
router.get("/:id/order-history", controller.orderHistory);
// Active cart items for a given product
router.get("/:id/cart-items", controller.cartItemsForProduct);
// Hierarchical stock calculation for products and categories
router.get("/:id/hierarchical-stock", controller.getHierarchicalStock);

module.exports = router;

