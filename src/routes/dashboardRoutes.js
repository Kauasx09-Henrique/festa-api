const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protectAdmin } = require('../middleware/authMiddleware');

router.get('/dashboard', protectAdmin, dashboardController.getStats);

module.exports = router;