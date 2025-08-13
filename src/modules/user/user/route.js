const express = require("express");
const UserController = require("./controller");

const router = express.Router();

// روت‌های مربوط به کاربران
router.get("/getAll", UserController.getAll); // دریافت تمام کاربران
router.get("/search", UserController.search); // جستجوی کاربران
router.get("/getOne/:id", UserController.getOne); // دریافت یک کاربر بر اساس ID
router.post("/create", UserController.create); // ایجاد کاربر جدید
router.put("/update/:id", UserController.update); // ویرایش کاربر بر اساس ID
router.delete("/delete/:id", UserController.delete); // حذف کاربر بر اساس ID

module.exports = router; 