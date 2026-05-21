/**
 * Unified AI Medical Informatics Engine (11-Step AI Doctor)
 *
 * Fuses 4 data sources:
 *   1. Blood report parameters
 *   2. Onboarding data (age, gender, symptoms, lifestyle)
 *   3. IoT sensor data (heart_rate, spo2, temperature)
 *   4. Skin analysis results (condition, confidence)
 *
 * Returns a single structured clinical response.
 */

const { analyzeSkinCondition } = require('./dermatologyService');

// ─── STEP 1 — PARAMETER VALIDATION ─────────────────────────────────────────
function validateParameters(params) {
  if (!Array.isArray(params)) return [];
  return params.filter(p => {
    const name = p.parameter_name || p.test_name;
    const val = parseFloat(p.value);
    return name && !isNaN(val);
  });
}

// ─── STEP 2 — ABNORMALITY ANALYSIS (Blood Report Rules) ────────────────────
function analyzeBloodParameters(parameters) {
  const predictions = [];
  const recommendations = { medical: [], ayurvedic: [], lifestyle: [] };
  const abnormal_parameters = [];

  parameters.forEach(p => {
    const name = (p.parameter_name || p.test_name || "").toLowerCase();
    const status = p.status || "unknown";

    if (status === "high" || status === "low") {
      abnormal_parameters.push({
        name: p.parameter_name || p.test_name,
        value: p.value,
        unit: p.unit,
        status
      });
    }

    // ── Hemoglobin ──
    if (name.includes("hemoglobin") && status === "low") {
      predictions.push({ condition: "Anemia", confidence: "High", reason: "Low hemoglobin level detected" });
      recommendations.medical.push("Increase iron-rich foods (meat, beans, spinach).");
      recommendations.ayurvedic.push("Consume Pomegranate, Dates, and Amla juice.");
      recommendations.lifestyle.push("Include green leafy vegetables and fortified cereals in daily diet.");
    }

    // ── ESR ──
    if (name.includes("esr") && status === "high") {
      predictions.push({ condition: "Inflammation", confidence: "Medium", reason: "Elevated ESR indicates systemic inflammation" });
      recommendations.medical.push("Further clinical evaluation to find inflammation source.");
      recommendations.ayurvedic.push("Haridra (Turmeric) with warm milk helps reduce inflammation.");
      recommendations.lifestyle.push("Reduce processed foods and increase omega-3 fatty acids.");
    }

    // ── Glucose ──
    if (name.includes("glucose") && status === "high") {
      predictions.push({ condition: "Diabetes risk", confidence: "High", reason: "High blood glucose level" });
      recommendations.medical.push("HbA1c test recommended; strictly reduce sugar intake.");
      recommendations.ayurvedic.push("Nishamalaki (Turmeric + Amla) for blood sugar balance.");
      recommendations.lifestyle.push("Reduce refined carbohydrates; 30 min daily exercise.");
    }

    // ── LDL ──
    if (name.includes("ldl") && status === "high") {
      predictions.push({ condition: "Cardiac risk", confidence: "High", reason: "High LDL cholesterol" });
      recommendations.medical.push("Adopt heart-healthy low-fat diet; increase aerobic exercise.");
      recommendations.ayurvedic.push("Arjuna bark decoction for heart health.");
      recommendations.lifestyle.push("Avoid trans-fats; walk at least 30 minutes daily.");
    }

    // ── Cholesterol ──
    if (name.includes("cholesterol") && status === "high") {
      predictions.push({ condition: "Hypercholesterolemia", confidence: "High", reason: "Total cholesterol exceeds safe range" });
      recommendations.medical.push("Lipid panel monitoring; consider dietary changes first.");
      recommendations.ayurvedic.push("Guggulu extract and Garlic capsules support lipid metabolism.");
      recommendations.lifestyle.push("Increase soluble fiber intake (oats, barley, fruits).");
    }

    // ── WBC ──
    if (name.includes("wbc")) {
      if (status === "high") {
        predictions.push({ condition: "Infection/Inflammation", confidence: "High", reason: "Elevated white blood cell count" });
        recommendations.medical.push("Check for localized infections; monitor for fever.");
        recommendations.ayurvedic.push("Neem and Giloy (Guduchi) help clear blood toxins and boost immunity.");
      } else if (status === "low") {
        predictions.push({ condition: "Low Immunity", confidence: "High", reason: "Low white blood cell count" });
        recommendations.medical.push("Protect against infections; further investigation into bone marrow health.");
        recommendations.ayurvedic.push("Ashwagandha and Chyawanprash to build 'Ojas' (strength/immunity).");
      }
    }

    // ── Platelets ──
    if (name.includes("platelets") && status === "low") {
      predictions.push({ condition: "Thrombocytopenia Risk", confidence: "High", reason: "Low platelet count" });
      recommendations.medical.push("Avoid blood thinners; monitor for easy bruising/bleeding.");
      recommendations.ayurvedic.push("Papaya leaf extract and Kiwi fruit are beneficial.");
    }

    // ── Neutrophils ──
    if (name.includes("neutrophils") && status === "high") {
      predictions.push({ condition: "Bacterial Infection", confidence: "Moderate", reason: "Elevated neutrophil percentage" });
      recommendations.medical.push("Consider antibiotic screening if symptoms like fever persist.");
      recommendations.ayurvedic.push("Tulsi and Black Pepper help manage respiratory bacterial load.");
    }

    // ── Lymphocytes ──
    if (name.includes("lymphocytes")) {
      if (status === "high") {
        predictions.push({ condition: "Viral Response", confidence: "Moderate", reason: "Elevated lymphocytes suggest viral activity" });
        recommendations.medical.push("Rest and hydration; monitor for viral symptoms.");
        recommendations.ayurvedic.push("Mulethi (Licorice) and Ginger tea for viral relief.");
      } else if (status === "low") {
        predictions.push({ condition: "Weakened Immune System", confidence: "Moderate", reason: "Low lymphocyte count" });
        recommendations.medical.push("Focus on nutrient-dense foods; avoid exposure to infectious environments.");
        recommendations.ayurvedic.push("Ashwagandha and Chyawanprash to boost 'Ojas' and immune resilience.");
      }
    }

    // ── Monocytes ──
    if (name.includes("monocytes") && status === "high") {
      predictions.push({ condition: "Chronic Inflammation", confidence: "Moderate", reason: "Elevated monocytes" });
      recommendations.medical.push("Evaluate for chronic infections or inflammatory conditions.");
      recommendations.ayurvedic.push("Triphala and Curcumin (Turmeric) to manage systemic inflammation.");
    }

    // ── Eosinophils ──
    if (name.includes("eosinophils") && status === "high") {
      predictions.push({ condition: "Allergy/Parasitic Load", confidence: "High", reason: "Elevated eosinophil count" });
      recommendations.medical.push("Check for allergens or parasitic infections; consider antihistamines if symptomatic.");
      recommendations.ayurvedic.push("Haridra Khanda and Neem are excellent for allergic skin or respiratory issues.");
    }

    // ── TSH ──
    if (name.includes("tsh")) {
      if (status === "high") {
        predictions.push({ condition: "Thyroid disorder (Hypo)", confidence: "High", reason: "TSH above normal range" });
        recommendations.medical.push("Consult endocrinologist for thyroid hormone therapy.");
        recommendations.ayurvedic.push("Avoid heavy, cold foods; use Ginger and Black Pepper.");
        recommendations.lifestyle.push("Regular exercise to boost metabolism; avoid soy-heavy diet.");
      } else if (status === "low") {
        predictions.push({ condition: "Thyroid disorder (Hyper)", confidence: "High", reason: "TSH below normal range" });
        recommendations.medical.push("Thyroid scan recommended; consult specialist.");
        recommendations.ayurvedic.push("Cooling herbs like Shatavari and coriander seeds.");
        recommendations.lifestyle.push("Manage stress with yoga and meditation; eat calcium-rich foods.");
      }
    }

    // ── Creatinine ──
    if (name.includes("creatinine") && status === "high") {
      predictions.push({ condition: "Kidney Stress", confidence: "High", reason: "Elevated creatinine level" });
      recommendations.medical.push("Kidney function panel (eGFR) recommended; monitor hydration.");
      recommendations.ayurvedic.push("Punarnava and Gokshura decoction supports kidney health.");
      recommendations.lifestyle.push("Increase water intake; reduce sodium and protein overload.");
    }

    // ── Bilirubin ──
    if (name.includes("bilirubin") && status === "high") {
      predictions.push({ condition: "Liver Stress / Jaundice Risk", confidence: "High", reason: "Elevated bilirubin" });
      recommendations.medical.push("Liver function panel recommended; avoid alcohol.");
      recommendations.ayurvedic.push("Bhumyamalaki and Kutki are excellent hepatoprotective herbs.");
      recommendations.lifestyle.push("Avoid fried and fatty foods; eat light, warm meals.");
    }

    // ── SGPT / SGOT ──
    if ((name.includes("sgpt") || name.includes("sgot") || name.includes("alt") || name.includes("ast")) && status === "high") {
      predictions.push({ condition: "Liver Enzyme Elevation", confidence: "Moderate", reason: "Elevated liver transaminases" });
      recommendations.medical.push("Avoid hepatotoxic substances (alcohol, certain medications).");
      recommendations.ayurvedic.push("Milk Thistle and Kutki support liver regeneration.");
    }

    // ── Vitamin D ──
    if (name.includes("vitamin d") && status === "low") {
      predictions.push({ condition: "Vitamin D Deficiency", confidence: "High", reason: "Below optimal Vitamin D levels" });
      recommendations.medical.push("Vitamin D3 supplementation; increase sun exposure (15-20 min/day).");
      recommendations.ayurvedic.push("Sesame oil massage (Abhyanga) and fortified foods.");
      recommendations.lifestyle.push("Spend 15–20 minutes in morning sunlight daily.");
    }

    // ── Vitamin B12 ──
    if (name.includes("b12") && status === "low") {
      predictions.push({ condition: "Vitamin B12 Deficiency", confidence: "High", reason: "Low B12 levels" });
      recommendations.medical.push("B12 supplementation; check for pernicious anemia.");
      recommendations.ayurvedic.push("Include fermented foods and dairy in diet.");
      recommendations.lifestyle.push("Consider fortified cereals if vegetarian.");
    }

    // ── Uric Acid ──
    if (name.includes("uric acid") && status === "high") {
      predictions.push({ condition: "Gout / Hyperuricemia Risk", confidence: "Moderate", reason: "Elevated uric acid" });
      recommendations.medical.push("Reduce purine-rich foods (red meat, shellfish); stay hydrated.");
      recommendations.ayurvedic.push("Giloy and Punarnava help lower uric acid naturally.");
      recommendations.lifestyle.push("Avoid alcohol; increase water to 3+ liters/day.");
    }
  });

  return { predictions, recommendations, abnormal_parameters };
}

