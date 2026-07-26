const BaseController = require("../../../core/baseController");
const User = require("../user/model");
const Role = require("../role/model");
const { findDefaultUserRole, ensureSellerRole } = require("../../../utils/assignRole");
const bcrypt = require("bcryptjs");
const { SignJWT, jwtVerify } = require("jose");
const config = require("config");
const Joi = require("joi");
const axios = require("axios");
const { main } = require("../../../utils/emailSender/nodemailerConfig");
const moment = require("moment");
const { Op } = require("sequelize");
const { buildAccountNav } = require("../../account/navLabels");
const {
  getCookieConfig,
  setUserSessionCookie,
} = require("../../../utils/sessionToken");

class AuthController extends BaseController {

  constructor() {
    super();
    this.User = User; // اضافه کردن User به instance کلاس
  }

  serializeUser(user) {
    return {
      id: user.id,
      userId: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fatherName: user.fatherName,
      nationalId: user.nationalId,
      address: user.address,
      postalCode: user.postalCode,
      mobile: user.mobile,
      phone: user.phone,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      isMobileVerified: user.isMobileVerified,
      isActive: user.isActive,
      mustChangePassword: !!user.mustChangePassword,
      roles: (user.userRoles || []).map((role) => ({
        id: role.id,
        name: role.name,
        nameEn: role.nameEn,
        nameFa: role.nameFa,
      })),
    };
  }

  getSmsToday() {
    return new Date().toISOString().slice(0, 10);
  }

  /** سقف ۵ پیامک در روز برای هر کاربر/شماره */
  assertSmsDailyLimit(user) {
    const today = this.getSmsToday();
    const stored = user.smsDailyDate ? String(user.smsDailyDate).slice(0, 10) : null;
    if (stored !== today) {
      user.smsDailyCount = 0;
      user.smsDailyDate = today;
    }
    if ((user.smsDailyCount || 0) >= 5) {
      const err = new Error("سقف ۵ پیامک روزانه برای این شماره پر شده است");
      err.statusCode = 429;
      throw err;
    }
  }

  bumpSmsDaily(user) {
    const today = this.getSmsToday();
    const stored = user.smsDailyDate ? String(user.smsDailyDate).slice(0, 10) : null;
    if (stored !== today) {
      user.smsDailyCount = 0;
      user.smsDailyDate = today;
    }
    user.smsDailyCount = (user.smsDailyCount || 0) + 1;
  }

