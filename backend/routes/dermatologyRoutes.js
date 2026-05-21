const express = require('express');
const router = express.Router();
const dermatologyController = require('../controllers/dermatologyController');
const auth = require('../config/authMiddleware');

// POST /api/dermatology/analyze
router.post('/analyze', auth, dermatologyController.analyzeSkin);

module.exports = router;
