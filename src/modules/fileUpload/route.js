const express = require("express");
const router = express.Router();
const FileController = require("./controller");
const upload = require("./middleware/multerConfig");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

// آپلود فایل
router.post("/upload", 
  authenticateUser,
  upload.single("file"),
  FileController.upload
);

// دریافت اطلاعات یک فایل
router.get("/file/:id",
  authenticateUser,
  FileController.getFile
);

// حذف فایل
router.delete("/file/:id",
  authenticateUser,
  FileController.deleteFile
);

// دریافت لیست فایل‌های یک ماژول
router.get("/module/:module",
  authenticateUser,
  FileController.getFilesByModule
);

// دریافت لیست فایل‌های کاربر
router.get("/user-files",
  authenticateUser,
  FileController.getUserFiles
);

// مسیر جدید برای مدیریت ساختار پوشه‌ها - فقط برای ادمین
router.post("/init-directories", 
  authenticateUser, 
  authorizeRole('admin'),
  FileController.initializeDirectories
);

module.exports = router; 