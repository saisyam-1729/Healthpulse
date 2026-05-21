import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Extract all text from a PDF file
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

// Normal ranges for common blood test parameters
const NORMAL_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  "Hemoglobin": { min: 12, max: 17.5, unit: "g/dL" },
  "RBC Count": { min: 4.0, max: 6.0, unit: "million/µL" },
  "WBC Count": { min: 4000, max: 11000, unit: "/µL" },
  "Platelet Count": { min: 150000, max: 400000, unit: "/µL" },
  "Hematocrit": { min: 36, max: 54, unit: "%" },
  "MCV": { min: 80, max: 100, unit: "fL" },
  "MCH": { min: 27, max: 33, unit: "pg" },
  "MCHC": { min: 32, max: 36, unit: "g/dL" },
  "ESR": { min: 0, max: 20, unit: "mm/hr" },
  "Fasting Blood Sugar": { min: 70, max: 100, unit: "mg/dL" },
  "Random Blood Sugar": { min: 70, max: 140, unit: "mg/dL" },
  "HbA1c": { min: 4, max: 5.6, unit: "%" },
  "Total Cholesterol": { min: 0, max: 200, unit: "mg/dL" },
  "HDL Cholesterol": { min: 40, max: 60, unit: "mg/dL" },
  "LDL Cholesterol": { min: 0, max: 100, unit: "mg/dL" },
  "Triglycerides": { min: 0, max: 150, unit: "mg/dL" },
  "VLDL": { min: 5, max: 40, unit: "mg/dL" },
  "Creatinine": { min: 0.6, max: 1.2, unit: "mg/dL" },
  "Blood Urea": { min: 15, max: 40, unit: "mg/dL" },
  "BUN": { min: 7, max: 20, unit: "mg/dL" },
  "Uric Acid": { min: 3.5, max: 7.2, unit: "mg/dL" },
  "SGOT (AST)": { min: 5, max: 40, unit: "U/L" },
  "SGPT (ALT)": { min: 7, max: 56, unit: "U/L" },
  "Alkaline Phosphatase": { min: 44, max: 147, unit: "U/L" },
  "Total Bilirubin": { min: 0.1, max: 1.2, unit: "mg/dL" },
  "Direct Bilirubin": { min: 0, max: 0.3, unit: "mg/dL" },
  "Total Protein": { min: 6.0, max: 8.3, unit: "g/dL" },
  "Albumin": { min: 3.5, max: 5.5, unit: "g/dL" },
  "Globulin": { min: 2.0, max: 3.5, unit: "g/dL" },
  "TSH": { min: 0.4, max: 4.0, unit: "µIU/mL" },
  "T3": { min: 80, max: 200, unit: "ng/dL" },
  "T4": { min: 4.5, max: 12, unit: "µg/dL" },
  "Calcium": { min: 8.5, max: 10.5, unit: "mg/dL" },
  "Sodium": { min: 136, max: 145, unit: "mEq/L" },
  "Potassium": { min: 3.5, max: 5.0, unit: "mEq/L" },
  "Iron": { min: 60, max: 170, unit: "µg/dL" },
  "Vitamin D": { min: 30, max: 100, unit: "ng/mL" },
  "Vitamin B12": { min: 200, max: 900, unit: "pg/mL" },
  "CRP": { min: 0, max: 10, unit: "mg/L" },
};

