const express = require("express");
const RoleController = require("./controller");

const router = express.Router();

// روت‌های مربوط به نقش‌ها
router.get("/getAll", RoleController.getAll); // دریافت تمام نقش‌ها
router.get("/getOne/:id", RoleController.getOne); // دریافت یک نقش بر اساس ID
router.post("/create", RoleController.create); // ایجاد نقش جدید
router.put("/update/:id", RoleController.update); // ویرایش نقش بر اساس ID
router.delete("/delete/:id", RoleController.delete); // حذف نقش بر اساس ID

module.exports = router; 