const express = require('express');
const router = express.Router();
const { analyzeSkinCondition } = require('../services/dermatologyService');
const authMiddleware = require('../config/authMiddleware');

/**
 * POST /api/skin/analyze
 * Wrapper for dermatology analysis
 */
router.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const { condition_name, confidence_score, symptoms } = req.body;
    
    // If no condition name provided, we might be simulating or expecting it from an image later
    // For now, we follow the dermatology logic
    const analysis = analyzeSkinCondition({
      condition_name,
      confidence_score: confidence_score || 0.85, // Default for testing if not provided
      symptoms: symptoms || []
    });

    res.json({ success: true, data: analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
