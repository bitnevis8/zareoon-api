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
const messagingRouter = require('../modules/messaging/route');
const supplierProfileRouter = require('../modules/supplierProfile/route');

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
baseRouter.use('/messaging', messagingRouter);
baseRouter.use('/tamin', supplierProfileRouter);

module.exports = baseRouter;
