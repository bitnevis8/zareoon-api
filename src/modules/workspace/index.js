/**
 * دامنه Workspace — چند کسب‌وکار به ازای هر کاربر
 *
 * User = شخص (احراز هویت شخص)
 * Workspace = کسب‌وکار (محصولات، خدمات، تیم، اشتراک، صفحه عمومی، احراز شرکت)
 *
 * نقش‌ها:
 * - PLATFORM (جدول roles / JWT): مدیرکل، مدیر، پشتیبان، ناظر محتوا، مسئول احراز/مالی/اشتراک، کاربر
 * - WORKSPACE (workspace_members.role): مالک، مدیر، کارشناس فروش، مدیر سفارش‌ها، ویرایشگر محصولات، فقط مشاهده
 * - ACTIVITY (فلگ روی workspace): خریدار / فروشنده / خدمات‌دهنده — ACL نیستند
 *   نقش‌های seller و service_provider در جدول roles فقط برای سازگاری موقت نگه داشته شده‌اند.
 *
 * اشتراک روی Workspace است؛ Plan ≠ BillingPeriod
 * نشان عضو طلایی ≠ هویت تأییدشده ≠ کسب‌وکار تأییدشده
 *
 * API:
 * - GET /workspace/catalog
 * - GET /workspace/mine
 * - POST /workspace
 * - GET /workspace/me  (+ هدر X-Workspace-Id)
 * - POST /workspace/me/switch
 * - GET/POST /workspace/me/members
 *
 * Migration: 20250725120000… + 20250725140000-user-active-workspace.js
 */

module.exports = {};
