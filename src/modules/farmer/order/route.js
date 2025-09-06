const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../../user/auth/middleware");

// All routes require authentication
router.use(authenticateUser);

// Supplier routes MUST come before param routes to avoid ":id" catching "me"
router.get("/me", controller.listForFarmer);
router.get("/customer", controller.listForCustomer);
router.get("/test", (req, res) => {
  console.log("Test endpoint hit - req.user:", req.user);
  console.log("Test endpoint - req.user.id:", req.user?.id);
  console.log("Test endpoint - req.user.userId:", req.user?.userId);
  res.json({ 
    success: true, 
    message: "Test endpoint working", 
    user: req.user,
    userId: req.user?.id,
    userUserId: req.user?.userId
  });
});
router.patch("/item/:itemId/status", authorizeRole("Administrator"), controller.updateItemStatus);
router.get("/:id/items", controller.listItems);

// Admin routes
router.get("/admin", authorizeRole("Administrator"), controller.listForAdmin);
router.get("/", authorizeRole("Administrator"), controller.list);
router.post("/", authorizeRole("Administrator"), controller.create);
router.get("/:id", authorizeRole("Administrator"), controller.getById);
router.post("/:id/cancel", authorizeRole("Administrator"), controller.cancel);
router.post("/:id/complete", authorizeRole("Administrator"), controller.complete);
router.put("/:id/allocate", authorizeRole("Administrator"), controller.allocate);
router.post("/:id/approve", authorizeRole("Administrator"), controller.approveOrder);
router.put("/:id/status", authorizeRole("Administrator"), controller.updateStatus);

module.exports = router;

