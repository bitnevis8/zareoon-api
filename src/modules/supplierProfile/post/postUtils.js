const MAX_POST_IMAGES = 3;
const {
  MAX_HASHTAGS: MAX_POST_HASHTAGS,
  normalizeHashtag,
  parseHashtagsInput: parsePostHashtags,
  formatHashtags,
  parseJsonArray,
} = require("../../../utils/hashtags");
function parsePostImageUrls(body = {}) {
  let urls = [];
  if (Array.isArray(body.imageUrls)) urls = body.imageUrls;
  else if (body.imageUrl) urls = [body.imageUrl];

  return urls
    .filter((u) => typeof u === "string" && u.trim())
    .map((u) => u.trim().slice(0, 500))
    .slice(0, MAX_POST_IMAGES);
}
function formatPostRecord(post) {
  const plain = post?.toJSON ? post.toJSON() : { ...post };
  let imageUrls = parseJsonArray(plain.imageUrls);
  if (!imageUrls.length && plain.imageUrl) imageUrls = [plain.imageUrl];
  const hashtags = formatHashtags(plain.hashtags);
  return {
    id: plain.id,
    userId: plain.userId,
    body: plain.body,
    imageUrl: imageUrls[0] || plain.imageUrl || null,
    imageUrls,
    hashtags,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

module.exports = {
  MAX_POST_IMAGES,
  MAX_POST_HASHTAGS,
  normalizeHashtag,
  parsePostImageUrls,
  parsePostHashtags,
  formatPostRecord,
};
