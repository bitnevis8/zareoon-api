const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const MAX_EDGE = 1280;
const JPEG_QUALITY = 82;

/**
 * فشرده‌سازی تصویر پیام: چرخش خودکار، محدودیت ابعاد، خروجی JPEG بهینه
 */
async function optimizeMessageImage(inputPath) {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(dir, `${base}-opt.jpg`);

  const meta = await sharp(inputPath).metadata();
  const pipeline = sharp(inputPath).rotate();

  if ((meta.width || 0) > MAX_EDGE || (meta.height || 0) > MAX_EDGE) {
    pipeline.resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true });
  }

  await pipeline
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
    .toFile(outputPath);

  const stat = fs.statSync(outputPath);
  return { outputPath, mimeType: "image/jpeg", size: stat.size };
}

module.exports = { optimizeMessageImage };
