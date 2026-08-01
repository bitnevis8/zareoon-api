const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

/** پیش‌فرض‌ها — در صورت نبود تنظیمات سایت */
const MAX_EDGE = 1600;
const WEBP_QUALITY = 78;
const WEBP_EFFORT = 6;

const LOGO_CANDIDATES = [
  path.join(__dirname, "../../../../assets/logo.png"),
  path.join(__dirname, "../../../../assets/logo.webp"),
  path.join(process.cwd(), "assets/logo.png"),
];

function resolveLogoPath() {
  for (const p of LOGO_CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function isProcessableImage(mimeType = "") {
  const m = String(mimeType).toLowerCase();
  if (!m.startsWith("image/")) return false;
  if (m.includes("svg")) return false;
  return true;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * واترمارک: لوگو + متن در گوشه پایین
 */
async function buildWatermarkOverlay(width, height, opts = {}) {
  const {
    text = "زارعون",
    opacity = 0.62,
    position = "bottom-right",
    logoEnabled = true,
    textEnabled = true,
  } = opts;

  const short = Math.min(width, height);
  const logoSize = Math.max(28, Math.min(72, Math.round(short * 0.08)));
  const fontSize = Math.max(12, Math.min(28, Math.round(short * 0.032)));
  const pad = Math.max(10, Math.round(short * 0.02));
  const gap = Math.max(6, Math.round(fontSize * 0.45));

  const layers = [];
  let logoBuf = null;
  let logoW = 0;
  let logoH = 0;

  if (logoEnabled) {
    const logoPath = resolveLogoPath();
    if (logoPath) {
      try {
        logoBuf = await sharp(logoPath)
          .resize(logoSize, logoSize, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        const meta = await sharp(logoBuf).metadata();
        logoW = meta.width || logoSize;
        logoH = meta.height || logoSize;
      } catch (e) {
        console.warn("watermark logo load failed:", e.message);
        logoBuf = null;
      }
    }
  }

  const textH = textEnabled && text ? fontSize : 0;
  const blockW = Math.max(logoW, textEnabled && text ? Math.round(String(text).length * fontSize * 0.55) : 0);
  const blockH = (logoBuf ? logoH : 0) + (logoBuf && textH ? gap : 0) + textH;

  const isLeft = position === "bottom-left";
  const left = isLeft ? pad : Math.max(0, width - pad - Math.max(blockW, logoW));
  const top = Math.max(0, height - pad - blockH);

  if (logoBuf) {
    layers.push({ input: logoBuf, left: Math.round(left), top: Math.round(top) });
  }

  if (textEnabled && text) {
    const textY = top + (logoBuf ? logoH + gap : 0) + fontSize;
    const textX = isLeft ? left : left + Math.max(blockW, logoW);
    const anchor = isLeft ? "start" : "end";
    const alpha = Math.min(1, Math.max(0.15, Number(opacity) || 0.62));
    const fill = `rgba(255,255,255,${alpha.toFixed(2)})`;
    const shadow = `rgba(0,0,0,${Math.min(0.55, alpha * 0.7).toFixed(2)})`;
    const safe = escapeXml(text);

    const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <text x="${textX + 1}" y="${textY + 1}" text-anchor="${anchor}"
    font-family="Tahoma, Arial, Helvetica, DejaVu Sans, sans-serif"
    font-size="${fontSize}" font-weight="700"
    fill="${shadow}">${safe}</text>
  <text x="${textX}" y="${textY}" text-anchor="${anchor}"
    font-family="Tahoma, Arial, Helvetica, DejaVu Sans, sans-serif"
    font-size="${fontSize}" font-weight="700"
    fill="${fill}">${safe}</text>
</svg>`);
    layers.push({ input: svg, top: 0, left: 0 });
  }

  return layers;
}

/**
 * فشرده‌سازی → WebP + واترمارک اختیاری طبق تنظیمات سایت
 * @returns {{ outputPath: string, fileName: string, mimeType: string, size: number } | null}
 */
async function processUploadImage(inputPath, options = {}) {
  const {
    watermark = true,
    maxEdge = MAX_EDGE,
    webpQuality = WEBP_QUALITY,
    webpEffort = WEBP_EFFORT,
    processImages = true,
    watermarkLogoEnabled = true,
    watermarkTextEnabled = true,
    watermarkText = "زارعون",
    watermarkOpacity = 0.62,
    watermarkPosition = "bottom-right",
  } = options;

  if (processImages === false) {
    return null;
  }

  const absInput = path.resolve(inputPath);
  const dir = path.dirname(absInput);
  const base = path.basename(absInput, path.extname(absInput));
  const fileName = `${base}.out.webp`;
  const outputPath = path.join(dir, fileName);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const inputBuffer = fs.readFileSync(absInput);

  let pipeline = sharp(inputBuffer, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  const width = meta.width || maxEdge;
  const height = meta.height || maxEdge;

  pipeline = sharp(inputBuffer, { failOn: "none" }).rotate();

  if (width > maxEdge || height > maxEdge) {
    pipeline = pipeline.resize(maxEdge, maxEdge, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const resized = await pipeline.toBuffer({ resolveWithObject: true });
  const outW = resized.info.width || width;
  const outH = resized.info.height || height;

  let final = sharp(resized.data);
  if (watermark) {
    const overlays = await buildWatermarkOverlay(outW, outH, {
      text: watermarkText,
      opacity: watermarkOpacity,
      position: watermarkPosition,
      logoEnabled: watermarkLogoEnabled,
      textEnabled: watermarkTextEnabled,
    });
    if (overlays.length) {
      final = final.composite(overlays);
    }
  }

  const outBuffer = await final
    .webp({
      quality: webpQuality,
      effort: webpEffort,
      smartSubsample: true,
    })
    .toBuffer();

  fs.writeFileSync(outputPath, outBuffer);

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
