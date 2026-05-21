const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../config/authMiddleware');
const OnboardingData = require('../models/OnboardingData');
const HealthAnalysis = require('../models/HealthAnalysis');
const Report = require('../models/Report');
const HealthData = require('../models/HealthData');
const { checkCriticalConditions } = require('../services/ruleEngine');
const { predictCondition } = require('../services/predictionService');
const { getAyurvedicRecommendations } = require('../services/ayurvedaService');
const { analyzeReport } = require('../services/informaticsService');

/**
 * POST /api/ai/analyze
 * Full Hybrid Health Intelligence Pipeline:
 *  1. Fetch onboarding + latest report + latest IoT vitals
 *  2. Call Python /ai/predict (ensemble ML)
 *  3. Fallback to Node.js rule engine if Python is down
 *  4. Merge all data and save
 */
router.post('/analyze', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { sensorData, skinAnalysis } = req.body;

    // 1. Fetch data sources
    const onboarding = await OnboardingData.findOne({ user_id: userId }).sort({ createdAt: -1 });
    const latestReport = await Report.findOne({ userId }).sort({ createdAt: -1 });
    const latestSensor = await HealthData.findOne({ userId }).sort({ createdAt: -1 });

    // Fuse body sensor data with DB sensor data
    const vitals = sensorData || {};
    if (latestSensor) {
      vitals.heart_rate = vitals.heartRate || vitals.heart_rate || latestSensor.heartRate;
      vitals.spo2 = vitals.spo2 || latestSensor.spo2;
      vitals.temperature = vitals.temperature || latestSensor.temperature;
    }

    // 2. Call Unified AI Medical Informatics Engine (11-Step Pipeline)
    const result = analyzeReport({
      reportData: latestReport?.extractedData || [],
      onboardingData: onboarding || {},
      sensorData: vitals,
      skinAnalysis: skinAnalysis || null
    });

    // 3. Save to History
    const analysisRecord = new HealthAnalysis({
      user_id: userId,
      type: result.alert ? 'EMERGENCY' : 'NORMAL',
      condition: result.predictions?.[0]?.condition || "Healthy",
      healthScore: result.summary.health_score,
      riskLevel: result.summary.riskLevel,
      dominantDosha: result.predictions?.[0]?.dosha || "Balanced",
      recommendations: result.recommendations,
      sensorData: vitals,
      skinAnalysis: result.skin_analysis,
      timestamp: new Date()
    });

    await analysisRecord.save();

    // 4. Update latest report if one was analyzed
    if (latestReport) {
      latestReport.analysis = result;
      await latestReport.save();
    }

    res.json({
      success: true,
      data: result,
      message: "Unified health analysis completed"
    });

  } catch (err) {
    console.error("[AI] Unified Engine Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/latest
 * Fetch user's latest analysis + latest report parameters
 */
router.get('/latest', authMiddleware, async (req, res) => {
  try {
    const analysis = await HealthAnalysis.findOne({ user_id: req.user.id }).sort({ timestamp: -1 });
    const latestReport = await Report.findOne({ userId: req.user.id }).sort({ createdAt: -1 });

    if (!analysis) return res.json(null);

    const responseObj = analysis.toObject();
    responseObj.reportParameters = latestReport?.extractedData || [];
    responseObj.reportAnalysis = latestReport?.analysis || null;

    res.json(responseObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/ai/history
 * Fetch user's analysis history
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const history = await HealthAnalysis.find({ user_id: req.user.id }).sort({ timestamp: -1 }).limit(10);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
