const express = require('express');
const router = express.Router();
const trackController = require('../controllers/trackController');

// The beacon sends POST requests
router.post('/', trackController.trackEvents);

module.exports = router;
