const express = require("express");
const { jwtVerify } = require("jose");
const { getJwtSecret } = require("../../utils/jwtSecret");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) token = authHeader.substring(7);
    }
    if (token) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(getJwtSecret()));
      req.user = payload;
      req.user.id = payload.userId;
    }
  } catch {
    // guest submission allowed
  }
  next();
};

router.post("/", optionalAuth, controller.create);

router.use(authenticateUser);
router.get("/", authorizeRole("Administrator"), controller.list);
router.get("/:id", authorizeRole("Administrator"), controller.getById);
router.patch("/:id/status", authorizeRole("Administrator"), controller.updateStatus);

module.exports = router;
