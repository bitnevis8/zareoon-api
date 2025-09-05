const ftp = require("basic-ftp");
const config = require("config");
const path = require("path");

class FTPService {
  constructor() {
    this.client = new ftp.Client();
    this.client.ftp.verbose = true;
  }

  async connect() {
    try {
      await this.client.access({
        host: config.get("UPLOAD.FTP.host"),
        user: config.get("UPLOAD.FTP.user"),
        password: config.get("UPLOAD.FTP.password"),
        secure: config.get("UPLOAD.FTP.secure"),
        port: config.get("UPLOAD.FTP.port"),
        // تنظیمات برای self-signed certificate
        secureOptions: {
          rejectUnauthorized: false
        }
      });
      console.log("✅ FTP connection established successfully");
    } catch (err) {
      console.error("❌ FTP connection failed:", err.message);
      throw err;
    }
  }

  async createDirectory(dirPath) {
    try {
      const parts = dirPath.split("/").filter(Boolean);
      let currentPath = "";

      for (const part of parts) {
        currentPath += "/" + part;
        try {
          await this.client.ensureDir(currentPath);
          console.log("✅ Created new directory:", currentPath);
        } catch (err) {
          console.warn("⚠️ Directory operation for", currentPath + ":", err.message);
          // اگر دایرکتوری وجود داشته باشد، خطا را نادیده می‌گیریم
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async initializeDirectoryStructure() {
    try {
      await this.connect();

      const structure = {
        'users': ['avatars', 'documents', 'temp'],
        'products': ['images', 'videos', 'documents', 'icons'],
        'inventory': ['images', 'videos', 'documents', 'certificates'],
        'orders': ['invoices', 'receipts', 'contracts', 'shipping'],
        'locations': ['images', 'maps', 'documents'],
        'attributes': ['documents'],
        'system': ['temp', 'backups', 'logs'],
        'shared': ['templates', 'icons', 'banners', 'default']
      };

      // ایجاد ساختار پوشه‌ها
      await this.createNestedStructure(structure);
      
    } catch (err) {
      console.error("❌ Failed to initialize directory structure:", err.message);
      throw err;
    } finally {
      this.client.close();
    }
  }

  async createNestedStructure(structure) {
    const basePath = config.get("UPLOAD.FTP.basePath") || "/public_html";
    for (const [module, types] of Object.entries(structure)) {
      for (const type of types) {
        // استفاده از / به جای path.join برای FTP
        const fullPath = `${basePath}/media/${module}/${type}`;
        await this.createDirectory(fullPath);
        console.log("✅ Initialized directory structure for", module + ":", fullPath);
      }
    }
  }

  async uploadFile(localPath, module, fileName, fileType = 'images') {
    try {
      await this.connect();
      
      // ایجاد مسیر کامل بر اساس ساختار جدید (شامل public_html)
      const basePath = config.get("UPLOAD.FTP.basePath") || "/public_html";
      const remotePath = `${basePath}/media/${module}/${fileType}/${fileName}`;
      const remoteDir = `${basePath}/media/${module}/${fileType}`;
      await this.createDirectory(remoteDir);
      await this.client.uploadFrom(localPath, remotePath);
      
      // مسیر نسبی برای ذخیره در دیتابیس (بدون public_html)
      const relativePath = `media/${module}/${fileType}/${fileName}`;
      
      console.log("✅ File uploaded successfully to FTP:", remotePath);
      return { remotePath, relativePath };
    } catch (err) {
      console.error("❌ FTP upload failed:", err.message);
      throw err;
    } finally {
      this.client.close();
    }
  }

  async deleteFile(relativePath) {
    try {
      await this.connect();
      const basePath = config.get("UPLOAD.FTP.basePath") || "/public_html";
      const fullPath = `${basePath}/${relativePath}`;
      await this.client.remove(fullPath);
      console.log("✅ File deleted successfully from FTP:", fullPath);
    } catch (err) {
      console.error("❌ FTP delete failed:", err.message);
      throw err;
    } finally {
      this.client.close();
    }
  }
}

module.exports = new FTPService(); 