const Account = require("../account/model");

function slugify(text) {
  if (!text) return "";
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function ensureUniqueSlug(base, excludeAccountId = null) {
  let slug = base || "user";
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const existing = await Account.findOne({ where: { profileSlug: candidate } });
    if (!existing || (excludeAccountId && existing.id === excludeAccountId)) return candidate;
    n += 1;
  }
}

async function generateProfileSlug(user) {
  const fromUsername = slugify(user.username);
  if (fromUsername && !fromUsername.startsWith("temp")) {
    return ensureUniqueSlug(fromUsername);
  }
  const fromName = slugify(`${user.firstName || ""}-${user.lastName || ""}`);
  return ensureUniqueSlug(fromName || `tamin-${user.id}`);
}

module.exports = {
  slugify,
  ensureUniqueSlug,
  generateProfileSlug,
};
