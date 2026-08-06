/**
 * Simple in-memory rate limits per user + feature.
 * Soft fail: caller should treat exceeded as "assistant unavailable".
 */
const buckets = new Map();

function key(userId, feature, window) {
  return `${feature}:${userId}:${window}`;
}

function pruneOld(now) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
}

/**
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
function consumeRateLimit(userId, feature, { perMinute = 20, perDay = 200 } = {}) {
  const uid = Number(userId) || 0;
  if (!uid) return { ok: false, retryAfterSec: 60 };
  const now = Date.now();
  pruneOld(now);

  const minuteKey = key(uid, feature, "m");
  const dayKey = key(uid, feature, "d");

  const minute = buckets.get(minuteKey) || { count: 0, resetAt: now + 60_000 };
  const day = buckets.get(dayKey) || { count: 0, resetAt: now + 24 * 60 * 60_000 };

  if (minute.resetAt <= now) {
    minute.count = 0;
    minute.resetAt = now + 60_000;
  }
  if (day.resetAt <= now) {
    day.count = 0;
    day.resetAt = now + 24 * 60 * 60_000;
  }

  if (minute.count >= perMinute) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((minute.resetAt - now) / 1000)) };
  }
  if (day.count >= perDay) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((day.resetAt - now) / 1000)) };
  }

  minute.count += 1;
  day.count += 1;
  buckets.set(minuteKey, minute);
  buckets.set(dayKey, day);
  return { ok: true };
}

module.exports = {
  consumeRateLimit,
};
