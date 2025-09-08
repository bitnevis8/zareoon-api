const express = require("express");
const authController = require("./controller");

const router = express.Router();

// 📌 مسیرهای احراز هویت
router.post("/register/email", authController.registerWithEmail); // ثبت‌نام با ایمیل
router.post("/register/mobile", authController.registerWithMobile); // ثبت‌نام با موبایل
router.post("/resend-code/email", authController.resendEmailVerificationCode); // ارسال مجدد کد احراز ایمیل
router.post("/verify/email", authController.verifyEmailCode); // تأیید کد احراز ایمیل
router.post("/resend-code/mobile", authController.resendMobileVerificationCode); // ارسال مجدد کد تأیید موبایل
router.post("/verify/mobile", authController.verifyMobileCode); // تأیید کد احراز موبایل
router.post("/login", authController.login); // لاگین کاربر
router.get("/me", authController.getUserData);
router.post("/logout", authController.logout); // مسیر خروج

// مسیرهای جدید سیستم احراز هویت
router.post("/check-identifier", authController.checkIdentifier); // بررسی وجود کاربر
router.post("/verify-code", authController.verifyCode); // تایید کد
router.post("/resend-code", authController.resendCode); // ارسال مجدد کد
router.post("/send-code-for-registration", authController.sendCodeForRegistration); // ارسال کد برای ثبت‌نام
router.post("/complete-registration", authController.completeRegistration); // تکمیل ثبت‌نام
router.post("/clear-sessions", authController.clearAllSessions); // پاک کردن تمام sessions

module.exports = router;
