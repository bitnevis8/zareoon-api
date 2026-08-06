const OpenAI = require("openai");
const { getApiKey, getParspackConfig, isAiEnabled } = require("./parspackConfig");

let clientSingleton = null;
let clientKey = null;

function getParspackClient() {
  if (!isAiEnabled()) return null;
  const key = getApiKey();
  const { baseURL, timeoutMs } = getParspackConfig();
  if (clientSingleton && clientKey === key) return clientSingleton;

  clientSingleton = new OpenAI({
    apiKey: key,
    baseURL: `${baseURL}/`,
    timeout: timeoutMs,
    maxRetries: 1,
  });
  clientKey = key;
  return clientSingleton;
}

function resetParspackClient() {
  clientSingleton = null;
  clientKey = null;
}

module.exports = {
  getParspackClient,
  resetParspackClient,
};
