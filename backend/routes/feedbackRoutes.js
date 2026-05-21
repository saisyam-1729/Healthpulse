const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const authMiddleware = require('../config/authMiddleware');
const { validateFeedback } = require('../middleware/validator');

// POST /api/feedback
router.post('/', [authMiddleware, validateFeedback], feedbackController.createFeedback);

// GET /api/feedback
router.get('/', feedbackController.getFeedback);

module.exports = router;
