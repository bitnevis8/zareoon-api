const express = require("express");
const { authenticateUser } = require("../user/auth/middleware");
const c = require("./controller");

const router = express.Router();

router.get("/catalog", c.listCatalog);
router.get("/mine", authenticateUser, c.listMine);
router.post("/", authenticateUser, c.createMine);
router.get("/me", authenticateUser, c.getMyWorkspace);
router.post("/me/switch", authenticateUser, c.switchMine);
router.get("/me/members", authenticateUser, c.listMembers);
router.post("/me/members", authenticateUser, c.inviteMember);
router.patch("/me/members/:memberId", authenticateUser, c.updateMemberRole);
router.delete("/me/members/:memberId", authenticateUser, c.removeMember);
router.post("/me/members/:memberId/accept", authenticateUser, c.acceptInvite);
router.patch("/me/activities", authenticateUser, c.updateActivities);

router.get("/me/verification", authenticateUser, c.getMyVerification);
router.post("/me/verification/person", authenticateUser, c.submitPersonVerification);
router.post("/me/verification/business", authenticateUser, c.submitBusinessVerification);
router.post("/me/verification/representation", authenticateUser, c.submitRepresentation);

router.get("/admin/verification/pending", authenticateUser, c.adminListPending);
router.post("/admin/verification/person/:userId", authenticateUser, c.adminReviewPerson);
router.post("/admin/verification/business/:workspaceId", authenticateUser, c.adminReviewBusiness);
router.post("/admin/verification/representation/:id", authenticateUser, c.adminReviewRepresentation);

module.exports = router;
