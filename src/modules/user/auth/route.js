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

module.exports = router;
