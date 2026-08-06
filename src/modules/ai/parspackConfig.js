const config = require("config");

function getApiKey() {
  if (config.has("AI_FREE_PARSPACK_API_KEY")) {
    const key = String(config.get("AI_FREE_PARSPACK_API_KEY") || "").trim();
    if (key) return key;
  }
  return "";
}

function getParspackConfig() {
  const base = config.has("AI.PARSPACK") ? config.get("AI.PARSPACK") : {};
  return {
    baseURL: String(base.BASE_URL || "https://ai.parspack.com/v1").replace(/\/+$/, ""),
    timeoutMs: Number(base.TIMEOUT_MS) || 25000,
    enabled: base.ENABLED !== false,
    features: base.FEATURES && typeof base.FEATURES === "object" ? base.FEATURES : {},
    chatTranslate: base.CHAT_TRANSLATE && typeof base.CHAT_TRANSLATE === "object" ? base.CHAT_TRANSLATE : {},
  };
}

function isAiEnabled() {
  return getParspackConfig().enabled && Boolean(getApiKey());
}

function isFeatureEnabled(featureKey) {
  if (!isAiEnabled()) return false;
  const features = getParspackConfig().features;
  if (features[featureKey] === false) return false;
  return true;
}

module.exports = {
  getApiKey,
  getParspackConfig,
  isAiEnabled,
  isFeatureEnabled,
};
