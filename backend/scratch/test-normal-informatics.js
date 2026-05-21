/**
 * Test Normal Entry Logic
 */
const { analyzeReport } = require('../services/informaticsService');

const normalData = [
  { test_name: 'Lymphocytes', value: 30, unit: '%', status: 'normal' },
  { test_name: 'Hemoglobin', value: 14, unit: 'g/dL', status: 'normal' }
];

console.log("=== TESTING NORMAL ENTRY INFORMATICS ===");
const output = analyzeReport({ reportData: normalData, onboardingData: {}, sensorData: {} });

console.log("Predictions:", JSON.stringify(output.predictions, null, 2));
console.log("Recommendations (Medical):", output.recommendations.medical);
console.log("Recommendations (Ayurvedic):", output.recommendations.ayurvedic);

if (output.recommendations.medical.length > 0 && output.recommendations.medical[0].includes("standard ranges")) {
    console.log("\n✅ SUCCESS: Generated wellness fallback for normal results.");
} else {
    console.log("\n❌ FAILED: No wellness advice generated.");
}
