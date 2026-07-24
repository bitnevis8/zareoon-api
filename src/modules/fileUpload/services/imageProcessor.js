const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

/** حداکثر ضلع بلندتر — کیفیت خوب با حجم کمتر */
const MAX_EDGE = 1600;
/** کیفیت WebP: تعادل حجم / وضوح (effort بالاتر = فشرده‌تر و کندتر) */
const WEBP_QUALITY = 78;
const WEBP_EFFORT = 6;

function isProcessableImage(mimeType = "") {
  const m = String(mimeType).toLowerCase();
  if (!m.startsWith("image/")) return false;
  // SVG را دست نمی‌زنیم
  if (m.includes("svg")) return false;
  return true;
}

function buildWatermarkSvg(width, height) {
  const short = Math.min(width, height);
  const fontSize = Math.max(13, Math.min(36, Math.round(short * 0.038)));
  const pad = Math.max(8, Math.round(fontSize * 0.7));
  const x = width - pad;
  const y = height - pad;

  // سایه تیره + متن روشن برای خوانایی روی پس‌زمینه روشن و تیره
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${x + 1}" y="${y + 1}" text-anchor="end"
    font-family="Arial, Helvetica, DejaVu Sans, sans-serif"
    font-size="${fontSize}" font-weight="700"
    fill="rgba(0,0,0,0.40)">Zareoon.com</text>
  <text x="${x}" y="${y}" text-anchor="end"
    font-family="Arial, Helvetica, DejaVu Sans, sans-serif"
    font-size="${fontSize}" font-weight="700"
    fill="rgba(255,255,255,0.62)">Zareoon.com</text>
</svg>`);
}

/**
 * فشرده‌سازی شدید با حفظ کیفیت نسبی → WebP + واترمارک Zareoon.com
 * @returns {{ outputPath: string, fileName: string, mimeType: string, size: number } | null}
 */
async function processUploadImage(inputPath, { watermark = true, maxEdge = MAX_EDGE } = {}) {
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const fileName = `${base}.webp`;
  const outputPath = path.join(dir, fileName);

  let pipeline = sharp(inputPath, { failOn: "none" }).rotate();

  const meta = await pipeline.metadata();
  const width = meta.width || maxEdge;
  const height = meta.height || maxEdge;

  // بعد از rotate دوباره pipeline بسازیم تا متادیتا درست باشد
  pipeline = sharp(inputPath, { failOn: "none" }).rotate();

  if (width > maxEdge || height > maxEdge) {
    pipeline = pipeline.resize(maxEdge, maxEdge, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  // ابعاد نهایی برای واترمارک
  const resized = await pipeline.toBuffer({ resolveWithObject: true });
  const outW = resized.info.width || width;
  const outH = resized.info.height || height;

  let final = sharp(resized.data);
  if (watermark) {
    final = final.composite([
      {
        input: buildWatermarkSvg(outW, outH),
        top: 0,
        left: 0,
      },
    ]);
  }

  await final
    .webp({
      quality: WEBP_QUALITY,
      effort: WEBP_EFFORT,
      smartSubsample: true,
    })
    .toFile(outputPath);

  const stat = fs.statSync(outputPath);
  return {
    outputPath,
    fileName,
    mimeType: "image/webp",
    size: stat.size,
  };
}

module.exports = {
  isProcessableImage,
  processUploadImage,
  MAX_EDGE,
  WEBP_QUALITY,
};
