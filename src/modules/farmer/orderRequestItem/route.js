const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { authorizeRole } = require('../../user/auth/middleware');

// Update status of a specific order request item
router.patch('/:id/status', authorizeRole("Administrator"), controller.updateStatus);

module.exports = router;
