const express = require("express");
const baseRouter = express.Router();

// Import routers
const userRouter = require('../modules/user/route');
const authRouter = require('../modules/user/auth/route');
const roleRouter = require('../modules/user/role/route');
const fileUploadRouter = require('../modules/fileUpload/route');
const locationRouter = require('../modules/location/route');
const supplierRouter = require('../modules/farmer/route');
const lcRequestRouter = require('../modules/lcRequest/route');
const serviceRequestRouter = require('../modules/serviceRequest/route');
const tradeServiceProviderRouter = require('../modules/tradeServiceProvider/route');
const siteSettingRouter = require('../modules/siteSetting/route');
const messagingRouter = require('../modules/messaging/route');
const supplierProfileRouter = require('../modules/supplierProfile/route');
const applicantRequestRouter = require('../modules/applicantRequest/route');
const escrowRouter = require('../modules/escrow/route');
const subscriptionRouter = require('../modules/subscription/route');
const backupRouter = require('../modules/backup/route');
const publicSlugRouter = require('../modules/publicSlug/route');

// Use routers
baseRouter.use('/user', userRouter);
baseRouter.use('/user/auth', authRouter);
baseRouter.use('/user/role', roleRouter);
baseRouter.use('/file-upload', fileUploadRouter);
baseRouter.use('/location', locationRouter);
baseRouter.use('/supplier', supplierRouter);
baseRouter.use('/farmer', supplierRouter); // alias قدیمی
baseRouter.use('/lc-request', lcRequestRouter);
baseRouter.use('/service-request', serviceRequestRouter);
baseRouter.use('/trade-service-provider', tradeServiceProviderRouter);
baseRouter.use('/site-setting', siteSettingRouter);
baseRouter.use('/messaging', messagingRouter);
baseRouter.use('/tamin', supplierProfileRouter);
baseRouter.use('/applicant-request', applicantRequestRouter);
baseRouter.use('/escrow', escrowRouter);
baseRouter.use('/subscription', subscriptionRouter);
baseRouter.use('/backup', backupRouter);
baseRouter.use('/public-slug', publicSlugRouter);

module.exports = baseRouter;
