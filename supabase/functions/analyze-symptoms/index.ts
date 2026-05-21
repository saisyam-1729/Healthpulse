import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SymptomInput {
  headache: boolean;
  chest_pain: boolean;
  body_pain: boolean;
  fever: boolean;
  cold: boolean;
  fatigue: boolean;
  stomach_pain: boolean;
  nausea: boolean;
  cough: boolean;
  heart_rate?: number;
}

interface Condition {
  name: string;
  risk: string;
  description: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const symptoms: SymptomInput = await req.json();
    const conditions: Condition[] = [];

    // Rule-based symptom analysis
    if (symptoms.headache && symptoms.nausea) {
      conditions.push({ name: "Migraine", risk: "moderate", description: "Recurring headache with nausea may indicate migraine." });
    }

    if (symptoms.chest_pain && symptoms.heart_rate && symptoms.heart_rate > 100) {
      conditions.push({ name: "Cardiac Risk", risk: "high", description: "Chest pain with elevated heart rate requires immediate attention." });
    }

    if (symptoms.cold && symptoms.cough && symptoms.fever) {
      conditions.push({ name: "Flu / Respiratory Infection", risk: "moderate", description: "Cold, cough and fever combination suggests flu or respiratory infection." });
    }

    if (symptoms.fever && symptoms.body_pain && symptoms.fatigue) {
      conditions.push({ name: "Viral Infection", risk: "moderate", description: "Fever with body pain and fatigue may indicate a viral infection." });
    }

    if (symptoms.stomach_pain && symptoms.nausea) {
      conditions.push({ name: "Gastric Issue", risk: "low", description: "Stomach pain with nausea may indicate gastric distress." });
    }

    if (symptoms.chest_pain && symptoms.fatigue) {
      conditions.push({ name: "Cardiovascular Concern", risk: "high", description: "Chest pain combined with fatigue warrants cardiac evaluation." });
    }

    if (symptoms.headache && symptoms.fever) {
      conditions.push({ name: "Possible Infection", risk: "moderate", description: "Headache with fever may indicate an underlying infection." });
    }

    // Calculate overall risk
    const riskLevels = conditions.map(c => c.risk);
    let overallRisk = "low";
    if (riskLevels.includes("high")) overallRisk = "high";
    else if (riskLevels.includes("moderate")) overallRisk = "moderate";

    // Recommendations
    const recommendations: string[] = [];
    if (overallRisk === "high") {
      recommendations.push("Seek immediate medical attention.");
      recommendations.push("Contact your emergency contact.");
    } else if (overallRisk === "moderate") {
      recommendations.push("Monitor symptoms closely.");
      recommendations.push("Schedule a doctor visit if symptoms persist.");
      recommendations.push("Stay hydrated and rest.");
    } else {
      recommendations.push("Continue monitoring your health.");
      recommendations.push("Maintain a healthy lifestyle.");
    }

    return new Response(JSON.stringify({
      conditions,
      overall_risk: overallRisk,
      recommendations,
      symptom_count: Object.values(symptoms).filter(v => v === true).length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
