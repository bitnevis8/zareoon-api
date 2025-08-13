const { Model, DataTypes } = require("sequelize");
const sequelize = require("../../core/database/mysql/connection");
const config = require("config");

class File extends Model {}

File.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    originalName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    module: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "نام ماژولی که فایل به آن تعلق دارد (مثلاً profile, property, etc.)",
    },
    entityId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "شناسه رکورد مرتبط در ماژول مربوطه",
    },
    uploaderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    downloadUrl: {
      type: DataTypes.VIRTUAL,
      get() {
        return `${config.get("UPLOAD.DOWNLOAD_HOST")}/${this.path}`;
      },
    },
  },
  {
    sequelize,
    modelName: "File",
    tableName: "files",
    timestamps: true,
  }
);

module.exports = File; 