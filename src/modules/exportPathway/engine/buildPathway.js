const { TEMPLATE_VERSION, PHASES: DEFAULT_PHASES, DISCLAIMER_FA } = require("../constants");
const { RULES } = require("./rules");
const { applyRules } = require("./evaluateRules");
const { resolveExportFamily, listFamiliesPublic, ROOT_COVERAGE } = require("./resolveFamily");
const { applyDestinationHints } = require("./countryHints");
const { resolveServiceLinks } = require("./serviceCategoryMap");
const { getStepDefinition, getFamilyTemplate, getCatalogSync } = require("../catalogStore");

function getPhases() {
  const phases = getCatalogSync().phases;
  return Array.isArray(phases) && phases.length ? phases : DEFAULT_PHASES;
}

function sortSteps(steps) {
  const phaseOrder = Object.fromEntries(getPhases().map((p) => [p.id, p.order]));
  return [...steps].sort((a, b) => {
    const po = (phaseOrder[a.phase] || 99) - (phaseOrder[b.phase] || 99);
    if (po !== 0) return po;
    return (a.order || 0) - (b.order || 0);
  });
}

function computeInitialStatuses(steps) {
  const byCode = Object.fromEntries(steps.map((s) => [s.code, s]));
  const completed = new Set();

  return steps.map((step) => {
    if (step.status === "not_applicable") return step;
    const deps = step.dependencies || [];
    const depsMet = deps.every((d) => {
      const dep = byCode[d];
      if (!dep) return true;
      if (dep.status === "not_applicable") return true;
      return completed.has(d) || dep.status === "completed";
    });
    if (!depsMet) {
      return { ...step, status: "locked" };
    }
    if (!step.required) {
      return { ...step, status: step.status === "optional" ? "optional" : "optional" };
    }
    return { ...step, status: "ready" };
  });
}

/**
 * Build deterministic export pathway (pure function).
 * @param {object} input
 */
function buildPathway(input = {}) {
  const {
    product = {},
    rootCategoryId = null,
    tradeCompliance = {},
    originCountry = "IR",
    originCity = null,
    destinationCountry = null,
    destinationCity = null,
    quantity = null,
    unit = null,
    transportMode = "unspecified",
    incoterm = "unspecified",
    paymentMethod = "unspecified",
    packagingType = null,
    hints = {},
    l2Slug = null,
    slugPath = [],
  } = input;

  const { familyId, template, flags, matchedBy, l2Slug: resolvedL2 } = resolveExportFamily({
    product,
    rootCategoryId,
    tradeCompliance,
    hints,
    l2Slug,
    slugPath,
  });

  const ctx = {
    flags,
    tradeCompliance: tradeCompliance || {},
    transportMode: transportMode || "unspecified",
    incoterm: incoterm || "unspecified",
    paymentMethod: paymentMethod || "unspecified",
    originCountry,
    destinationCountry,
    packagingType,
    familyId,
  };

  const { stepCodes, mutations, matchedRuleIds } = applyRules({
    baseStepCodes: template.stepCodes,
    rules: RULES,
    ctx,
  });

  const stepsByCode = {};
  for (const code of stepCodes) {
    const def = getStepDefinition(code);
    if (!def) continue;
    const step = {
      ...def,
      documents: [...(def.defaultDocuments || [])],
      warnings: [...(def.warnings || [])],
      serviceLinks: resolveServiceLinks(def.serviceKeys || []),
      required: Boolean(def.required),
      status: "ready",
    };
    if (mutations.requireSet.has(code)) step.required = true;
    if (mutations.optionalSet.has(code)) {
      step.required = false;
      step.status = "optional";
    }
    if (mutations.docsByStep[code]) {
      step.documents = [...new Set([...step.documents, ...mutations.docsByStep[code]])];
    }
    if (mutations.warningsByStep[code]) {
      step.warnings = [...new Set([...step.warnings, ...mutations.warningsByStep[code]])];
    }
    stepsByCode[code] = step;
  }

  const destMeta = applyDestinationHints({
    destinationCountry,
    familyId,
    stepsByCode,
  });

  // Keep only dependencies that exist in the final set
  for (const step of Object.values(stepsByCode)) {
    step.dependencies = (step.dependencies || []).filter((d) => stepsByCode[d]);
  }

  let steps = sortSteps(Object.values(stepsByCode));
  steps = computeInitialStatuses(steps);

  // Re-number sortOrder for persistence
  steps = steps.map((s, idx) => ({
    ...s,
    sortOrder: idx + 1,
  }));

  const familyTemplate = getFamilyTemplate(familyId);
  const catalog = getCatalogSync();

  return {
    templateVersion: TEMPLATE_VERSION,
    exportFamily: familyId,
    familyTitleFa: familyTemplate.titleFa,
    familyDescriptionFa: familyTemplate.descriptionFa,
    flags,
    matchedBy,
    matchedRuleIds,
    disclaimer: DISCLAIMER_FA,
    phases: getPhases(),
    availableFamilies: listFamiliesPublic(),
    rootCoverage: catalog.rootCoverage || ROOT_COVERAGE,
    context: {
      originCountry,
      originCity,
      destinationCountry,
      destinationCity,
      quantity,
      unit,
      transportMode,
      incoterm,
      paymentMethod,
      packagingType,
      rootCategoryId,
      l2Slug: resolvedL2,
      slugPath,
      destinationHint: destMeta.hint,
    },
    steps,
    summary: {
      totalSteps: steps.length,
      requiredSteps: steps.filter((s) => s.required && s.status !== "not_applicable").length,
      optionalSteps: steps.filter((s) => !s.required).length,
      nextStepCode: steps.find((s) => s.status === "ready" || s.status === "optional")?.code || null,
    },
  };
}

