const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../../user/auth/middleware");

// All routes require authentication
router.use(authenticateUser);

// Supplier routes MUST come before param routes to avoid ":id" catching "me"
router.get("/me", controller.listForFarmer);
router.patch("/item/:itemId/status", controller.updateItemStatus);
router.get("/:id/items", controller.listItems);

// Admin routes
router.get("/", authorizeRole("Administrator"), controller.list);
router.post("/", authorizeRole("Administrator"), controller.create);
router.get("/:id", authorizeRole("Administrator"), controller.getById);
router.post("/:id/cancel", authorizeRole("Administrator"), controller.cancel);
router.post("/:id/complete", authorizeRole("Administrator"), controller.complete);
router.put("/:id/allocate", authorizeRole("Administrator"), controller.allocate);
router.post("/:id/cancel", controller.cancel);
router.post("/:id/complete", controller.complete);

module.exports = router;

