const BaseController = require("../../core/baseController");
const File = require("./model");
const config = require("config");
const ftpService = require("./services/ftpService");
const path = require("path");
const fs = require("fs");

class FileController extends BaseController {
  async initializeDirectories(req, res) {
    try {
      await ftpService.initializeDirectoryStructure();
      return this.response(res, 200, true, "ساختار پوشه‌ها با موفقیت ایجاد شد");
    } catch (error) {
      console.error("❌ Directory initialization failed:", error.message);
      return this.response(res, 500, false, "خطا در ایجاد ساختار پوشه‌ها", null, error);
    }
  }

  async upload(req, res) {
    try {
      console.log('=== Upload Debug ===');
      console.log('Request user:', req.user);
      console.log('Request file:', req.file);
      console.log('Request body:', req.body);
      console.log('===================');

      if (!req.file) {
        console.log('No file in request');
        return this.response(res, 400, false, "هیچ فایلی آپلود نشده است");
      }

      if (!req.user || !req.user.userId) {
        console.log('No user in request or missing user ID:', req.user);
        return this.response(res, 401, false, "برای آپلود فایل باید وارد حساب کاربری خود شوید");
      }

      const module = req.body.module || 'default';
      console.log('Upload module:', module);
      
      // آپلود به FTP و دریافت مسیرها
      const { relativePath } = await ftpService.uploadFile(
        req.file.path,
        module,
        req.file.filename
      );

      // حذف فایل موقت
      fs.unlinkSync(req.file.path);

      const file = await File.create({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        path: relativePath,
        mimeType: req.file.mimetype,
        size: req.file.size,
        module: module,
        entityId: req.body.entityId || null,
        uploaderId: req.user.userId,
      });

      console.log("✅ File uploaded successfully:", file.fileName);
      return this.response(res, 201, true, "فایل با موفقیت آپلود شد", {
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        downloadUrl: file.downloadUrl,
        mimeType: file.mimeType,
        size: file.size,
        module: file.module,
        uploadDate: file.createdAt
      });

    } catch (error) {
      // در صورت خطا، فایل موقت را حذف می‌کنیم
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error("❌ File upload failed:", error.message);
      return this.response(res, 500, false, "خطا در آپلود فایل", null, error);
    }
  }

  async getFile(req, res) {
    try {
      const file = await File.findByPk(req.params.id);
      if (!file) {
        return this.response(res, 404, false, "فایل یافت نشد");
      }

      return this.response(res, 200, true, "اطلاعات فایل دریافت شد", {
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        downloadUrl: file.downloadUrl,
        mimeType: file.mimeType,
        size: file.size,
        module: file.module,
        uploadDate: file.createdAt
      });

    } catch (error) {
      console.error("❌ Get file failed:", error.message);
      return this.response(res, 500, false, "خطا در دریافت اطلاعات فایل", null, error);
    }
  }

  async deleteFile(req, res) {
    try {
      const file = await File.findByPk(req.params.id);
      if (!file) {
        return this.response(res, 404, false, "فایل یافت نشد");
      }

      // حذف فایل از FTP
      await ftpService.deleteFile(file.path);

      await file.destroy();
      console.log("✅ File deleted successfully:", file.fileName);
      return this.response(res, 200, true, "فایل با موفقیت حذف شد");

    } catch (error) {
      console.error("❌ Delete file failed:", error.message);
      return this.response(res, 500, false, "خطا در حذف فایل", null, error);
    }
  }

  async getFilesByModule(req, res) {
    try {
      const files = await File.findAll({
        where: {
          module: req.params.module,
          entityId: req.query.entityId || null
        }
      });

      return this.response(res, 200, true, "لیست فایل‌ها دریافت شد", files);

    } catch (error) {
      console.error("❌ Get files by module failed:", error.message);
      return this.response(res, 500, false, "خطا در دریافت لیست فایل‌ها", null, error);
    }
  }

  async getUserFiles(req, res) {
    try {
      const files = await File.findAll({
        where: {
          uploaderId: req.user.userId
        },
        order: [['createdAt', 'DESC']]
      });

      // تبدیل اطلاعات به فرمت مناسب
      const formattedFiles = files.map(file => ({
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        downloadUrl: file.downloadUrl,
        mimeType: file.mimeType,
        size: file.size,
        module: file.module,
        uploadDate: file.createdAt
      }));

      return this.response(res, 200, true, "لیست فایل‌های کاربر دریافت شد", formattedFiles);

    } catch (error) {
      console.error("❌ Get user files failed:", error.message);
      return this.response(res, 500, false, "خطا در دریافت لیست فایل‌های کاربر", null, error);
    }
  }
}

module.exports = new FileController(); 