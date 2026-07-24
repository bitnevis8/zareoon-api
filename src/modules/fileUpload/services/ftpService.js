const ftp = require("basic-ftp");
const config = require("config");
const path = require("path");

function getRootFolder() {
  try {
    return config.get("UPLOAD.FTP.rootFolder") || "zareoon";
  } catch {
    return "zareoon";
  }
}

function getBasePath() {
  try {
    return config.get("UPLOAD.FTP.basePath") || "/public_html";
  } catch {
    return "/public_html";
  }
}

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
        secureOptions: {
          rejectUnauthorized: false,
        },
      });
      console.log("✅ FTP connection established successfully");
    } catch (err) {
      console.error("❌ FTP connection failed:", err.message);
      throw err;
    }
  }

  buildRemoteDir(module, fileType) {
    const basePath = getBasePath();
    const rootFolder = getRootFolder();
    return `${basePath}/${rootFolder}/${module}/${fileType}`;
  }

  buildRelativePath(module, fileType, fileName) {
    const rootFolder = getRootFolder();
    return `${rootFolder}/${module}/${fileType}/${fileName}`;
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
        users: ["avatars", "documents", "temp"],
        accounts: ["images", "covers"],
        products: ["images", "videos", "documents", "icons"],
        inventory: ["images", "videos", "documents", "certificates"],
        orders: ["invoices", "receipts", "contracts", "shipping"],
        locations: ["images", "maps", "documents"],
        attributes: ["documents"],
        messages: ["images"],
        "supplier-posts": ["images"],
        system: ["temp", "backups", "logs"],
        shared: ["templates", "icons", "banners", "default"],
      };

      await this.createNestedStructure(structure);
    } catch (err) {
      console.error("❌ Failed to initialize directory structure:", err.message);
      throw err;
    } finally {
      this.client.close();
    }
  }

  async createNestedStructure(structure) {
    const rootFolder = getRootFolder();
    for (const [module, types] of Object.entries(structure)) {
      for (const type of types) {
        const fullPath = this.buildRemoteDir(module, type);
        await this.createDirectory(fullPath);
        console.log("✅ Initialized directory structure for", module + ":", fullPath);
      }
    }
    console.log(`✅ All upload directories initialized under /${rootFolder}`);
  }

  async uploadFile(localPath, module, fileName, fileType = "images") {
    try {
      await this.connect();

      const remoteDir = this.buildRemoteDir(module, fileType);
      const remotePath = `${remoteDir}/${fileName}`;
      const relativePath = this.buildRelativePath(module, fileType, fileName);

      await this.createDirectory(remoteDir);
      await this.client.uploadFrom(localPath, remotePath);

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
      const basePath = getBasePath();
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
