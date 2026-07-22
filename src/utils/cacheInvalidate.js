const cache = require("../core/cache/cacheService");

function stableQueryKey(query = {}, keys) {
  const parts = [];
  for (const k of keys) {
    if (query[k] === undefined || query[k] === null || query[k] === "") continue;
    parts.push(`${k}=${String(query[k])}`);
  }
  return parts.sort().join("&") || "default";
}

async function invalidateProductsCache() {
  await Promise.all([
    cache.flushNamespace(cache.NAMESPACES.PRODUCTS),
    cache.flushNamespace(cache.NAMESPACES.SEARCH),
    cache.flushNamespace(cache.NAMESPACES.HOMEPAGE),
  ]);
}

async function invalidateInventoryCache() {
  await Promise.all([
    cache.flushNamespace(cache.NAMESPACES.INVENTORY),
    cache.flushNamespace(cache.NAMESPACES.HOMEPAGE),
    cache.flushNamespace(cache.NAMESPACES.SEARCH),
  ]);
}

module.exports = {
  cache,
  stableQueryKey,
  invalidateProductsCache,
  invalidateInventoryCache,
};
