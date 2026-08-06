/**
 * Resolves exact model IDs from ParsPack AI Studio /models list.
 * Never hardcodes a guessed display name as the final model id.
 */
const { getParspackClient } = require("./parspackClient");
const { getParspackConfig, isAiEnabled } = require("./parspackConfig");

let cache = {
  models: null,
  fetchedAt: 0,
  chatTranslateModelId: null,
};

const CACHE_TTL_MS = 10 * 60 * 1000;

function normalizeId(id) {
  return String(id || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

async function listModels({ force = false } = {}) {
  if (!isAiEnabled()) return [];
  const now = Date.now();
  if (!force && cache.models && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.models;
  }
  const client = getParspackClient();
  if (!client) return [];
  try {
    const page = await client.models.list();
    const models = Array.isArray(page?.data)
      ? page.data
          .map((m) => ({
            id: String(m.id || "").trim(),
            ownedBy: m.owned_by || m.ownedBy || null,
          }))
          .filter((m) => m.id)
      : [];
    cache.models = models;
    cache.fetchedAt = now;
    return models;
  } catch (err) {
    console.warn("[ai] models.list failed:", err?.message || err);
    return cache.models || [];
  }
}

function scoreModelMatch(modelId, matchTokens) {
  const id = normalizeId(modelId);
  if (!id) return -1;
  let score = 0;
  for (const token of matchTokens) {
    const t = normalizeId(token);
    if (!t) continue;
    if (id.includes(t)) score += 10;
    else return -1;
  }
  // Prefer instruction-tuned / it variants when present
  if (/\bit\b|-it$|_it$|\/.*it/.test(id) || id.includes("-it") || id.endsWith("it")) score += 3;
  if (id.includes("gemma-3n") || id.includes("gemma3n")) score += 2;
  return score;
}

/**
 * Resolve chat-translate model id from live catalog (or config override once set).
 */
async function resolveChatTranslateModelId({ force = false } = {}) {
  const cfg = getParspackConfig().chatTranslate || {};
  const configured = String(cfg.MODEL_ID || "").trim();
  if (configured) {
    cache.chatTranslateModelId = configured;
    return configured;
  }

  if (!force && cache.chatTranslateModelId) return cache.chatTranslateModelId;

  const matchTokens = Array.isArray(cfg.MODEL_MATCH) && cfg.MODEL_MATCH.length
    ? cfg.MODEL_MATCH.map(String)
    : ["gemma", "3n", "e2b"];

  const models = await listModels({ force });
  let best = null;
  let bestScore = -1;
  for (const m of models) {
    const score = scoreModelMatch(m.id, matchTokens);
    if (score > bestScore) {
      bestScore = score;
      best = m.id;
    }
  }

  if (best && bestScore >= 0) {
    cache.chatTranslateModelId = best;
    console.log(`[ai] chat-translate model resolved from ParsPack catalog: ${best}`);
    return best;
  }

  console.warn(
    "[ai] Could not resolve Gemma 3n E2B model from ParsPack /models. Set AI.PARSPACK.CHAT_TRANSLATE.MODEL_ID after checking the catalog."
  );
  return null;
}

function invalidateModelCache() {
  cache = { models: null, fetchedAt: 0, chatTranslateModelId: null };
}

/** Models unsuitable for chat translation (embeddings, TTS, rerank, safety-only, …). */
function isChatCapableModel(modelId) {
  const id = normalizeId(modelId);
  if (!id) return false;
  if (/(embed|embedding|rerank|tts|whisper|transcrib|moderation|content-safety|image|vision|vl-|omni)/i.test(id)) {
    return false;
  }
  return true;
}

function modelLabel(modelId) {
  const id = String(modelId || "").trim();
  if (!id) return "";
  // google/gemma-3n-e2b-it → gemma-3n-e2b-it (google)
  const parts = id.split("/");
  if (parts.length >= 2) {
    return `${parts.slice(1).join("/")} (${parts[0]})`;
  }
  return id;
}

/**
 * Live ParsPack chat-capable models for user selection.
 */
async function listChatModels({ force = false } = {}) {
  const models = await listModels({ force });
  return models
    .filter((m) => isChatCapableModel(m.id))
    .map((m) => ({
      id: m.id,
      label: modelLabel(m.id),
      ownedBy: m.ownedBy || null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
}

module.exports = {
  listModels,
  listChatModels,
  resolveChatTranslateModelId,
  invalidateModelCache,
  scoreModelMatch,
  isChatCapableModel,
  modelLabel,
};
