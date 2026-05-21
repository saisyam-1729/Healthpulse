const HealthData = require('../models/HealthData');
const HealthAnalysis = require('../models/HealthAnalysis');
const OnboardingData = require('../models/OnboardingData');
const { generateHealthInsights } = require('./healthEngine');
const Alert = require('../models/Alert');
const axios = require('axios');

/**
 * Perform intelligent health analysis based on sensor data and onboarding profile.
 */
const analyzeUserHealth = async (userId, sensorData, deviceId) => {
  try {
    console.log(`[HealthService] Starting intelligent analysis for User: ${userId}`);

    // 1. Fetch Latest Onboarding Data and Recent Vitals
    const [onboarding, recentVitals] = await Promise.all([
      OnboardingData.findOne({ user_id: userId }).sort({ createdAt: -1 }),
      HealthData.find({ user_id: userId }).sort({ createdAt: -1 }).limit(10)
    ]);
    
    // 2. Generate AI Insights via Health Engine
    const healthResult = generateHealthInsights(onboarding || {}, sensorData, recentVitals);
    
    // 3. Automated Alert Generation
    if (healthResult.alerts && healthResult.alerts.length > 0) {
      const alertPromises = healthResult.alerts.map(a => {
        return new Alert({
          user_id: userId,
          message: a.message,
          severity: a.severity,
          resolved: false,
          timestamp: new Date()
        }).save();
      });
      await Promise.all(alertPromises);
      console.log(`[HealthService] Generated ${healthResult.alerts.length} automated alerts.`);
    }

    // 4. Calculate Health Score Fallback (if not from AI)
    let healthScore = 100;
    if (sensorData.heartRate > 100 || sensorData.heartRate < 50) healthScore -= 15;
    if (sensorData.spo2 < 95) healthScore -= 20;
    
    healthScore = Math.max(0, Math.min(100, healthScore));

    // 5. Trigger External AI Service (Optional)
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001';
    let aiResult = null;
    
    try {
      if (onboarding) {
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, {
          symptoms: onboarding.common_symptoms || [],
          onboardingData: onboarding,
          vitals: sensorData
        }, { timeout: 3000 });
        aiResult = aiResponse.data;
      }
    } catch (aiErr) {
      console.warn("[HealthService] External AI Service unreachable, using local intelligence engine.");
    }

    // 6. Consolidate and Save Analysis
    const analysis = new HealthAnalysis({
      user_id: userId,
      type: (aiResult?.type === 'EMERGENCY' || healthResult.riskLevel === 'high') ? 'EMERGENCY' : 'NORMAL',
      condition: aiResult?.predictedDisease || (healthResult.riskLevel === 'high' ? "Attention Required" : "Stable"),
      healthScore: aiResult?.healthScore || healthScore,
      riskLevel: aiResult?.riskLevel || healthResult.riskLevel,
      insights: healthResult.insights,
      recommendations: aiResult?.recommendations || healthResult.recommendations,
      sensorData: sensorData,
      timestamp: new Date()
    });

    await analysis.save();
    console.log(`[HealthService] Analysis Saved. Risk: ${healthResult.riskLevel}`);
    return analysis;

  } catch (err) {
    console.error(`[HealthService] Error during async analysis:`, err);
  }
};

module.exports = {
  analyzeUserHealth
};
