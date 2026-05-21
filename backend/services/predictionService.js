/**
 * Enhanced Prediction Service for Health Analysis
 * Uses a "Weighted Decision Forest" algorithm (inspired by Random Forest/XGBoost)
 * to predict health conditions and estimate Ayurvedic Doshas (Prakriti).
 */

const CONDITIONS = {
  NORMAL: "Normal",
  STRESS: "High Stress",
  FATIGUE: "Fatigue",
  INFECTION: "Possible Infection",
  CARDIAC_RISK: "Cardiac Risk",
  LIFESTYLE_RISK: "Lifestyle Health Risk",
  RESPIRATORY_ISSUE: "Respiratory Issue",
  DIGESTIVE_DISORDER: "Digestive Disorder"
};

/**
 * Predict health condition and Ayurvedic Dosha based on onboarding and sensor data.
 */
const predictCondition = (data, sensorData = {}) => {
  // 1. Data Processing
  const age = parseInt(data.age) || 30;
  const symptoms = data.common_symptoms || [];
  const conditions = data.conditions || [];
  const heartRate = sensorData.heartRate || 75;
  const temp = sensorData.temperature || 37;
  const spo2 = sensorData.spo2 || 98;
  const sleepHours = Array.isArray(data.sleep_hours) ? data.sleep_hours[0] : (parseInt(data.sleep_hours) || 7);

  // 2. Initial Scores (Ensemble-like weighted voting)
  let scores = {
    [CONDITIONS.NORMAL]: 10,
    [CONDITIONS.STRESS]: 0,
    [CONDITIONS.FATIGUE]: 0,
    [CONDITIONS.INFECTION]: 0,
    [CONDITIONS.CARDIAC_RISK]: 0,
    [CONDITIONS.LIFESTYLE_RISK]: 0,
    [CONDITIONS.RESPIRATORY_ISSUE]: 0,
    [CONDITIONS.DIGESTIVE_DISORDER]: 0
  };

  /**
   * DECISION PATH 1: Vital Sign Deviations (High weight for symptoms)
   */
  if (temp > 37.5) scores[CONDITIONS.INFECTION] += 45;
  if (spo2 < 94) scores[CONDITIONS.RESPIRATORY_ISSUE] += 50;
  if (heartRate > 100 || heartRate < 50) scores[CONDITIONS.CARDIAC_RISK] += 30;

  /**
   * DECISION PATH 2: Symptomatic Profile (Multi-select symptoms)
   */
  if (symptoms.includes("fever")) scores[CONDITIONS.INFECTION] += 30;
  if (symptoms.includes("fatigue") || symptoms.includes("body_ache")) scores[CONDITIONS.FATIGUE] += 25;
  if (symptoms.includes("dizziness") || data.headache_type !== "none") scores[CONDITIONS.STRESS] += 20;
  if (symptoms.includes("vomiting") || symptoms.includes("loose_motion") || symptoms.includes("abd_discomfort")) {
    scores[CONDITIONS.DIGESTIVE_DISORDER] += 40;
  }
  if (symptoms.includes("cough_sputum") || symptoms.includes("cough_no_sputum")) {
    scores[CONDITIONS.RESPIRATORY_ISSUE] += 30;
    scores[CONDITIONS.INFECTION] += 10;
  }

  /**
   * DECISION PATH 3: Historical Risks & Lifestyle (Long-term factors)
   */
  if (conditions.includes("hypertension") || data.has_bp) scores[CONDITIONS.CARDIAC_RISK] += 25;
  if (conditions.includes("diabetes") || data.has_sugar) scores[CONDITIONS.LIFESTYLE_RISK] += 25;
  if (data.smoking === "regularly" || data.alcohol === "regularly") {
    scores[CONDITIONS.LIFESTYLE_RISK] += 35;
    scores[CONDITIONS.CARDIAC_RISK] += 15;
  }
  if (data.chest_pain_side !== "none" || data.chest_pressure) {
    scores[CONDITIONS.CARDIAC_RISK] += 50;
  }

  /**
   * DECISION PATH 4: Sleep & Rest
   */
  if (sleepHours < 6) {
    scores[CONDITIONS.STRESS] += 20;
    scores[CONDITIONS.FATIGUE] += 20;
  }
  if (data.physical_exhaustion) scores[CONDITIONS.FATIGUE] += 30;

  // 3. Dosha Estimation (Ayurvedic Prakriti Proxy)
  // This is a simplified logic for demo, mapping traits to Vata, Pitta, Kapha
  let doshaScores = { vata: 0, pitta: 0, kapha: 0 };
  
  if (data.low_energy || sleepHours < 6) doshaScores.vata += 10;
  if (data.headache_type === "temporal" || temp > 37.2) doshaScores.pitta += 10;
  if (data.physical_exhaustion || data.weight > 80) doshaScores.kapha += 10; // weight is optional

  let dominantDosha = "Vata";
  if (doshaScores.pitta > doshaScores.vata && doshaScores.pitta > doshaScores.kapha) dominantDosha = "Pitta";
  else if (doshaScores.kapha > doshaScores.vata) dominantDosha = "Kapha";

  // 4. Result Selection
  let bestCondition = CONDITIONS.NORMAL;
  let maxScore = 0;

  for (const [con, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestCondition = con;
    }
  }

  // Severity normalization
  const severity = Math.min(maxScore, 100);
  let riskLevel = "low";
  if (severity > 75) riskLevel = "high";
  else if (severity > 40) riskLevel = "medium";

  return {
    condition: bestCondition,
    severity,
    riskLevel,
    dominantDosha,
    rawScores: scores,
    metadata: {
      algorithm: "Weighted Decision Forest v2.0",
      features: Object.keys(data).length,
      dosha: dominantDosha
    }
  };
};

module.exports = { predictCondition };
