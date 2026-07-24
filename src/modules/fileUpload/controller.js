const BaseController = require("../../core/baseController");
const File = require("./model");
const ftpService = require("./services/ftpService");
const { isProcessableImage, processUploadImage } = require("./services/imageProcessor");
const path = require("path");
const fs = require("fs");

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

/**
 * تصویر → WebP فشرده + واترمارک؛ غیرتصویر بدون تغییر
 */
async function resolveUploadAsset(reqFile, { watermark = true } = {}) {
  const originalPath = reqFile.path;
  if (!isProcessableImage(reqFile.mimetype)) {
    return {
      localPath: originalPath,
      fileName: reqFile.filename,
      mimeType: reqFile.mimetype,
      size: reqFile.size,
      originalName: reqFile.originalname,
      processedPath: null,
    };
  }

  const processed = await processUploadImage(originalPath, { watermark });
  const baseOriginal = path.basename(reqFile.originalname, path.extname(reqFile.originalname));
  return {
    localPath: processed.outputPath,
    fileName: processed.fileName,
    mimeType: processed.mimeType,
    size: processed.size,
    originalName: `${baseOriginal || "image"}.webp`,
    processedPath: processed.outputPath,
  };
}

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
    let processedPath = null;
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

      const module = req.body.module || 'users';
      const fileType = req.body.fileType || (req.file.mimetype.startsWith('video/') ? 'videos' : 'images');
      const entityId = req.body.entityId ? parseInt(req.body.entityId, 10) : null;
      console.log('Upload module:', module, 'fileType:', fileType, 'entityId:', entityId);

      const asset = await resolveUploadAsset(req.file, {
        // آواتار / لوگوی فروشگاه بدون واترمارک
        watermark: !(
          (module === "users" && fileType === "avatars") ||
          module === "accounts"
        ),
      });
      processedPath = asset.processedPath;

      const { relativePath } = await ftpService.uploadFile(
        asset.localPath,
        module,
        asset.fileName,
        fileType
      );

      safeUnlink(req.file.path);
      if (processedPath && processedPath !== req.file.path) safeUnlink(processedPath);

      const file = await File.create({
        fileName: asset.fileName,
        originalName: asset.originalName,
        path: relativePath,
        mimeType: asset.mimeType,
        size: asset.size,
        module: module,
        fileType: fileType,
        entityId: entityId,
        uploaderId: req.user.userId,
      });

      // تصویر محصول → همیشه کاور را به‌روز کن
      if (module === 'products' && fileType === 'images' && entityId) {
        const Product = require('../farmer/product/model');
        const product = await Product.findByPk(entityId);
        if (product) {
          await product.update({ imageUrl: file.downloadUrl });
        }
      }

      console.log("✅ File uploaded successfully:", file.fileName, `(${Math.round(file.size / 1024)}KB)`);
      return this.response(res, 201, true, "فایل با موفقیت آپلود شد", {
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        downloadUrl: file.downloadUrl,
        mimeType: file.mimeType,
        size: file.size,
        module: file.module,
        fileType: file.fileType,
        entityId: file.entityId,
        uploadDate: file.createdAt
      });

    } catch (error) {
      if (req.file) safeUnlink(req.file.path);
      if (processedPath) safeUnlink(processedPath);
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

  async deleteFileByUrl(req, res) {
    try {
      const { fileUrl, clearAvatar } = req.body || {};
      if (!fileUrl) {
        return this.response(res, 400, false, "URL فایل الزامی است");
      }

      const User = require("../user/user/model");
      const userId = req.user?.userId || req.user?.id;

      // downloadUrl مجازی است و در WHERE قابل جستجو نیست — از path استفاده می‌کنیم
      const normalizePath = (raw) => {
        let s = String(raw || "").trim();
        if (!s) return "";
        try {
          if (/^https?:\/\//i.test(s)) {
            const u = new URL(s);
            s = u.pathname || "";
          }
        } catch {
          /* ignore */
        }
        s = s.replace(/^\/dl-media\//i, "/");
        s = s.replace(/^\//, "");
        // query/hash را حذف کن
        s = s.split("?")[0].split("#")[0];
        return s;
      };

      const targetPath = normalizePath(fileUrl);
      let file = null;

      if (targetPath) {
        file = await File.findOne({ where: { path: targetPath } });
        if (!file) {
          // تطبیق با پسوند مسیر (اگر هاست/پیشوند فرق داشته باشد)
          const baseName = targetPath.split("/").pop();
          if (baseName) {
            const { Op } = require("sequelize");
            file = await File.findOne({
              where: {
                path: { [Op.like]: `%/${baseName}` },
              },
              order: [["id", "DESC"]],
            });
          }
        }
      }

      if (file) {
        try {
          await ftpService.deleteFile(file.path);
        } catch (ftpErr) {
          console.warn("FTP delete skipped:", ftpErr.message);
        }
        await file.destroy();
      }

      // همیشه آواتار کاربر را خالی کن اگر درخواست حذف آواتار باشد یا URL با آواتار فعلی یکی باشد
      if (userId) {
        const user = await User.findByPk(userId);
        if (user) {
          const userAvatarPath = normalizePath(user.avatar);
          const shouldClear =
            clearAvatar === true ||
            clearAvatar === "true" ||
            (userAvatarPath && targetPath && userAvatarPath === targetPath) ||
            (user.avatar && String(user.avatar) === String(fileUrl));
          if (shouldClear && user.avatar) {
            await user.update({ avatar: null });
          }
        }
      }

      if (!file) {
        // فایل در جدول نبود، ولی آواتار پاک شده — موفقیت نرم
        return this.response(res, 200, true, "تصویر از نمایه حذف شد", { cleared: true, fileMissing: true });
      }

      console.log("✅ File deleted successfully by URL:", file.fileName);
      return this.response(res, 200, true, "فایل با موفقیت حذف شد", { cleared: true });
    } catch (error) {
      console.error("❌ Delete file by URL failed:", error.message);
      return this.response(res, 500, false, "خطا در حذف فایل", null, error);
    }
  }

  async getFilesByModule(req, res) {
    try {
      const where = { module: req.params.module };
      if (req.query.entityId) {
        where.entityId = parseInt(req.query.entityId, 10);
      }
      if (req.query.fileType) {
        where.fileType = req.query.fileType;
      }

      const files = await File.findAll({
        where,
        order: [['createdAt', 'DESC']],
      });

      let filtered = files;
      if (req.query.fileType) {
        const ft = req.query.fileType;
        filtered = files.filter((f) => {
          if (ft === 'images') {
            return f.fileType === 'images' || (!f.fileType && String(f.mimeType || '').startsWith('image/'));
          }
          if (ft === 'videos') {
            return f.fileType === 'videos' || (!f.fileType && String(f.mimeType || '').startsWith('video/'));
          }
          return f.fileType === ft;
        });
      }

      const formatted = filtered.map(file => ({
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        downloadUrl: file.downloadUrl,
        mimeType: file.mimeType,
        size: file.size,
        module: file.module,
        fileType: file.fileType,
        entityId: file.entityId,
        uploadDate: file.createdAt,
      }));

      return this.response(res, 200, true, "لیست فایل‌ها دریافت شد", formatted);

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
        fileType: file.fileType,
        uploadDate: file.createdAt
      }));

      return this.response(res, 200, true, "لیست فایل‌های کاربر دریافت شد", formattedFiles);

    } catch (error) {
      console.error("❌ Get user files failed:", error.message);
      return this.response(res, 500, false, "خطا در دریافت لیست فایل‌های کاربر", null, error);
    }
  }

  async getUserFilesByType(req, res) {
    try {
      const { fileType } = req.params;
      
      const files = await File.findAll({
        where: {
          uploaderId: req.user.userId,
          fileType: fileType
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
        fileType: file.fileType,
        uploadDate: file.createdAt
      }));

      return this.response(res, 200, true, `لیست فایل‌های ${fileType} کاربر دریافت شد`, formattedFiles);

    } catch (error) {
      console.error("❌ Get user files by type failed:", error.message);
      return this.response(res, 500, false, "خطا در دریافت لیست فایل‌های کاربر", null, error);
    }
  }

  async uploadAvatar(req, res) {
    let processedPath = null;
    try {
      console.log('=== Avatar Upload Debug ===');
      console.log('Request user:', req.user);
      console.log('Request file:', req.file);
      console.log('Request body:', req.body);
      console.log('===================');

      if (!req.file) {
        return this.response(res, 400, false, "هیچ فایلی آپلود نشده است");
      }

      if (!req.user || !req.user.userId) {
        console.error('❌ Authentication failed - req.user:', req.user);
        return this.response(res, 401, false, "برای آپلود فایل باید وارد حساب کاربری خود شوید");
      }

      // بررسی نوع فایل (فقط تصاویر)
      if (!req.file.mimetype.startsWith('image/')) {
        return this.response(res, 400, false, "فقط فایل‌های تصویری مجاز است");
      }

      // تعیین کاربر هدف (اگر userId ارسال شده باشد، از آن استفاده می‌کنیم)
      const targetUserId = req.body.userId ? parseInt(req.body.userId) : req.user.userId;

      const asset = await resolveUploadAsset(req.file, { watermark: false });
      processedPath = asset.processedPath;

      const { relativePath } = await ftpService.uploadFile(
        asset.localPath,
        'users',
        asset.fileName,
        'avatars'
      );

      safeUnlink(req.file.path);
      if (processedPath && processedPath !== req.file.path) safeUnlink(processedPath);

      const file = await File.create({
        fileName: asset.fileName,
        originalName: asset.originalName,
        path: relativePath,
        mimeType: asset.mimeType,
        size: asset.size,
        module: 'users',
        fileType: 'avatars',
        entityId: targetUserId,
        uploaderId: req.user.userId,
      });

      // به‌روزرسانی آواتار کاربر
      const User = require('../user/user/model');
      await User.update(
        { avatar: file.downloadUrl },
        { where: { id: targetUserId } }
      );

      console.log("✅ Avatar uploaded successfully:", file.fileName);
      return this.response(res, 201, true, "آواتار با موفقیت آپلود شد", {
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        downloadUrl: file.downloadUrl,
        mimeType: file.mimeType,
        size: file.size,
        uploadDate: file.createdAt
      });

    } catch (error) {
      if (req.file) safeUnlink(req.file.path);
      if (processedPath) safeUnlink(processedPath);
      console.error("❌ Avatar upload failed:", error.message);
      return this.response(res, 500, false, "خطا در آپلود آواتار", null, error);
    }
  }

  async uploadUserDocument(req, res) {
    try {
      console.log('=== User Document Upload Debug ===');
      console.log('Request user:', req.user);
      console.log('Request file:', req.file);
      console.log('===================');

      if (!req.file) {
        return this.response(res, 400, false, "هیچ فایلی آپلود نشده است");
      }

      if (!req.user || !req.user.userId) {
        return this.response(res, 401, false, "برای آپلود فایل باید وارد حساب کاربری خود شوید");
      }

      // آپلود به FTP
      const { relativePath } = await ftpService.uploadFile(
        req.file.path,
        'users',
        req.file.filename,
        'documents'
      );

      // حذف فایل موقت
      fs.unlinkSync(req.file.path);

      // ذخیره در دیتابیس
      const file = await File.create({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        path: relativePath,
        mimeType: req.file.mimetype,
        size: req.file.size,
        module: 'users',
        fileType: 'documents',
        entityId: req.user.userId,
        uploaderId: req.user.userId,
      });

      console.log("✅ User document uploaded successfully:", file.fileName);
      return this.response(res, 201, true, "مدرک با موفقیت آپلود شد", {
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        downloadUrl: file.downloadUrl,
        mimeType: file.mimeType,
        size: file.size,
        uploadDate: file.createdAt
      });

    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error("❌ User document upload failed:", error.message);
      return this.response(res, 500, false, "خطا در آپلود مدرک", null, error);
    }
  }
}

module.exports = new FileController(); 