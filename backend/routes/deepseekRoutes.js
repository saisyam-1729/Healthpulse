const express = require('express');
const router = express.Router();
const { queryDeepSeek } = require('../services/deepseekService');
const authMiddleware = require('../config/authMiddleware');
const OnboardingData = require('../models/OnboardingData');
const Report = require('../models/Report');

/**
 * POST /api/deepseek/chat
 * Consult the Doctor AI Agent
 */
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { message, skinAnalysis } = req.body;
    const userId = req.user.id;

    // Fetch context for the agent
    const onboarding = await OnboardingData.findOne({ user_id: userId }).sort({ createdAt: -1 });
    const latestReport = await Report.findOne({ userId }).sort({ createdAt: -1 });

    const context = {
      age: onboarding?.age,
      gender: onboarding?.gender,
      symptoms: onboarding?.has_bp ? "Blood pressure issues" : "None reported",
      bloodReport: latestReport?.extractedData,
      skinAnalysis: skinAnalysis || latestReport?.analysis?.skin_analysis
    };

    const response = await queryDeepSeek({
      prompt: message,
      context
    });

    res.json({
      success: true,
      data: response
    });
  } catch (err) {
    console.error("[DeepSeek Route] Error:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
