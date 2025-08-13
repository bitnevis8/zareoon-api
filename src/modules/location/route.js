const express = require("express");
const router = express.Router();
const locationController = require("./controller");

// روت‌های مربوط به لوکیشن‌ها
router.get("/getAll", locationController.getAll); // دریافت تمام لوکیشن‌ها
router.get("/getOne/:id", locationController.getOne); // دریافت یک لوکیشن بر اساس ID
router.get("/getBySlug/:slug", locationController.getBySlug); // دریافت یک لوکیشن بر اساس slug
router.get("/getByName/:name", locationController.getByName); // دریافت لوکیشن بر اساس نام
router.get("/getChildren/:parentId", locationController.getChildren); // دریافت فرزندان یک لوکیشن
router.get("/getChildrenBySlug/:parentSlug", locationController.getChildrenBySlug); // دریافت فرزندان یک لوکیشن بر اساس slug والد
router.get("/getByDivisionType/:type", locationController.getByDivisionType); // دریافت لوکیشن‌ها بر اساس نوع تقسیمات کشوری
router.get("/getHierarchy/:id", locationController.getHierarchy); // دریافت درخت سلسله‌مراتبی
router.get("/getHierarchyBySlug/:slug", locationController.getHierarchyBySlug); // دریافت درخت سلسله‌مراتبی بر اساس slug
router.get("/getWikiDetails/:id", locationController.getWikiDetails); // دریافت اطلاعات ویکی‌پدیا برای لوکیشن
router.get("/getWikiDetailsBySlug/:slug", locationController.getWikiDetailsBySlug); // دریافت اطلاعات ویکی‌پدیا برای لوکیشن بر اساس slug
router.get("/getWikidataInfo/:id", locationController.getWikidataInfo); // دریافت اطلاعات Wikidata برای لوکیشن
router.get("/getWikidataInfoBySlug/:slug", locationController.getWikidataInfoBySlug); // دریافت اطلاعات Wikidata برای لوکیشن بر اساس slug

router.get("/search", locationController.search); // جستجوی لوکیشن‌ها
router.post("/create", locationController.create); // ایجاد لوکیشن جدید
router.put("/update/:id", locationController.update); // ویرایش لوکیشن بر اساس ID
router.put("/updateBySlug/:slug", locationController.updateBySlug); // ویرایش لوکیشن بر اساس slug
router.delete("/delete/:id", locationController.delete); // حذف لوکیشن بر اساس ID
router.delete("/deleteBySlug/:slug", locationController.deleteBySlug); // حذف لوکیشن بر اساس slug

module.exports = router; 