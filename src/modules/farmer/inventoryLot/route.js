const express = require("express");
const router = express.Router();
const controller = require("./controller");

router.get("/", controller.list);
router.post("/", controller.create);
router.get("/:id", controller.getById);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

// Reservation and release endpoints
router.post("/:id/reserve", controller.reserve);
router.post("/:id/release", controller.release);

// Pricing endpoints
router.get("/:id/calculate-price", controller.calculatePrice);
router.put("/:id/set-tiered-pricing", controller.setTieredPricing);

module.exports = router;

