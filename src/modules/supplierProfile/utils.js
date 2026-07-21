const Account = require("../account/model");
const {
  slugify,
  isPublicSlugAvailable,
  assertPublicSlugAvailable,
  validatePublicSlug,
} = require("../../utils/publicPageSlug");

async function ensureUniqueSlug(base, excludeAccountId = null) {
  let slug = base || "user";
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const available = await isPublicSlugAvailable(candidate, { excludeAccountId });
    if (available) return candidate;
    n += 1;
    if (n > 100) return `${slug}-${Date.now()}`;
  }
}

async function generateProfileSlug(user) {
  const fromUsername = slugify(user.username);
  if (fromUsername && !fromUsername.startsWith("temp") && fromUsername.length >= 4) {
    return ensureUniqueSlug(fromUsername);
  }
  const fromName = slugify(`${user.firstName || ""}-${user.lastName || ""}`);
  if (fromName && fromName.length >= 4) {
    return ensureUniqueSlug(fromName);
  }
  return ensureUniqueSlug(`shop-${user.id}`);
}

module.exports = {
  slugify,
  ensureUniqueSlug,
  generateProfileSlug,
  assertPublicSlugAvailable,
  isPublicSlugAvailable,
  validatePublicSlug,
};
