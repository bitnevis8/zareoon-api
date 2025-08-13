const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const config = require("config");
const fs = require('fs');

// اطمینان از وجود دایرکتوری موقت
const tempPath = config.get("UPLOAD.TEMP_PATH");
if (!fs.existsSync(tempPath)) {
  fs.mkdirSync(tempPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  // اعتبارسنجی نوع فایل
  const allowedMimes = config.get("UPLOAD.ALLOWED_MIMES");

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('فرمت فایل مجاز نیست'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.get("UPLOAD.MAX_FILE_SIZE")
  }
});

module.exports = upload; 