const config = require("config");

const LOGO_FILE_ID = 691376;

function getFrontendHost() {
  try {
    if (config.has("FRONTEND.HOST")) return String(config.get("FRONTEND.HOST")).replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  return process.env.FRONTEND_URL || "https://zareoon.ir";
}

function getMailFrom() {
  try {
    if (config.has("EMAIL.FROM") && config.get("EMAIL.FROM")) {
      return String(config.get("EMAIL.FROM"));
    }
  } catch {
    /* ignore */
  }
  let user = "zareoon.ir@gmail.com";
  try {
    if (config.has("EMAIL.AUTH.USER")) user = config.get("EMAIL.AUTH.USER");
  } catch {
    /* ignore */
  }
  return `"Zareoon" <${user}>`;
}

async function resolveLogoUrl() {
  const siteLogo = `${getFrontendHost()}/images/logo.png`;
  try {
    const File = require("../../modules/fileUpload/model");
    const file = await File.findByPk(LOGO_FILE_ID);
    if (file?.path) {
      return siteLogo;
    }
  } catch (e) {
    console.warn("email logo resolve failed:", e.message);
  }
  return siteLogo;
}

const COPY = {
  register: {
    subject: "Zareoon verification code | کد ورود زارعون | رمز التحقق",
    en: "Enter this code to continue signing up:",
    fa: "برای ادامهٔ ثبت‌نام، این کد را وارد کنید:",
    ar: "أدخل هذا الرمز لمتابعة التسجيل:",
  },
  verify: {
    subject: "Zareoon verification code | کد تأیید زارعون | رمز التحقق",
    en: "Your verification code:",
    fa: "کد تأیید شما:",
    ar: "رمز التحقق الخاص بك:",
  },
  resend: {
    subject: "Zareoon new code | کد جدید زارعون | رمز جديد",
    en: "Your new verification code:",
    fa: "کد جدید شما:",
    ar: "رمز التحقق الجديد:",
  },
};

/**
 * ایمیل OTP سه‌زبانه: انگلیسی → فارسی → عربی
 */
async function buildVerificationEmail({ code, purpose = "register" } = {}) {
  const logoUrl = await resolveLogoUrl();
  const site = getFrontendHost();
  const codeStr = String(code);
  const c = COPY[purpose] || COPY.register;

  const text = [
    "Zareoon",
    "",
    `EN: ${c.en}`,
    `FA: ${c.fa}`,
    `AR: ${c.ar}`,
    "",
    codeStr,
    "",
    "Valid for 3 minutes | اعتبار ۳ دقیقه | صالح لمدة ٣ دقائق",
    site,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${c.subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:440px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:24px 24px 10px;text-align:center;background:#ecfdf5;">
              <img src="${logoUrl}" alt="Zareoon" width="64" height="64" style="display:block;margin:0 auto 10px;border:0;border-radius:14px;" />
              <div style="font-size:18px;font-weight:800;color:#064e3b;">Zareoon · زارعون</div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 6px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:#94a3b8;text-transform:uppercase;">English</p>
              <p dir="ltr" style="margin:0;font-size:14px;line-height:1.7;color:#334155;text-align:left;">${c.en}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px 6px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:#94a3b8;">فارسی</p>
              <p dir="rtl" style="margin:0;font-size:14px;line-height:1.9;color:#334155;text-align:right;">${c.fa}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px 6px;">
              <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.04em;color:#94a3b8;">العربية</p>
              <p dir="rtl" style="margin:0;font-size:14px;line-height:1.9;color:#334155;text-align:right;">${c.ar}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 8px;text-align:center;">
              <div style="display:inline-block;padding:14px 22px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;">
                <span style="font-size:30px;font-weight:800;letter-spacing:0.28em;color:#047857;font-family:Consolas,Monaco,monospace;">${codeStr}</span>
              </div>
              <p style="margin:12px 0 0;font-size:12px;line-height:1.7;color:#94a3b8;">
                Valid for 3 minutes<br/>
                اعتبار: ۳ دقیقه<br/>
                صالح لمدة ٣ دقائق
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px 22px;text-align:center;">
              <a href="${site}" style="font-size:12px;color:#059669;text-decoration:none;">zareoon.ir</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: c.subject, text, html, from: getMailFrom() };
}

module.exports = {
  LOGO_FILE_ID,
  getMailFrom,
  getFrontendHost,
  resolveLogoUrl,
  buildVerificationEmail,
};
