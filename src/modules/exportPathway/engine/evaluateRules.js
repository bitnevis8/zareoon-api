function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function matchWhen(when, ctx) {
  if (!when) return true;
  if (when.always) return true;

  if (when.or && Array.isArray(when.or)) {
    return when.or.some((part) => matchWhen(part, ctx));
  }
  if (when.and && Array.isArray(when.and)) {
    return when.and.every((part) => matchWhen(part, ctx));
  }

  if (when.anyFlag?.length) {
    return when.anyFlag.some((f) => Boolean(ctx.flags?.[f]));
  }
  if (when.allFlags?.length) {
    return when.allFlags.every((f) => Boolean(ctx.flags?.[f]));
  }
  if (when.fieldEquals) {
    return getByPath(ctx, when.fieldEquals.path) === when.fieldEquals.value;
  }
  if (when.fieldIn) {
    const v = getByPath(ctx, when.fieldIn.path);
    return (when.fieldIn.values || []).includes(v);
  }
  if (when.tradeCompliance) {
    const tc = ctx.tradeCompliance || {};
    return Object.entries(when.tradeCompliance).every(([k, expected]) => tc[k] === expected);
  }
  return false;
}

function uniqueStrings(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

/**
 * @returns {{ stepCodes: string[], mutations: object, matchedRuleIds: string[] }}
 */
function applyRules({ baseStepCodes, rules, ctx }) {
  const codeSet = new Set(baseStepCodes);
  const requireSet = new Set();
  const optionalSet = new Set();
  const removeSet = new Set();
  const docsByStep = {};
  const warningsByStep = {};
  const matchedRuleIds = [];

  const sorted = [...(rules || [])].sort((a, b) => (a.priority || 0) - (b.priority || 0));

  for (const rule of sorted) {
    if (!matchWhen(rule.when, ctx)) continue;
    matchedRuleIds.push(rule.id);

    (rule.addSteps || []).forEach((c) => codeSet.add(c));
    (rule.removeSteps || []).forEach((c) => removeSet.add(c));
    (rule.requireSteps || []).forEach((c) => requireSet.add(c));
    (rule.markOptional || []).forEach((c) => optionalSet.add(c));

    if (rule.appendDocuments) {
      for (const [stepCode, docs] of Object.entries(rule.appendDocuments)) {
        docsByStep[stepCode] = uniqueStrings([...(docsByStep[stepCode] || []), ...docs]);
      }
    }
    if (rule.appendWarnings) {
      for (const [stepCode, warns] of Object.entries(rule.appendWarnings)) {
        warningsByStep[stepCode] = uniqueStrings([...(warningsByStep[stepCode] || []), ...warns]);
      }
    }

    if (rule.mergeTradeComplianceDocuments) {
      const possible = ctx.tradeCompliance?.possibleDocuments || [];
      if (possible.length) {
        docsByStep.certifications = uniqueStrings([
          ...(docsByStep.certifications || []),
          ...possible,
        ]);
        docsByStep["customs-documents"] = uniqueStrings([
          ...(docsByStep["customs-documents"] || []),
          ...possible.filter((d) =>
            /invoice|packing|origin|bill|declaration/i.test(String(d))
          ),
        ]);
      }
    }
  }

  for (const c of removeSet) codeSet.delete(c);

  return {
    stepCodes: [...codeSet],
    mutations: { requireSet, optionalSet, docsByStep, warningsByStep },
    matchedRuleIds,
  };
}

module.exports = { matchWhen, applyRules };
