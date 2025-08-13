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

module.exports = router;

