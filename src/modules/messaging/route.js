const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const config = require("config");
const fs = require("fs");
const router = express.Router();
const controller = require("./controller");
const { authenticateUser } = require("../user/auth/middleware");

const tempPath = config.get("UPLOAD.TEMP_PATH");
if (!fs.existsSync(tempPath)) {
  fs.mkdirSync(tempPath, { recursive: true });
}

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tempPath),
    filename: (_req, file, cb) => {
      const unique = crypto.randomBytes(12).toString("hex");
      cb(null, `msg-${Date.now()}-${unique}${path.extname(file.originalname) || ".jpg"}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) cb(null, true);
    else cb(new Error("فقط تصویر مجاز است"));
  },
});

router.use(authenticateUser);

router.get("/conversations", controller.listConversations);
router.post("/conversations", controller.createConversation);
router.get("/unread-count", controller.unreadCount);
router.get("/users/search", controller.searchUsers);
router.get("/translation-options", controller.getTranslationOptions);

router.get("/conversations/:id", controller.getConversation);
router.get("/conversations/:id/messages", controller.getMessages);
router.post("/conversations/:id/messages", controller.sendTextMessage);
router.post(
  "/conversations/:id/messages/image",
  imageUpload.single("image"),
  controller.sendImageMessage
);
router.patch("/conversations/:id/read", controller.markConversationRead);

module.exports = router;
