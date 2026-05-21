/**
 * Verification Script for 16-Step Medical Informatics AI Engine
 */

const medicalParser = require('./services/medicalParser');
const { analyzeReport } = require('./services/informaticsService');

const TABULAR_OCR_TEXT = `
KRUPA MEDICAL CENTRE
--------------------------------------------------
TEST NAME          RESULT    UNIT      REF. RANGE
--------------------------------------------------
HAEMATOLOGY
Haemoglobin        10.4      gm/dl     13.5 - 16.5
Total WBC Count    12500     cells/cumm 4000 - 11000
Platelets          2.8       lakh/cumm 1.5 - 4.5
Neutrophils        78        %         40 - 75
Lymphocytes        18        %         20 - 45

BIOCHEMISTRY
Glucose Fasting    145       mg/dl     70 - 100
LDL Cholesterol    160       mg/dl     < 130
TSH                6.8       uIu/ml    0.4 - 4.2
`;

console.log("=== STARTING 16-STEP ENGINE VERIFICATION ===\n");

const startTime = Date.now();
const extractedData = medicalParser.process(TABULAR_OCR_TEXT);
const informaticsOutput = analyzeReport({ reportData: extractedData, onboardingData: {}, sensorData: {} });
const duration = Date.now() - startTime;

console.log(`Processing completed in ${duration}ms`);
console.log(`Parameters Extracted: ${extractedData.length}`);
console.log(`Predictions Generated: ${informaticsOutput.predictions.length}`);
console.log(`Safety Alert: ${informaticsOutput.alert || "None"}\n`);

// 1. Verify Extraction (Step 1-12)
console.log("--- EXTRACTION VERIFICATION ---");
extractedData.forEach(p => {
  console.log(`[${p.parameter_name.padEnd(18)}] Val: ${String(p.value).padEnd(6)} Unit: ${p.unit.padEnd(10)} Range: ${p.reference_range.padEnd(12)} Status: ${p.status.toUpperCase()}`);
});

// 2. Verify Analysis (Step 13-16)
console.log("\n--- CLINICAL ANALYSIS ---");
console.log("Predictions:", JSON.stringify(informaticsOutput.predictions, null, 2));
console.log("Alerts:", informaticsOutput.recommendations.alerts);

// Specific Assertions
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
};

assert(extractedData.length >= 8, "Extracted at least 8 parameters");
assert(informaticsOutput.predictions.some(p => p.condition === "Anemia"), "Detected Anemia");
assert(informaticsOutput.predictions.some(p => p.condition === "Diabetes risk"), "Detected Diabetes Risk");
assert(informaticsOutput.alert !== undefined, "Safety Alert triggered (>= 3 abnormalities)");

console.log("\n=== TEST COMPLETED ===");
