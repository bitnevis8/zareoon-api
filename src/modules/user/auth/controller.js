const BaseController = require("../../../core/baseController");
const User = require("../user/model");
const Role = require("../role/model");
const bcrypt = require("bcryptjs");
const { SignJWT, jwtVerify } = require("jose");
const config = require("config");
const Joi = require("joi");
const axios = require("axios");
const { main } = require("../../../utils/emailSender/nodemailerConfig");
const moment = require("moment");
const { Op } = require("sequelize");

// تابع کمکی برای تنظیمات کوکی
function getCookieConfig(isProduction) {
  return {
    httpOnly: true,
    secure: isProduction, // در سرور `true` باشد، در لوکال `false`
    maxAge: 24 * 60 * 60 * 1000, // 24 ساعت
    path: "/",
    domain: isProduction ? ".zareoon.ir" : undefined, // برای دسترسی از همه ساب‌دامین‌ها
    sameSite: isProduction ? "None" : "Lax", // در سرور `None`، در لوکال `Lax`
  };
}

class AuthController extends BaseController {

  constructor() {
    super();
    this.User = User; // اضافه کردن User به instance کلاس
  }
  // اضافه کردن متد logout در AuthController
  async logout(req, res) {
    try {
      const isProduction = process.env.NODE_ENV === "production";
      res.clearCookie("token", {
        ...getCookieConfig(isProduction),
        maxAge: 0
      });
      console.log("✅ User logged out successfully");
      return this.response(res, 200, true, "خروج با موفقیت انجام شد.");
    } catch (error) {
      console.error("❌ Logout failed:", error.message);
      return this.response(res, 500, false, "خطای داخلی سرور");
    }
  }

  // پاک کردن تمام sessions (برای حل مشکل JWT)
  async clearAllSessions(req, res) {
    try {
      const isProduction = process.env.NODE_ENV === "production";
      
      // پاک کردن تمام cookies مربوط به احراز هویت
      res.clearCookie("token", {
        ...getCookieConfig(isProduction),
        maxAge: 0
      });
      
      res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        maxAge: 0,
        path: "/",
        domain: "localhost"
      });
      
      res.clearCookie("token", {
        httpOnly: true,
        secure: false,
        maxAge: 0,
        path: "/"
      });
      
