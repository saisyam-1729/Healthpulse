const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const authMiddleware = require('../config/authMiddleware');

router.get('/', authMiddleware, alertController.getAlerts);
router.patch('/:id/resolve', authMiddleware, alertController.resolveAlert);

module.exports = router;
