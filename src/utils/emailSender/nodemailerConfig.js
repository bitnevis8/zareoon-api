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
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY تنظیم نشده است");
  }

  const payload = {
    from,
    to: [to],
    subject,
    html,
  };
  if (text) payload.text = text;

  const { data } = await axios.post("https://api.resend.com/emails", payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 20000,
    validateStatus: () => true,
  });

  if (!data?.id) {
    const msg = data?.message || data?.error || JSON.stringify(data);
    throw new Error(`Resend failed: ${msg}`);
  }

  console.log("Message sent via Resend: %s", data.id);
  return { messageId: data.id, provider: "resend" };
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