      console.log("✅ All sessions cleared successfully");
      return this.response(res, 200, true, "تمام sessions پاک شد. لطفاً دوباره وارد شوید.");
    } catch (error) {
      console.error("❌ Clear sessions failed:", error.message);
      return this.response(res, 500, false, "خطای داخلی سرور");
    }
  }

  //----------------------------------------------------------------------------------
  async getUserData(req, res) {
    try {
      const token = req.cookies.token; // توکن را از کوکی دریافت کن
      if (!token) {
        return this.response(res, 401, false, "کاربر لاگین نیست.");
      }

      // ✅ بررسی صحت توکن
      const secretKey = config.get("JWT_SECRET");

      const encoder = new TextEncoder();
      const { payload } = await jwtVerify(token, encoder.encode(secretKey));
      console.log("fff" + payload);
      // ✅ یافتن اطلاعات کامل کاربر
      const user = await this.User.findOne({
        where: { id: payload.userId },
        include: [{
          model: Role,
          as: "userRoles",
          attributes: ['id', 'name', 'nameEn', 'nameFa'], // Include necessary role attributes
          through: { attributes: [] }, // Exclude UserRole attributes
        }],
      });

      if (!user) {
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      // ✅ ارسال اطلاعات کاربر بدون نیاز به `JWT`
      return this.response(res, 200, true, "اطلاعات کاربر دریافت شد.", {
        userId: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        roles: user.userRoles.map(role => ({
          id: role.id,
          name: role.name,
          nameEn: role.nameEn,
          nameFa: role.nameFa,
        })), // Return an array of roles
      });
    } catch (error) {
      return this.response(res, 401, false, "توکن نامعتبر است.");
    }
  }

  // 📌 -------------------------------------------------------------ثبت‌نام کاربر با ایمیل
  async registerWithEmail(req, res) {
    try {
      const value = req.body;

      // ✅ یافتن نقش 'User'
      const defaultUserRole = await Role.findOne({
        where: { name: "User" }, // یا نام فارسی: { nameFa: "کاربر" }
      });

      if (!defaultUserRole) {
        console.error("❌ Default 'User' role not found. Please create it.");
        return this.response(res, 500, false, "نقش پیش‌فرض یافت نشد.");
      }

      // ✅ بررسی وجود کاربر
      const existingUser = await this.User.findOne({
        where: { email: value.email },
      });
      if (existingUser) {
        console.warn("❌ Duplicate email registration attempt:", value.email);
        return this.response(res, 409, false, "این ایمیل قبلاً ثبت شده است.");
      }

      // ✅ تولید کد احراز هویت
      const emailVerifyCode = Math.floor(100000 + Math.random() * 900000);

      // ✅ ایجاد کاربر جدید
      const newUser = await this.User.create({
        firstName: value.firstName,
        lastName: value.lastName,
        email: value.email,
        username: value.username,
        password: value.password, // بدون رمزنگاری، hooks مدل انجام میده
        emailVerifyCode,
        emailVerificationSentAt: moment().toDate(),
        isEmailVerified: false,
        isActive: true,
      });

      // ✅ اختصاص نقش پیش‌فرض به کاربر جدید
      await newUser.addRole(defaultUserRole);

      // ✅ ارسال ایمیل تأییدیه
      await main(
        value.email,
        "کد تأیید ایمیل شما",
        "",
        `
        <div style="text-align: center;">
          <span style="font-family:'tahoma';font-size:'14px'">کد تأییدیه ایمیل شما: </span><br>
          <b style="font-size: 24px;">${emailVerifyCode}</b>
        </div>
      `
      );
      console.log("✅ Email verification sent to:", value.email);

      // ✅ تولید JWT و ست کردن کوکی httpOnly
      const secretKey = config.get("JWT_SECRET");
      const encoder = new TextEncoder();
      const token = await new SignJWT({
        userId: newUser.id,
        email: newUser.email,
        username: newUser.username,
        isEmailVerified: false,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(encoder.encode(secretKey));

      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
        domain: isProduction ? ".zareoon.ir" : undefined,
        sameSite: isProduction ? "None" : "Lax",
      });

      // ✅ بازیابی نقش‌ها برای کاربر جدید
      const roles = await newUser.getRoles(); // فرض می‌کنیم متد getRoles در مدل User وجود دارد

      this.response(
        res,
        201,
        true,
        "حساب کاربری ایجاد شد. کد تأیید به ایمیل ارسال شد.",
        {
          userId: newUser.id,
          email: newUser.email,
          username: newUser.username,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          isEmailVerified: newUser.isEmailVerified,
          roles: roles.map(role => ({
            id: role.id,
            name: role.name,
            nameEn: role.nameEn,
            nameFa: role.nameFa,
          })),
        }
      );
    } catch (error) {
      console.error("❌ Email registration failed:", error.message);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  // 📌 ثبت‌نام کاربر با موبایل
  async registerWithMobile(req, res) {
    try {
      const value = req.body;

      // ✅ یافتن نقش 'User'
      const defaultUserRole = await Role.findOne({
        where: { name: "User" }, // یا نام فارسی: { nameFa: "کاربر" }
      });

      if (!defaultUserRole) {
        console.error("❌ Default 'User' role not found. Please create it.");
        return this.response(res, 500, false, "نقش پیش‌فرض یافت نشد.");
      }

      // ✅ بررسی وجود کاربر
      const existingUser = await this.User.findOne({
        where: { mobile: value.mobile },
      });
      if (existingUser) {
        console.warn("❌ Duplicate mobile registration attempt:", value.mobile);
        return this.response(
          res,
          409,
          false,
          "این شماره موبایل قبلاً ثبت شده است."
        );
      }

      // ✅ تولید کد احراز هویت
      const mobileVerifyCode = Math.floor(100000 + Math.random() * 900000);

      // ✅ ایجاد کاربر جدید
      const newUser = await this.User.create({
        firstName: value.firstName,
        lastName: value.lastName,
        mobile: value.mobile,
        username: value.username,
        password: value.password, // بدون رمزنگاری، hooks مدل انجام میده
        mobileVerifyCode,
        isMobileVerified: false,
        isActive: true,
      });

      // ✅ اختصاص نقش پیش‌فرض به کاربر جدید
      await newUser.addRole(defaultUserRole);

      // ✅ ارسال پیامک تأییدیه با `sms.ir`
      const data = JSON.stringify({
        mobile: value.mobile,
        templateId: config.get("SMS.TEMPLATE_ID"),
        parameters: [
          { name: "CODE", value: mobileVerifyCode.toString() }
        ]
      });

      const smsConfig = {
        method: "post",
        url: "https://api.sms.ir/v1/send/verify",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/plain",
          "x-api-key": config.get("SMS.API_KEY")
        },
        data: data
      };

      try {
        const response = await axios(smsConfig);
        console.log("✅ SMS verification sent to:", value.mobile);
        console.log("📱 SMS Response:", response.data);
      } catch (smsError) {
        console.error("❌ SMS sending failed:", smsError.response?.data || smsError.message);
        // حتی اگر ارسال پیامک با خطا مواجه شد، کاربر را ثبت می‌کنیم
        // اما پیام مناسب به کاربر می‌دهیم
        return this.response(
          res,
          201,
          true,
          "حساب کاربری ایجاد شد اما در ارسال پیامک مشکلی پیش آمده. لطفاً با پشتیبانی تماس بگیرید."
        );
      }

      // ✅ تولید JWT
      const secretKey = config.get("JWT_SECRET");
      const encoder = new TextEncoder();
      const token = await new SignJWT({ userMobile: newUser.mobile })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(encoder.encode(secretKey));

      const isProduction = process.env.NODE_ENV === "production";

      res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction, // در سرور `true` باشد، در لوکال `false`
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 روز
        path: "/",
        domain: isProduction ? ".zareoon.ir" : undefined, // در لوکال `undefined` باشد
        sameSite: isProduction ? "None" : "Lax", // در سرور `None`، در لوکال `Lax`
      });

      // ✅ بازیابی نقش‌ها برای کاربر جدید
      const roles = await newUser.getRoles(); // فرض می‌کنیم متد getRoles در مدل User وجود دارد

      this.response(
        res,
        201,
        true,
        "حساب کاربری ایجاد شد. کد تأیید به موبایل ارسال شد.",
        {
          userId: newUser.id,
          email: newUser.email,
          username: newUser.username,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          isMobileVerified: newUser.isMobileVerified,
          roles: roles.map(role => ({
            id: role.id,
            name: role.name,
            nameEn: role.nameEn,
            nameFa: role.nameFa,
          })),
        }
      );
    } catch (error) {
      console.error("❌ Mobile registration failed:", error.message);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  // 📌 تأیید کد ارسال شده به ایمیل
  async verifyEmailCode(req, res) {
    try {
      // ✅ اعتبارسنجی ورودی‌ها
      const schema = Joi.object({
        email: Joi.string().email().required(),
        code: Joi.string().length(6).required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        console.warn("❌ Invalid email verification input:", error.details[0].message);
        return this.response(res, 400, false, error.details[0].message);
      }

      // ✅ جستجوی کاربر بر اساس ایمیل
      const user = await this.User.findOne({ where: { email: value.email } });
      if (!user) {
        console.warn(
          "❌ Email verification attempt failed: User not found",
          value.email
        );
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      // ✅ بررسی صحت کد تأیید
      if (user.emailVerifyCode !== value.code) {
        console.warn("❌ Invalid email verification code for", value.email);
        return this.response(res, 400, false, "کد وارد شده صحیح نیست.");
      }

      // ✅ بررسی انقضای کد (۳ دقیقه)
      const currentTime = moment();
      const codeSentTime = moment(user.emailVerificationSentAt);
      const diffInMinutes = currentTime.diff(codeSentTime, "minutes");

      if (diffInMinutes > 3) {
        console.warn("❌ Expired email verification code for", value.email);
        return this.response(
          res,
          400,
          false,
          "کد تأیید منقضی شده است. لطفاً کد جدید دریافت کنید."
        );
      }

      // ✅ تأیید ایمیل و پاک کردن کد
      user.isEmailVerified = true;
      user.emailVerifyCode = null;
      user.emailVerificationSentAt = null;
      await user.save();

      // بعد از تأیید موفق ایمیل، توکن صادر می‌شود
      const secretKey = config.get("JWT_SECRET");
      const encoder = new TextEncoder();
      const token = await new SignJWT({ 
        userId: user.id,
        email: user.email,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("24h") // کاهش مدت زمان توکن به 24 ساعت
        .sign(encoder.encode(secretKey));

      const isProduction = process.env.NODE_ENV === "production";

      // تنظیمات امنیتی بهبود یافته برای کوکی
      res.cookie("token", token, getCookieConfig(isProduction));

      console.log("✅ Email verified successfully:", value.email);
      this.response(res, 200, true, "ایمیل شما با موفقیت تأیید شد.");
    } catch (error) {
      console.error("❌ Email verification failed:", error.message);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  // 📌 ارسال مجدد کد تأیید ایمیل
  async resendEmailVerificationCode(req, res) {
    try {
      // ✅ اعتبارسنجی ورودی‌ها
      const schema = Joi.object({
        email: Joi.string().email().required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        console.warn("❌ Invalid resend email verification input:", error.details[0].message);
        return this.response(res, 400, false, error.details[0].message);
      }

      // ✅ جستجوی کاربر بر اساس ایمیل
      const user = await this.User.findOne({ where: { email: value.email } });
      if (!user) {
        console.warn(
          "❌ Resend verification code attempt failed: User not found",
          value.email
        );
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      // ✅ بررسی اگر ایمیل قبلاً تأیید شده باشد
      if (user.isEmailVerified) {
        console.warn(
          "❌ Resend verification code attempt failed: Email already verified",
          value.email
        );
        return this.response(res, 400, false, "این ایمیل قبلاً تأیید شده است.");
      }

      // ✅ تولید کد جدید
      const newEmailVerifyCode = Math.floor(100000 + Math.random() * 900000);
      user.emailVerifyCode = newEmailVerifyCode;
      user.emailVerificationSentAt = moment().toDate();
      await user.save();

      // ✅ ارسال مجدد ایمیل تأییدیه
      await main(
        value.email,
        "کد تأیید ایمیل شما",
        "",
        `<div style="text-align: center;">
            <span style="font-family:'tahoma';font-size:'14px'">کد تأیید جدید ایمیل شما: </span><br>
            <b style="font-size: 24px;">${newEmailVerifyCode}</b>
          </div>`
      );
      console.log("🔄 New verification code sent to:", value.email);

      this.response(res, 200, true, "کد تأیید جدید به ایمیل شما ارسال شد.");
    } catch (error) {
      console.error("❌ Resend email verification failed:", error.message);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  // 📌 ارسال مجدد کد تأیید موبایل
  async resendMobileVerificationCode(req, res) {
    try {
      const { mobile } = req.body;

      // ✅ اعتبارسنجی ورودی‌ها
      const schema = Joi.object({
        mobile: Joi.string().pattern(/^[0-9]{11}$/).required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return this.response(res, 400, false, error.details[0].message);
      }

      // ✅ یافتن کاربر
      const user = await this.User.findOne({
        where: { mobile: value.mobile },
      });

      if (!user) {
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      // ✅ تولید کد جدید
      const mobileVerifyCode = Math.floor(100000 + Math.random() * 900000);
      user.mobileVerifyCode = mobileVerifyCode;
      await user.save();

      // ✅ ارسال پیامک جدید با استفاده از تمپلیت
      const data = JSON.stringify({
        mobile: value.mobile,
        templateId: config.get("SMS.TEMPLATE_ID"),
        parameters: [
          { name: "CODE", value: mobileVerifyCode.toString() }
        ]
      });

      const smsConfig = {
        method: "post",
        url: "https://api.sms.ir/v1/send/verify",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/plain",
          "x-api-key": config.get("SMS.API_KEY")
        },
        data: data
      };

      try {
        const response = await axios(smsConfig);
        console.log("✅ New SMS verification sent to:", value.mobile);
        console.log("📱 SMS Response:", response.data);
      } catch (smsError) {
        console.error("❌ Failed to send new SMS verification:", smsError.response?.data || smsError.message);
        return this.response(res, 500, false, "خطا در ارسال کد تأیید");
      }

      return this.response(res, 200, true, "کد تأیید جدید ارسال شد.");
    } catch (error) {
      console.error("❌ Failed to resend mobile verification code:", error);
      return this.response(res, 500, false, "خطا در ارسال کد تأیید");
    }
  }

  // 📌 تأیید کد ارسال شده به موبایل
  async verifyMobileCode(req, res) {
    try {
      const { mobile, code } = req.body;

      // ✅ اعتبارسنجی ورودی‌ها
      const schema = Joi.object({
        mobile: Joi.string().pattern(/^[0-9]{11}$/).required(),
        code: Joi.string().length(6).required(),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return this.response(res, 400, false, error.details[0].message);
      }

      // ✅ یافتن کاربر
      const user = await this.User.findOne({
        where: { mobile: value.mobile },
      });

      if (!user) {
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      // ✅ بررسی صحت کد
      if (user.mobileVerifyCode !== value.code) {
        return this.response(res, 400, false, "کد تأیید نامعتبر است.");
      }

      // ✅ تایید موبایل
      user.isMobileVerified = true;
      user.mobileVerifyCode = null;
      await user.save();

      // ✅ تولید توکن
      const secretKey = config.get("JWT_SECRET");
      const encoder = new TextEncoder();
      const token = await new SignJWT({ userId: user.id })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(encoder.encode(secretKey));

      // ✅ تنظیم کوکی
      const isProduction = process.env.NODE_ENV === "production";
      res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
        domain: isProduction ? ".zareoon.ir" : undefined,
        sameSite: isProduction ? "None" : "Lax",
      });

      return this.response(res, 200, true, "موبایل با موفقیت تایید شد.");
    } catch (error) {
      console.error("❌ Mobile verification failed:", error);
      return this.response(res, 500, false, "خطا در تایید موبایل");
    }
  }

  //---------------------------------------------------------------------------- 📌 ورود کاربر (Login)
  async login(req, res) {
    try {
      const value = req.body;
      console.log("Login attempt with identifier:", value.identifier);

      // ✅ بررسی کاربر بر اساس ایمیل یا موبایل
      const user = await this.User.findOne({
        where: {
          [Op.or]: [{ email: value.identifier }, { mobile: value.identifier }],
        },
        include: [{
          model: Role,
          as: "userRoles",
          attributes: ["id", "name", "nameEn", "nameFa"], // Include necessary role attributes
          through: { attributes: [] }, // Exclude UserRole attributes
        }],
      });

      if (!user) {
        console.warn("❌ Login failed: User not found", value.identifier);
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      // ✅ بررسی صحت رمز عبور
      const isPasswordValid = await bcrypt.compare(
        value.password,
        user.password
      );
      if (!isPasswordValid) {
        console.warn("❌ Login failed: Incorrect password for", value.identifier);
        return this.response(res, 400, false, "رمز عبور اشتباه است.");
      }

      // ✅ بررسی فعال بودن حساب
      if (!user.isActive) {
        console.warn("❌ Login failed: Account is not active", value.identifier);
        return this.response(
          res,
          403,
          false,
          "حساب شما غیرفعال است. لطفاً با پشتیبانی تماس بگیرید."
        );
      }

      console.log("User object after fetching and before token generation:", JSON.stringify(user, null, 2));
      console.log("User roles for tokenPayload:", user.userRoles);

      // ✅ تولید `JWT`
      const secretKey = config.get("JWT_SECRET");
      const encoder = new TextEncoder();
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        roles: user.userRoles && user.userRoles.length > 0 ? user.userRoles.map(role => ({ // Include all roles in the payload safely
          id: role.id,
          name: role.name,
          nameEn: role.nameEn,
          nameFa: role.nameFa,
        })) : [], // If no roles, send an empty array
      };

      const token = await new SignJWT(tokenPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(encoder.encode(secretKey));

      // ✅ ذخیره آخرین زمان ورود
      user.lastLogin = new Date();
      await user.save();

      const isProduction = process.env.NODE_ENV === "production";

      res.cookie("token", token, getCookieConfig(isProduction));

      console.log("✅ User logged in successfully:", user.email || user.mobile);
      console.log("Set-Cookie header sent:", res.getHeaders()['set-cookie']);
      console.log("Cookie config used:", getCookieConfig(isProduction));

      this.response(res, 200, true, "ورود موفقیت‌آمیز بود.", {
        user: {
          userId: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.userRoles && user.userRoles.length > 0 ? user.userRoles.map(role => ({ // Return all roles in the response safely
            id: role.id,
            name: role.name,
            nameEn: role.nameEn,
            nameFa: role.nameFa,
          })) : [], // If no roles, return an empty array
        }
      });
    } catch (error) {
      console.error("❌ Login failed:", error.message);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }
}

module.exports = new AuthController();
