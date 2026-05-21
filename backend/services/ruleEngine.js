/**
 * Rule-based Engine for Critical Health Condition Detection
 * This service identifies emergency-level risks that must be flagged immediately.
 */

const checkCriticalConditions = (onboardingData, sensorData = {}) => {
  const alerts = [];
  const criticalFlags = [];
  const recommendations = {
    medicines: [],
    lifestyle: [],
    diet: [],
    disclaimer: "These recommendations are based on your profile and vitals. Please consult a doctor for official medical advice."
  };

  const hr = sensorData.heartRate || 0;
  const spo2 = sensorData.spo2 || 0;
  const temp = sensorData.temperature || 0;

  // 1. CARDIAC & VITAL RISKS
  if (hr > 120 || (onboardingData.chest_pain_side && onboardingData.chest_pain_side !== 'none' && onboardingData.chest_pressure)) {
    criticalFlags.push('CARDIAC_EMERGENCY');
    alerts.push({
      type: 'cardiac_risk',
      severity: 'high',
      message: 'Critical heart activity or chest pressure detected. Contact emergency services or a cardiologist immediately.'
    });
    recommendations.lifestyle.push("Immediate rest and medical evaluation");
    recommendations.diet.push("Avoid all caffeine and stimulants");
  } else if (hr > 100) {
    alerts.push({ type: 'tachycardia', severity: 'moderate', message: 'Elevated heart rate detected.' });
    recommendations.lifestyle.push("Practice deep breathing (Pranayama)");
    recommendations.lifestyle.push("Reduce stress and physical exertion");
  }

  // 2. RESPIRATORY RISKS
  if (spo2 > 0 && spo2 < 92) {
    const isAsthmatic = onboardingData.conditions?.includes('asthma');
    criticalFlags.push('RESPIRATORY_DISTRESS');
    alerts.push({
      type: 'hypoxia',
      severity: 'high',
      message: isAsthmatic ? 'Severe respiratory distress in asthmatic profile.' : 'Low oxygen levels detected.'
    });
    recommendations.lifestyle.push("Sit upright and ensure fresh air circulation");
    if (isAsthmatic) recommendations.lifestyle.push("Use prescribed rescue inhaler if needed");
  }

  // 3. LIFESTYLE & ADDICTION MAPPING
  if (onboardingData.smoking && onboardingData.smoking !== 'never') {
    recommendations.lifestyle.push("Smoking cessation program recommended");
    recommendations.diet.push("Increase Vitamin C and antioxidant intake");
    if (spo2 < 95) {
      alerts.push({ type: 'smoker_hypoxia', severity: 'moderate', message: 'Lower SpO2 levels likely correlated with smoking history.' });
    }
  }

  if (onboardingData.alcohol && onboardingData.alcohol !== 'never') {
    recommendations.diet.push("Increase hydration (2-3L water daily)");
    recommendations.diet.push("B-complex vitamin-rich foods (Leafy greens, eggs)");
  }

  // 4. CHRONIC CONDITIONS (BP/SUGAR)
  if (onboardingData.has_bp) {
    recommendations.diet.push("Follow DASH diet (Low sodium, high potassium)");
    recommendations.lifestyle.push("Daily 30-min brisk walk");
  }

  if (onboardingData.has_sugar) {
    recommendations.diet.push("Low Glycemic Index (GI) foods only");
    recommendations.lifestyle.push("Regular blood glucose monitoring");
  }

  // 5. PAIN & PHYSICAL STATE
  if (onboardingData.physical_exhaustion || onboardingData.low_energy) {
    recommendations.lifestyle.push("Ensure 7-9 hours of consistent sleep");
    recommendations.diet.push("Increase iron and magnesium intake");
  }

  if (onboardingData.body_pain_location?.length > 0) {
    recommendations.lifestyle.push(`Gentle stretching focused on: ${onboardingData.body_pain_location.join(', ')}`);
  }

  // 6. GENERAL REVIEWS
  if (recommendations.lifestyle.length === 0) recommendations.lifestyle.push("Maintain current healthy habits");
  if (recommendations.diet.length === 0) recommendations.diet.push("Balanced Mediterranean-style diet");

  return {
    alerts,
    criticalFlags,
    recommendations,
    riskLevel: alerts.some(a => a.severity === 'high') ? 'high' : 
               alerts.length > 0 ? 'moderate' : 'low'
  };
};

module.exports = { checkCriticalConditions };
