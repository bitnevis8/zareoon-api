const express = require("express");
const router = express.Router();
const locationController = require("./controller");
const { authenticateUser, authorizeRole } = require("../user/auth/middleware");

const adminOnly = [authenticateUser, authorizeRole("Administrator")];

router.get("/getAll", locationController.getAll);
router.get("/getOne/:id", locationController.getOne);
router.get("/getBySlug/:slug", locationController.getBySlug);
router.get("/getByName/:name", locationController.getByName);
router.get("/getChildren/:parentId", locationController.getChildren);
router.get("/getChildrenBySlug/:parentSlug", locationController.getChildrenBySlug);
router.get("/getByDivisionType/:type", locationController.getByDivisionType);
router.get("/getHierarchy/:id", locationController.getHierarchy);
router.get("/getHierarchyBySlug/:slug", locationController.getHierarchyBySlug);
router.get("/getWikiDetails/:id", locationController.getWikiDetails);
router.get("/getWikiDetailsBySlug/:slug", locationController.getWikiDetailsBySlug);
router.get("/getWikidataInfo/:id", locationController.getWikidataInfo);
router.get("/getWikidataInfoBySlug/:slug", locationController.getWikidataInfoBySlug);

router.get("/search", locationController.search);
router.post("/create", ...adminOnly, locationController.create);
router.put("/update/:id", ...adminOnly, locationController.update);
router.put("/updateBySlug/:slug", ...adminOnly, locationController.updateBySlug);
router.delete("/delete/:id", ...adminOnly, locationController.delete);
router.delete("/deleteBySlug/:slug", ...adminOnly, locationController.deleteBySlug);

module.exports = router;