// ─── STEP 3 — MULTI-DATA CORRELATION (Onboarding + Blood) ──────────────────
function correlateWithOnboarding(predictions, recommendations, onboardingData) {
  if (!onboardingData || typeof onboardingData !== 'object') return;
  if (!onboardingData.symptoms && !onboardingData.age) return;

  const symptoms = Array.isArray(onboardingData.symptoms)
    ? onboardingData.symptoms.map(s => s.toLowerCase())
    : [];
  const age = parseInt(onboardingData.age) || 0;

  // Symptom-based confidence boost
  const hasAnemia = predictions.some(p => p.condition === "Anemia");
  if (hasAnemia && symptoms.some(s => s.includes("fatigue") || s.includes("tired") || s.includes("weakness"))) {
    const idx = predictions.findIndex(p => p.condition === "Anemia");
    if (idx !== -1) {
      predictions[idx].confidence = "High";
      predictions[idx].reason += " (corroborated by reported fatigue)";
    }
  }

  const hasDiabetes = predictions.some(p => p.condition === "Diabetes risk");
  if (hasDiabetes && symptoms.some(s => s.includes("thirst") || s.includes("urination") || s.includes("hunger"))) {
    const idx = predictions.findIndex(p => p.condition === "Diabetes risk");
    if (idx !== -1) {
      predictions[idx].confidence = "High";
      predictions[idx].reason += " (corroborated by classic diabetic symptoms)";
    }
  }

  // Age-based risk flags
  if (age >= 50) {
    recommendations.lifestyle.push("Regular health check-ups every 6 months recommended for age 50+.");
  }
  if (age >= 40) {
    recommendations.lifestyle.push("Annual cardiac screening recommended.");
  }
}

