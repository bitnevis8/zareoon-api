/**
 * ParsPack AI Studio integration for Zareoon.
 * Capability 0 (chat translate) is active; other features are scaffolded later.
 */
const { isAiEnabled, isFeatureEnabled, getParspackConfig } = require("./parspackConfig");
const { listModels, listChatModels, resolveChatTranslateModelId } = require("./modelCatalog");
const {
  translateChatText,
  getChatTranslateOptionsPublic,
  normalizeLang,
} = require("./features/chatTranslate");
const { CHAT_TRANSLATE_LANGUAGES } = require("./constants");

module.exports = {
  isAiEnabled,
  isFeatureEnabled,
  getParspackConfig,
  listModels,
  listChatModels,
  resolveChatTranslateModelId,
  translateChatText,
  getChatTranslateOptionsPublic,
  normalizeLang,
  CHAT_TRANSLATE_LANGUAGES,
};
