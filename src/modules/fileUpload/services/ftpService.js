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
        host: config.get("FTP.HOST"),
        user: config.get("FTP.USER"),
        password: config.get("FTP.PASSWORD"),
        secure: config.get("FTP.SECURE")
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

      const modules = ["property", "project", "agency", "user"];
      const types = ["images", "documents", "videos"];

      for (const module of modules) {
        for (const type of types) {
          const fullPath = path.join("/", module, type);
          await this.createDirectory(fullPath);
          console.log("✅ Initialized directory structure for", module + ":", fullPath);
        }
      }
    } catch (err) {
      console.error("❌ Failed to initialize directory structure:", err.message);
      throw err;
    } finally {
      this.client.close();
    }
  }

  async uploadFile(localPath, remotePath) {
    try {
      await this.connect();
      await this.createDirectory(path.dirname(remotePath));
      await this.client.uploadFrom(localPath, remotePath);
      console.log("✅ File uploaded successfully to FTP:", remotePath);
    } catch (err) {
      console.error("❌ FTP upload failed:", err.message);
      throw err;
    } finally {
      this.client.close();
    }
  }

  async deleteFile(fullPath) {
    try {
      await this.connect();
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