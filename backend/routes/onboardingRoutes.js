const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');
const authMiddleware = require('../config/authMiddleware');
const { validateOnboarding } = require('../middleware/validator');

router.get('/', authMiddleware, onboardingController.getOnboarding);
router.post('/', [authMiddleware, validateOnboarding], onboardingController.saveOnboarding);

module.exports = router;