function recalculateStepStatuses(stepRows) {
  const byCode = Object.fromEntries(stepRows.map((s) => [s.code, s]));
  const completedCodes = new Set(
    stepRows.filter((s) => s.status === "completed" || s.status === "not_applicable").map((s) => s.code)
  );

  return stepRows.map((row) => {
    if (["completed", "not_applicable", "in_progress", "waiting_for_provider", "waiting_for_document", "needs_revision"].includes(row.status)) {
      // still lock check for in-progress? keep user status if deps ok; re-lock if deps broken
      const deps = row.dependencies || [];
      const depsMet = deps.every((d) => completedCodes.has(d) || !byCode[d]);
      if (!depsMet && row.status !== "completed" && row.status !== "not_applicable") {
        return { ...row, status: "locked" };
      }
      return row;
    }
    const deps = row.dependencies || [];
    const depsMet = deps.every((d) => completedCodes.has(d) || !byCode[d]);
    if (!depsMet) return { ...row, status: "locked" };
    if (!row.required) return { ...row, status: "optional" };
    return { ...row, status: "ready" };
  });
}

function computeProgress(steps) {
  const countable = steps.filter((s) => s.status !== "not_applicable");
  const required = countable.filter((s) => s.required);
  const base = required.length ? required : countable;
  if (!base.length) return { percent: 0, completedRequired: 0, totalRequired: 0 };
  const done = base.filter((s) => s.status === "completed").length;
  return {
    percent: Math.round((done / base.length) * 100),
    completedRequired: done,
    totalRequired: base.length,
  };
}

function pickNextAction(steps) {
  const priority = [
    "in_progress",
    "needs_revision",
    "waiting_for_document",
    "waiting_for_provider",
    "ready",
    "optional",
  ];
  for (const st of priority) {
    const found = steps.find((s) => s.status === st);
    if (found) return found;
  }
  return null;
}

module.exports = {
  buildPathway,
  recalculateStepStatuses,
  computeProgress,
  pickNextAction,
  sortSteps,
};
