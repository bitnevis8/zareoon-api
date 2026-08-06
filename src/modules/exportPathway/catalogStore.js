const { getJsonSetting, setJsonSetting } = require("../siteSetting/service");
const { FAMILY_TEMPLATES } = require("./engine/templates");
const { STEPS } = require("./engine/stepLibrary");
const { PHASES } = require("./constants");
const {
  ROOT_FAMILY_MAP,
  L2_FAMILY_MAP,
  ROOT_COVERAGE,
} = require("./engine/resolveFamily");

const SETTING_KEY = "exportPathwayCatalog";

let cache = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultCatalog() {
  return {
    version: 1,
    updatedAt: null,
    families: clone(FAMILY_TEMPLATES),
    steps: clone(STEPS),
    phases: clone(PHASES),
    rootFamilyMap: clone(ROOT_FAMILY_MAP),
    l2FamilyMap: clone(L2_FAMILY_MAP),
    rootCoverage: clone(ROOT_COVERAGE),
  };
}

function normalizeStep(code, raw = {}) {
  const base = STEPS[code] || {};
  const merged = { ...base, ...raw, code: String(raw.code || code || "").trim() };
  if (!merged.code) return null;
  return {
    code: merged.code,
    title: String(merged.title || merged.code).trim(),
    description: String(merged.description || "").trim(),
    phase: String(merged.phase || "prepare").trim(),
    order: Number.isFinite(Number(merged.order)) ? Number(merged.order) : 100,
    required: merged.required !== false,
    dependencies: Array.isArray(merged.dependencies) ? merged.dependencies.map(String) : [],
    defaultDocuments: Array.isArray(merged.defaultDocuments)
      ? merged.defaultDocuments.map(String)
      : [],
    requiredOutput: merged.requiredOutput ? String(merged.requiredOutput) : null,
    serviceKeys: Array.isArray(merged.serviceKeys) ? merged.serviceKeys.map(String) : [],
    toolLinks: Array.isArray(merged.toolLinks) ? merged.toolLinks : [],
    responsibleParty: merged.responsibleParty ? String(merged.responsibleParty) : "seller",
    estimatedDuration: merged.estimatedDuration ? String(merged.estimatedDuration) : null,
    warnings: Array.isArray(merged.warnings) ? merged.warnings.map(String) : [],
    helpContent: merged.helpContent ? String(merged.helpContent) : "",
  };
}

function normalizeFamily(id, raw = {}) {
  const base = FAMILY_TEMPLATES[id] || {};
  const fid = String(raw.id || id || "").trim();
  if (!fid) return null;
  const stepCodes = Array.isArray(raw.stepCodes)
    ? raw.stepCodes.map(String)
    : Array.isArray(base.stepCodes)
      ? base.stepCodes
      : [];
  return {
    id: fid,
    titleFa: String(raw.titleFa || base.titleFa || fid).trim(),
    titleEn: String(raw.titleEn || base.titleEn || fid).trim(),
    descriptionFa: String(raw.descriptionFa || base.descriptionFa || "").trim(),
    stepCodes,
    defaultFlags:
      raw.defaultFlags && typeof raw.defaultFlags === "object" ? { ...raw.defaultFlags } : {},
  };
}

function normalizeCatalog(raw) {
  const defaults = defaultCatalog();
  if (!raw || typeof raw !== "object") return defaults;

  const stepsIn = raw.steps && typeof raw.steps === "object" ? raw.steps : defaults.steps;
  const steps = {};
  for (const [code, step] of Object.entries(stepsIn)) {
    const n = normalizeStep(code, step);
    if (n) steps[n.code] = n;
  }
  // ensure at least default steps exist if admin wiped everything
  if (!Object.keys(steps).length) Object.assign(steps, defaults.steps);

  const familiesIn =
    raw.families && typeof raw.families === "object" ? raw.families : defaults.families;
  const families = {};
  for (const [id, fam] of Object.entries(familiesIn)) {
    const n = normalizeFamily(id, fam);
    if (!n) continue;
    // drop unknown step codes from family
    n.stepCodes = n.stepCodes.filter((c) => steps[c]);
    families[n.id] = n;
  }
  if (!Object.keys(families).length) Object.assign(families, defaults.families);
  if (!families.general) families.general = defaults.families.general;

  const rootFamilyMap =
    raw.rootFamilyMap && typeof raw.rootFamilyMap === "object"
      ? Object.fromEntries(
          Object.entries(raw.rootFamilyMap).map(([k, v]) => [String(k), String(v)])
        )
      : defaults.rootFamilyMap;

  const l2FamilyMap =
    raw.l2FamilyMap && typeof raw.l2FamilyMap === "object"
      ? Object.fromEntries(
          Object.entries(raw.l2FamilyMap).map(([k, v]) => [String(k), String(v)])
        )
      : defaults.l2FamilyMap;

  const rootCoverage = Array.isArray(raw.rootCoverage)
    ? raw.rootCoverage
    : defaults.rootCoverage;

  const phases = Array.isArray(raw.phases) && raw.phases.length ? raw.phases : defaults.phases;

  return {
    version: Number(raw.version) || defaults.version,
    updatedAt: raw.updatedAt || null,
    families,
    steps,
    phases,
    rootFamilyMap,
    l2FamilyMap,
    rootCoverage,
  };
}

function getCatalogSync() {
  return cache || defaultCatalog();
}

async function ensureCatalogLoaded() {
  if (cache) return cache;
  const raw = await getJsonSetting(SETTING_KEY, null);
  cache = normalizeCatalog(raw);
  return cache;
}

async function getCatalog() {
  return ensureCatalogLoaded();
}

async function saveCatalog(payload) {
  const next = normalizeCatalog({
    ...payload,
    version: Number(payload?.version) || 1,
    updatedAt: new Date().toISOString(),
  });
  await setJsonSetting(SETTING_KEY, next);
  cache = next;
  return cache;
}

async function resetCatalogToDefaults() {
  const next = defaultCatalog();
  next.updatedAt = new Date().toISOString();
  await setJsonSetting(SETTING_KEY, next);
  cache = next;
  return cache;
}

function invalidateCatalogCache() {
  cache = null;
}

function getFamilyTemplate(familyId) {
  const cat = getCatalogSync();
  return cat.families[familyId] || cat.families.general || FAMILY_TEMPLATES.general;
}

function getStepDefinition(code) {
  const cat = getCatalogSync();
  const step = cat.steps[code];
  return step ? { ...step } : null;
}

function listFamiliesPublic() {
  return Object.values(getCatalogSync().families).map((f) => ({
    id: f.id,
    titleFa: f.titleFa,
    titleEn: f.titleEn,
    descriptionFa: f.descriptionFa,
    stepCount: (f.stepCodes || []).length,
  }));
}

module.exports = {
  SETTING_KEY,
  defaultCatalog,
  normalizeCatalog,
  getCatalogSync,
  ensureCatalogLoaded,
  getCatalog,
  saveCatalog,
  resetCatalogToDefaults,
  invalidateCatalogCache,
  getFamilyTemplate,
  getStepDefinition,
  listFamiliesPublic,
};
