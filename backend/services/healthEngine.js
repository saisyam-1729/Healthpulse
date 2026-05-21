/**
 * Health Intelligence Engine v2.0
 * Transforms user profile and biometric data into actionable insights and medical-style predictions.
 */

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const generateHealthInsights = (userData = {}, vitalsData = {}, recentReadings = []) => {
  const alerts = [];
  const predictions = [];
  const insights = [];
  const recommendations = {
    lifestyle: [],
    diet: [],
    activity: [],
    disclaimer: "HealthPulse AI insights are based on provided data and trends. This is not a clinical diagnosis. Consult a physician for medical advice."
  };

  const hr = vitalsData.heartRate || 0;
  const spo2 = vitalsData.spo2 || 0;
  const temp = vitalsData.temperature || 0;

  // 1. DATA GROUPING (Vitals, Symptoms, History, Lifestyle, Special)
  const symptoms = userData.common_symptoms || [];
  const hasChestPain = userData.chest_pain_side && userData.chest_pain_side !== 'none';
  const hasPressure = userData.chest_pressure === true;
  const hasHeadache = userData.headache_type && userData.headache_type !== 'none';
  
  // 2. HEALTH INTELLIGENCE ENGINE - CRITICAL ALERTS
  if (hasChestPain && hasPressure) {
    alerts.push({ severity: 'critical', type: 'cardiac', message: 'CRITICAL: Acute cardiac risk detected. Immediate clinical assessment advised.' });
    recommendations.lifestyle.push('Avoid any physical exertion immediately. Seek emergency care.');
  }

  if (userData.stroke_history && hasHeadache && userData.pain_severity === 'severe') {
    alerts.push({ severity: 'critical', type: 'neurological', message: 'CRITICAL: High neurological risk. Stroke history + severe headache requires urgent evaluation.' });
  }

  // 3. MODERATE ALERTS
  if (!userData.proper_sleep && userData.activity_level === 'inactive') {
    alerts.push({ severity: 'moderate', type: 'lifestyle', message: 'Moderate lifestyle risk: Chronic sleep deficit + sedentary behavior detected.' });
  }

  if (userData.has_bp && userData.low_energy) {
    alerts.push({ severity: 'moderate', type: 'hypertension', message: 'Hypertension risk: History of BP + persistent fatigue indicates poor management.' });
  }

  // 4. BIOMETRIC THRESHOLDS
  if (hr > 100) {
    alerts.push({ severity: 'high', type: 'biometric', message: 'Tachycardia Warning: Heart rate exceeds 100 BPM.' });
  } else if (hr > 0 && hr < 60) {
    alerts.push({ severity: 'moderate', type: 'biometric', message: 'Bradycardia Warning: Heart rate below 60 BPM.' });
  }

  if (spo2 > 0 && spo2 < 95) {
    alerts.push({ severity: 'high', type: 'biometric', message: 'Oxygen Risk: SpO2 levels are critically low (<95%).' });
  }

  if (temp > 37.5) {
    alerts.push({ severity: 'moderate', type: 'fever', message: 'Febrile State: Temperature exceeds 37.5°C.' });
  }

  // 5. PREDICTION ENGINE (Pattern Detection)
  // Migraine Pattern
  if (hasHeadache && (symptoms.includes('nausea') || symptoms.includes('light_sensitivity'))) {
    predictions.push({ pattern: 'Migraine Cycle', confidence: 'high', insight: 'Symptom cluster suggests potential migraine development.' });
  }

  // GI Pattern
  if (userData.outside_food_intake === 'frequently' && (symptoms.includes('bloating') || symptoms.includes('acid_reflux'))) {
    predictions.push({ pattern: 'GI Sensitivity', confidence: 'medium', insight: 'High frequency of processed food correlates with digestive inflammation.' });
  }

  // Cardiac Trends (Trends)
  if (recentReadings.length >= 3) {
    const hrTrend = recentReadings.map(r => r.heartRate);
    const spo2Trend = recentReadings.map(r => r.spo2);
    
    const isHrIncreasing = hrTrend.every((v, i) => i === 0 || v >= hrTrend[i-1]);
    const isSpo2Decreasing = spo2Trend.every((v, i) => i === 0 || v <= spo2Trend[i-1]);

    if (isHrIncreasing && hr > 90) {
      alerts.push({ severity: 'high', type: 'trend', message: 'Predictive Alert: Sustained upward trend in heart rate detected.' });
    }
    if (isSpo2Decreasing && spo2 < 97) {
      alerts.push({ severity: 'high', type: 'trend', message: 'Predictive Alert: Potential respiratory distress developing (SpO2 downward trend).' });
    }
  }

  // 6. RECOMMENDATIONS
  if (userData.diet_type === 'non-veg' && userData.has_bp) {
    recommendations.diet.push('Reduce red meat intake. Prioritize lean proteins and leafy greens.');
  }
  if (userData.activity_level === 'inactive') {
    recommendations.activity.push('Begin with 15 minutes of low-impact walking daily.');
  }

  // Calculate Overall Risk Score
  let score = 0;
  alerts.forEach(a => {
    if (a.severity === 'critical') score += 40;
    if (a.severity === 'high') score += 20;
    if (a.severity === 'moderate') score += 10;
  });
  predictions.forEach(() => score += 5);

  let riskLevel = 'low';
  if (score >= 40) riskLevel = 'critical';
  else if (score >= 20) riskLevel = 'high';
  else if (score >= 10) riskLevel = 'medium';

  return {
    riskLevel,
    alerts,
    predictions,
    recommendations,
    insights: alerts.map(a => a.message).concat(predictions.map(p => p.insight))
  };
};

module.exports = { generateHealthInsights, calculateDistance };