// ─── STEP 4 — IoT SENSOR DATA ANALYSIS ─────────────────────────────────────
function analyzeIoTData(iotData, predictions, recommendations) {
  if (!iotData || typeof iotData !== 'object') return;

  const hr = parseFloat(iotData.heart_rate);
  const spo2 = parseFloat(iotData.spo2);
  const temp = parseFloat(iotData.temperature);

  // Heart Rate Analysis
  if (!isNaN(hr)) {
    if (hr > 100) {
      predictions.push({ condition: "Tachycardia", confidence: "Moderate", reason: `Heart rate ${hr} bpm exceeds normal resting range` });
      recommendations.medical.push("Monitor heart rate; reduce caffeine and stress.");
      recommendations.ayurvedic.push("Arjuna and Brahmi support heart rhythm regulation.");
      recommendations.lifestyle.push("Practice deep breathing exercises; avoid stimulants.");
    } else if (hr < 50) {
      predictions.push({ condition: "Bradycardia", confidence: "Moderate", reason: `Heart rate ${hr} bpm below normal resting range` });
      recommendations.medical.push("ECG recommended if accompanied by dizziness or fainting.");
      recommendations.ayurvedic.push("Stimulating herbs like Pippali (Long Pepper) may help.");
    }
  }

  // SpO2 Analysis
  if (!isNaN(spo2)) {
    if (spo2 < 94) {
      predictions.push({ condition: "Hypoxemia Risk", confidence: "High", reason: `SpO2 ${spo2}% is critically low` });
      recommendations.medical.push("URGENT: Seek immediate medical attention for low oxygen saturation.");
      recommendations.lifestyle.push("Practice deep breathing; avoid polluted environments.");
    } else if (spo2 < 96) {
      predictions.push({ condition: "Low Oxygen Saturation", confidence: "Moderate", reason: `SpO2 ${spo2}% is below optimal` });
      recommendations.medical.push("Monitor SpO2 continuously; consult if it drops further.");
      recommendations.ayurvedic.push("Pranayama (breathing exercises) and Vasaka for respiratory support.");
    }
  }

  // Temperature Analysis
  if (!isNaN(temp)) {
    if (temp > 38.0) {
      predictions.push({ condition: "Fever", confidence: "High", reason: `Body temperature ${temp}°C indicates fever` });
      recommendations.medical.push("Rest, hydrate, and use fever-reducing measures. Seek care if persistent.");
      recommendations.ayurvedic.push("Tulsi tea, Coriander seed water, and Sandalwood paste on forehead.");
      recommendations.lifestyle.push("Complete bed rest; drink fluids frequently.");
    } else if (temp > 37.3) {
      predictions.push({ condition: "Low-grade Fever", confidence: "Moderate", reason: `Temperature ${temp}°C slightly elevated` });
      recommendations.medical.push("Monitor temperature; rest and hydrate.");
      recommendations.ayurvedic.push("Ginger and honey tea for mild fever relief.");
    }
  }
}

