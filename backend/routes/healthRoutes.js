const express = require('express');
const router = express.Router();
const healthDataController = require('../controllers/healthDataController');
const authMiddleware = require('../config/authMiddleware');

router.get('/', authMiddleware, healthDataController.getHealthData);

module.exports = router;
