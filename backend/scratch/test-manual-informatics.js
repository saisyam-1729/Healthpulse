/**
 * Test Manual Entry Logic
 */
const { analyzeReport } = require('../services/informaticsService');

const manualData = [
  { test_name: 'Lymphocytes', value: 4, unit: '%', status: 'low' }, // Low Lymphocytes
  { test_name: 'Monocytes', value: 4, unit: '%', status: 'normal' },
  { test_name: 'Eosinophils', value: 2, unit: '%', status: 'normal' }
];

console.log("=== TESTING MANUAL ENTRY INFORMATICS ===");
const output = analyzeReport({ reportData: manualData, onboardingData: {}, sensorData: {} });

console.log("Status:", JSON.stringify(output.summary, null, 2));
console.log("Predictions:", JSON.stringify(output.predictions, null, 2));
console.log("Recommendations (Medical):", output.recommendations.medical);
console.log("Recommendations (Ayurvedic):", output.recommendations.ayurvedic);

if (output.predictions.length > 0 && output.recommendations.medical.length > 0) {
    console.log("\n✅ SUCCESS: Detected low lymphocytes and generated advice.");
} else {
    console.log("\n❌ FAILED: No advice generated for low lymphocytes.");
}