  async sendSmsCode(mobile, code) {
    const data = JSON.stringify({
      mobile,
      templateId: config.get("SMS.TEMPLATE_ID"),
      parameters: [{ name: "CODE", value: String(code) }],
    });
    await axios({
      method: "post",
      url: "https://api.sms.ir/v1/send/verify",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/plain",
        "x-api-key": config.get("SMS.API_KEY"),
      },
      data,
    });
  }

  isOtpExpired(sentAt, minutes = 3) {
    if (!sentAt) return true;
    const diffInMinutes = (Date.now() - new Date(sentAt).getTime()) / (1000 * 60);
    return diffInMinutes > minutes;
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
      // کاربر از طریق middleware احراز هویت شده است
      const userId = req.user.userId || req.user.id;
      
      if (!userId) {
        return this.response(res, 400, false, "شناسه کاربر یافت نشد.");
      }

      // ✅ یافتن اطلاعات کامل کاربر
      const user = await this.User.findOne({
        where: { id: userId },
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

      const accountNav = await buildAccountNav(user);
      const payload = { ...this.serializeUser(user), accountNav };

      // ✅ ارسال اطلاعات کاربر
      return this.response(res, 200, true, "اطلاعات کاربر دریافت شد.", payload);
    } catch (error) {
      return this.response(res, 401, false, "توکن نامعتبر است.");
    }
  }

  async updateProfile(req, res) {
    try {
      const userId = req.user.userId || req.user.id;
      if (!userId) {
        return this.response(res, 400, false, "شناسه کاربر یافت نشد.");
      }

      const schema = Joi.object({
        firstName: Joi.string().trim().min(1).max(100).required(),
        lastName: Joi.string().trim().min(1).max(100).required(),
        fatherName: Joi.string().trim().max(100).allow("", null),
        nationalId: Joi.string().trim().max(20).allow("", null),
        address: Joi.string().trim().max(1000).allow("", null),
        postalCode: Joi.string().trim().max(20).allow("", null),
        email: Joi.string().email().allow("", null),
        phone: Joi.string().trim().max(20).allow("", null),
        currentPassword: Joi.string().min(6).allow("", null),
        newPassword: Joi.string().min(6).allow("", null),
        confirmPassword: Joi.string().allow("", null),
      });

      const { error, value } = schema.validate(req.body);
      if (error) {
        return this.response(res, 400, false, error.details[0].message);
      }

      if (value.newPassword) {
        if (!value.currentPassword) {
          return this.response(res, 400, false, "برای تغییر رمز عبور، رمز فعلی را وارد کنید.");
        }
        if (value.newPassword !== value.confirmPassword) {
          return this.response(res, 400, false, "رمز عبور جدید و تکرار آن یکسان نیست.");
        }
      }

      const user = await this.User.findOne({
        where: { id: userId },
        include: [{
          model: Role,
          as: "userRoles",
          attributes: ["id", "name", "nameEn", "nameFa"],
          through: { attributes: [] },
        }],
      });

      if (!user) {
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      if (value.newPassword) {
        const passwordOk = await user.comparePassword(value.currentPassword);
        if (!passwordOk) {
          return this.response(res, 400, false, "رمز عبور فعلی نادرست است.");
        }
        user.password = value.newPassword;
      }

      if (value.email && value.email !== user.email) {
        const emailExists = await this.User.findOne({
          where: {
            email: value.email,
            id: { [Op.ne]: userId },
          },
        });
        if (emailExists) {
          return this.response(res, 400, false, "این ایمیل قبلاً ثبت شده است.");
        }
        user.email = value.email;
        user.isEmailVerified = false;
      } else if (value.email === "") {
        user.email = null;
        user.isEmailVerified = false;
      } else if (value.email) {
        user.email = value.email;
      }

      user.firstName = value.firstName;
      user.lastName = value.lastName;
      user.fatherName = value.fatherName || null;
      user.nationalId = value.nationalId || null;
      user.address = value.address || null;
      user.postalCode = value.postalCode || null;
      user.phone = value.phone || null;

      await user.save();

      return this.response(res, 200, true, "اطلاعات حساب کاربری بروزرسانی شد.", this.serializeUser(user));
    } catch (error) {
      console.error("❌ Profile update failed:", error.message);
      return this.response(res, 500, false, "خطا در بروزرسانی حساب کاربری", null, error);
    }
  }

  // 📌 -------------------------------------------------------------ثبت‌نام کاربر با ایمیل
  async registerWithEmail(req, res) {
    try {
      const value = req.body;

      const defaultUserRole = await findDefaultUserRole();

      if (!defaultUserRole) {
        console.error("❌ Default 'user' role not found. Please create it.");
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
      const UserRole = require("../userRole/model");
      await UserRole.create({
        userId: newUser.id,
        roleId: defaultUserRole.id
      });

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

      // ✅ JWT با نقش پیش‌فرض user
      await newUser.reload({ include: [{ model: Role, as: "userRoles" }] });
      const token = await setUserSessionCookie(res, newUser, { rememberMe: true });

      // ✅ بازیابی نقش‌ها برای کاربر جدید
      const roles = await newUser.getUserRoles();

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

      const defaultUserRole = await findDefaultUserRole();

      if (!defaultUserRole) {
        console.error("❌ Default 'user' role not found. Please create it.");
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
      const UserRole = require("../userRole/model");
      await UserRole.create({
        userId: newUser.id,
        roleId: defaultUserRole.id
      });

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

      // ✅ JWT با userId و نقش پیش‌فرض user
      await newUser.reload({ include: [{ model: Role, as: "userRoles" }] });
      const token = await setUserSessionCookie(res, newUser, { rememberMe: true });

      this.response(
        res,
        201,
        true,
        "حساب کاربری ایجاد شد. کد تأیید به موبایل ارسال شد.",
        {
          token,
          userId: newUser.id,
          email: newUser.email,
          username: newUser.username,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          isMobileVerified: newUser.isMobileVerified,
          roles: (newUser.userRoles || []).map((role) => ({
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
      const secretKey = require("../../../utils/jwtSecret").getJwtSecret();
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

      await user.reload({ include: [{ model: Role, as: "userRoles" }] });
      const token = await setUserSessionCookie(res, user, { rememberMe: true });

      return this.response(res, 200, true, "موبایل با موفقیت تایید شد.", {
        token,
        user: this.serializeUser(user),
      });
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

      // رمز موقت فراموشی — اعتبار ۵ دقیقه
      if (user.mustChangePassword && this.isOtpExpired(user.mobileVerificationSentAt, 5)) {
        return this.response(
          res,
          400,
          false,
          "رمز موقت منقضی شده است. دوباره فراموشی رمز عبور را بزنید."
        );
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
      const secretKey = require("../../../utils/jwtSecret").getJwtSecret();
      const encoder = new TextEncoder();
      const tokenPayload = {
        userId: user.id,
        id: user.id, // اضافه کردن id برای سازگاری
        email: user.email,
        username: user.username,
        roles: user.userRoles && user.userRoles.length > 0 ? user.userRoles.map(role => ({ // Include all roles in the payload safely
          id: role.id,
          name: role.name,
          nameEn: role.nameEn,
          nameFa: role.nameFa,
        })) : [], // If no roles, send an empty array
      };
      
      console.log("Token payload created:", tokenPayload);
      console.log("User ID in token:", user.id);

      const token = await new SignJWT(tokenPayload)
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(encoder.encode(secretKey));

      // ✅ ذخیره آخرین زمان ورود
      user.lastLogin = new Date();
      await user.save();

      const isProduction = process.env.NODE_ENV === "production";
      const rememberMe = value.rememberMe || false;

      res.cookie("token", token, getCookieConfig(isProduction, rememberMe));

      console.log("✅ User logged in successfully:", user.email || user.mobile);
      console.log("Set-Cookie header sent:", res.getHeaders()['set-cookie']);
      console.log("Cookie config used:", getCookieConfig(isProduction, rememberMe));
      console.log("Remember Me:", rememberMe);

      this.response(res, 200, true, "ورود موفقیت‌آمیز بود.", {
        token: token,
        mustChangePassword: !!user.mustChangePassword,
        user: {
          id: user.id,
          userId: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          mobile: user.mobile,
          isEmailVerified: user.isEmailVerified,
          isMobileVerified: user.isMobileVerified,
          isActive: user.isActive,
          mustChangePassword: !!user.mustChangePassword,
          roles: user.userRoles && user.userRoles.length > 0 ? user.userRoles.map(role => ({
            id: role.id,
            name: role.name,
            nameEn: role.nameEn,
            nameFa: role.nameFa,
          })) : [],
        }
      });
    } catch (error) {
      console.error("❌ Login failed:", error.message);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  // 📌 بررسی وجود کاربر بر اساس شناسه
  async checkIdentifier(req, res) {
    try {
      const { identifier, countryCode } = req.body;
      const { isValidEmail, isIranMobile, normalizePhoneNumber, detectPhoneCountry } = require("../../../utils/phoneCountries");
      const { getAuthSignupPublic } = require("../../siteSetting/service");

      if (!identifier) {
        return this.response(res, 400, false, "شناسه الزامی است");
      }

      const cfg = await getAuthSignupPublic();
      const raw = String(identifier).trim();
      const isEmail = raw.includes("@");
      let mobile = null;
      let isMobile = false;

      if (isEmail) {
        if (!cfg.emailEnabled) {
          return this.response(res, 400, false, "ثبت‌نام با ایمیل فعلاً غیرفعال است");
        }
        if (!isValidEmail(raw)) {
          return this.response(res, 400, false, "فرمت ایمیل نامعتبر است");
        }
      } else {
        if (!cfg.phoneEnabled) {
          return this.response(res, 400, false, "ثبت‌نام با موبایل فعلاً غیرفعال است");
        }
        const cc =
          countryCode ||
          detectPhoneCountry(raw) ||
          cfg.defaultPhoneCountry ||
          "IR";
        if (!cfg.allowedPhoneCountries.includes(String(cc).toUpperCase())) {
          return this.response(res, 400, false, "ثبت‌نام با موبایل این کشور فعال نیست");
        }
        mobile = isIranMobile(raw)
          ? raw
          : normalizePhoneNumber(cc, raw.replace(/^\+/, "").replace(/\D/g, "")) ||
            (raw.startsWith("+") ? raw : null);
        if (!mobile && isIranMobile(raw)) mobile = raw;
        if (!mobile) {
          // اگر قبلاً نرمال شده 09… باشد
          if (/^09\d{9}$/.test(raw)) mobile = raw;
          else if (raw.startsWith("+")) mobile = raw;
        }
        if (!mobile) {
          return this.response(res, 400, false, "فرمت شماره موبایل نامعتبر است");
        }
        isMobile = true;
      }

      const lookup = isEmail ? raw.toLowerCase() : mobile;
      let user = null;
      if (isEmail) {
        user = await this.User.findOne({ where: { email: lookup } });
      } else {
        user = await this.User.findOne({ where: { mobile: lookup } });
      }

      const userExists = !!(user && user.isActive);

      return this.response(res, 200, true, "بررسی انجام شد", {
        userExists,
        identifier: lookup,
        isEmail,
        isMobile,
      });
    } catch (error) {
      console.error("❌ Check identifier failed:", error);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  // 📌 تایید کد و تعیین نوع عملیات
  async verifyCode(req, res) {
    try {
      const { identifier, code, action } = req.body;

      if (!identifier || !code || !action) {
        return this.response(res, 400, false, "تمام فیلدها الزامی است");
      }

      const isEmail = String(identifier).includes("@");
      let user = null;

      if (isEmail) {
        user = await this.User.findOne({ where: { email: String(identifier).trim().toLowerCase() } });
      } else {
        user = await this.User.findOne({ where: { mobile: String(identifier).trim() } });
      }

      if (!user) {
        return this.response(res, 404, false, "کاربر یافت نشد");
      }

      const expected = isEmail ? user.emailVerifyCode : user.mobileVerifyCode;
      const sentAt = isEmail ? user.emailVerificationSentAt : user.mobileVerificationSentAt;

      if (String(expected) !== String(code).trim()) {
        return this.response(res, 400, false, "کد تایید اشتباه است");
      }

      if (!sentAt) {
        return this.response(res, 400, false, "زمان ارسال کد مشخص نیست");
      }

      if (this.isOtpExpired(sentAt, 3)) {
        return this.response(res, 400, false, "کد تایید منقضی شده است. دوباره درخواست دهید.");
      }

      if (action === "register") {
        if (isEmail) {
          user.isEmailVerified = true;
          user.emailVerifyCode = null;
        } else {
          user.isMobileVerified = true;
          user.mobileVerifyCode = null;
        }
        await user.save();

        const roles = await user.getUserRoles();

        return this.response(res, 200, true, "کد تایید شد", {
          action: "register",
          identifier: identifier,
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            mobile: user.mobile,
            email: user.email,
            username: user.username,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified,
            isActive: user.isActive,
            roles: roles.map((role) => ({
              id: role.id,
              name: role.name,
              nameEn: role.nameEn,
              nameFa: role.nameFa,
            })),
          },
        });
      } else if (action === "login") {
        // برای ورود - تولید JWT و ورود
        const secretKey = require("../../../utils/jwtSecret").getJwtSecret();
        const encoder = new TextEncoder();
        const token = await new SignJWT({
          userMobile: user.mobile,
          userEmail: user.email,
          userId: user.id,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("30d")
          .sign(encoder.encode(secretKey));

        const isProduction = process.env.NODE_ENV === "production";

        // HttpOnly cookie برای Web
        res.cookie("token", token, {
          httpOnly: true,
          secure: isProduction,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          path: "/",
          domain: isProduction ? ".zareoon.ir" : undefined,
          sameSite: isProduction ? "None" : "Lax",
        });

        // بازیابی نقش‌های کاربر
        const roles = await user.getUserRoles();

        return this.response(res, 200, true, "ورود موفق", {
          action: "login",
          token: token, // برای Mobile apps
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            mobile: user.mobile,
            email: user.email,
            username: user.username,
            isEmailVerified: user.isEmailVerified,
            isMobileVerified: user.isMobileVerified,
            isActive: user.isActive,
            roles: roles.map(role => ({
              id: role.id,
              name: role.name,
              nameEn: role.nameEn,
              nameFa: role.nameFa,
            }))
          }
        });
      } else if (action === "forgot") {
        // برای بازیابی رمز عبور
        return this.response(res, 200, true, "کد تایید شد", {
          action: "forgot",
          identifier: identifier
        });
      }

      return this.response(res, 400, false, "عملیات نامعتبر");
    } catch (error) {
      console.error("❌ Verify code failed:", error);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  // 📌 ارسال مجدد کد
  async resendCode(req, res) {
    try {
      const { identifier, action } = req.body;

      if (!identifier || !action) {
        return this.response(res, 400, false, "شناسه و نوع عملیات الزامی است");
      }

      // ورود با پیامک حذف شده — فقط register (و در صورت نیاز forgot از مسیر جدا)
      if (action === "login") {
        return this.response(res, 400, false, "ورود با پیامک غیرفعال است. از رمز عبور استفاده کنید.");
      }

      const isEmail = identifier.includes("@");
      let user = null;
      if (isEmail) {
        user = await this.User.findOne({ where: { email: identifier } });
      } else {
        user = await this.User.findOne({ where: { mobile: identifier } });
      }

      if (!user) {
        return this.response(res, 404, false, "کاربر یافت نشد");
      }

      try {
        this.assertSmsDailyLimit(user);
      } catch (limitErr) {
        return this.response(res, limitErr.statusCode || 429, false, limitErr.message);
      }

      const mobileVerifyCode = Math.floor(100000 + Math.random() * 900000);
      user.mobileVerifyCode = String(mobileVerifyCode);
      user.mobileVerificationSentAt = new Date();
      this.bumpSmsDaily(user);
      await user.save();

      try {
        await this.sendSmsCode(user.mobile, mobileVerifyCode);
      } catch (smsError) {
        console.error("❌ SMS sending failed:", smsError.response?.data || smsError.message);
        return this.response(res, 500, false, "خطا در ارسال پیامک");
      }

      return this.response(res, 200, true, "کد جدید ارسال شد", {
        expiresInSeconds: 180,
      });
    } catch (error) {
      console.error("❌ Resend code failed:", error);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  // 📌 ارسال کد برای ثبت‌نام (ایجاد کاربر موقت) — موبایل یا ایمیل
  async sendCodeForRegistration(req, res) {
    try {
      const { mobile, email, identifier } = req.body;
      const { isValidEmail, isIranMobile } = require("../../../utils/phoneCountries");
      const { getAuthSignupPublic } = require("../../siteSetting/service");
      const cfg = await getAuthSignupPublic();

      const raw = String(identifier || email || mobile || "").trim();
      if (!raw) {
        return this.response(res, 400, false, "ایمیل یا شماره موبایل الزامی است");
      }

      const isEmail = raw.includes("@");
      const defaultUserRole = await findDefaultUserRole();
      if (!defaultUserRole) {
        return this.response(res, 500, false, "نقش پیش‌فرض یافت نشد.");
      }

      if (isEmail) {
        if (!cfg.emailEnabled) {
          return this.response(res, 400, false, "ثبت‌نام با ایمیل فعلاً غیرفعال است");
        }
        const addr = raw.toLowerCase();
        if (!isValidEmail(addr)) {
          return this.response(res, 400, false, "فرمت ایمیل نامعتبر است");
        }

        let user = await this.User.findOne({ where: { email: addr } });
        if (user && user.isActive) {
          return this.response(res, 409, false, "این ایمیل قبلاً ثبت شده است");
        }

        const emailVerifyCode = Math.floor(100000 + Math.random() * 900000);

        if (user) {
          user.emailVerifyCode = String(emailVerifyCode);
          user.emailVerificationSentAt = new Date();
          user.isEmailVerified = false;
          user.isActive = false;
          await user.save();
        } else {
          user = await this.User.create({
            firstName: "temp",
            lastName: "temp",
            email: addr,
            username: `temp_${Date.now()}`,
            password: `temp_${Math.random().toString(36).slice(2)}`,
            emailVerifyCode: String(emailVerifyCode),
            emailVerificationSentAt: new Date(),
            isEmailVerified: false,
            isActive: false,
          });
          user.username = `Zareoon_u_${user.id}`;
          await user.save();
          const UserRole = require("../userRole/model");
          await UserRole.create({ userId: user.id, roleId: defaultUserRole.id });
        }

        try {
          await main(
            addr,
            "کد تأیید ثبت‌نام زارعون",
            "",
            `
            <div style="text-align:center;font-family:tahoma,sans-serif;font-size:14px;line-height:1.8">
              <p>کد تأیید ثبت‌نام شما در زارعون:</p>
              <b style="font-size:28px;letter-spacing:4px">${emailVerifyCode}</b>
              <p style="color:#666;font-size:12px;margin-top:16px">اگر این ایمیل را در Inbox ندیدید، پوشه Spam / هرزنامه را هم بررسی کنید.</p>
            </div>
            `
          );
        } catch (mailErr) {
          console.error("❌ Email sending failed:", mailErr.message || mailErr);
          return this.response(res, 500, false, "خطا در ارسال ایمیل");
        }

        return this.response(res, 200, true, "کد تأیید به ایمیل ارسال شد", {
          expiresInSeconds: 180,
          channel: "email",
        });
      }

      // موبایل
      if (!cfg.phoneEnabled) {
        return this.response(res, 400, false, "ثبت‌نام با موبایل فعلاً غیرفعال است");
      }
      if (!isIranMobile(raw) && !String(raw).startsWith("+")) {
        return this.response(res, 400, false, "فرمت شماره موبایل نامعتبر است");
      }
      if (!isIranMobile(raw)) {
        return this.response(
          res,
          400,
          false,
          "ارسال پیامک فعلاً فقط برای شماره‌های ایران (+۹۸) فعال است"
        );
      }

      const phone = raw;
      let user = await this.User.findOne({ where: { mobile: phone } });

      if (user && user.isActive) {
        return this.response(res, 409, false, "این شماره موبایل قبلاً ثبت شده است");
      }

      if (user) {
        try {
          this.assertSmsDailyLimit(user);
        } catch (limitErr) {
          return this.response(res, limitErr.statusCode || 429, false, limitErr.message);
        }
      }

      const mobileVerifyCode = Math.floor(100000 + Math.random() * 900000);

      if (user) {
        user.mobileVerifyCode = String(mobileVerifyCode);
        user.mobileVerificationSentAt = new Date();
        user.isMobileVerified = false;
        user.isActive = false;
        this.bumpSmsDaily(user);
        await user.save();
      } else {
        user = await this.User.create({
          firstName: "temp",
          lastName: "temp",
          mobile: phone,
          username: `temp_${Date.now()}`,
          password: `temp_${Math.random().toString(36).slice(2)}`,
          mobileVerifyCode: String(mobileVerifyCode),
          mobileVerificationSentAt: new Date(),
          isMobileVerified: false,
          isActive: false,
          smsDailyCount: 1,
          smsDailyDate: this.getSmsToday(),
        });
        user.username = `Zareoon_u_${user.id}`;
        await user.save();
        const UserRole = require("../userRole/model");
        await UserRole.create({ userId: user.id, roleId: defaultUserRole.id });
      }

      try {
        await this.sendSmsCode(phone, mobileVerifyCode);
      } catch (smsError) {
        console.error("❌ SMS sending failed:", smsError.response?.data || smsError.message);
        return this.response(res, 500, false, "خطا در ارسال پیامک");
      }

      return this.response(res, 200, true, "کد تایید ارسال شد", {
        expiresInSeconds: 180,
        channel: "sms",
      });
    } catch (error) {
      console.error("❌ Send code for registration failed:", error);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  // 📌 تکمیل ثبت‌نام
  async completeRegistration(req, res) {
    try {
      const { firstName, lastName, fullName, mobile, email, identifier, password, acceptTerms } =
        req.body;

      const resolvedFirst =
        (firstName && String(firstName).trim()) ||
        (fullName ? String(fullName).trim().split(/\s+/)[0] : "");
      const resolvedLast =
        (lastName && String(lastName).trim()) ||
        (fullName ? String(fullName).trim().split(/\s+/).slice(1).join(" ") : "");

      const idRaw = String(identifier || email || mobile || "").trim();
      if (!resolvedFirst || !resolvedLast || !password || !idRaw) {
        return this.response(res, 400, false, "نام، نام خانوادگی، شناسه و رمز عبور الزامی است");
      }
      if (acceptTerms === false) {
        return this.response(res, 400, false, "پذیرش قوانین الزامی است");
      }
      if (String(password).length < 6) {
        return this.response(res, 400, false, "رمز عبور باید حداقل ۶ کاراکتر باشد");
      }

      const isEmail = idRaw.includes("@");
      const user = isEmail
        ? await this.User.findOne({ where: { email: idRaw.toLowerCase() } })
        : await this.User.findOne({ where: { mobile: idRaw } });

      if (!user) {
        return this.response(res, 404, false, "کاربر یافت نشد");
      }
      if (isEmail && !user.isEmailVerified) {
        return this.response(res, 400, false, "ایمیل تایید نشده است");
      }
      if (!isEmail && !user.isMobileVerified) {
        return this.response(res, 400, false, "شماره موبایل تایید نشده است");
      }

      user.firstName = resolvedFirst;
      user.lastName = resolvedLast;
      user.password = password;
      user.isActive = true;
      user.mustChangePassword = false;
      user.mobileVerifyCode = null;
      user.emailVerifyCode = null;
      if (!user.username || String(user.username).startsWith("temp_")) {
        user.username = `Zareoon_u_${user.id}`;
      }
      await user.save();

      await user.reload({ include: [{ model: Role, as: "userRoles" }] });
      const token = await setUserSessionCookie(res, user, { rememberMe: true });

      return this.response(res, 200, true, "ثبت‌نام تکمیل شد", {
        token,
        user: {
          ...this.serializeUser(user),
          mustChangePassword: false,
        },
      });
    } catch (error) {
      console.error("❌ Complete registration failed:", error);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  /** فراموشی رمز — ارسال رمز موقت پیامکی */
  async forgotPassword(req, res) {
    try {
      const { mobile, identifier } = req.body;
      const phone = mobile || identifier;
      if (!phone || !/^09\d{9}$/.test(phone)) {
        return this.response(res, 400, false, "شماره موبایل معتبر الزامی است");
      }

      const user = await this.User.findOne({ where: { mobile: phone } });
      if (!user || !user.isActive) {
        return this.response(res, 404, false, "حساب کاربری یافت نشد");
      }

      try {
        this.assertSmsDailyLimit(user);
      } catch (limitErr) {
        return this.response(res, limitErr.statusCode || 429, false, limitErr.message);
      }

      const tempPassword = String(Math.floor(100000 + Math.random() * 900000));
      user.password = tempPassword;
      user.mustChangePassword = true;
      user.mobileVerificationSentAt = new Date();
      this.bumpSmsDaily(user);
      await user.save();

      try {
        await this.sendSmsCode(phone, tempPassword);
      } catch (smsError) {
        console.error("❌ SMS sending failed:", smsError.response?.data || smsError.message);
        return this.response(res, 500, false, "خطا در ارسال پیامک");
      }

      return this.response(res, 200, true, "رمز موقت پیامک شد", {
        expiresInSeconds: 300,
      });
    } catch (error) {
      console.error("❌ Forgot password failed:", error);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  /** تنظیم رمز جدید پس از ورود با رمز موقت */
  async setNewPassword(req, res) {
    try {
      const { newPassword, confirmPassword } = req.body;
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        return this.response(res, 401, false, "وارد حساب کاربری شوید.");
      }
      if (!newPassword || newPassword !== confirmPassword) {
        return this.response(res, 400, false, "رمز عبور و تکرار آن باید یکسان باشند");
      }
      if (String(newPassword).length < 6) {
        return this.response(res, 400, false, "رمز عبور باید حداقل ۶ کاراکتر باشد");
      }

      const user = await this.User.findByPk(userId, {
        include: [{ model: Role, as: "userRoles", through: { attributes: [] } }],
      });
      if (!user) {
        return this.response(res, 404, false, "کاربر یافت نشد");
      }
      if (!user.mustChangePassword) {
        return this.response(res, 400, false, "تغییر رمز اجباری نیست");
      }

      user.password = newPassword;
      user.mustChangePassword = false;
      await user.save();

      return this.response(res, 200, true, "رمز عبور جدید ذخیره شد", {
        user: this.serializeUser(user),
      });
    } catch (error) {
      console.error("❌ Set new password failed:", error);
      this.response(res, 500, false, "خطای داخلی سرور", null, error);
    }
  }

  /** عضویت فروشندگان — افزودن نقش seller + رزرو نام صفحه */
  async becomeSeller(req, res) {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        return this.response(res, 401, false, "وارد حساب کاربری شوید.");
      }

      const {
        profileSlug,
        shopName,
        displayName,
        shopDisplayName,
        publicPhone,
        publicLandline,
        publicEmail,
        businessHours,
        latitude,
        longitude,
        addressLabel,
        headline,
      } = req.body || {};
      const rawSlug = profileSlug || shopName;
      const pageDisplayName = String(displayName || shopDisplayName || "").trim();

      const { assertPublicSlugAvailable } = require("../../../utils/publicPageSlug");
      const { getOrCreateAccountForUser } = require("../../account/profileService");
      const { isShopsAutoApprove } = require("../../siteSetting/service");
      const { initialStatusFromAutoApprove } = require("../../../utils/pageLifecycle");

      const result = await ensureSellerRole(userId);
      if (!result.ok) {
        return this.response(res, 500, false, "نقش فروشنده در سامانه تعریف نشده است.");
      }

      const user = await this.User.findByPk(userId, {
        include: [{ model: Role, as: "userRoles" }],
      });
      if (!user) {
        return this.response(res, 404, false, "کاربر یافت نشد.");
      }

      const account = await getOrCreateAccountForUser(user);
      const autoApprove = await isShopsAutoApprove();
      const shopStatus = initialStatusFromAutoApprove(autoApprove);

      const accountPatch = {
        isPublic: true,
        shopStatus,
        deletionRequestedAt: null,
      };
      if (pageDisplayName) {
        accountPatch.displayName = pageDisplayName.slice(0, 120);
      }
      if (headline !== undefined) accountPatch.headline = String(headline || "").slice(0, 200) || null;
      if (publicPhone !== undefined) accountPatch.publicPhone = String(publicPhone || "").slice(0, 30) || null;
      if (publicLandline !== undefined) {
        accountPatch.publicLandline = String(publicLandline || "").slice(0, 30) || null;
      }
      if (publicEmail !== undefined) {
        accountPatch.publicEmail = String(publicEmail || "").trim().slice(0, 120) || null;
      }
      {
        const { normalizeShopContacts, legacyFromContacts, applyShopContactsToAccountPatch } = require("../../../utils/shopContacts");
        const applied = applyShopContactsToAccountPatch(req.body || {}, accountPatch);
        if (!applied && (publicPhone !== undefined || publicLandline !== undefined || publicEmail !== undefined)) {
          const contacts = normalizeShopContacts(null, {
            publicPhone: accountPatch.publicPhone,
            publicLandline: accountPatch.publicLandline,
            publicEmail: accountPatch.publicEmail,
          });
          accountPatch.shopContacts = contacts;
          Object.assign(accountPatch, legacyFromContacts(contacts));
        }
      }
      if (businessHours && typeof businessHours === "object") accountPatch.businessHours = businessHours;
      if (addressLabel !== undefined) {
        accountPatch.addressLabel = String(addressLabel || "").trim().slice(0, 300) || null;
      }
      if (latitude != null && longitude != null && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
        accountPatch.latitude = Number(latitude);
        accountPatch.longitude = Number(longitude);
      }

      // اگر قبلاً برای خدمات/فروشگاه اسلاگ دارد، دوباره نپرس
      if (!rawSlug || !String(rawSlug).trim()) {
        if (!account.profileSlug) {
          return this.response(res, 400, false, "ابتدا آدرس صفحه فروشگاه را انتخاب کنید");
        }
      } else {
        try {
          if (!account.profileSlug) {
            if (!pageDisplayName) {
              return this.response(res, 400, false, "نام نمایشی فروشگاه را وارد کنید");
            }
            const slug = await assertPublicSlugAvailable(rawSlug, {
              excludeAccountId: account.id,
              excludeUserId: userId,
            });
            accountPatch.profileSlug = slug;
          }
        } catch (slugErr) {
          return this.response(res, slugErr.statusCode || 400, false, slugErr.message);
        }
      }

      await account.update(accountPatch);
      await account.reload();
      const TradeServiceProvider = require("../../tradeServiceProvider/model");
      if (account.profileSlug) {
        await TradeServiceProvider.update(
          { profileSlug: account.profileSlug },
          { where: { userId } }
        );
      }

      await user.reload({ include: [{ model: Role, as: "userRoles" }] });
      const { buildAccountNav } = require("../../account/navLabels");
      const accountNav = await buildAccountNav(user);

      // نقش seller بلافاصله در JWT هم اعمال شود تا محدودیت نقش نماند
      const token = await setUserSessionCookie(res, user, { rememberMe: true });

      const message = autoApprove
        ? result.created
          ? "فروشگاه شما ساخته شد و فعال است."
          : "شما از قبل فروشنده هستید."
        : "فروشگاه ثبت شد و پس از تأیید مدیریت فعال می‌شود.";

      return this.response(res, 200, true, message, {
        ...this.serializeUser(user),
        token,
        profileSlug: account.profileSlug,
        shopStatus: account.shopStatus,
        accountNav,
        awaitsApproval: !autoApprove,
      });
    } catch (error) {
      console.error("becomeSeller error:", error);
      return this.response(res, 500, false, "خطا در فعال‌سازی عضویت فروشنده", null, error);
    }
  }
}

module.exports = new AuthController();
