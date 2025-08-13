const express = require("express");
const router = express.Router();

// Import sub-routes
// const productCategoryRouter = require("./productCategory/route"); // merged into products
const productRouter = require("./product/route");
const inventoryLotRouter = require("./inventoryLot/route");
const orderRouter = require("./order/route");
const cartRouter = require("./cart/route");
const attributeDefRouter = require("./customAttributeDefinition/route");
const attributeValueRouter = require("./customAttributeValue/route");

// router.use("/product-category", productCategoryRouter); // disabled after merge
router.use("/product", productRouter);
router.use("/inventory-lot", inventoryLotRouter);
router.use("/order", orderRouter);
router.use("/cart", cartRouter);
router.use("/attribute-definition", attributeDefRouter);
router.use("/attribute-value", attributeValueRouter);

module.exports = router;

