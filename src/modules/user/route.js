const express = require("express");
const router = express.Router();

// Import routes
const userRouter = require("./user/route");
const roleRouter = require("./role/route");
const authRouter = require("./auth/route");

// Define routes
router.use("/auth", authRouter); // احراز هویت
router.use("/user", userRouter); // مدیریت کاربر
router.use("/role", roleRouter); // مدیریت نقش

module.exports = router; 