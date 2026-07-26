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
  return `"زارعون" <${user}>`;
}

/**
 * لوگو از دامنهٔ اصلی سایت (برای Inbox بهتر از CDN ناشناس است)
 * در صورت تمایل فایل 691376 هم در دسترس است.
 */
async function resolveLogoUrl() {
  const siteLogo = `${getFrontendHost()}/images/logo.png`;
  try {
    const File = require("../../modules/fileUpload/model");
    const file = await File.findByPk(LOGO_FILE_ID);
    if (file?.path) {
      const host = String(config.get("UPLOAD.DOWNLOAD_HOST") || "https://dl.zareoon.ir").replace(
        /\/$/,
        ""
      );
      // ترجیح دامنهٔ برند برای اسپم کمتر؛ اگر لوگو روی سایت نبود از CDN
      return siteLogo || `${host}/${String(file.path).replace(/^\//, "")}`;
    }
  } catch (e) {
    console.warn("email logo resolve failed:", e.message);
  }
  return siteLogo;
}

/**
 * ایمیل کوتاه و کاربرپسند کد تأیید
 * @param {{ code: string|number, purpose?: 'register'|'verify'|'resend' }} opts
 */
async function buildVerificationEmail({ code, purpose = "register" } = {}) {
  const logoUrl = await resolveLogoUrl();
  const site = getFrontendHost();
  const codeStr = String(code);

  const subjectByPurpose = {
    register: "کد ورود به زارعون",
    verify: "کد تأیید زارعون",
    resend: "کد جدید زارعون",
  };
  const subject = subjectByPurpose[purpose] || subjectByPurpose.register;

  const introByPurpose = {
    register: "برای ادامهٔ ثبت‌نام، این کد را وارد کنید:",
    verify: "کد تأیید شما:",
    resend: "کد جدید شما:",
  };
  const intro = introByPurpose[purpose] || introByPurpose.register;

  const text = `زارعون\n${intro}\n${codeStr}\n\n${site}`;

  const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:420px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:28px 24px 12px;text-align:center;background:#ecfdf5;">
              <img src="${logoUrl}" alt="زارعون" width="64" height="64" style="display:block;margin:0 auto 10px;border:0;border-radius:14px;" />
              <div style="font-size:18px;font-weight:800;color:#064e3b;">زارعون</div>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 8px;text-align:center;">
              <p style="margin:0;font-size:14px;line-height:1.9;color:#334155;">${intro}</p>
              <div style="margin:16px auto 8px;display:inline-block;padding:12px 20px;border-radius:12px;background:#f0fdf4;border:1px solid #bbf7d0;">
                <span style="font-size:30px;font-weight:800;letter-spacing:0.28em;color:#047857;font-family:Consolas,Monaco,monospace;">${codeStr}</span>
              </div>
              <p style="margin:6px 0 0;font-size:12px;color:#94a3b8;">۳ دقیقه اعتبار دارد</p>
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

  return { subject, text, html, from: getMailFrom() };
}

module.exports = {
  LOGO_FILE_ID,
  getMailFrom,
  getFrontendHost,
  resolveLogoUrl,
  buildVerificationEmail,
};
