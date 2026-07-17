const service = require("./service");

function sendJsonDownload(res, filename, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(body);
}

const listSections = async (_req, res) => {
  res.json({ success: true, data: service.listSections() });
};

const exportSection = async (req, res) => {
  try {
    const section = req.params.section;
    const payload = await service.exportSection(section);
    const stamp = new Date().toISOString().slice(0, 10);
    sendJsonDownload(res, `zareoon-${section}-${stamp}.json`, payload);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || "Export failed" });
  }
};

const exportFull = async (_req, res) => {
  try {
    const payload = await service.exportFull();
    const stamp = new Date().toISOString().slice(0, 10);
    sendJsonDownload(res, `zareoon-full-backup-${stamp}.json`, payload);
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || "Export failed" });
  }
};

function parseImportBody(req) {
  if (req.file && req.file.buffer) {
    const text = req.file.buffer.toString("utf8");
    return JSON.parse(text);
  }
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }
  if (req.body && req.body.payload) {
    return typeof req.body.payload === "string" ? JSON.parse(req.body.payload) : req.body.payload;
  }
  return req.body;
}

const importSection = async (req, res) => {
  try {
    const section = req.params.section;
    const mode = String(req.query.mode || req.body?.mode || "merge").toLowerCase();
    if (!["merge", "replace"].includes(mode)) {
      return res.status(400).json({ success: false, message: "mode must be merge or replace" });
    }
    const payload = parseImportBody(req);
    const result = await service.importSection(section, payload, { mode });
    res.json({ success: true, data: result });
  } catch (error) {
    const status = error.status || (error instanceof SyntaxError ? 400 : 500);
    res.status(status).json({
      success: false,
      message: error.message || "Import failed",
    });
  }
};

const importFull = async (req, res) => {
  try {
    const mode = String(req.query.mode || req.body?.mode || "merge").toLowerCase();
    if (!["merge", "replace"].includes(mode)) {
      return res.status(400).json({ success: false, message: "mode must be merge or replace" });
    }
    const payload = parseImportBody(req);
    const result = await service.importFull(payload, { mode });
    res.json({ success: true, data: result });
  } catch (error) {
    const status = error.status || (error instanceof SyntaxError ? 400 : 500);
    res.status(status).json({
      success: false,
      message: error.message || "Import failed",
    });
  }
};

module.exports = {
  listSections,
  exportSection,
  exportFull,
  importSection,
  importFull,
};
