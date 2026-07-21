const fs = require("fs");
const path = require("path");

const CATALOG_PATH = path.join(
  __dirname,
  "../core/database/zareoon-reserved-usernames.v1.json"
);

let cached = null;

function normalizeToken(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/\.+/g, ".")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
}

function flattenReservedObject(reserved) {
  const out = [];
  if (!reserved || typeof reserved !== "object") return out;
  for (const value of Object.values(reserved)) {
    if (Array.isArray(value)) {
      out.push(...value);
    } else if (value && typeof value === "object") {
      out.push(...flattenReservedObject(value));
    }
  }
  return out;
}

function loadCatalogFile() {
  if (cached) return cached;
  const raw = fs.readFileSync(CATALOG_PATH, "utf8");
  const doc = JSON.parse(raw);
  const flat = [
    ...new Set(
      flattenReservedObject(doc.reserved)
        .map(normalizeToken)
        .filter((s) => s && s.length >= 2)
    ),
  ].sort();

  cached = {
    doc,
    flat,
    flatSet: new Set(flat),
    matching: doc.matching || {},
    version: doc.version || "1.0.0",
    name: doc.name || "zareoon-reserved-usernames",
    path: CATALOG_PATH,
  };
  return cached;
}

function getDefaultReservedSlugs() {
  return loadCatalogFile().flat;
}

function getReservedSlugSet() {
  return loadCatalogFile().flatSet;
}

function getMatchingRules() {
  return loadCatalogFile().matching || {};
}

function matchesBlockedPatterns(slug, matching = getMatchingRules()) {
  const s = String(slug || "").toLowerCase();
  if (!s) return false;
  const prefixes = matching.blockPrefixPatterns || [];
  const suffixes = matching.blockSuffixPatterns || [];
  if (prefixes.some((p) => s.startsWith(String(p).toLowerCase()))) return true;
  if (suffixes.some((p) => s.endsWith(String(p).toLowerCase()))) return true;
  return false;
}

function isInDefaultCatalog(slug) {
  return getReservedSlugSet().has(normalizeToken(slug));
}

/**
 * استخراج لیست اسلاگ از سند ایمپورت (فرمت کامل کاتالوگ یا { slugs: [] })
 */
function extractSlugsFromImportPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw Object.assign(new Error("فایل JSON نامعتبر است"), { statusCode: 400 });
  }

  if (Array.isArray(payload)) {
    return [...new Set(payload.map(normalizeToken).filter((s) => s && s.length >= 2))].sort();
  }

  if (Array.isArray(payload.slugs)) {
    return [...new Set(payload.slugs.map(normalizeToken).filter((s) => s && s.length >= 2))].sort();
  }

  if (payload.reserved && typeof payload.reserved === "object") {
    return [
      ...new Set(
        flattenReservedObject(payload.reserved)
          .map(normalizeToken)
          .filter((s) => s && s.length >= 2)
      ),
    ].sort();
  }

  throw Object.assign(
    new Error("فرمت پشتیبانی نمی‌شود. از کاتالوگ کامل یا { slugs: [...] } استفاده کنید."),
    { statusCode: 400 }
  );
}

function buildExportDocument(slugs, meta = {}) {
  const base = loadCatalogFile().doc;
  return {
    $schema: base.$schema,
    name: base.name || "zareoon-reserved-usernames",
    version: meta.version || base.version || "1.0.0",
    description: base.description,
    exportedAt: new Date().toISOString(),
    source: meta.source || "database",
    normalization: base.normalization,
    validation: base.validation,
    reserved: {
      ...(base.reserved || {}),
      managedBlockedSlugs: Array.isArray(slugs) ? [...slugs].sort() : [],
    },
    matching: base.matching,
    slugs: Array.isArray(slugs) ? [...slugs].sort() : [],
  };
}

function reloadCatalogCache() {
  cached = null;
  return loadCatalogFile();
}

module.exports = {
  CATALOG_PATH,
  normalizeToken,
  flattenReservedObject,
  loadCatalogFile,
  getDefaultReservedSlugs,
  getReservedSlugSet,
  getMatchingRules,
  matchesBlockedPatterns,
  isInDefaultCatalog,
  extractSlugsFromImportPayload,
  buildExportDocument,
  reloadCatalogCache,
};
