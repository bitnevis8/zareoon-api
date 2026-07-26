const axios = require("axios");
const nodemailer = require("nodemailer");
const config = require("config");
const { getMailFrom, getFrontendHost } = require("./zareoonEmailTemplates");

function safeGet(path, fallback = undefined) {
  try {
    if (config.has(path)) return config.get(path);
  } catch {
    /* ignore */
  }
  return fallback;
}

function getProvider() {
  const p = String(safeGet("EMAIL.PROVIDER", "smtp") || "smtp").toLowerCase();
  if (p === "resend") return "resend";
  return "smtp";
}

function getResendApiKey() {
  return (
    process.env.RESEND_API_KEY ||
    safeGet("EMAIL.RESEND_API_KEY", "") ||
    safeGet("EMAIL.RESEND.API_KEY", "") ||
    ""
  );
}

function getFromAddress(optsFrom) {
  if (optsFrom) return optsFrom;
  const configured = safeGet("EMAIL.FROM", null);
  if (configured) return configured;
  return getMailFrom();
}

let smtpTransporter = null;
function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  smtpTransporter = nodemailer.createTransport({
    host: config.get("EMAIL.HOST"),
    port: config.get("EMAIL.PORT"),
    secure: config.get("EMAIL.SECURE"),
    auth: {
      user: config.get("EMAIL.AUTH.USER"),
      pass: config.get("EMAIL.AUTH.PASS"),
    },
  });
  return smtpTransporter;
}

async function sendViaResend({ to, subject, text, html, from }) {
  const apiKey = String(getResendApiKey() || "").trim();
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY تنظیم نشده است. روی سرور config/local.json یا متغیر محیطی را ست کنید."
    );
  }

  // Resend: از آدرس ساده استفاده کن؛ نام نمایشی با کاراکترهای خاص گاهی 422 می‌دهد
  let fromAddr = String(from || "").trim();
  const angle = fromAddr.match(/<([^>]+)>/);
  if (angle) {
    const emailOnly = angle[1].trim();
    const nameMatch = fromAddr.replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "");
    fromAddr = nameMatch ? `${JSON.stringify(nameMatch)} <${emailOnly}>` : emailOnly;
  }

  const payload = {
    from: fromAddr,
    to: [to],
    subject,
    html,
  };
  if (text) payload.text = text;

  const res = await axios.post("https://api.resend.com/emails", payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 20000,
    validateStatus: () => true,
  });

  const data = res.data || {};
  if (res.status >= 200 && res.status < 300 && data.id) {
    console.log("Message sent via Resend: %s", data.id);
    return { messageId: data.id, provider: "resend" };
  }

  const detail =
    (typeof data.message === "string" && data.message) ||
    (typeof data.error === "string" && data.error) ||
    (data.error && data.error.message) ||
    JSON.stringify(data);
  console.error("❌ Resend HTTP", res.status, detail);
  throw new Error(`Resend: ${detail}`);
}

async function sendViaSmtp({ to, subject, text, html, from }) {
  const site = getFrontendHost();
  const smtpUser = safeGet("EMAIL.AUTH.USER", "zareoon.ir@gmail.com");
  const transporter = getSmtpTransporter();

  const info = await transporter.sendMail({
    from,
    to,
    replyTo: from,
    subject,
    text: text || undefined,
    html,
    headers: {
      "X-Mailer": "Zareoon",
      "X-Priority": "1",
      "X-Entity-Ref-ID": `zareoon-otp-${Date.now()}`,
      "List-Unsubscribe": `<${site}/auth/login>`,
    },
    envelope: { from: smtpUser, to },
  });
  console.log("Message sent via SMTP: %s", info.messageId);
  return info;
}

/**
 * ارسال ایمیل — Resend یا SMTP بر اساس EMAIL.PROVIDER
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 * @param {{ from?: string }} [opts]
 */
async function main(to, subject, text, html, opts = {}) {
  const from = getFromAddress(opts.from);
  const provider = getProvider();

  if (provider === "resend") {
    try {
      return await sendViaResend({ to, subject, text, html, from });
    } catch (err) {
      console.error("❌ Resend send failed:", err.message);
      throw err;
    }
  }

  return sendViaSmtp({ to, subject, text, html, from });
}

module.exports = { main, getProvider };
