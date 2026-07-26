const crypto = require("crypto");
const axios = require("axios");
const config = require("config");

function hashOtp(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeMobile(mobile) {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (digits.startsWith("98") && digits.length >= 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  return digits;
}

async function sendVerifySms(mobile, code) {
  const apiKey = config.get("SMS.API_KEY");
  const templateId = config.get("SMS.TEMPLATE_ID");
  if (!apiKey || !String(templateId).trim()) {
    const err = new Error("سرویس پیامک پیکربندی نشده است");
    err.statusCode = 503;
    throw err;
  }

  await axios({
    method: "post",
    url: "https://api.sms.ir/v1/send/verify",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/plain",
      "x-api-key": apiKey,
    },
    data: JSON.stringify({
      mobile: normalizeMobile(mobile),
      templateId,
      parameters: [{ name: "CODE", value: String(code) }],
    }),
  });
}

function isOtpExpired(sentAt, minutes = 3) {
  if (!sentAt) return true;
  return (Date.now() - new Date(sentAt).getTime()) / (1000 * 60) > minutes;
}

module.exports = {
  hashOtp,
  generateOtpCode,
  normalizeMobile,
  sendVerifySms,
  isOtpExpired,
};
