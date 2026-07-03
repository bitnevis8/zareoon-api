const MAX_HASHTAGS = 3;

function normalizeHashtag(raw) {
  const tag = String(raw || "")
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "");
  if (!tag || tag.length < 2 || tag.length > 40) return null;
  if (!/^[\w\u0600-\u06FF][\w\u0600-\u06FF.-]*$/u.test(tag)) return null;
  return tag;
}

function parseHashtagsInput(body = {}) {
  let raw = [];
  if (Array.isArray(body.hashtags)) raw = body.hashtags;
  else if (typeof body.hashtags === "string") {
    raw = body.hashtags.split(/[\s,،]+/);
  }

  const tags = [];
  for (const item of raw) {
    const tag = normalizeHashtag(item);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length >= MAX_HASHTAGS) break;
  }
  return tags;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatHashtags(value) {
  return parseJsonArray(value)
    .map(normalizeHashtag)
    .filter(Boolean)
    .slice(0, MAX_HASHTAGS);
}

function countRawHashtags(body = {}) {
  if (Array.isArray(body.hashtags)) {
    return body.hashtags.filter((t) => String(t || "").trim()).length;
  }
  if (typeof body.hashtags === "string") {
    return body.hashtags.split(/[\s,،]+/).filter((t) => String(t || "").trim()).length;
  }
  return 0;
}

module.exports = {
  MAX_HASHTAGS,
  normalizeHashtag,
  parseHashtagsInput,
  parseJsonArray,
  formatHashtags,
  countRawHashtags,
};
