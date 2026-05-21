/**
 * Full 11-Step AI Doctor Verification
 * Tests blood report + onboarding + IoT + skin analysis fusion
 */
const { analyzeReport } = require('../services/informaticsService');

console.log("=== 11-STEP AI DOCTOR ENGINE VERIFICATION ===\n");

// ─── TEST 1: Full Multi-Source Fusion ────────────────────────────────────────
console.log("─── TEST 1: Full Multi-Source Fusion ───");
const result1 = analyzeReport({
  reportData: [
    { parameter_name: 'Hemoglobin', value: 9.5, unit: 'g/dl', status: 'low', category: 'Haematology' },
    { parameter_name: 'Glucose', value: 180, unit: 'mg/dl', status: 'high', category: 'Biochemistry' },
    { parameter_name: 'LDL', value: 170, unit: 'mg/dl', status: 'high', category: 'Lipid Profile' },
    { parameter_name: 'TSH', value: 7.2, unit: 'uIu/ml', status: 'high', category: 'Endocrinology' },
  ],
  onboardingData: {
    age: 55,
    gender: "male",
    symptoms: ["fatigue", "frequent thirst"],
    lifestyle: "sedentary"
  },
  sensorData: {
    heart_rate: 105,
    spo2: 95,
    temperature: 37.5
  },
  skinAnalysis: {
    condition: "Rash",
    confidence: 78
  }
});

console.log("Health Score:", result1.summary.health_score);
console.log("Risk Level:", result1.summary.riskLevel);
console.log("Abnormal Params:", result1.abnormal_parameters.length);
console.log("Predictions:", result1.predictions.length);
console.log("Medical Advice:", result1.recommendations.medical.length);
console.log("Ayurvedic Advice:", result1.recommendations.ayurvedic.length);
console.log("Lifestyle Advice:", result1.recommendations.lifestyle.length);
console.log("Skin Analysis:", result1.skin_analysis ? result1.skin_analysis.severity : "N/A");
console.log("Alert:", result1.alert);

const t1Pass = 
  result1.summary.health_score < 70 &&
  result1.predictions.length >= 5 &&
  result1.recommendations.medical.length >= 4 &&
  result1.skin_analysis !== null &&
  result1.alert !== null;

console.log(t1Pass ? "✅ PASSED" : "❌ FAILED");

// ─── TEST 2: Normal Results (Wellness Fallback) ─────────────────────────────
console.log("\n─── TEST 2: Normal Results (Wellness Fallback) ───");
const result2 = analyzeReport({
  reportData: [
    { parameter_name: 'Hemoglobin', value: 14.5, unit: 'g/dl', status: 'normal', category: 'Haematology' },
    { parameter_name: 'Glucose', value: 90, unit: 'mg/dl', status: 'normal', category: 'Biochemistry' },
  ],
  onboardingData: {},
  sensorData: null,
  skinAnalysis: null
});

console.log("Health Score:", result2.summary.health_score);
console.log("Predictions:", result2.predictions.length);
console.log("Medical Advice:", result2.recommendations.medical);
const t2Pass = result2.summary.health_score === 100 && result2.recommendations.medical.length > 0;
console.log(t2Pass ? "✅ PASSED" : "❌ FAILED");

// ─── TEST 3: IoT Critical Alert ─────────────────────────────────────────────
console.log("\n─── TEST 3: IoT Critical Alert (Low SpO2) ───");
const result3 = analyzeReport({
  reportData: [],
  onboardingData: {},
  sensorData: {
    heart_rate: 88,
    spo2: 91,
    temperature: 39.2
  },
  skinAnalysis: null
});

console.log("Health Score:", result3.summary.health_score);
console.log("Alert:", result3.alert);
console.log("Predictions:", JSON.stringify(result3.predictions, null, 2));
const t3Pass = result3.alert && result3.alert.includes("CRITICAL");
console.log(t3Pass ? "✅ PASSED" : "❌ FAILED");

// ─── TEST 4: Severe Skin Condition ──────────────────────────────────────────
console.log("\n─── TEST 4: Severe Skin Condition (Melanoma) ───");
const result4 = analyzeReport({
  reportData: [],
  onboardingData: {},
  sensorData: null,
  skinAnalysis: {
    condition: "Melanoma",
    confidence: 90
  }
});

console.log("Skin Severity:", result4.skin_analysis?.severity);
console.log("Consult Doctor:", result4.skin_analysis?.consult_doctor);
console.log("Alert:", result4.alert);
const t4Pass = result4.skin_analysis?.severity === "severe" && result4.alert !== null;
console.log(t4Pass ? "✅ PASSED" : "❌ FAILED");

// ─── SUMMARY ────────────────────────────────────────────────────────────────
console.log("\n=== FINAL RESULTS ===");
const allPassed = t1Pass && t2Pass && t3Pass && t4Pass;
console.log(`Tests: ${[t1Pass, t2Pass, t3Pass, t4Pass].filter(Boolean).length}/4 passed`);
console.log(allPassed ? "🎉 ALL TESTS PASSED" : "⚠️ Some tests failed");
