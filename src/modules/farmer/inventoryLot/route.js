const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser } = require("../../user/auth/middleware");

const auth = authenticateUser;

router.get("/", controller.list);
router.get("/:id/calculate-price", controller.calculatePrice);
router.get("/:id", controller.getById);

router.get("/:id/supplier-contact", auth, controller.getSupplierContact);

router.post("/", auth, controller.create);
router.put("/:id", auth, controller.update);
router.delete("/:id", auth, controller.remove);

router.post("/:id/reserve", auth, controller.reserve);
router.post("/:id/release", auth, controller.release);
router.put("/:id/set-tiered-pricing", auth, controller.setTieredPricing);

module.exports = router;