// Regex patterns matching common blood report text formats
const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "Hemoglobin", regex: /(?:haemoglobin|hemoglobin|hgb|hb)\s*[:\-]?\s*([\d.]+)/i },
  { name: "RBC Count", regex: /(?:rbc|red blood cell|erythrocyte)\s*(?:count)?\s*[:\-]?\s*([\d.]+)/i },
  { name: "WBC Count", regex: /(?:wbc|white blood cell|leucocyte|leukocyte)\s*(?:count)?\s*[:\-]?\s*([\d.,]+)/i },
  { name: "Platelet Count", regex: /(?:platelet|plt)\s*(?:count)?\s*[:\-]?\s*([\d.,]+)/i },
  { name: "Hematocrit", regex: /(?:hematocrit|haematocrit|hct|pcv)\s*[:\-]?\s*([\d.]+)/i },
  { name: "MCV", regex: /(?:mcv|mean corpuscular volume)\s*[:\-]?\s*([\d.]+)/i },
  { name: "MCH", regex: /(?:mch|mean corpuscular hemo)\s*[:\-]?\s*([\d.]+)/i },
  { name: "MCHC", regex: /(?:mchc)\s*[:\-]?\s*([\d.]+)/i },
  { name: "ESR", regex: /(?:esr|erythrocyte sedimentation)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Fasting Blood Sugar", regex: /(?:fasting.*(?:sugar|glucose)|fbs|fbg)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Random Blood Sugar", regex: /(?:random.*(?:sugar|glucose)|rbs|rbg|blood sugar|blood glucose)\s*[:\-]?\s*([\d.]+)/i },
  { name: "HbA1c", regex: /(?:hba1c|glycated|glycosylated)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Total Cholesterol", regex: /(?:total cholesterol|cholesterol.*total)\s*[:\-]?\s*([\d.]+)/i },
  { name: "HDL Cholesterol", regex: /(?:hdl|high density)\s*[:\-]?\s*([\d.]+)/i },
  { name: "LDL Cholesterol", regex: /(?:ldl|low density)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Triglycerides", regex: /(?:triglycerides|tg|triglyceride)\s*[:\-]?\s*([\d.]+)/i },
  { name: "VLDL", regex: /(?:vldl)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Creatinine", regex: /(?:creatinine|creat)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Blood Urea", regex: /(?:blood urea|urea)\s*[:\-]?\s*([\d.]+)/i },
  { name: "BUN", regex: /(?:bun|blood urea nitrogen)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Uric Acid", regex: /(?:uric acid|uric)\s*[:\-]?\s*([\d.]+)/i },
  { name: "SGOT (AST)", regex: /(?:sgot|ast|aspartate)\s*[:\-]?\s*([\d.]+)/i },
  { name: "SGPT (ALT)", regex: /(?:sgpt|alt|alanine)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Alkaline Phosphatase", regex: /(?:alkaline phosphatase|alp|alk phos)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Total Bilirubin", regex: /(?:total bilirubin|bilirubin.*total|t[.\s-]?bil)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Direct Bilirubin", regex: /(?:direct bilirubin|bilirubin.*direct|d[.\s-]?bil)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Total Protein", regex: /(?:total protein)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Albumin", regex: /(?:albumin|alb)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Globulin", regex: /(?:globulin|glob)\s*[:\-]?\s*([\d.]+)/i },
  { name: "TSH", regex: /(?:tsh|thyroid stimulating)\s*[:\-]?\s*([\d.]+)/i },
  { name: "T3", regex: /(?:t3|triiodothyronine)\s*[:\-]?\s*([\d.]+)/i },
  { name: "T4", regex: /(?:t4|thyroxine)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Calcium", regex: /(?:calcium|ca)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Sodium", regex: /(?:sodium|na)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Potassium", regex: /(?:potassium|k)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Iron", regex: /(?:iron|serum iron|fe)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Vitamin D", regex: /(?:vitamin d|vit d|25.*hydroxy)\s*[:\-]?\s*([\d.]+)/i },
  { name: "Vitamin B12", regex: /(?:vitamin b12|vit b12|b12|cobalamin)\s*[:\-]?\s*([\d.]+)/i },
  { name: "CRP", regex: /(?:crp|c-reactive|c reactive)\s*[:\-]?\s*([\d.]+)/i },
];

export interface ParsedResult {
  name: string;
  value: number;
  unit: string;
  normalRange: string;
  status: "normal" | "low" | "high";
}

/**
 * Parse extracted text and find blood test values
 */
export function parseBloodReport(text: string): ParsedResult[] {
  const results: ParsedResult[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    const match = text.match(pattern.regex);
    if (match && !seen.has(pattern.name)) {
      const rawValue = match[1].replace(/,/g, "");
      const value = parseFloat(rawValue);
      if (isNaN(value)) continue;

      const range = NORMAL_RANGES[pattern.name];
      if (!range) continue;

      let status: "normal" | "low" | "high" = "normal";
      if (value < range.min) status = "low";
      else if (value > range.max) status = "high";

      results.push({
        name: pattern.name,
        value,
        unit: range.unit,
        normalRange: `${range.min} - ${range.max}`,
        status,
      });

      seen.add(pattern.name);
    }
  }

  return results;
}