// ─── STEP 5 — SKIN CONDITION ANALYSIS ───────────────────────────────────────
function integrateSkinAnalysis(skinData) {
  if (!skinData || !skinData.condition) return null;

  const result = analyzeSkinCondition({
    condition_name: skinData.condition,
    confidence_score: skinData.confidence || 0,
    symptoms: skinData.symptoms || []
  });

  return {
    condition: result.condition,
    severity: result.severity,
    advice: [
      ...result.medical_advice,
      ...result.ayurvedic_advice
    ],
    consult_doctor: result.consult_doctor,
    warning: result.warning
  };
}

// ─── STEP 6 — HEALTH SCORE CALCULATION ──────────────────────────────────────
function calculateHealthScore(abnormalCount, iotData, skinResult) {
  let score = 100;

  // Deduct for abnormal blood parameters
  score -= abnormalCount * 8;

  // Deduct for IoT issues
  if (iotData && typeof iotData === 'object') {
    const spo2 = parseFloat(iotData.spo2);
    const temp = parseFloat(iotData.temperature);
    const hr = parseFloat(iotData.heart_rate);

    if (!isNaN(spo2) && spo2 < 94) score -= 15;
    else if (!isNaN(spo2) && spo2 < 96) score -= 8;

    if (!isNaN(temp) && temp > 38.0) score -= 10;
    else if (!isNaN(temp) && temp > 37.3) score -= 5;

    if (!isNaN(hr) && (hr > 100 || hr < 50)) score -= 8;
  }

  // Deduct for skin severity
  if (skinResult) {
    if (skinResult.severity === "severe") score -= 15;
    else if (skinResult.severity === "moderate") score -= 8;
    else if (skinResult.severity === "mild") score -= 3;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── MAIN EXPORT — analyzeReport ────────────────────────────────────────────
const analyzeReport = ({ reportData, onboardingData, sensorData, skinAnalysis }) => {
  // STEP 1 — Validate
  const parameters = validateParameters(reportData || []);

  if (!parameters.length && !sensorData && !skinAnalysis) {
    return {
      parameters: [],
      summary: { total: 0, high: 0, low: 0, normal: 0, health_score: 100, riskLevel: "Low" },
      abnormal_parameters: [],
      predictions: [],
      recommendations: { medical: [], ayurvedic: [], lifestyle: [] },
      skin_analysis: null,
      alert: null
    };
  }

  // STEP 2 — Blood Analysis
  const { predictions, recommendations, abnormal_parameters } = analyzeBloodParameters(parameters);

  // STEP 8/9 — Strict Summary
  const summary = {
    total: parameters.length,
    high: parameters.filter(p => p.status === "high").length,
    low: parameters.filter(p => p.status === "low").length,
    normal: parameters.filter(p => p.status === "normal").length,
  };

  // STEP 3 — Correlate with Onboarding
  correlateWithOnboarding(predictions, recommendations, onboardingData);

  // STEP 4 — IoT Sensor Analysis
  analyzeIoTData(sensorData, predictions, recommendations);

  // STEP 5 — Skin Analysis
  const skinResult = integrateSkinAnalysis(skinAnalysis);

  // STEP 6 — Health Score
  const abnormalCount = summary.high + summary.low;
  const healthScore = calculateHealthScore(abnormalCount, sensorData, skinResult);

  let riskLevel = "Low";
  if (healthScore < 50) riskLevel = "High";
  else if (healthScore < 75) riskLevel = "Moderate";

  summary.health_score = healthScore;
  summary.healthScore = healthScore;  // Legacy alias
  summary.riskLevel = riskLevel;

  // STEP 10 — Safety Alert
  let alert = null;
  if (abnormalCount >= 3) {
    alert = "Consult a doctor immediately";
  }
  if (sensorData) {
    const spo2 = parseFloat(sensorData.spo2);
    const temp = parseFloat(sensorData.temperature);
    if (!isNaN(spo2) && spo2 < 94) alert = "CRITICAL: Low oxygen saturation. Seek immediate medical attention.";
    if (!isNaN(temp) && temp > 39.0) alert = "CRITICAL: High fever detected. Seek immediate medical attention.";
  }
  if (skinResult && skinResult.severity === "severe") {
    alert = alert || "Severe skin condition detected. Consult a dermatologist immediately.";
  }

  // STEP 7/8/9 — Fallback Wellness Advice
  if (recommendations.medical.length === 0 && recommendations.ayurvedic.length === 0) {
    recommendations.medical.push("All parameters are within standard ranges. Maintain a balanced diet and regular exercise.");
    recommendations.ayurvedic.push("Continue with seasonal 'Ritucharya' (lifestyle habits) to maintain Dosha balance.");
  }
  if (recommendations.lifestyle.length === 0) {
    recommendations.lifestyle.push("Maintain 7-8 hours of quality sleep.", "Drink 2-3 liters of water daily.", "Exercise moderately for 30 minutes, 5 days a week.");
  }

  // Deduplicate
  recommendations.medical = [...new Set(recommendations.medical)];
  recommendations.ayurvedic = [...new Set(recommendations.ayurvedic)];
  recommendations.lifestyle = [...new Set(recommendations.lifestyle)];

  // Format parameters for output
  const formattedParameters = parameters.map(p => ({
    category: p.category,
    parameter_name: p.parameter_name || p.test_name,
    value: p.value,
    unit: p.unit,
    reference_range: p.reference_range || p.range,
    min: p.min,
    max: p.max,
    status: p.status
  }));

  // STEP 11 — STRICT OUTPUT
  return {
    parameters: formattedParameters,
    summary,
    abnormal_parameters,
    predictions,
    recommendations,
    skin_analysis: skinResult,
    alert
  };
};

module.exports = { analyzeReport };
