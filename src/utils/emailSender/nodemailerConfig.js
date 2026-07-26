const nodemailer = require("nodemailer");
const config = require("config");
const { getMailFrom, getFrontendHost } = require("./zareoonEmailTemplates");

const transporter = nodemailer.createTransport({
  host: config.get("EMAIL.HOST"),
  port: config.get("EMAIL.PORT"),
  secure: config.get("EMAIL.SECURE"),
  auth: {
    user: config.get("EMAIL.AUTH.USER"),
    pass: config.get("EMAIL.AUTH.PASS"),
  },
});

function getSmtpUser() {
  try {
    return config.get("EMAIL.AUTH.USER");
  } catch {
    return "zareoon.ir@gmail.com";
  }
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @param {string} html
 * @param {{ from?: string }} [opts]
 */
async function main(to, subject, text, html, opts = {}) {
  const site = getFrontendHost();
  const smtpUser = getSmtpUser();
  const from = opts.from || getMailFrom();

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
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    // هم‌ترازی Envelope با حساب SMTP اعتبار را بهتر می‌کند
    envelope: {
      from: smtpUser,
      to,
    },
  });
  console.log("Message sent: %s", info.messageId);
  return info;
}

module.exports = { main };
