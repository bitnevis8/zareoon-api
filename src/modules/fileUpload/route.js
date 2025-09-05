const express = require("express");
const router = express.Router();
const FileController = require("./controller");
const upload = require("./middleware/multerConfig");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

// آپلود فایل عمومی
router.post("/upload", 
  authenticateUser,
  upload.single("file"),
  FileController.upload
);

// آپلود آواتار کاربر
router.post("/upload/avatar", 
  authenticateUser,
  upload.single("file"),
  FileController.uploadAvatar
);

// آپلود مدارک کاربر
router.post("/upload/user-document", 
  authenticateUser,
  upload.single("file"),
  FileController.uploadUserDocument
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

// حذف فایل بر اساس URL
router.delete("/file",
  authenticateUser,
  FileController.deleteFileByUrl
);

// دریافت لیست فایل‌های یک ماژول (عمومی برای نمایش رسانه‌ها)
router.get("/module/:module",
  FileController.getFilesByModule
);

// دریافت لیست فایل‌های کاربر
router.get("/user-files",
  authenticateUser,
  FileController.getUserFiles
);

// دریافت فایل‌های کاربر بر اساس نوع
router.get("/user-files/:fileType",
  authenticateUser,
  FileController.getUserFilesByType
);

// مسیر جدید برای مدیریت ساختار پوشه‌ها - فقط برای ادمین
router.post("/init-directories", 
  authenticateUser, 
  authorizeRole('admin'),
  FileController.initializeDirectories
);

module.exports = router; 