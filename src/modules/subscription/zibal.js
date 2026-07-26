/**
 * زیبال IPG
 * https://help.zibal.ir/ipg/
 *
 * config (api/config/*.json):
 *   ZIBAL.MERCHANT
 *   ZIBAL.SANDBOX
 *   ZIBAL.CALLBACK_URL
 *
 * optional env override:
 *   ZIBAL_MERCHANT / ZIBAL_SANDBOX / ZIBAL_CALLBACK_URL / FRONTEND_URL
 */

const config = require("config");

const API_BASE = "https://gateway.zibal.ir";

function cfg(key, envKey, fallback = "") {
  if (process.env[envKey] != null && String(process.env[envKey]).trim() !== "") {
    return process.env[envKey];
  }
  try {
    if (config.has(`ZIBAL.${key}`)) return config.get(`ZIBAL.${key}`);
  } catch {
    /* ignore */
  }
  return fallback;
}

function isSandbox() {
  const raw = cfg("SANDBOX", "ZIBAL_SANDBOX", true);
  return String(raw).toLowerCase() !== "false";
}

function merchantId() {
  if (isSandbox()) return "zibal";
  return String(cfg("MERCHANT", "ZIBAL_MERCHANT", "") || "").trim();
}

function callbackUrl(override) {
  if (override && String(override).trim()) return String(override).trim();
  return (
    String(cfg("CALLBACK_URL", "ZIBAL_CALLBACK_URL", "") || "").trim() ||
    `${process.env.FRONTEND_URL || (config.has("FRONTEND_URL") ? config.get("FRONTEND_URL") : "http://localhost:3001")}/pricing/callback`
  );
}

function startPayUrl(trackId) {
  return `${API_BASE}/start/${trackId}`;
}

async function requestPayment({ amountToman, description, mobile, orderId, callbackUrl: cbOverride }) {
  const merchant = merchantId();
  if (!merchant) {
    const err = new Error("ZIBAL.MERCHANT تنظیم نشده است");
    err.code = "ZIBAL_NOT_CONFIGURED";
    throw err;
  }

  const amountRial = Math.round(Number(amountToman) * 10);
  if (!Number.isFinite(amountRial) || amountRial < 1000) {
    throw new Error("مبلغ پرداخت نامعتبر است");
  }

  const body = {
    merchant,
    amount: amountRial,
    callbackUrl: callbackUrl(cbOverride),
    description: description || "خرید اشتراک زارعون",
  };
  if (orderId) body.orderId = String(orderId);
  if (mobile) body.mobile = String(mobile);

  const res = await fetch(`${API_BASE}/v1/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  const result = Number(json?.result);
  const trackId = json?.trackId;
  if (result !== 100 || trackId == null) {
    const message = json?.message || "خطا در ایجاد پرداخت زیبال";
    const err = new Error(message);
    err.details = json;
    err.code = result;
    throw err;
  }

  return {
    trackId: String(trackId),
    authority: String(trackId),
    paymentUrl: startPayUrl(trackId),
    raw: json,
  };
}

async function verifyPayment({ trackId }) {
  const merchant = merchantId();
  if (!merchant) {
    const err = new Error("ZIBAL.MERCHANT تنظیم نشده است");
    err.code = "ZIBAL_NOT_CONFIGURED";
    throw err;
  }

  const id = String(trackId || "").trim();
  if (!id) {
    throw new Error("کد پیگیری پرداخت یافت نشد");
  }

  const res = await fetch(`${API_BASE}/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      merchant,
      trackId: Number.isFinite(Number(id)) ? Number(id) : id,
    }),
  });

  const json = await res.json();
  const result = Number(json?.result);
  // 100 = success, 201 = already verified
  if (result !== 100 && result !== 201) {
    const message = json?.message || "تأیید پرداخت ناموفق بود";
    const err = new Error(message);
    err.details = json;
    err.code = result;
    throw err;
  }

  return {
    code: result,
    refId: String(json?.refNumber ?? json?.ref_id ?? trackId ?? ""),
    cardPan: json?.cardNumber || json?.cardPan || null,
    raw: json,
  };
}

module.exports = {
  isSandbox,
  merchantId,
  requestPayment,
  verifyPayment,
  callbackUrl,
};
