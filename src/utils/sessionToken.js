const { SignJWT } = require("jose");
const config = require("config");

function getCookieConfig(isProduction, rememberMe = false) {
  return {
    httpOnly: true,
    secure: isProduction,
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    path: "/",
    domain: isProduction ? ".zareoon.ir" : undefined,
    sameSite: isProduction ? "None" : "Lax",
  };
}

function mapRolesForToken(user) {
  const roles = user?.userRoles || user?.roles || [];
  if (!Array.isArray(roles) || !roles.length) return [];
  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    nameEn: role.nameEn,
    nameFa: role.nameFa,
  }));
}

/** JWT نشست با نقش‌های به‌روز — برای ثبت‌نام، ورود، become-seller و خدمات‌دهنده */
async function signUserSessionToken(user) {
  const secretKey = config.get("JWT_SECRET");
  const encoder = new TextEncoder();
  const payload = {
    userId: user.id,
    id: user.id,
    email: user.email || undefined,
    username: user.username || undefined,
    mobile: user.mobile || undefined,
    roles: mapRolesForToken(user),
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(encoder.encode(secretKey));
}

async function setUserSessionCookie(res, user, { rememberMe = true } = {}) {
  const token = await signUserSessionToken(user);
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("token", token, getCookieConfig(isProduction, rememberMe));
  return token;
}

module.exports = {
  getCookieConfig,
  mapRolesForToken,
  signUserSessionToken,
  setUserSessionCookie,
};
