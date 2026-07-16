/**
 * زرین‌پال (REST v4)
 * env:
 *   ZARINPAL_MERCHANT_ID=
 *   ZARINPAL_SANDBOX=true|false
 *   ZARINPAL_CALLBACK_URL=https://zareoon.ir/pricing/callback
 *   FRONTEND_URL=https://zareoon.ir
 */

function isSandbox() {
  return String(process.env.ZARINPAL_SANDBOX || "true").toLowerCase() !== "false";
}

function merchantId() {
  return process.env.ZARINPAL_MERCHANT_ID || "";
}

function apiBase() {
  return isSandbox() ? "https://sandbox.zarinpal.com/pg/v4/payment" : "https://api.zarinpal.com/pg/v4/payment";
}

function startPayUrl(authority) {
  const host = isSandbox() ? "https://sandbox.zarinpal.com" : "https://www.zarinpal.com";
  return `${host}/pg/StartPay/${authority}`;
}

function callbackUrl() {
  return (
    process.env.ZARINPAL_CALLBACK_URL ||
    `${process.env.FRONTEND_URL || "http://localhost:3001"}/pricing/callback`
  );
}

async function requestPayment({ amountToman, description, email, mobile, metadata = {} }) {
  const merchant = merchantId();
  if (!merchant) {
    const err = new Error("ZARINPAL_MERCHANT_ID تنظیم نشده است");
    err.code = "ZARINPAL_NOT_CONFIGURED";
    throw err;
  }

  const amountRial = Math.round(Number(amountToman) * 10);
  if (!Number.isFinite(amountRial) || amountRial < 1000) {
    throw new Error("مبلغ پرداخت نامعتبر است");
  }

  const res = await fetch(`${apiBase()}/request.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      merchant_id: merchant,
      amount: amountRial,
      callback_url: callbackUrl(),
      description: description || "خرید اشتراک زارعون",
      metadata: {
        email: email || undefined,
        mobile: mobile || undefined,
        ...metadata,
      },
    }),
  });

  const json = await res.json();
  const code = json?.data?.code;
  const authority = json?.data?.authority;
  if (code !== 100 || !authority) {
    const message = json?.errors?.message || json?.data?.message || "خطا در ایجاد پرداخت زرین‌پال";
    const err = new Error(message);
    err.details = json;
    throw err;
  }

  return {
    authority,
    paymentUrl: startPayUrl(authority),
    fee: json?.data?.fee,
  };
}

async function verifyPayment({ authority, amountToman }) {
  const merchant = merchantId();
  if (!merchant) {
    const err = new Error("ZARINPAL_MERCHANT_ID تنظیم نشده است");
    err.code = "ZARINPAL_NOT_CONFIGURED";
    throw err;
  }

  const amountRial = Math.round(Number(amountToman) * 10);
  const res = await fetch(`${apiBase()}/verify.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      merchant_id: merchant,
      amount: amountRial,
      authority,
    }),
  });

  const json = await res.json();
  const code = json?.data?.code;
  // 100 = success first verify, 101 = already verified
  if (code !== 100 && code !== 101) {
    const message = json?.errors?.message || json?.data?.message || "تأیید پرداخت ناموفق بود";
    const err = new Error(message);
    err.details = json;
    err.code = code;
    throw err;
  }

  return {
    code,
    refId: String(json?.data?.ref_id ?? ""),
    cardPan: json?.data?.card_pan,
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
